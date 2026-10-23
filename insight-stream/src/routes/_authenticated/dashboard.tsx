import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, Flame, Gauge, Heart, MessageSquare, Newspaper, Radio, TrendingUp } from "lucide-react";

import { AiBriefCard } from "@/components/ai-brief-card";
import { AppShell } from "@/components/app-shell";
import { HistoryTrendChart } from "@/components/history-trend-chart";

import {
  ChartCard,
  SentimentPie,
  SentimentTrendChart,
  SourceBarChart,
  VolumeAreaChart,
  WordCloud,
} from "@/components/charts";
import { FeedItemCard } from "@/components/feed-item-card";
import { DEFAULT_FILTERS, FilterBar, type FilterState } from "@/components/filter-bar";
import { StatCard } from "@/components/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-auth";
import { useFeed } from "@/hooks/use-feed";
import { useSavedArticles, useToggleSave } from "@/hooks/use-saved";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Monitoring Dashboard | Pulse Signal" },
      { name: "description", content: "Live media intelligence dashboard: mention volume, sentiment split, top sources and trending keywords." },
      { property: "og:title", content: "Monitoring Dashboard | Pulse Signal" },
      { property: "og:description", content: "Live mention volume, sentiment and trending keywords in one dashboard." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(filters);
  const { user } = useSession();
  const { data: saved } = useSavedArticles(user?.id);
  const toggleSave = useToggleSave(user?.id);
  const savedUrls = useMemo(() => new Set((saved ?? []).map((r) => r.url)), [saved]);

  const { data, isLoading, isFetching, error } = useFeed({ ...applied, kind: "all" });
  const analytics = data?.analytics;
  const items = data?.items ?? [];

  const total = (analytics?.totalNews ?? 0) + (analytics?.totalSocial ?? 0);
  const sentimentScore = total
    ? Math.round((((analytics?.positive ?? 0) - (analytics?.negative ?? 0)) / total) * 100)
    : 0;

  return (
    <AppShell
      title="Dashboard"
      description={data ? `Live across ${data.sources.filter((s) => s.ok).length} connected sources` : "Loading live sources…"}
    >
      <div className="space-y-5">
        <FilterBar
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setApplied(next);
          }}
          onRefresh={() => setApplied({ ...filters })}
          isFetching={isFetching}
          sourceOptions={(data?.sources ?? []).map((s) => ({ key: s.key, name: s.name }))}
          exportItems={items}
        />
        <AiBriefCard filters={{ ...applied, kind: "all" }} />


        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Live data unavailable</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading || !analytics ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total mentions" value={total.toLocaleString()} icon={Activity} delta={analytics.mentionGrowth} hint="vs previous period" />
              <StatCard label="News articles" value={analytics.totalNews.toLocaleString()} icon={Newspaper} hint={`${analytics.newsToday} in last 24h`} />
              <StatCard label="Social posts" value={analytics.totalSocial.toLocaleString()} icon={Radio} hint={`${analytics.socialToday} in last 24h`} />
              <StatCard label="Engagement" value={analytics.totalEngagement.toLocaleString()} icon={Heart} hint="likes + comments + shares" />
              <StatCard label="Positive" value={analytics.positive.toLocaleString()} icon={TrendingUp} tone="positive" hint={`${total ? Math.round((analytics.positive / total) * 100) : 0}% of mentions`} />
              <StatCard label="Neutral" value={analytics.neutral.toLocaleString()} icon={MessageSquare} tone="neutral" hint={`${total ? Math.round((analytics.neutral / total) * 100) : 0}% of mentions`} />
              <StatCard label="Negative" value={analytics.negative.toLocaleString()} icon={Flame} tone="negative" hint={`${total ? Math.round((analytics.negative / total) * 100) : 0}% of mentions`} />
              <StatCard label="Net sentiment" value={`${sentimentScore > 0 ? "+" : ""}${sentimentScore}`} icon={Gauge} tone={sentimentScore >= 0 ? "positive" : "negative"} hint="positive minus negative" />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <ChartCard title="Mention volume" description="News vs social over time" className="xl:col-span-2">
                <VolumeAreaChart data={analytics.timeline} />
              </ChartCard>
              <ChartCard title="Sentiment split" description="Share of all mentions">
                <SentimentPie analytics={analytics} />
              </ChartCard>
              <ChartCard title="Sentiment trend" description="How tone evolves" className="xl:col-span-2">
                <SentimentTrendChart data={analytics.timeline} />
              </ChartCard>
              <ChartCard title="Top sources" description="Most active outlets">
                <SourceBarChart data={analytics.sources.slice(0, 8)} />
              </ChartCard>
              <HistoryTrendChart keyword={applied.query ?? ""} days={30} className="xl:col-span-3" />

            </div>

            <ChartCard title="Trending keywords" description="Weighted by mention volume and tone">
              <WordCloud terms={analytics.keywords.slice(0, 40)} />
            </ChartCard>

            <Card className="gap-3 rounded-2xl border-border/70 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Latest mentions</h2>
                <Badge variant="secondary" className="rounded-full">{items.length} items</Badge>
              </div>
              <div className="space-y-3">
                {items.slice(0, 12).map((item) => (
                  <FeedItemCard
                    key={item.id}
                    item={item}
                    saved={savedUrls.has(item.url)}
                    onToggleSave={(i) => toggleSave.mutate({ item: i, saved: savedUrls.has(i.url) })}
                  />
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}