import { boundedText, trustedFetch, mapLimited, validateCustomRead } from "../security/http.server";
import { validatePublicUrl } from "../security/safe-url";
import type { TenantContext } from "../security/tenant.server";
import { automatioEnabled, searchAutomatio } from "./automatio.server";
import { analyzeSentiment } from "./analysis.server";
import type { FeedItem, FeedFilters, SourceStatus } from "./types";
import { ID_MEDIA, ID_MEDIA_VIA_GOOGLE, isIndonesianContext, isMajorIdDomain, STOPWORDS } from "./indonesia";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch with one retry on transient failures (429/5xx/timeout). */
async function request(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await trustedFetch(url, init, timeoutMs);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await sleep(900);
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

async function getJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 12000): Promise<T> {
  const res = await request(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers } }, timeoutMs);
  const text = await boundedText(res);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid source response");
  }
}

async function getText(url: string, timeoutMs = 12000): Promise<string> {
  const res = await request(
    url,
    { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" } },
    timeoutMs,
  );
  return await boundedText(res);
}


function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapCdata(value: string): string {
  return stripHtml(value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, ""));
}

function tag(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? unwrapCdata(match[1]) : "";
}

function makeItem(partial: Omit<FeedItem, "id" | "sentiment" | "sentimentScore">): FeedItem {
  const { sentiment, score } = analyzeSentiment(`${partial.title}. ${partial.summary}`);
  return {
    ...partial,
    id: `${partial.sourceKey}:${partial.url}`,
    sentiment,
    sentimentScore: score,
  };
}

/* ----------------------------- News sources ------------------------------ */

function parseGoogleNewsRss(xml: string, lang: string, country: string, category: string | null): FeedItem[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks.slice(0, 60).map((block) => {
    const link = tag(block, "link");
    const source = tag(block, "source") || "Google News";
    const description = tag(block, "description");
    const pub = tag(block, "pubDate");
    return makeItem({
      kind: "news",
      title: tag(block, "title").replace(new RegExp(`\\s*-\\s*${source}$`), ""),
      summary: description.slice(0, 400),
      url: link,
      source,
      sourceKey: "google_news",
      author: source || null,
      imageUrl: null,
      language: lang,
      country,
      category,
      publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      engagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    });
  });
}

export async function fetchGoogleNews(filters: FeedFilters): Promise<FeedItem[]> {
  const idMode = isIndonesianContext(filters);
  const lang = filters.language && filters.language !== "all" ? filters.language : idMode ? "id" : "en";
  const country = (filters.country && filters.country !== "all" ? filters.country : idMode ? "ID" : "US").toUpperCase();
  const terms = [filters.query, filters.category].filter(Boolean).join(" ").trim();
  const q = encodeURIComponent(terms || (idMode ? "berita terkini" : "breaking news"));

  // Google News returns nothing when the query language does not match the
  // requested edition, so query the chosen edition plus sensible fallbacks.
  const locales: Array<[string, string]> = [[lang, country]];
  if (!(lang === "id" && country === "ID")) locales.push(["id", "ID"]);
  if (!(lang === "en" && country === "US")) locales.push(["en", "US"]);

  const items: FeedItem[] = [];
  let lastError: unknown;
  for (const [l, c] of locales) {
    try {
      const xml = await getText(`https://news.google.com/rss/search?q=${q}&hl=${l}-${c}&gl=${c}&ceid=${c}:${l}`);
      items.push(...parseGoogleNewsRss(xml, l, c, filters.category ?? null));
    } catch (error) {
      lastError = error;
      continue;
    }
    if (items.length >= 15) break;
  }

  if (!items.length && lastError) throw lastError instanceof Error ? lastError : new Error("Google News unavailable");
  return items;
}


interface GdeltArticle {
  url: string;
  title: string;
  domain: string;
  seendate: string;
  socialimage?: string;
  language?: string;
  sourcecountry?: string;
}

