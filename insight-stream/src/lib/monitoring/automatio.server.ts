import { getRequest } from "@tanstack/react-start/server";
import type { TenantContext } from "../security/tenant.server";
import { boundedText } from "../security/http.server";
import { parseSearchHits } from "./automatio-response";
import { analyzeSentiment } from "./analysis.server";
import type { FeedFilters, FeedItem } from "./types";

/** Automatio credentials and credit reservations are owned by the Supabase Edge Function.
 * Do not invoke the upstream Automatio API directly from the app server.
 */
export function automatioEnabled(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

export async function searchAutomatio(tenant: TenantContext, filters: FeedFilters): Promise<FeedItem[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase staging is not configured");
  const authorization = getRequest()?.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication required");
  const query = (filters.query ?? "").trim().slice(0, 180);
  if (!query) return [];
  const response = await fetch(new URL("/functions/v1/automatio-search", url), {
    method: "POST",
    headers: { Authorization: authorization, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ orgId: tenant.org.id, tool: "web_search", query }),
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  const body: unknown = JSON.parse(await boundedText(response, 350000));
  if (!response.ok) throw new Error("Automatio Edge Function unavailable or quota restricted");
  if (!body || typeof body !== "object" || !("result" in body)) throw new Error("Unexpected Automatio response");
  return parseSearchHits((body as { result: unknown }).result).map((hit): FeedItem => {
    const sentiment = analyzeSentiment(`${hit.title}. ${hit.snippet}`);
    return {
      id: `automatio:${hit.url}`, kind: "news", title: hit.title,
      summary: hit.snippet, url: hit.url, source: new URL(hit.url).hostname,
      sourceKey: "automatio", author: null, imageUrl: null, language: null,
      country: null, category: null,
      publishedAt: hit.publishedAt ?? new Date().toISOString(),
      sentiment: sentiment.sentiment, sentimentScore: sentiment.score,
      engagement: 0, likes: 0, comments: 0, shares: 0,
    };
  });
}

/** Arbitrary URL retrieval remains disabled pending an audited egress proxy. */
export async function readAutomatioUrl(_tenant: TenantContext, _url: string): Promise<never> {
  throw new Error("URL reading is disabled pending security review");
}
