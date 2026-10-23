import { createFileRoute } from "@tanstack/react-router";

import { MonitorPage } from "@/components/monitor-page";

export const Route = createFileRoute("/_authenticated/social")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Social Monitoring | Pulse Signal" },
      { name: "description", content: "Monitor Reddit, YouTube, Bluesky and Mastodon conversations with live sentiment analysis." },
      { property: "og:title", content: "Social Monitoring | Pulse Signal" },
      { property: "og:description", content: "Live social listening across Reddit, YouTube, Bluesky and Mastodon." },
    ],
  }),
  component: () => (
    <MonitorPage
      kind="social"
      title="Social monitoring"
      description="Reddit, YouTube, Bluesky and Mastodon conversations"
    />
  ),
});