export async function fetchGdelt(filters: FeedFilters): Promise<FeedItem[]> {
  const raw = [filters.query, filters.category].filter(Boolean).join(" ").trim() || "breaking news";
  // GDELT rejects queries shorter than 3 characters and needs phrases quoted.
  if (raw.replace(/\s+/g, "").length < 3) return [];
  const terms = /\s/.test(raw) ? `"${raw.replace(/"/g, "")}"` : raw;
  const params = new URLSearchParams({
    query: terms,
    mode: "ArtList",
    format: "json",
    maxrecords: "75",
    sort: "DateDesc",
    timespan: `${Math.max(1, Math.min(168, filters.sinceHours ?? 24))}h`,
  });
  const data = await getJson<{ articles?: GdeltArticle[] }>(
    `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`,
  );

  return (data.articles ?? []).map((a) => {
    const seen = a.seendate;
    const iso = /^\d{8}T\d{6}Z$/.test(seen)
      ? `${seen.slice(0, 4)}-${seen.slice(4, 6)}-${seen.slice(6, 8)}T${seen.slice(9, 11)}:${seen.slice(11, 13)}:${seen.slice(13, 15)}Z`
      : new Date().toISOString();
    return makeItem({
      kind: "news",
      title: stripHtml(a.title ?? ""),
      summary: "",
      url: a.url,
      source: a.domain ?? "GDELT",
      sourceKey: "gdelt",
      author: a.domain ?? null,
      imageUrl: a.socialimage ?? null,
      language: (a.language ?? "").slice(0, 2).toLowerCase() || null,
      country: a.sourcecountry ?? null,
      category: filters.category ?? null,
      publishedAt: iso,
      engagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    });
  });
}

export async function fetchNewsApi(filters: FeedFilters, apiKey: string): Promise<FeedItem[]> {
  const params = new URLSearchParams({
    q: [filters.query, filters.category].filter(Boolean).join(" ") || "breaking news",
    pageSize: "60",
    sortBy: "publishedAt",
    language: filters.language || "en",
  });
  const data = await getJson<{
    status: string;
    message?: string;
    articles?: Array<{
      title: string;
      description: string | null;
      url: string;
      urlToImage: string | null;
      publishedAt: string;
      author: string | null;
      source: { name: string };
    }>;
  }>(`https://newsapi.org/v2/everything?${params.toString()}`, { "X-Api-Key": apiKey });

  if (data.status !== "ok") throw new Error(data.message ?? "NewsAPI error");

  return (data.articles ?? []).map((a) =>
    makeItem({
      kind: "news",
      title: stripHtml(a.title ?? ""),
      summary: stripHtml(a.description ?? "").slice(0, 400),
      url: a.url,
      source: a.source?.name ?? "NewsAPI",
      sourceKey: "newsapi",
      author: a.author ?? a.source?.name ?? null,
      imageUrl: a.urlToImage,
      language: filters.language || "en",
      country: filters.country ?? null,
      category: filters.category ?? null,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      engagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    }),
  );
}

export async function fetchCustomRss(url: string, meta?: { name?: string; sourceKey?: string; language?: string; country?: string }): Promise<FeedItem[]> {
  if (!ID_MEDIA.some(m => m.url === url)) await validateCustomRead(url);
  const xml = await getText(url);
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/g) ?? [];
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "RSS";
    }
  })();

  return blocks.slice(0, 50).map((block) => {
    const link = tag(block, "link") || (block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? url);
    const pub = tag(block, "pubDate") || tag(block, "updated") || tag(block, "published");
    return makeItem({
      kind: "news",
      title: tag(block, "title"),
      summary: (tag(block, "description") || tag(block, "summary") || tag(block, "content")).slice(0, 400),
      url: link,
      source: meta?.name ?? host,
      sourceKey: meta?.sourceKey ?? "rss",
      author: tag(block, "author") || tag(block, "dc:creator") || meta?.name || host,
      imageUrl: block.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] ?? null,
      language: meta?.language ?? null,
      country: meta?.country ?? null,
      category: null,
      publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      engagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    });
  });
}

/* ---------------------------- Social sources ----------------------------- */

