import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Save, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile, useSession } from "@/hooks/use-auth";
import { useFeed } from "@/hooks/use-feed";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Settings | Pulse Signal" },
      { name: "description", content: "Manage your profile and review the connection status of every live news and social data source." },
      { property: "og:title", content: "Settings | Pulse Signal" },
      { property: "og:description", content: "Profile settings and live data source connection status." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setCompany(profile?.company ?? "");
  }, [profile]);

  const { data: feed } = useFeed({ query: "technology", kind: "all", sinceHours: 24 }, { autoRefresh: false });

  const sources = useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("data_sources").select("*").order("kind");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, company })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile updated");
  }

  return (
    <AppShell title="Settings" description="Profile and data source configuration">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="h-fit rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <Button onClick={save} disabled={saving}>
              <Save className="size-4" /> Save changes
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" /> Data sources</CardTitle>
            <CardDescription>
              Keyless sources work out of the box. Key-based sources activate once their environment variable is configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(sources.data ?? []).map((source) => {
              const status = feed?.sources.find((s) => s.key === source.key);
              const ok = status?.ok ?? false;
              return (
                <div key={source.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{source.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.kind} · {source.requires_key ? source.env_var ?? "API key required" : "no key required"}
                      {status?.message ? ` · ${status.message}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={ok ? "rounded-full border-positive/40 text-positive" : "rounded-full text-muted-foreground"}>
                    {ok ? <CheckCircle2 className="mr-1 size-3" /> : <XCircle className="mr-1 size-3" />}
                    {ok ? `live · ${status?.count ?? 0}` : status?.configured === false ? "key missing" : "unavailable"}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}