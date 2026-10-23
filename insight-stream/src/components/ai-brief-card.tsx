import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDailyBrief, type FeedInput } from "@/lib/monitoring.functions";

const toneClass: Record<string, string> = {
  positive: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/15 text-destructive",
};

export function AiBriefCard({ filters }: { filters: FeedInput }) {
  const fetchBrief = useServerFn(getDailyBrief);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-brief", filters],
    queryFn: () => fetchBrief({ data: filters }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (!data) return null;

  return (
    <Card className="gap-3 rounded-2xl border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-display text-base font-semibold">AI Brief</h2>
        <Badge variant="secondary" className="ml-auto rounded-full text-[11px]">
          {new Date(data.generatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </Badge>
      </div>
      <p className="font-display text-lg leading-snug font-semibold">{data.headline}</p>
      <p className="text-sm text-muted-foreground">{data.summary}</p>
      {data.issues.length ? (
        <ul className="mt-1 grid gap-2 sm:grid-cols-2">
          {data.issues.map((issue) => (
            <li key={issue.title} className="rounded-xl border border-border/60 bg-card/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{issue.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${toneClass[issue.sentiment] ?? toneClass.neutral}`}>
                  {issue.sentiment}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{issue.insight}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">~{issue.mentions} pemberitaan</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}