export async function fetchReddit(filters: FeedFilters): Promise<FeedItem[]> {
  const q = encodeURIComponent(filters.query || "news");
  const path = `/search.json?q=${q}&sort=new&limit=60&t=week&raw_json=1`;
  const hosts = ["https://www.reddit.com", "https://old.reddit.com", "https://api.reddit.com"];
  type RedditResponse = { data?: { children?: Array<{ data: Record<string, unknown> }> } };
  let data: RedditResponse | undefined;
  let lastError: unknown;
  for (const host of hosts) {
    try {
      data = await getJson<RedditResponse>(`${host}${path}`);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!data) throw lastError instanceof Error ? lastError : new Error("Reddit unavailable");


  return (data.data?.children ?? []).map((child) => {
    const p = child.data as {
      title: string;
      selftext?: string;
      permalink: string;
      author: string;
      subreddit_name_prefixed: string;
      created_utc: number;
      score: number;
      num_comments: number;
      thumbnail?: string;
      url_overridden_by_dest?: string;
    };
    const likes = Number(p.score ?? 0);
    const comments = Number(p.num_comments ?? 0);
    return makeItem({
      kind: "social",
      title: stripHtml(p.title ?? ""),
      summary: stripHtml(p.selftext ?? "").slice(0, 400),
      url: `https://www.reddit.com${p.permalink}`,
      source: p.subreddit_name_prefixed ?? "Reddit",
      sourceKey: "reddit",
      author: p.author ? `u/${p.author}` : null,
      imageUrl: p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : null,
      language: null,
      country: null,
      category: null,
      publishedAt: new Date((p.created_utc ?? Date.now() / 1000) * 1000).toISOString(),
      engagement: likes + comments,
      likes,
      comments,
      shares: 0,
    });
  });
}

export async function fetchBluesky(filters: FeedFilters): Promise<FeedItem[]> {
  const q = encodeURIComponent(filters.query || "news");
  const data = await getJson<{
    posts?: Array<{
      uri: string;
      author: { handle: string; displayName?: string; avatar?: string };
      record: { text?: string; createdAt?: string; langs?: string[] };
      likeCount?: number;
      replyCount?: number;
      repostCount?: number;
      indexedAt?: string;
    }>;
  }>(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${q}&limit=50&sort=latest`);

  return (data.posts ?? []).map((p) => {
    const text = stripHtml(p.record?.text ?? "");
    const rkey = p.uri.split("/").pop();
    const likes = p.likeCount ?? 0;
    const comments = p.replyCount ?? 0;
    const shares = p.repostCount ?? 0;
    return makeItem({
      kind: "social",
      title: text.slice(0, 140) || "(no text)",
      summary: text,
      url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
      source: "Bluesky",
      sourceKey: "bluesky",
      author: p.author.displayName ? `${p.author.displayName} (@${p.author.handle})` : `@${p.author.handle}`,
      imageUrl: p.author.avatar ?? null,
      language: p.record?.langs?.[0] ?? null,
      country: null,
      category: null,
      publishedAt: p.record?.createdAt ?? p.indexedAt ?? new Date().toISOString(),
      engagement: likes + comments + shares,
      likes,
      comments,
      shares,
    });
  });
}

export async function fetchMastodon(filters: FeedFilters): Promise<FeedItem[]> {
  const raw = (filters.query || "news").trim();
  const tagName = raw.split(/\s+/)[0].replace(/[^\p{L}\p{N}]/gu, "").toLowerCase() || "news";
  const data = await getJson<
    Array<{
      id: string;
      url: string;
      uri: string;
      content: string;
      created_at: string;
      language?: string;
      favourites_count?: number;
      replies_count?: number;
      reblogs_count?: number;
      account: { acct: string; display_name?: string; avatar?: string };
    }>
  >(`https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(tagName)}?limit=40`);

  return (data ?? []).map((s) => {
    const text = stripHtml(s.content ?? "");
    const likes = s.favourites_count ?? 0;
    const comments = s.replies_count ?? 0;
    const shares = s.reblogs_count ?? 0;
    return makeItem({
      kind: "social",
      title: text.slice(0, 140) || "(no text)",
      summary: text,
      url: s.url || s.uri,
      source: "Mastodon",
      sourceKey: "mastodon",
      author: s.account?.display_name ? `${s.account.display_name} (@${s.account.acct})` : `@${s.account?.acct}`,
      imageUrl: s.account?.avatar ?? null,
      language: s.language ?? null,
      country: null,
      category: null,
      publishedAt: s.created_at ?? new Date().toISOString(),
      engagement: likes + comments + shares,
      likes,
      comments,
      shares,
    });
  });
}

export async function fetchYouTube(filters: FeedFilters, apiKey: string): Promise<FeedItem[]> {
  const params = new URLSearchParams({
    part: "snippet",
    q: filters.query || "news",
    type: "video",
    order: "date",
    maxResults: "25",
    key: apiKey,
  });
  const search = await getJson<{
    items?: Array<{
      id: { videoId: string };
      snippet: { title: string; description: string; publishedAt: string; channelTitle: string; thumbnails?: { medium?: { url: string } } };
    }>;
  }>(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);

  const ids = (search.items ?? []).map((i) => i.id?.videoId).filter(Boolean);
  let stats: Record<string, { viewCount?: string; likeCount?: string; commentCount?: string }> = {};
  if (ids.length) {
    try {
      const statsRes = await getJson<{
        items?: Array<{ id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }>;
      }>(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}&key=${apiKey}`);
      stats = Object.fromEntries((statsRes.items ?? []).map((i) => [i.id, i.statistics]));
    } catch {
      stats = {};
    }
  }

  return (search.items ?? []).map((i) => {
    const s = stats[i.id.videoId] ?? {};
    const likes = Number(s.likeCount ?? 0);
    const comments = Number(s.commentCount ?? 0);
    const views = Number(s.viewCount ?? 0);
    return makeItem({
      kind: "social",
      title: stripHtml(i.snippet.title),
      summary: stripHtml(i.snippet.description ?? ""),
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
      source: "YouTube",
      sourceKey: "youtube",
      author: i.snippet.channelTitle,
      imageUrl: i.snippet.thumbnails?.medium?.url ?? null,
      language: null,
      country: null,
      category: null,
      publishedAt: i.snippet.publishedAt,
      engagement: likes + comments + Math.round(views / 100),
      likes,
      comments,
      shares: 0,
    });
  });
}

