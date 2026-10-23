import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { InstagramScraper } from "@/components/instagram-scraper";

export const Route = createFileRoute("/_authenticated/instagram")({
  head: () => ({
    meta: [
      { title: "Instagram Scraper | Pulse Signal" },
      {
        name: "description",
        content: "Scrape postingan, hashtag, dan profil Instagram publik dengan metrik likes, komentar, dan followers secara real-time.",
      },
      { property: "og:title", content: "Instagram Scraper | Pulse Signal" },
      {
        property: "og:description",
        content: "Ambil data Instagram publik — postingan akun, hashtag, dan detail profil — tanpa perlu login Instagram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell
      title="Instagram scraper"
      description="Postingan, hashtag & profil Instagram publik via Apify"
    >
      <InstagramScraper />
    </AppShell>
  ),
});