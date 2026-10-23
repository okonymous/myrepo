import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Admin Panel | Pulse Signal" },
      { name: "description", content: "Administer users, roles, data sources and system logs for the monitoring workspace." },
      { property: "og:title", content: "Admin Panel | Pulse Signal" },
      { property: "og:description", content: "Users, roles, data sources and system logs." },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

function AdminPage() {
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, company, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const logs = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const roleFor = (id: string) => (roles.data ?? []).find((r) => r.user_id === id)?.role ?? "user";

  return (
    <AppShell title="Admin panel" description="Workspace users, roles and system activity">
      <div className="space-y-5">
        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4" /> Users</CardTitle>
            <CardDescription>{users.data?.length ?? 0} registered accounts</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.display_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.company ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full capitalize">{roleFor(row.id)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">System logs</CardTitle>
            <CardDescription>Most recent 50 events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(logs.data ?? []).length ? (
              logs.data!.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
                  <Badge variant="outline" className="rounded-full uppercase">{log.level}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{log.event}</p>
                    <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No system events recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}