/* ------------- Public social web (Instagram / Threads / X / Facebook) ------------- */
/* No API keys: reads publicly indexed posts through DuckDuckGo's HTML endpoint.      */

export const PUBLIC_SOCIAL_SITES = [
  { key: "instagram", name: "Instagram", site: "instagram.com" },
  { key: "threads", name: "Threads", site: "threads.net" },
  { key: "x", name: "X (Twitter)", site: "x.com" },
  { key: "facebook", name: "Facebook", site: "facebook.com" },
] as const;

const HANDLE_BLOCKLIST = new Set([
  "p", "reel", "reels", "explore", "stories", "tv", "accounts", "status", "i", "hashtag", "search",
  "watch", "groups", "pages", "photo", "events", "media", "share", "profile.php", "permalink.php",
]);

function parseCount(snippet: string, ...labels: string[]): number {
  for (const label of labels) {
    const match = snippet.match(new RegExp(`([\\d.,]+)\\s*([KMkm])?\\s*${label}`, "i"));
    if (!match) continue;
    const raw = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(raw)) continue;
    const unit = match[2]?.toLowerCase();
    return Math.round(raw * (unit === "m" ? 1_000_000 : unit === "k" ? 1_000 : 1));
  }
  return 0;
}

function handleFrom(url: string, title: string): string | null {
  const fromTitle = title.match(/@([A-Za-z0-9._]{2,30})/);
  if (fromTitle) return `@${fromTitle[1]}`;
  try {
    const segment = new URL(url).pathname.split("/").filter(Boolean)[0];
    if (segment && !HANDLE_BLOCKLIST.has(segment.toLowerCase()) && /^[A-Za-z0-9._-]{2,40}$/.test(segment)) {
      return `@${segment}`;
    }
  } catch {
    /* ignore malformed urls */
  }
  return null;
}

interface WebResult {
  url: string;
  title: string;
  snippet: string;
}

/** Brave Search HTML — no API key, publicly indexed pages only. */
async function braveResults(query: string): Promise<WebResult[]> {
  const res = await request(
    `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9,id;q=0.8" } },
    16000,
  );
  const html = await boundedText(res);
  const out: WebResult[] = [];
  for (const block of html.split('<div class="snippet ').slice(1)) {
    const href = block.match(/<a href="(https?:\/\/[^"]+)"/)?.[1];
    if (!href) continue;
    const title = stripHtml(block.match(/class="[^"]*search-snippet-title[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const snippet = stripHtml(block.match(/class="content [^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    if (!title) continue;
    out.push({ url: href.replace(/&amp;/g, "&"), title, snippet });
  }
  return out;
}

/** Fallback reader proxy over DuckDuckGo when Brave is unavailable. */
async function readerFallbackResults(query: string): Promise<WebResult[]> {
  const res = await request(
    `https://r.jina.ai/https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": UA, Accept: "text/plain" } },
    18000,
  );
  const text = await boundedText(res);
  const out: WebResult[] = [];
  const pattern = /\[([^\]]{4,200})\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    out.push({ title: stripHtml(match[1]), url: match[2], snippet: stripHtml(text.slice(match.index + match[0].length, match.index + match[0].length + 300)) });
  }
  return out;
}

