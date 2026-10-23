import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BadgeCheck,
  ExternalLink,
  Eye,
  Heart,
  Instagram,
  Loader2,
  MessageCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { scrapeInstagram, type InstagramScrapeResult } from "@/lib/instagram.functions";

type Mode = "posts" | "hashtag" | "profile";

const MODE_HINTS: Record<Mode, { label: string; placeholder: string; helper: string }> = {
  posts: {
    label: "Username / URL akun",
    placeholder: "detikcom, kompascom, https://www.instagram.com/cnnindonesia/",
    helper: "Pisahkan beberapa akun dengan koma. Maksimal 10 akun.",
  },
  hashtag: {
    label: "Hashtag",
    placeholder: "prabowo",
    helper: "Satu hashtag per pencarian, tanpa tanda #.",
  },
  profile: {
    label: "Username / URL akun",
    placeholder: "detikcom, kompascom",
    helper: "Ambil detail profil: followers, following, jumlah postingan, bio.",
  },
};

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}rb`;
  return value.toLocaleString("id-ID");
}

export function InstagramScraper() {
  const [mode, setMode] = useState<Mode>("posts");
  const [targets, setTargets] = useState("detikcom, kompascom");
  const [limit, setLimit] = useState(12);
  const scrape = useServerFn(scrapeInstagram);

  const mutation = useMutation({
    mutationFn: (): Promise<InstagramScrapeResult> => {
      const parsed = targets
        .split(/[\n,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);
      if (!parsed.length) throw new Error("Masukkan minimal satu username, URL, atau hashtag.");
      return scrape({ data: { mode, targets: parsed, resultsLimit: limit } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Scraping gagal");
    },
  });

  const result = mutation.data;
  const hint = MODE_HINTS[mode];

  return (
    <div className="space-y-5">
      <Card className="gap-4 rounded-2xl border-border/70 p-5">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary">
            <Instagram className="size-4.5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">Instagram scraper</h2>
            <p className="text-xs text-muted-foreground">
              Ambil postingan &amp; profil publik lewat Apify. Proses bisa memakan 30–90 detik.
            </p>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="posts">Postingan akun</TabsTrigger>
            <TabsTrigger value="hashtag">Hashtag</TabsTrigger>
            <TabsTrigger value="profile">Detail profil</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="ig-targets">{hint.label}</Label>
            <Input
              id="ig-targets"
              value={targets}
              onChange={(e) => setTargets(e.target.value)}
              placeholder={hint.placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !mutation.isPending) mutation.mutate();
              }}
            />
            <p className="text-[11px] text-muted-foreground">{hint.helper}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig-limit">Jumlah hasil</Label>
            <Input
              id="ig-limit"
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="shrink-0">
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Scraping…
              </>
            ) : (
              <>
                <Instagram className="size-4" /> Jalankan scraper
              </>
            )}
          </Button>
        </div>

        {mutation.isPending ? (
          <Alert>
            <Loader2 className="size-4 animate-spin" />
            <AlertTitle>Sedang mengambil data dari Instagram</AlertTitle>
            <AlertDescription>
              Apify sedang membuka halaman publik target. Mohon tunggu, jangan tutup halaman ini.
            </AlertDescription>
          </Alert>
        ) : null}

        {mutation.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Scraping gagal</AlertTitle>
            <AlertDescription>
              {mutation.error instanceof Error ? mutation.error.message : "Terjadi kesalahan"}
            </AlertDescription>
          </Alert>
        ) : null}
      </Card>

      {mutation.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="rounded-full">
              {result.mode === "profile" ? result.profiles.length : result.posts.length} hasil
            </Badge>
            <span>Diperbarui {new Date(result.fetchedAt).toLocaleTimeString("id-ID")}</span>
          </div>

          {result.mode === "profile" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.profiles.map((profile) => (
                <Card key={profile.username} className="gap-3 rounded-2xl border-border/70 p-4">
                  <div className="flex items-start gap-3">
                    {profile.profilePicUrl ? (
                      <img
                        src={profile.profilePicUrl}
                        alt={`Foto profil ${profile.username}`}
                        className="size-12 shrink-0 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                        <Instagram className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={profile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate font-semibold hover:underline"
                        >
                          @{profile.username}
                        </a>
                        {profile.verified ? <BadgeCheck className="size-4 shrink-0 text-primary" /> : null}
                      </div>
                      {profile.fullName ? (
                        <p className="truncate text-xs text-muted-foreground">{profile.fullName}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center">
                    <div>
                      <p className="text-sm font-semibold tabular-nums">{formatCount(profile.postsCount)}</p>
                      <p className="text-[11px] text-muted-foreground">Postingan</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold tabular-nums">{formatCount(profile.followersCount)}</p>
                      <p className="text-[11px] text-muted-foreground">Pengikut</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold tabular-nums">{formatCount(profile.followsCount)}</p>
                      <p className="text-[11px] text-muted-foreground">Mengikuti</p>
                    </div>
                  </div>
                  {profile.biography ? (
                    <p className="line-clamp-3 text-xs text-muted-foreground">{profile.biography}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : result.posts.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {result.posts.map((post) => (
                <Card key={post.id} className="gap-0 overflow-hidden rounded-2xl border-border/70 py-0">
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.caption.slice(0, 80) || "Postingan Instagram"}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-muted/40">
                      <Instagram className="size-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {post.ownerUsername ? `@${post.ownerUsername}` : post.ownerFullName || "—"}
                      </span>
                      <Badge variant="secondary" className="shrink-0 rounded-md text-[10px]">
                        {post.type}
                      </Badge>
                    </div>
                    {post.caption ? (
                      <p className="line-clamp-3 text-xs text-muted-foreground">{post.caption}</p>
                    ) : null}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="size-3" /> {formatCount(post.likesCount)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="size-3" /> {formatCount(post.commentsCount)}
                      </span>
                      {post.videoViewCount != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3" /> {formatCount(post.videoViewCount)}
                        </span>
                      ) : null}
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <ExternalLink className="size-3" /> Buka
                      </a>
                    </div>
                    {post.timestamp ? (
                      <p className="text-[10px] text-muted-foreground/80">
                        {new Date(post.timestamp).toLocaleString("id-ID")}
                      </p>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 size-6 text-muted-foreground/60" />
              Tidak ada hasil. Pastikan akun bersifat publik dan username/hashtag benar.
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}