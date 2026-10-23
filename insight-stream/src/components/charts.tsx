import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FeedAnalytics, RankedTerm, TimeBucket } from "@/lib/monitoring/types";

const tooltipStyle = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.75rem",
    color: "var(--color-popover-foreground)",
    fontSize: "12px",
  },
} as const;

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-2xl border-border/70", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function VolumeAreaChart({ data }: { data: TimeBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="newsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="socialFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="news" name="News" stroke="var(--color-chart-1)" fill="url(#newsFill)" strokeWidth={2} />
        <Area type="monotone" dataKey="social" name="Social" stroke="var(--color-chart-2)" fill="url(#socialFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SentimentTrendChart({ data }: { data: TimeBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="positive" name="Positive" stroke="var(--color-positive)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="neutral" name="Neutral" stroke="var(--color-neutral)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="negative" name="Negative" stroke="var(--color-negative)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SentimentPie({ analytics }: { analytics: FeedAnalytics }) {
  const data = [
    { name: "Positive", value: analytics.positive, color: "var(--color-positive)" },
    { name: "Neutral", value: analytics.neutral, color: "var(--color-neutral)" },
    { name: "Negative", value: analytics.negative, color: "var(--color-negative)" },
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} stroke="none">
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SourceBarChart({ data }: { data: Array<{ source: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 40, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="source"
          width={130}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
        />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Mentions" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KeywordBarChart({ data }: { data: RankedTerm[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="term" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval={0} angle={-35} textAnchor="end" height={70} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Mentions" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WordCloud({ terms }: { terms: RankedTerm[] }) {
  if (!terms.length) return <p className="text-sm text-muted-foreground">No keywords yet.</p>;
  const max = terms[0].count || 1;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {terms.map((term) => {
        const weight = term.count / max;
        const tone = term.positive > term.negative ? "text-positive" : term.negative > term.positive ? "text-negative" : "text-foreground";
        return (
          <span
            key={term.term}
            title={`${term.count} mentions · ${term.positive} positive · ${term.negative} negative`}
            className={cn("font-display leading-none transition-opacity hover:opacity-70", tone)}
            style={{ fontSize: `${0.85 + weight * 1.9}rem`, opacity: 0.55 + weight * 0.45 }}
          >
            {term.term}
          </span>
        );
      })}
    </div>
  );
}

export function ActivityHeatmap({ cells }: { cells: Array<{ day: string; hour: number; count: number }> }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lookup = new Map(cells.map((c) => [`${c.day}-${c.hour}`, c.count]));
  const max = Math.max(1, ...cells.map((c) => c.count));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[620px] space-y-1">
        <div className="grid grid-cols-[42px_repeat(24,1fr)] gap-1 text-[10px] text-muted-foreground">
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="text-center">
              {hour % 3 === 0 ? hour : ""}
            </span>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} className="grid grid-cols-[42px_repeat(24,1fr)] items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{day}</span>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = lookup.get(`${day}-${hour}`) ?? 0;
              return (
                <span
                  key={hour}
                  title={`${day} ${hour}:00 · ${count} mentions`}
                  className="aspect-square rounded-[3px] bg-primary"
                  style={{ opacity: count ? 0.18 + (count / max) * 0.82 : 0.06 }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}