async function webSearch(query: string): Promise<WebResult[]> {
  try {
    const brave = await braveResults(query);
    if (brave.length) return brave;
  } catch {
    /* fall through to reader proxy */
  }
  return await readerFallbackResults(query);
}

export async function fetchPublicSocialSite(
  filters: FeedFilters,
  platform: { key: string; name: string; site: string },
): Promise<FeedItem[]> {
  const query = (filters.query || "viral").trim();
  const results = await webSearch(`site:${platform.site} ${query}`);
  const items: FeedItem[] = [];
  for (const result of results.slice(0, 25)) {
    if (!result.url.toLowerCase().includes(platform.site)) continue;
    const author = handleFrom(result.url, result.title);
    const likes = parseCount(result.snippet, "likes", "suka", "me gusta");
    const comments = parseCount(result.snippet, "comments", "komentar", "replies", "balasan", "comentarios");
    const shares = parseCount(result.snippet, "shares", "reposts", "retweets");
    const followers = parseCount(result.snippet, "followers", "pengikut", "seguidores", "seguidores");
    const dateMatch = result.snippet.match(/\b([A-Z][a-z]{2}\s\d{1,2},\s\d{4})\b/);
    items.push(
      makeItem({
        kind: "social",
        title: result.title.slice(0, 220),
        summary: result.snippet.slice(0, 400),
        url: result.url,
        source: platform.name,
        sourceKey: platform.key,
        author,
        imageUrl: null,
        language: filters.language && filters.language !== "all" ? filters.language : null,
        country: null,
        category: null,
        publishedAt: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
        engagement: likes + comments + shares + Math.round(followers / 100),
        likes,
        comments,
        shares,
      }),
    );
  }
  return items;
}



export async function fetchIndonesianMedia(filters: FeedFilters): Promise<FeedItem[]> {
  const jobs = [...ID_MEDIA.map(m => () => fetchCustomRss(m.url, {name:m.name,sourceKey:"id_media",language:"id",country:"ID"})), () => fetchIdMajorViaGoogleNews(filters)];
  const results = await mapLimited(jobs, 3, async job => {try{return {status:"fulfilled" as const,value:await job()};}catch{return {status:"rejected" as const,value:[]};}});
  const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!items.length) throw new Error("Semua feed media Indonesia tidak dapat diakses");
  return items;
}

/** Mirrors major Indonesian outlets that block direct RSS, via Google News site: search. */
export async function fetchIdMajorViaGoogleNews(filters: FeedFilters): Promise<FeedItem[]> {
  const sites = ID_MEDIA_VIA_GOOGLE.map((d) => `site:${d}`).join(" OR ");
  const terms = [filters.query, filters.category].filter(Boolean).join(" ").trim();
  const q = encodeURIComponent(terms ? `${terms} (${sites})` : `(${sites})`);
  const xml = await getText(
    `https://news.google.com/rss/search?q=${q}&hl=id-ID&gl=ID&ceid=ID:id`,
  );
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks.slice(0, 80).map((block) => {
    const source = tag(block, "source") || "Media Indonesia";
    const title = tag(block, "title").replace(new RegExp(`\\s*-\\s*${source}$`), "");
    const pub = tag(block, "pubDate");
    return makeItem({
      kind: "news",
      title,
      summary: tag(block, "description").slice(0, 400),
      url: tag(block, "link"),
      source,
      sourceKey: "id_media",
      author: source,
      imageUrl: null,
      language: "id",
      country: "ID",
      category: filters.category ?? null,
      publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      engagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    });
  });
}

/* ------------------------------ Orchestrator ----------------------------- */

interface Loader {
  key: string;
  name: string;
  kind: "news" | "social";
  requiresKey: boolean;
  configured: boolean;
  run: () => Promise<FeedItem[]>;
}

