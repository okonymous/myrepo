import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { FeedResult } from "./monitoring/types";
import type { DailyBrief } from "./monitoring/ai.server";
import type { TrendPoint } from "./monitoring/archive.server";

const FiltersSchema = z.object({
  orgId: z.string().uuid().optional(),
  query: z.string().max(200).optional().default(""),
  kind: z.enum(["all", "news", "social"]).optional().default("all"),
  language: z.string().max(10).optional().default("all"),
  country: z.string().max(10).optional().default("all"),
  category: z.string().max(40).optional().default(""),
  source: z.string().max(40).optional().default("all"),
  sentiment: z.enum(["all", "positive", "neutral", "negative"]).optional().default("all"),
  sinceHours: z.number().int().min(1).max(720).optional().default(168),
  ai: z.boolean().optional().default(true),
});

const TrendSchema = z.object({
  orgId: z.string().uuid().optional(),
  keyword: z.string().max(200).optional().default(""),
  days: z.number().int().min(3).max(180).optional().default(30),
  kind: z.enum(["all", "news", "social"]).optional().default("all"),
});

export type FeedInput = z.input<typeof FiltersSchema>;
export type { DailyBrief, TrendPoint };

export const getFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FiltersSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<FeedResult> => {
    const { runFeedPipeline } = await import("./monitoring/pipeline.server");
    const { authorizeTenant, withTenantRequest } = await import("./security/tenant.server");
    const { ai, orgId, ...rest } = data;
    const tenant = await authorizeTenant(context.supabase, context.userId, orgId);
    return await withTenantRequest(tenant, "feed", () => runFeedPipeline(
      {
        ...rest,
        language: rest.language === "all" ? undefined : rest.language,
        country: rest.country === "all" ? undefined : rest.country,
        category: rest.category || undefined,
      },
      ai, tenant,
    ));
  });

export const getDailyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FiltersSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<DailyBrief | null> => {
    const { getBrief } = await import("./monitoring/pipeline.server");
    const { authorizeTenant, withTenantRequest } = await import("./security/tenant.server");
    const { ai: _ai, orgId, ...rest } = data;
    const tenant = await authorizeTenant(context.supabase, context.userId, orgId);
    return await withTenantRequest(tenant, "brief", () => getBrief({
      ...rest,
      language: rest.language === "all" ? undefined : rest.language,
      country: rest.country === "all" ? undefined : rest.country,
      category: rest.category || undefined,
    }, tenant));
  });

export const getTrendHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TrendSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<TrendPoint[]> => {
    const { readTrend } = await import("./monitoring/archive.server");
    const { authorizeTenant, withTenantRequest } = await import("./security/tenant.server");
    const tenant = await authorizeTenant(context.supabase, context.userId, data.orgId, true);
    return await withTenantRequest(tenant, "trend", () => readTrend(data.keyword, data.days, data.kind, tenant));
  });