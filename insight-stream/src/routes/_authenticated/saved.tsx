import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bookmark } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { FeedItemCard } from "@/components/feed-item-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-auth";
import { useSavedArticles, useToggleSave } from "@/hooks/use-saved";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export";
import type { FeedItem, FeedKind, Sentiment } from "@/lib/monitoring/types";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Saved Mentions | Pulse Signal" },
      { name: "description", content: "Your bookmarked news articles and social posts, ready to export as CSV, Excel or PDF." },
      { property: "og:title", content: "Saved Mentions | Pulse Signal" },
      { property: "og:description", content: "Bookmarked coverage ready to export as CSV, Excel or PDF." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { user } = useSession();
  const { data, isLoading } = useSavedArticles(user?.id);
  const toggleSave = useToggleSave(user?.id);

  const items = useMemo<FeedItem[]>(
    () =>
      (data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind as FeedKind,
        title: row.title,
        summary: row.summary ?? "",
        url: row.url,
        source: row.source ?? "Unknown",
        sourceKey: row.source ?? "unknown",
        author: row.author,
        imageUrl: row.image_url,
        language: row.language,
        country: row.country,
        category: row.category,
        publishedAt: row.published_at ?? row.created_at,
        sentiment: (row.sentiment ?? "neutral") as Sentiment,
        sentimentScore: row.sentiment_score ?? 0,
        engagement: row.engagement ?? 0,
        likes: row.likes ?? 0,
        comments: row.comments ?? 0,
        shares: row.shares ?? 0,
      })),
    [data],
  );

  return (
    <AppShell
      title="Saved mentions"
      description={`${items.length} bookmarked items`}
      actions={
        <div className="hidden items-center gap-2 sm:flex">
          <Button variant="outline" size="sm" onClick={() => exportCsv(items, "saved.csv")} disabled={!items.length}>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportExcel(items, "saved.xlsx")} disabled={!items.length}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => exportPdf(items, "Saved mentions", "saved.pdf")} disabled={!items.length}>PDF</Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <FeedItemCard key={item.id} item={item} saved onToggleSave={(i) => toggleSave.mutate({ item: i, saved: true })} />
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl p-12 text-center">
          <Bookmark className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Bookmark items from the dashboard or feeds to build a report.</p>
        </Card>
      )}
    </AppShell>
  );
}