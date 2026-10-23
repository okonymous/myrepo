import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getFeed, type FeedInput } from "@/lib/monitoring.functions";
import type { FeedResult } from "@/lib/monitoring/types";

export const FIVE_MINUTES = 5 * 60 * 1000;

export function useFeed(filters: FeedInput, options?: { autoRefresh?: boolean }) {
  const fetchFeed = useServerFn(getFeed);

  return useQuery<FeedResult>({
    queryKey: ["feed", filters],
    queryFn: () => fetchFeed({ data: filters }),
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    refetchInterval: options?.autoRefresh === false ? false : FIVE_MINUTES,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
}