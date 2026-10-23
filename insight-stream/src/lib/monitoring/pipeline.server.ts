import type { FeedFilters, FeedResult } from "./types";
import type { TenantContext } from "../security/tenant.server";

/**
 * Full monitoring pipeline: cache lookup -> live collection -> AI enrichment ->
 * analytics -> archive persistence. Everything here is server-only.
 */
export async function runFeedPipeline(filters: FeedFilters, useAi: boolean, tenant: TenantContext): Promise<FeedResult> {
  const { collectFeed } = await import("./sources.server");
  const { buildAnalytics } = await import("./analysis.server");
  const { cacheKeyFor, readCache, writeCache, persistItems } = await import("./archive.server");

  const cacheKey = cacheKeyFor({ ...filters, ai: useAi, provider: tenant.org.provider });
  const cached = await readCache(cacheKey, tenant);
  if (cached) return { ...cached, cached: true };

  const { items, sources } = await collectFeed(filters, tenant);

  if (useAi && items.length) {
    const { classifyItems } = await import("./ai.server");
    const labels = await classifyItems(items, 60);
    for (const item of items) {
      const label = labels.get(item.id);
      if (!label) continue;
      item.aiSentiment = label.sentiment;
      item.topic = label.topic;
      item.sentiment = label.sentiment;
    }
  }

  const result: FeedResult = {
    query: filters.query ?? "",
    items,
    analytics: buildAnalytics(items),
    sources,
    fetchedAt: new Date().toISOString(),
    aiEnriched: useAi && items.some((i) => i.aiSentiment),
    cached: false,
  };

  // Persist without blocking the response longer than necessary.
  await persistItems(items, filters.query ?? "", tenant);
  await writeCache(cacheKey, result, 300, tenant);

  return result;
}

export async function getBrief(filters: FeedFilters, tenant: TenantContext) {
  const { collectFeed } = await import("./sources.server");
  const { buildDailyBrief } = await import("./ai.server");
  const { cacheKeyFor, readCache } = await import("./archive.server");

  const cached = await readCache(cacheKeyFor({ ...filters, ai: true, provider: tenant.org.provider }), tenant);
  const items = cached?.items ?? (await collectFeed(filters, tenant)).items;
  return await buildDailyBrief(items, filters.query ?? "");
}