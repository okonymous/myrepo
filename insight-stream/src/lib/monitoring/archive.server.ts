import type { FeedItem, FeedResult, Sentiment } from "./types";
import type { TenantContext } from "../security/tenant.server";

/** Normalised key used to keep one row per story URL. */
function urlKey(url: string): string {
  return url.split("?")[0].replace(/\/$/, "").toLowerCase().slice(0, 500);
}

async function writer(tenant: TenantContext) {
 const {supabaseAdmin} = await import("@/integrations/supabase/client.server");
 return supabaseAdmin as unknown as typeof tenant.db;
}

/* --------------------------------- Cache --------------------------------- */

export function cacheKeyFor(input: Record<string, unknown>): string {
  const stable = Object.keys(input)
    .sort()
    .map((k) => `${k}=${String(input[k] ?? "")}`)
    .join("&");
  let hash = 0;
  for (let i = 0; i < stable.length; i += 1) {
    hash = (hash * 31 + stable.charCodeAt(i)) | 0;
  }
  return `feed:${Math.abs(hash).toString(36)}:${stable.length}`;
}

export async function readCache(key: string, tenant: TenantContext): Promise<FeedResult | null> {
  try {
    const db = tenant.db;
    const { data } = await db
      .from("tenant_feed_cache")
      .select("payload, expires_at")
      .eq("org_id", tenant.org.id)
      .eq("cache_key", key)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.payload as unknown as FeedResult;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, payload: FeedResult, ttlSeconds: number, tenant: TenantContext): Promise<void> {
  try {
    const db = await writer(tenant);
    await db.from("tenant_feed_cache").upsert(
      {
        org_id: tenant.org.id,
        cache_key: key,
        payload: payload as never,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: "org_id,cache_key" },
    );
    await db.from("tenant_feed_cache").delete().eq("org_id",tenant.org.id).lt("expires_at", new Date(Date.now() - 3_600_000).toISOString());
  } catch (error) {
    console.error("[archive] cache write failed:", "unavailable");
  }
}

/* --------------------------------- Archive -------------------------------- */

export async function persistItems(items: FeedItem[], keyword: string, tenant: TenantContext): Promise<void> {
  if (!items.length) return;
  try {
    const db = await writer(tenant);
    const now = new Date().toISOString();
    const keywords = keyword.trim() ? [keyword.trim().toLowerCase()] : [];

    const rows = items.slice(0, 300).map(item => ({org_id:tenant.org.id,url_key:urlKey(item.url),payload:item,last_seen_at:now}));
    const {error} = await db.from("tenant_monitored_items").upsert(rows,{onConflict:"org_id,url_key"});
    if(error) throw new Error("Archive write unavailable");
    await rollUpDaily(items, keyword, tenant);
  } catch (error) {
    console.error("[archive] persist failed:", "unavailable");
  }
}

async function rollUpDaily(items: FeedItem[], keyword: string, tenant: TenantContext): Promise<void> {
  const key = (keyword.trim() || "__all__").toLowerCase();
  const buckets = new Map<string, { total: number; positive: number; neutral: number; negative: number; engagement: number }>();

  for (const item of items) {
    const day = item.publishedAt.slice(0, 10);
    for (const kind of [item.kind, "all"]) {
      const id = `${day}|${kind}`;
      const bucket = buckets.get(id) ?? { total: 0, positive: 0, neutral: 0, negative: 0, engagement: 0 };
      bucket.total += 1;
      bucket[item.sentiment] += 1;
      bucket.engagement += item.engagement;
      buckets.set(id, bucket);
    }
  }

  const db = await writer(tenant);
  const rows = [...buckets.entries()].map(([id, b]) => {
    const [day, kind] = id.split("|");
    return { org_id: tenant.org.id, day, keyword: key, kind, ...b };
  });
  if (rows.length) await db.from("tenant_item_metrics_daily").upsert(rows, { onConflict: "org_id,day,keyword,kind" });
}

/* ------------------------------- Historical ------------------------------- */

export interface TrendPoint {
  day: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  engagement: number;
}

export async function readTrend(keyword: string, days: number, kind: string, tenant: TenantContext): Promise<TrendPoint[]> {
  try {
    const db = tenant.db;
    const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const { data } = await db
      .from("tenant_item_metrics_daily")
      .select("day, total, positive, neutral, negative, engagement")
      .eq("org_id",tenant.org.id)
      .eq("keyword", (keyword.trim() || "__all__").toLowerCase())
      .eq("kind", kind)
      .gte("day", from)
      .order("day", { ascending: true });

    return (data ?? []).map((row) => ({
      day: row.day,
      total: row.total,
      positive: row.positive,
      neutral: row.neutral,
      negative: row.negative,
      engagement: Number(row.engagement ?? 0),
    }));
  } catch (error) {
    console.error("[archive] trend read failed:", "unavailable");
    return [];
  }
}

export type { Sentiment };