import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, Bell, Globe2, Radio, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Pulse Signal — Real-Time News & Social Monitoring" },
      { name: "description", content: "Track brand mentions across Google News, GDELT, Reddit, YouTube, Bluesky and Mastodon with live sentiment analysis and alerts." },
      { property: "og:title", content: "Pulse Signal — Real-Time News & Social Monitoring" },
      { property: "og:description", content: "Live media intelligence with sentiment analysis, keyword analytics and alerts." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Globe2, title: "Live news coverage", body: "Google News, GDELT, NewsAPI and any RSS feed, deduplicated and ranked." },
  { icon: Radio, title: "Social listening", body: "Reddit, YouTube, Bluesky and Mastodon conversations as they happen." },
  { icon: Activity, title: "Sentiment analysis", body: "Every mention scored positive, neutral or negative with intensity." },
  { icon: BarChart3, title: "Keyword analytics", body: "Word clouds, entity extraction, trend charts and posting heatmaps." },
  { icon: Bell, title: "Real-time alerts", body: "Spike, negative-sentiment and virality triggers pushed instantly." },
  { icon: ShieldCheck, title: "Exports & admin", body: "CSV, Excel and PDF reports plus role-based workspace administration." },
];

function Landing() {
  return (
    <div className="surface-grid min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Radio className="size-4.5" />
          </span>
          <span className="font-display text-lg font-semibold">Pulse Signal</span>
        </div>
        <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="py-16 text-center md:py-24">
          <p className="mb-4 inline-flex rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Live data only · no mock feeds
          </p>
          <h1 className="mx-auto max-w-3xl font-display text-4xl leading-tight font-semibold tracking-tight md:text-6xl">
            Know what the world says about you, the moment it's said
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Pulse Signal monitors global news wires and social platforms in real time, scores sentiment on every
            mention, and alerts you before a story becomes a crisis.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-xl px-8"><Link to="/auth">Start monitoring</Link></Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl px-8"><Link to="/auth">View the dashboard</Link></Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="gap-2 rounded-2xl border-border/70 p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="size-5" />
              </span>
              <h2 className="mt-3 font-display text-lg font-semibold">{feature.title}</h2>
              <p className="text-sm text-muted-foreground">{feature.body}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}