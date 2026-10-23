import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { getTrendHistory } from "@/lib/monitoring.functions";

const tooltipStyle = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.75rem",
    color: "var(--color-popover-foreground)",
    fontSize: "12px",
  },
} as const;

/** Long-term trend read from the archived daily metrics table. */
export function HistoryTrendChart({
  keyword,
  days = 30,
  kind = "all",
  className,
}: {
  keyword: string;
  days?: number;
  kind?: "all" | "news" | "social";
  className?: string;
}) {
  const fetchTrend = useServerFn(getTrendHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["trend-history", keyword, days, kind],
    queryFn: () => fetchTrend({ data: { keyword, days, kind } }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const points = data ?? [];

  return (
    <ChartCard
      title="Riwayat pemantauan"
      description={`Arsip ${days} hari terakhir untuk "${keyword || "semua topik"}"`}
      className={className}
    >
      {isLoading ? (
        <Skeleton className="h-[240px] rounded-xl" />
      ) : points.length < 2 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Data historis sedang dikumpulkan. Grafik muncul setelah beberapa kali pemantauan.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={points} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="total" stroke="var(--color-primary)" fill="url(#historyFill)" name="Total" />
            <Line type="monotone" dataKey="negative" stroke="var(--color-destructive)" dot={false} name="Negatif" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}