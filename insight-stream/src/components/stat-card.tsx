import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative" | "neutral";
}

const toneMap = {
  default: "text-primary bg-primary/10",
  positive: "text-positive bg-positive/10",
  negative: "text-negative bg-negative/10",
  neutral: "text-neutral bg-neutral/10",
} as const;

export function StatCard({ label, value, hint, delta, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <Card className="gap-0 rounded-2xl border-border/70 p-5 transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {Icon ? (
          <span className={cn("grid size-9 place-items-center rounded-xl", toneMap[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {typeof delta === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
              delta >= 0 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta)}%
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </Card>
  );
}