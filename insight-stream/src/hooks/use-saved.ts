import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { FeedItem } from "@/lib/monitoring/types";

export function useSavedArticles(userId?: string) {
  return useQuery({
    queryKey: ["saved", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_articles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleSave(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ item, saved }: { item: FeedItem; saved: boolean }) => {
      if (!userId) throw new Error("You must be signed in to save items.");
      if (saved) {
        const { error } = await supabase.from("saved_articles").delete().eq("user_id", userId).eq("url", item.url);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase.from("saved_articles").insert({
        user_id: userId,
        kind: item.kind,
        title: item.title,
        summary: item.summary,
        url: item.url,
        source: item.source,
        author: item.author,
        image_url: item.imageUrl,
        language: item.language,
        country: item.country,
        category: item.category,
        sentiment: item.sentiment,
        sentiment_score: item.sentimentScore,
        engagement: item.engagement,
        likes: item.likes,
        comments: item.comments,
        shares: item.shares,
        published_at: item.publishedAt,
      });
      if (error) throw error;
      return "saved" as const;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["saved"] });
      toast.success(result === "saved" ? "Added to saved items" : "Removed from saved items");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}