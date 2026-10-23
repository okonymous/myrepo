import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { History, Search as SearchIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { FeedItemCard } from "@/components/feed-item-card";
import { DEFAULT_FILTERS, FilterBar, type FilterState } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-auth";
import { useFeed } from "@/hooks/use-feed";
import { useSavedArticles, useToggleSave } from "@/hooks/use-saved";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Search & History | Pulse Signal" },
      { name: "description", content: "Search live news and social sources at once and revisit your previous monitoring queries." },
      { property: "og:title", content: "Search & History | Pulse Signal" },
      { property: "og:description", content: "Search live news and social sources and revisit past queries." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS, query: "" });
  const [applied, setApplied] = useState(filters);
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: saved } = useSavedArticles(user?.id);
  const toggleSave = useToggleSave(user?.id);
  const savedUrls = useMemo(() => new Set((saved ?? []).map((r) => r.url)), [saved]);

  const { data, isLoading, isFetching } = useFeed({ ...applied, kind: "all" }, { autoRefresh: false });

  const history = useQuery({
    queryKey: ["search-history", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("search_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return rows ?? [];
    },
  });

  async function runSearch(next: FilterState) {
    const query = next.query.trim();
    setApplied({ ...next, query });
    if (!user?.id || !query) return;
    const last = history.data?.[0]?.query?.trim().toLowerCase();
    if (last === query.toLowerCase()) return;
    await supabase.from("search_history").insert({
      user_id: user.id,
      query,
      scope: "all",
      results_count: 0,
    });
    queryClient.invalidateQueries({ queryKey: ["search-history"] });
  }

  const items = data?.items ?? [];

  return (
    <AppShell title="Search" description="Query every connected source at once">
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <FilterBar
            value={filters}
            onChange={(next) => {
              setFilters(next);
              if (applied.query) setApplied({ ...next, query: applied.query });
            }}
            onRefresh={(query) => void runSearch({ ...filters, query })}
            isFetching={isFetching}
            sourceOptions={(data?.sources ?? []).map((s) => ({ key: s.key, name: s.name }))}
            exportItems={items}
          />


          {!applied.query ? (
            <Card className="rounded-2xl p-12 text-center">
              <SearchIcon className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Enter a brand, topic, person or hashtag to search live news and social sources.
              </p>
            </Card>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
          ) : items.length ? (
            <div className="space-y-3">
              <Badge variant="secondary" className="rounded-full">{items.length} results</Badge>
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
              No live results found for “{applied.query}”.
            </Card>
          )}
        </div>

        <Card className="h-fit rounded-2xl border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" /> Recent searches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(history.data ?? []).length ? (
              history.data!.map((row) => (
                <Button
                  key={row.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => {
                    const next = { ...filters, query: row.query };
                    setFilters(next);
                    setApplied(next);
                  }}
                >
                  <span className="truncate">{row.query}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{row.results_count ?? 0}</span>
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No searches yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}