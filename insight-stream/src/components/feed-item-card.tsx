import { formatDistanceToNowStrict } from "date-fns";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Heart,
  MessageCircle,
  Repeat2,
  Newspaper,
  Radio,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FeedItem, Sentiment } from "@/lib/monitoring/types";

const sentimentStyles: Record<Sentiment, string> = {
  positive: "bg-positive/12 text-positive border-positive/30",
  negative: "bg-negative/12 text-negative border-negative/30",
  neutral: "bg-neutral/12 text-neutral border-neutral/30",
};

export function SentimentBadge({ sentiment, score }: { sentiment: Sentiment; score?: number }) {
  return (
    <Badge variant="outline" className={cn("rounded-full capitalize", sentimentStyles[sentiment])}>
      {sentiment}
      {typeof score === "number" ? <span className="ml-1 tabular-nums opacity-70">{score.toFixed(2)}</span> : null}
    </Badge>
  );
}

function safeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function FeedItemCard({
  item,
  saved,
  onToggleSave,
}: {
  item: FeedItem;
  saved?: boolean;
  onToggleSave?: (item: FeedItem) => void;
}) {
  const Icon = item.kind === "news" ? Newspaper : Radio;

  return (
    <Card className="group gap-3 rounded-2xl border-border/70 p-4 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-medium text-secondary-foreground">
          <Icon className="size-3.5" />
          {item.source}
        </span>
        <SentimentBadge sentiment={item.sentiment} score={item.sentimentScore} />
        {item.author ? <span className="truncate max-w-[220px]">{item.author}</span> : null}
        <span>·</span>
        <span>{safeTime(item.publishedAt)}</span>
      </div>

      <a href={item.url} target="_blank" rel="noreferrer noopener" className="block">
        <h3 className="font-display text-base leading-snug font-semibold group-hover:text-primary">{item.title}</h3>
      </a>

      {item.summary ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3.5" /> {item.likes.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-3.5" /> {item.comments.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat2 className="size-3.5" /> {item.shares.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleSave ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleSave(item)}
              aria-label={saved ? "Remove from saved" : "Save item"}
            >
              {saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" asChild>
            <a href={item.url} target="_blank" rel="noreferrer noopener">
              Source <ExternalLink className="ml-1 size-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}