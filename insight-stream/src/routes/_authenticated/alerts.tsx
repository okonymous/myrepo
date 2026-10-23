import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, BellRing, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/hooks/use-auth";
import { useFeed } from "@/hooks/use-feed";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Alerts | Pulse Signal" },
      { name: "description", content: "Create keyword alerts for mention spikes, negative sentiment and viral posts, with real-time notifications." },
      { property: "og:title", content: "Alerts | Pulse Signal" },
      { property: "og:description", content: "Keyword alerts for spikes, negative sentiment and viral posts." },
    ],
  }),
  component: AlertsPage,
});

const TRIGGERS = [
  { value: "mention_spike", label: "Mention volume above threshold" },
  { value: "negative_sentiment", label: "Negative mentions above threshold" },
  { value: "viral_post", label: "Engagement above threshold" },
];

function AlertsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [triggerType, setTriggerType] = useState("mention_spike");
  const [threshold, setThreshold] = useState(10);

  const alerts = useQuery({
    queryKey: ["alerts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = useQuery({
    queryKey: ["alert-events", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("alert-events-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alert_events", filter: `user_id=eq.${user.id}` },
        (payload) => {
          toast.warning((payload.new as { message: string }).message);
          queryClient.invalidateQueries({ queryKey: ["alert-events"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const activeAlert = (alerts.data ?? []).find((a) => a.is_active);
  const { data: feed } = useFeed(
    { query: activeAlert?.keyword ?? "", kind: "all", sinceHours: 24 },
    { autoRefresh: Boolean(activeAlert) },
  );

  // Evaluate active alerts against the live feed and persist triggered events.
  useEffect(() => {
    if (!user?.id || !feed || !activeAlert) return;
    const items = feed.items;
    const value =
      activeAlert.trigger_type === "negative_sentiment"
        ? items.filter((i) => i.sentiment === "negative").length
        : activeAlert.trigger_type === "viral_post"
          ? Math.max(0, ...items.map((i) => i.engagement))
          : items.length;

    if (value < activeAlert.threshold) return;
    const last = activeAlert.last_triggered_at ? new Date(activeAlert.last_triggered_at).getTime() : 0;
    if (Date.now() - last < 30 * 60 * 1000) return;

    void (async () => {
      await supabase.from("alert_events").insert({
        alert_id: activeAlert.id,
        user_id: user.id,
        severity: activeAlert.trigger_type === "negative_sentiment" ? "high" : "medium",
        message: `${activeAlert.name}: ${value} (threshold ${activeAlert.threshold}) for “${activeAlert.keyword}”`,
        payload: { value, threshold: activeAlert.threshold, sampled: items.length },
      });
      await supabase.from("alerts").update({ last_triggered_at: new Date().toISOString() }).eq("id", activeAlert.id);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    })();
  }, [feed, activeAlert, user?.id, queryClient]);

  const createAlert = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      const { error } = await supabase.from("alerts").insert({
        user_id: user.id,
        name: name.trim() || `${keyword} watch`,
        keyword: keyword.trim(),
        entity_type: "keyword",
        trigger_type: triggerType,
        threshold,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setKeyword("");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAlert = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("alerts").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert deleted");
    },
  });

  return (
    <AppShell title="Alerts" description="Real-time triggers evaluated against live coverage">
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">New alert</CardTitle>
            <CardDescription>Alerts are evaluated whenever live data refreshes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="alert-name">Name</Label>
              <Input id="alert-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Crisis watch" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-keyword">Keyword</Label>
              <Input id="alert-keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="acme corp" />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-threshold">Threshold</Label>
              <Input
                id="alert-threshold"
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
            <Button className="w-full" onClick={() => createAlert.mutate()} disabled={!keyword.trim() || createAlert.isPending}>
              <Plus className="size-4" /> Create alert
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4" /> Your alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(alerts.data ?? []).length ? (
                alerts.data!.map((alert) => (
                  <div key={alert.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{alert.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        “{alert.keyword}” · {TRIGGERS.find((t) => t.value === alert.trigger_type)?.label} · ≥ {alert.threshold}
                      </p>
                    </div>
                    {alert.last_triggered_at ? (
                      <Badge variant="outline" className="rounded-full text-xs">
                        Last fired {new Date(alert.last_triggered_at).toLocaleString()}
                      </Badge>
                    ) : null}
                    <Switch
                      checked={alert.is_active}
                      onCheckedChange={(checked) => updateAlert.mutate({ id: alert.id, is_active: checked })}
                      aria-label="Toggle alert"
                    />
                    <Button variant="ghost" size="icon" onClick={() => deleteAlert.mutate(alert.id)} aria-label="Delete alert">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No alerts yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><BellRing className="size-4" /> Alert history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(events.data ?? []).length ? (
                events.data!.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                    <Badge
                      variant="outline"
                      className={event.severity === "high" ? "rounded-full border-negative/40 text-negative" : "rounded-full"}
                    >
                      {event.severity}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{event.message}</p>
                      <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No alerts have fired yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}