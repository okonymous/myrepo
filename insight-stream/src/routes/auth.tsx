import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Sign in | Pulse Signal" },
      { name: "description", content: "Sign in to Pulse Signal to monitor news and social media mentions in real time." },
      { property: "og:title", content: "Sign in | Pulse Signal" },
      { property: "og:description", content: "Access your real-time media monitoring workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { display_name: displayName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Check your inbox if confirmation is required.");
    navigate({ to: "/dashboard", replace: true });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error(result.error.message ?? "Google sign-in failed");
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="surface-grid flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl border-border/70">
        <CardHeader className="items-center text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Radio className="size-5" />
          </span>
          <CardTitle className="font-display text-2xl">Pulse Signal</CardTitle>
          <CardDescription>Real-time news & social media intelligence</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="mb-4 w-full" onClick={google}>
            Continue with Google
          </Button>
          <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button className="w-full" onClick={signIn} disabled={loading}>Sign in</Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-up">Email</Label>
                <Input id="email-up" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password-up">Password</Label>
                <Input id="password-up" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button className="w-full" onClick={signUp} disabled={loading}>Create account</Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}