import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import {
  ActivityHeatmap,
  ChartCard,
  KeywordBarChart,
  SentimentTrendChart,
  SourceBarChart,
  WordCloud,
} from "@/components/charts";
import { DEFAULT_FILTERS, FilterBar, type FilterState } from "@/components/filter-bar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeed } from "@/hooks/use-feed";
import type { RankedTerm } from "@/lib/monitoring/types";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Keyword Analytics | Pulse Signal" },
      { name: "description", content: "Word clouds, entity extraction, sentiment trends and posting heatmaps built from live media data." },
      { property: "og:title", content: "Keyword Analytics | Pulse Signal" },
      { property: "og:description", content: "Word clouds, entities and sentiment trends from live media data." },
    ],
  }),
  component: AnalyticsPage,
});

function TermTable({ terms, emptyLabel }: { terms: RankedTerm[]; emptyLabel: string }) {
  if (!terms.length) return <p className="p-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="divide-y divide-border">
      {terms.map((term, index) => (
        <div key={term.term} className="flex items-center gap-3 py-2.5 text-sm">
          <span className="w-6 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
          <span className="flex-1 truncate font-medium">{term.term}</span>
          <span className="text-xs text-positive tabular-nums">+{term.positive}</span>
          <span className="text-xs text-negative tabular-nums">-{term.negative}</span>
          <span className="w-12 text-right tabular-nums">{term.count}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(filters);
  const { data, isLoading, isFetching } = useFeed({ ...applied, kind: "all" });
  const analytics = data?.analytics;

  return (
    <AppShell title="Keyword analytics" description="Entities, topics and temporal patterns from live coverage">
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
          exportItems={data?.items ?? []}
        />

        {isLoading || !analytics ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <ChartCard title="Word cloud" description="Most mentioned terms, coloured by dominant sentiment">
              <WordCloud terms={analytics.keywords.slice(0, 60)} />
            </ChartCard>

            <div className="grid gap-4 xl:grid-cols-2">
              <ChartCard title="Top keywords" description="Mention counts">
                <KeywordBarChart data={analytics.keywords.slice(0, 15)} />
              </ChartCard>
              <ChartCard title="Sentiment over time">
                <SentimentTrendChart data={analytics.timeline} />
              </ChartCard>
              <ChartCard title="Source distribution">
                <SourceBarChart data={analytics.sources.slice(0, 10)} />
              </ChartCard>
              <ChartCard title="Publishing heatmap" description="Activity by weekday and hour (local time)">
                <ActivityHeatmap cells={analytics.heatmap} />
              </ChartCard>
            </div>

            <Card className="rounded-2xl border-border/70 p-4">
              <Tabs defaultValue="hashtags">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
                  <TabsTrigger value="people">People</TabsTrigger>
                  <TabsTrigger value="companies">Organisations</TabsTrigger>
                  <TabsTrigger value="locations">Locations</TabsTrigger>
                  <TabsTrigger value="authors">Authors</TabsTrigger>
                  <TabsTrigger value="positive">Positive topics</TabsTrigger>
                  <TabsTrigger value="negative">Negative topics</TabsTrigger>
                </TabsList>
                <TabsContent value="hashtags"><TermTable terms={analytics.hashtags} emptyLabel="No hashtags found." /></TabsContent>
                <TabsContent value="people"><TermTable terms={analytics.people} emptyLabel="No people detected." /></TabsContent>
                <TabsContent value="companies"><TermTable terms={analytics.companies} emptyLabel="No organisations detected." /></TabsContent>
                <TabsContent value="locations"><TermTable terms={analytics.locations} emptyLabel="No locations detected." /></TabsContent>
                <TabsContent value="authors"><TermTable terms={analytics.authors} emptyLabel="No authors detected." /></TabsContent>
                <TabsContent value="positive"><TermTable terms={analytics.topPositiveTopics} emptyLabel="No positive topics yet." /></TabsContent>
                <TabsContent value="negative"><TermTable terms={analytics.topNegativeTopics} emptyLabel="No negative topics yet." /></TabsContent>
              </Tabs>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}