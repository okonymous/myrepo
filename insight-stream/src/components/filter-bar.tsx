import { useEffect, useState } from "react";

import { Download, FileSpreadsheet, FileText, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, COUNTRIES, LANGUAGES, type FeedItem } from "@/lib/monitoring/types";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export";

export interface FilterState {
  query: string;
  language: string;
  country: string;
  category: string;
  source: string;
  sentiment: "all" | "positive" | "neutral" | "negative";
  sinceHours: number;
}

export const DEFAULT_FILTERS: FilterState = {
  query: "artificial intelligence",
  language: "all",
  country: "all",
  category: "",
  source: "all",
  sentiment: "all",
  sinceHours: 168,
};

const TIMEFRAMES = [
  { value: 6, label: "Last 6 hours" },
  { value: 24, label: "Last 24 hours" },
  { value: 72, label: "Last 3 days" },
  { value: 168, label: "Last 7 days" },
  { value: 720, label: "Last 30 days" },
];

export function FilterBar({
  value,
  onChange,
  onRefresh,
  isFetching,
  sourceOptions,
  exportItems,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  onRefresh: (query: string) => void;
  isFetching: boolean;
  sourceOptions: Array<{ key: string; name: string }>;
  exportItems: FeedItem[];
}) {
  const [draft, setDraft] = useState(value.query);

  useEffect(() => {
    setDraft(value.query);
  }, [value.query]);

  function set<K extends keyof FilterState>(key: K, next: FilterState[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <Card className="gap-4 rounded-2xl border-border/70 p-4">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const q = draft.trim();
          if (q !== value.query) onChange({ ...value, query: q });
          onRefresh(q);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Track a brand, person, topic or hashtag…"
            className="h-11 rounded-xl pl-9"
            aria-label="Search keyword"
          />
        </div>
        <Button type="submit" className="h-11 rounded-xl px-6" disabled={isFetching}>
          <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
          {isFetching ? "Fetching" : "Run"}
        </Button>
      </form>


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Timeframe</Label>
          <Select value={String(value.sinceHours)} onValueChange={(v) => set("sinceHours", Number(v))}>
            <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEFRAMES.map((t) => (
                <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Sentiment</Label>
          <Select value={value.sentiment} onValueChange={(v) => set("sentiment", v as FilterState["sentiment"])}>
            <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sentiment</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Language</Label>
          <Select value={value.language} onValueChange={(v) => set("language", v)}>
            <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Country</Label>
          <Select value={value.country} onValueChange={(v) => set("country", v)}>
            <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={value.category || "any"} onValueChange={(v) => set("category", v === "any" ? "" : v)}>
            <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any category</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Source</Label>
          <Select value={value.source} onValueChange={(v) => set("source", v)}>
            <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sourceOptions.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="mr-1 text-xs text-muted-foreground">Export {exportItems.length} records:</span>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => exportCsv(exportItems)} disabled={!exportItems.length}>
          <Download className="size-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => exportExcel(exportItems)} disabled={!exportItems.length}>
          <FileSpreadsheet className="size-3.5" /> Excel
        </Button>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => exportPdf(exportItems, `Report: ${value.query || "all mentions"}`)} disabled={!exportItems.length}>
          <FileText className="size-3.5" /> PDF
        </Button>
      </div>
    </Card>
  );
}