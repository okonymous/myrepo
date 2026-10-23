import type { SupabaseClient } from '@supabase/supabase-js';
type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };
export interface Organization { id: string; name: string; personal_user_id: string | null; provider: 'existing' | 'hybrid' | 'automatio'; monthly_query_limit: number; monthly_credit_limit: number; automatio_call_limit: number }
export interface Usage { org_id: string; month: string; queries: number; credits: number; reserved_credits: number; automatio_calls: number }
export interface TenantDatabase {
 public: {
  Tables: {
   organizations: Table<Organization>;
   organization_memberships: Table<{org_id: string; user_id: string; role: string; created_at: string}>;
   tenant_monthly_usage: Table<Usage>;
   tenant_feed_cache: Table<{org_id: string; cache_key: string; payload: unknown; expires_at: string}>;
   tenant_monitored_items: Table<{org_id: string; url_key: string; payload: unknown; last_seen_at: string}>;
   tenant_item_metrics_daily: Table<{org_id: string; day: string; keyword: string; kind: string; total: number; positive: number; neutral: number; negative: number; engagement: number}>;
  };
  Views: Record<string, never>;
  Functions: {
   reserve_tenant_request: {Args: {p_org: string; p_user: string; p_request: string; p_operation: string; p_provider: string; p_reserve: number}; Returns: undefined};
   settle_tenant_request: {Args: {p_request: string; p_credits: number | null; p_status: string}; Returns: undefined};
  };
  Enums: Record<string, never>; CompositeTypes: Record<string, never>;
 }
}
export type TenantClient = SupabaseClient<TenantDatabase>;