export async function collectFeed(filters: FeedFilters, tenant: TenantContext): Promise<{ items: FeedItem[]; sources: SourceStatus[] }> {
  const newsApiKey = process.env.NEWS_API_KEY?.trim();
  const youtubeKey = process.env.YOUTUBE_API_KEY?.trim();
  const extraRss = (process.env.EXTRA_RSS_FEEDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const wantNews = filters.kind !== "social";
  const wantSocial = filters.kind !== "news";

  const loaders: Loader[] = [];

  if (wantNews) {
    loaders.push(
      { key: "google_news", name: "Google News RSS", kind: "news", requiresKey: false, configured: true, run: () => fetchGoogleNews(filters) },
      { key: "gdelt", name: "GDELT", kind: "news", requiresKey: false, configured: true, run: () => fetchGdelt(filters) },
      {
        key: "newsapi",
        name: "NewsAPI",
        kind: "news",
        requiresKey: true,
        configured: Boolean(newsApiKey),
        run: () => (newsApiKey ? fetchNewsApi(filters, newsApiKey) : Promise.resolve([])),
      },
    );
    if (isIndonesianContext(filters)) {
      loaders.push({
        key: "id_media",
        name: "Media Besar Indonesia",
        kind: "news",
        requiresKey: false,
        configured: true,
        run: () => fetchIndonesianMedia(filters),
      });
    }
    extraRss.forEach((feedUrl, index) => {
      loaders.push({
        key: `rss_${index}`,
        name: `RSS: ${feedUrl.replace(/^https?:\/\//, "").slice(0, 32)}`,
        kind: "news",
        requiresKey: false,
        configured: true,
        run: () => fetchCustomRss(feedUrl),
      });
    });
  }

  if (wantSocial) {
    loaders.push(
      { key: "reddit", name: "Reddit", kind: "social", requiresKey: false, configured: true, run: () => fetchReddit(filters) },
      { key: "bluesky", name: "Bluesky", kind: "social", requiresKey: false, configured: true, run: () => fetchBluesky(filters) },
      { key: "mastodon", name: "Mastodon", kind: "social", requiresKey: false, configured: true, run: () => fetchMastodon(filters) },
      {
        key: "youtube",
        name: "YouTube",
        kind: "social",
        requiresKey: true,
        configured: Boolean(youtubeKey),
        run: () => (youtubeKey ? fetchYouTube(filters, youtubeKey) : Promise.resolve([])),
      },
    );
    for (const platform of PUBLIC_SOCIAL_SITES) {
      loaders.push({
        key: platform.key,
        name: platform.name,
        kind: "social",
        requiresKey: false,
        configured: true,
        run: () => fetchPublicSocialSite(filters, platform),
      });
    }

  }

  if (wantNews && tenant.org.provider !== "existing") loaders.push({key:"automatio",name:"Automatio web search",kind:"news",requiresKey:true,configured:automatioEnabled(),run:()=>searchAutomatio(tenant,filters)});
  const settled = await mapLimited(
    loaders, 3, async (loader): Promise<{ status: SourceStatus; items: FeedItem[] }> => {
      if (loader.requiresKey && !loader.configured) {
        return {
          items: [],
          status: {
            key: loader.key,
            name: loader.name,
            kind: loader.kind,
            ok: false,
            count: 0,
            requiresKey: true,
            configured: false,
            message: "API key not configured",
          },
        };
      }
      try {
        const items = await loader.run();
        return {
          items,
          status: { key: loader.key, name: loader.name, kind: loader.kind, ok: true, count: items.length, requiresKey: loader.requiresKey, configured: true },
        };
      } catch (error) {
        return {
          items: [],
          status: {
            key: loader.key,
            name: loader.name,
            kind: loader.kind,
            ok: false,
            count: 0,
            requiresKey: loader.requiresKey,
            configured: loader.configured,
            message: "Source unavailable or restricted",
          },
        };
      }
    },
  );

  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const entry of settled) {
    for (const item of entry.items) {
      if (!item.url || !item.title || !Number.isFinite(Date.parse(item.publishedAt))) continue;
      try {item.url = validatePublicUrl(item.url).href;} catch {continue;}
      const dedupeKey = item.url.split("?")[0].toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      items.push(item);
    }
  }

  const since = Date.now() - (filters.sinceHours ?? 168) * 3600 * 1000;
  const idMode = isIndonesianContext(filters);

  const {
    parseQuery,
    indexItem,
    buildIdf,
    matchItem,
    titleSignature,
    tokenize,
    stem: stemWord,
  } = await import("./relevance.server");

  const query = parseQuery(filters.query ?? "");

  // Hard filters first (time window, facet filters).
  const base = items.filter((item) => {
    if (new Date(item.publishedAt).getTime() < since) return false;
    if (filters.sentiment && filters.sentiment !== "all" && item.sentiment !== filters.sentiment) return false;
    if (filters.source && filters.source !== "all" && item.sourceKey !== filters.source) return false;
    if (filters.language && filters.language !== "all" && item.language && item.language !== filters.language) return false;
    if (filters.country && filters.country !== "all" && item.country && item.country.toUpperCase() !== filters.country.toUpperCase()) return false;
    return true;
  });

  const indexes = new Map<string, ReturnType<typeof indexItem>>();
  for (const item of base) indexes.set(item.id, indexItem(item));

  const idf = buildIdf([...indexes.values()], query);
  const matches = new Map<string, ReturnType<typeof matchItem>>();
  for (const item of base) {const index=indexes.get(item.id);if(index)matches.set(item.id,matchItem(index,query,idf));}

  // Relevance gate: keep full-coverage hits; relax progressively only when the
  // stricter tier is too thin, so a real query never returns an empty screen.
  let filtered = base;
  if (!query.empty) {
    const allowed = base.filter((i) => matches.get(i.id)?.allowed && matches.get(i.id)?.phrasesOk);
    const pool = allowed.length ? allowed : base.filter((i) => matches.get(i.id)?.allowed);

    const tiers = [1, 0.75, 0.5, 0.34];
    filtered = pool;
    for (const tier of tiers) {
      const tierItems = pool.filter((i) => (matches.get(i.id)?.coverage ?? 0) >= tier);
      if (tierItems.length >= 8 || (tierItems.length && tier === tiers[tiers.length - 1])) {
        filtered = tierItems;
        break;
      }
      if (tierItems.length) filtered = tierItems;
    }
    // Never surface items with zero query signal when better matches exist.
    const withSignal = filtered.filter((i) => (matches.get(i.id)?.score ?? 0) > 0);
    if (withSignal.length) filtered = withSignal;
  }

  // Buzz: how often a distinctive stem recurs across the result set.
  const now = Date.now();
  const buzz = new Map<string, number>();
  for (const item of filtered) {
    const stems = new Set(
      tokenize(item.title)
        .filter((t) => t.length > 3 && !STOPWORDS.has(t))
        .map(stemWord),
    );
    for (const t of stems) buzz.set(t, (buzz.get(t) ?? 0) + 1);
  }

  function score(item: FeedItem): number {
    const m = matches.get(item.id);
    if (!m) return 0;
    const relevance = query.empty ? 0 : m.score * 2.2 + m.coverage * 30 + m.exactTitleHits * 4;
    const ageHours = Math.max(0, (now - new Date(item.publishedAt).getTime()) / 3_600_000);
    const freshness = 40 / (1 + ageHours / 6);
    const engagement = Math.log10(1 + item.engagement) * 8;
    const stems = new Set(
      tokenize(item.title)
        .filter((t) => t.length > 3 && !STOPWORDS.has(t))
        .map(stemWord),
    );
    let trending = 0;
    for (const t of stems) trending += Math.min(6, (buzz.get(t) ?? 1) - 1);
    const majorMedia = idMode && isMajorIdDomain(item.url, item.source) ? 25 : 0;
    // Penalise thin, title-only stubs which are usually aggregator noise.
    const thin = item.summary.trim().length < 40 ? -6 : 0;
    return relevance + freshness + engagement + trending * 1.5 + majorMedia + thin;
  }

  const ranked = [...filtered]
    .map((item) => ({ item, s: score(item) }))
    .sort((a, b) => b.s - a.s || new Date(b.item.publishedAt).getTime() - new Date(a.item.publishedAt).getTime());

  // Collapse near-duplicate coverage of the same story, keeping the best-ranked one.
  const seenStory = new Set<string>();
  const deduped: FeedItem[] = [];
  for (const { item } of ranked) {
    const sig = titleSignature(item.title);
    if (sig && seenStory.has(sig)) continue;
    if (sig) seenStory.add(sig);
    deduped.push(item);
  }

  return { items: deduped, sources: settled.map((s) => s.status) };
}