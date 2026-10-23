import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { FeedItemCard } from "@/components/feed-item-card";
import { DEFAULT_FILTERS, FilterBar, type FilterState } from "@/components/filter-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TopInfluencers } from "@/components/top-influencers";

import { useFeed } from "@/hooks/use-feed";
import { useSession } from "@/hooks/use-auth";
import { useSavedArticles, useToggleSave } from "@/hooks/use-saved";
import type { FeedKind } from "@/lib/monitoring/types";

export function MonitorPage({
  kind,
  title,
  description,
  defaultQuery,
}: {
  kind: FeedKind;
  title: string;
  description: string;
  defaultQuery?: string;
}) {
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    query: defaultQuery ?? DEFAULT_FILTERS.query,
  });
  const [applied, setApplied] = useState(filters);

  const { user } = useSession();
  const { data: saved } = useSavedArticles(user?.id);
  const toggleSave = useToggleSave(user?.id);
  const savedUrls = useMemo(() => new Set((saved ?? []).map((row) => row.url)), [saved]);

  const { data, isLoading, isFetching, error } = useFeed({ ...applied, kind });

  const items = data?.items ?? [];
  const sourceOptions = (data?.sources ?? []).filter((s) => s.kind === kind).map((s) => ({ key: s.key, name: s.name }));
  const failing = (data?.sources ?? []).filter((s) => s.kind === kind && !s.ok);

  return (
    <AppShell title={title} description={description}>
      <div className="space-y-5">
        <FilterBar
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setApplied(next);
          }}
          onRefresh={() => setApplied({ ...filters })}
          isFetching={isFetching}
          sourceOptions={sourceOptions}
          exportItems={items}
        />

        {failing.length ? (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>Some sources are unavailable</AlertTitle>
            <AlertDescription>
              {failing.map((s) => `${s.name}: ${s.message ?? "unavailable"}`).join(" · ")}
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Could not load live data</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        ) : null}

        {kind === "social" ? <TopInfluencers items={items} /> : null}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="rounded-full">{items.length} results</Badge>
          {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {data ? <span>Updated {new Date(data.fetchedAt).toLocaleTimeString()}</span> : null}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <FeedItemCard
                key={item.id}
                item={item}
                saved={savedUrls.has(item.url)}
                onToggleSave={(i) => toggleSave.mutate({ item: i, saved: savedUrls.has(i.url) })}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No live results for this query and timeframe. Try broader keywords or a longer window.
          </Card>
        )}
      </div>
    </AppShell>
  );
}