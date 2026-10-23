import type { SupabaseClient } from '@supabase/supabase-js';
import type { Organization, TenantClient } from './tenant-types';
export interface TenantContext { org: Organization; userId: string; db: TenantClient }
export type Operation = 'feed' | 'brief' | 'trend' | 'instagram' | 'automatio';
export async function authorizeTenant(supabase: SupabaseClient, userId: string, orgId?: string, readOnly = false): Promise<TenantContext> {
 const db = supabase as unknown as TenantClient;
 let query = db.from('organization_memberships').select('org_id,role').eq('user_id',userId).order('created_at').limit(1);
 if (orgId) query = query.eq('org_id',orgId);
 const {data: member,error} = await query.maybeSingle();
 if (error) throw new Error('Workspace security is unavailable. No paid requests were started.');
 if (!member || (!readOnly && member.role === 'viewer')) throw new Error('Workspace permission denied.');
 const {data: org,error: orgError} = await db.from('organizations').select('*').eq('id',member.org_id).single();
 if (orgError || !org) throw new Error('Workspace security is unavailable.');
 return {org,userId,db};
}
async function privileged(): Promise<TenantClient> {
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 return supabaseAdmin as unknown as TenantClient;
}
export async function reserveRequest(tenant: TenantContext, operation: Operation, provider = 'existing', reserve = 0): Promise<string> {
 const requestId = crypto.randomUUID();
 const db = await privileged();
 const {error} = await db.rpc('reserve_tenant_request',{p_org:tenant.org.id,p_user:tenant.userId,p_request:requestId,p_operation:operation,p_provider:provider,p_reserve:reserve});
 if (error) throw new Error('Workspace quota, rate limit, or permission prevented this request.');
 return requestId;
}
export async function settleRequest(requestId: string, credits: number | null, status: 'success'|'failed'|'unknown') {
 const db = await privileged();
 // Retrying the ledger RPC is safe. Never retry the external charged request.
 for (let attempt=0; attempt<3; attempt++) {
  const {error} = await db.rpc('settle_tenant_request',{p_request:requestId,p_credits:credits,p_status:status});
  if (!error) return;
 }
 throw new Error('Credit accounting unavailable; reservation retained.');
}
export async function withTenantRequest<T>(tenant: TenantContext, operation: Operation, run: () => Promise<T>): Promise<T> {
 const id = await reserveRequest(tenant,operation);
 try { const result = await run(); await settleRequest(id,0,'success'); return result; }
 catch { await settleRequest(id,0,'failed'); throw new Error('Monitoring request failed. Please retry later.'); }
}