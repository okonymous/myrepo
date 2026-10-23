import { useMemo } from "react";
import { Crown, ExternalLink, Flame, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FeedItem, Sentiment } from "@/lib/monitoring/types";

interface Influencer {
  key: string;
  handle: string;
  platform: string;
  profileUrl: string;
  mentions: number;
  engagement: number;
  positive: number;
  negative: number;
  topPost: FeedItem;
  score: number;
}

const PLATFORM_TONE: Record<string, string> = {
  Instagram: "bg-[oklch(0.62_0.22_10)]/12 text-[oklch(0.62_0.22_10)]",
  Threads: "bg-foreground/10 text-foreground",
  "X (Twitter)": "bg-foreground/10 text-foreground",
  Facebook: "bg-primary/12 text-primary",
};

function profileUrlFor(item: FeedItem, handle: string): string {
  const bare = handle.replace(/^[@u]\/?|^@/, "");
  try {
    const url = new URL(item.url);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes("instagram")) return `https://www.instagram.com/${bare}/`;
    if (host.includes("threads")) return `https://www.threads.net/@${bare}`;
    if (host.includes("x.com") || host.includes("twitter")) return `https://x.com/${bare}`;
    if (host.includes("facebook")) return `https://www.facebook.com/${bare}`;
    return item.url;
  } catch {
    return item.url;
  }
}

function dominantTone(positive: number, negative: number): Sentiment {
  if (positive > negative) return "positive";
  if (negative > positive) return "negative";
  return "neutral";
}

export function TopInfluencers({ items, limit = 10 }: { items: FeedItem[]; limit?: number }) {
  const influencers = useMemo(() => {
    const map = new Map<string, Influencer>();
    for (const item of items) {
      if (item.kind !== "social" || !item.author) continue;
      const key = `${item.sourceKey}:${item.author.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.mentions += 1;
        existing.engagement += item.engagement;
        if (item.sentiment === "positive") existing.positive += 1;
        if (item.sentiment === "negative") existing.negative += 1;
        if (item.engagement > existing.topPost.engagement) existing.topPost = item;
      } else {
        map.set(key, {
          key,
          handle: item.author,
          platform: item.source,
          profileUrl: profileUrlFor(item, item.author),
          mentions: 1,
          engagement: item.engagement,
          positive: item.sentiment === "positive" ? 1 : 0,
          negative: item.sentiment === "negative" ? 1 : 0,
          topPost: item,
          score: 0,
        });
      }
    }

    return [...map.values()]
      .map((entry) => ({
        ...entry,
        score: Math.round(Math.log10(1 + entry.engagement) * 30 + entry.mentions * 12),
      }))
      .sort((a, b) => b.score - a.score || b.engagement - a.engagement)
      .slice(0, limit);
  }, [items, limit]);

  if (!influencers.length) return null;

  const max = influencers[0].score || 1;

  return (
    <Card className="gap-4 rounded-2xl border-border/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Crown className="size-4 text-primary" />
            Akun paling berpengaruh
          </h2>
          <p className="text-xs text-muted-foreground">
            Peringkat dari jangkauan &amp; interaksi publik di Instagram, Threads, X, Facebook, Reddit, Mastodon &amp; YouTube.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full">{influencers.length}</Badge>
      </div>

      <ol className="space-y-2">
        {influencers.map((influencer, index) => {
          const tone = dominantTone(influencer.positive, influencer.negative);
          return (
            <li
              key={influencer.key}
              className="rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={influencer.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium hover:underline"
                    >
                      {influencer.handle}
                    </a>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                        PLATFORM_TONE[influencer.platform] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {influencer.platform}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize",
                        tone === "positive"
                          ? "bg-positive/10 text-positive"
                          : tone === "negative"
                            ? "bg-negative/10 text-negative"
                            : "bg-neutral/10 text-neutral",
                      )}
                    >
                      {tone}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{influencer.topPost.title}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="size-3" />
                      {influencer.engagement.toLocaleString()} interaksi
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3" />
                      {influencer.mentions} postingan
                    </span>
                    <a
                      href={influencer.topPost.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <ExternalLink className="size-3" />
                      Lihat
                    </a>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(6, (influencer.score / max) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}