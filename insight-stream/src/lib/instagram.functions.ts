import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface InstagramPost {
  id: string;
  url: string;
  caption: string;
  ownerUsername: string | null;
  ownerFullName: string | null;
  likesCount: number;
  commentsCount: number;
  timestamp: string | null;
  imageUrl: string | null;
  videoViewCount: number | null;
  type: string;
  hashtags: string[];
}

export interface InstagramProfile {
  username: string;
  fullName: string | null;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  biography: string;
  verified: boolean;
  url: string;
  profilePicUrl: string | null;
}

export interface InstagramScrapeResult {
  mode: "posts" | "hashtag" | "profile";
  posts: InstagramPost[];
  profiles: InstagramProfile[];
  totalItems: number;
  fetchedAt: string;
}

export const scrapeInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orgId: z.string().uuid().optional(),
        mode: z.enum(["posts", "hashtag", "profile"]).default("posts"),
        targets: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
        resultsLimit: z.number().int().min(1).max(50).default(12),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<InstagramScrapeResult> => {
    const {authorizeTenant,withTenantRequest} = await import("./security/tenant.server");
    const {boundedText} = await import("./security/http.server");
    const tenant = await authorizeTenant(context.supabase,context.userId,data.orgId);
    return withTenantRequest(tenant,"instagram",async () => {
    const token = process.env["APIFY_API_TOKEN"];
    if (!token) throw new Error("APIFY_API_TOKEN is not configured");

    const directUrls = data.targets.map((target) => {
      const cleaned = target.trim().replace(/^@/, "").replace(/\/+$/, "");
      const url = new URL(cleaned.startsWith("http") ? cleaned : `https://www.instagram.com/${cleaned}/`);
      if (!['instagram.com','www.instagram.com'].includes(url.hostname) || url.protocol !== 'https:' || url.username || url.password || url.port || !/^\/[A-Za-z0-9._]+\/?$/.test(url.pathname)) throw new Error("Invalid public Instagram account");
      return url.href;
    });

    const actorInput =
      data.mode === "hashtag"
        ? {
            search: data.targets[0].replace(/^#/, ""),
            searchType: "hashtag",
            resultsType: "posts",
            resultsLimit: data.resultsLimit,
            searchLimit: 1,
            addParentData: false,
          }
        : {
            directUrls,
            resultsType: data.mode === "profile" ? "details" : "posts",
            resultsLimit: data.resultsLimit,
            searchLimit: 20,
            addParentData: false,
          };

    const response = await fetch(
      "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        redirect: "error", signal: AbortSignal.timeout(90000),
        body: JSON.stringify(actorInput),
      },
    );

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Instagram provider unavailable.");
    }

    const raw = (JSON.parse(await boundedText(response))) as Array<Record<string, unknown>>;
    const rows = Array.isArray(raw) ? raw : [];

    const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
    const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

    const profiles: InstagramProfile[] = [];
    const posts: InstagramPost[] = [];

    for (const item of rows) {
      if (data.mode === "profile") {
        const username = str(item["username"]);
        if (!username) continue;
        profiles.push({
          username,
          fullName: str(item["fullName"]),
          followersCount: num(item["followersCount"]),
          followsCount: num(item["followsCount"]),
          postsCount: num(item["postsCount"]),
          biography: str(item["biography"]) ?? "",
          verified: item["verified"] === true,
          url: str(item["url"]) ?? `https://www.instagram.com/${username}/`,
          profilePicUrl: str(item["profilePicUrlHD"]) ?? str(item["profilePicUrl"]),
        });
      } else {
        const url = str(item["url"]);
        if (!url) continue;
        posts.push({
          id: str(item["id"]) ?? str(item["shortCode"]) ?? url,
          url,
          caption: str(item["caption"]) ?? str(item["text"]) ?? "",
          ownerUsername: str(item["ownerUsername"]),
          ownerFullName: str(item["ownerFullName"]),
          likesCount: num(item["likesCount"]),
          commentsCount: num(item["commentsCount"]),
          timestamp: str(item["timestamp"]),
          imageUrl: str(item["displayUrl"]) ?? str(item["imageUrl"]),
          videoViewCount: typeof item["videoViewCount"] === "number" ? (item["videoViewCount"] as number) : null,
          type: str(item["type"]) ?? "Image",
          hashtags: Array.isArray(item["hashtags"])
            ? (item["hashtags"] as unknown[]).filter((h): h is string => typeof h === "string")
            : [],
        });
      }
    }

    posts.sort((a, b) => b.likesCount + b.commentsCount - (a.likesCount + a.commentsCount));

    return {
      mode: data.mode,
      posts,
      profiles,
      totalItems: rows.length,
      fetchedAt: new Date().toISOString(),
    };
    });
  });