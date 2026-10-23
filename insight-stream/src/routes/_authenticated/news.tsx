import { createFileRoute } from "@tanstack/react-router";

import { MonitorPage } from "@/components/monitor-page";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "News Monitoring | Pulse Signal" },
      { name: "description", content: "Track live coverage from Google News, GDELT, NewsAPI and RSS feeds with sentiment scoring." },
      { property: "og:title", content: "News Monitoring | Pulse Signal" },
      { property: "og:description", content: "Live news coverage with sentiment scoring across global sources." },
    ],
  }),
  component: () => (
    <MonitorPage
      kind="news"
      title="News monitoring"
      description="Google News, GDELT, NewsAPI and RSS coverage in real time"
    />
  ),
});