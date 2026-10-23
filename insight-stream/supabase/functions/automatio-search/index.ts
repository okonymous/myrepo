import { createClient } from "npm:@supabase/supabase-js@2";
const encoder = new TextEncoder();
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
async function readLimited(r: Response, max=300000) {
  const length=Number(r.headers.get("content-length")||0);
  if(length>max) throw new Error("Provider response too large");
  const reader=r.body?.getReader(); if(!reader) return "";
  let n=0; const parts:Uint8Array[]=[];
  try { while(true) {const v=await reader.read();if(v.done) break;n+=v.value.byteLength;if(n>max)throw Error("Provider response too large");parts.push(v.value);} }
  finally { await reader.cancel().catch(()=>{});reader.releaseLock(); }
  const bytes=new Uint8Array(n);let off=0;for(const p of parts){bytes.set(p,off);off+=p.length;}
  return new TextDecoder().decode(bytes);
}
Deno.serve(async (req)=>{
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const jwt=req.headers.get("Authorization");
  if(!jwt?.startsWith("Bearer "))return json({error:"Authentication required"},401);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service) return json({error:"Supabase backend configuration missing"},503);
  const userDb=createClient(url,anon,{global:{headers:{Authorization:jwt}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await userDb.auth.getUser(jwt.slice(7));
  if(authError||!user)return json({error:"Invalid session"},401);
  let input:unknown;
  try{const raw=await req.text();if(encoder.encode(raw).length>4096)return json({error:"Input too large"},413);input=JSON.parse(raw);}catch{return json({error:"Invalid JSON"},400);}
  if(!input||typeof input!=="object")return json({error:"Invalid input"},400);
  const obj=input as Record<string,unknown>;
  if(typeof obj.orgId!=="string"||!/^[0-9a-f-]{36}$/i.test(obj.orgId))return json({error:"Organization required"},400);
  if(obj.tool!=="web_search")return json({error:"Only web_search is enabled; URL read is disabled until SSRF review"},400);
  if(typeof obj.query!=="string"||!obj.query.trim()||obj.query.length>180)return json({error:"Query must be 1-180 characters"},400);
  const {data:member,error:memberError}=await userDb.from("organization_memberships").select("role").eq("org_id",obj.orgId).eq("user_id",user.id).maybeSingle();
  if(memberError||!member||member.role==="viewer")return json({error:"Organization permission denied"},403);
  const secret=Deno.env.get("AUTOMATIO_API_KEY");
  if(!secret)return json({error:"Automatio secret not configured in this Supabase project"},503);
  const limit=Number(Deno.env.get("AUTOMATIO_MAX_CREDITS_PER_CALL")||"10");
  if(!Number.isFinite(limit)||limit<1||limit>1000)return json({error:"Credit guard not configured"},503);
  const db=createClient(url,service,{auth:{persistSession:false}});
  const requestId=crypto.randomUUID();
  const reserve=await db.rpc("reserve_tenant_request",{p_org:obj.orgId,p_user:user.id,p_request:requestId,p_operation:"automatio",p_provider:"automatio",p_reserve:limit});
  if(reserve.error)return json({error:"Usage quota or access restriction"},429);
  let status:"success"|"failed"|"unknown"="unknown";let charged:number|null=null;let output:Response;
  try{
    const res=await fetch("https://automatio.ai/api/v1/query",{
      method:"POST",headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json"},
      body:JSON.stringify({tool:"web_search",params:{query:obj.query.trim()}}),
      redirect:"error",signal:AbortSignal.timeout(18000)});
    const body=JSON.parse(await readLimited(res));
    const c=body?.automatio?.credits_charged;
    charged=typeof c==="number"&&Number.isFinite(c)&&c>=0?c:null;
    if(charged===null&&[400,401,402,429].includes(res.status))charged=0;
    status=res.ok?"success":"failed";
    if(!res.ok)output=json({error:"Upstream provider unavailable",credits_charged:charged},502);
    else output=json({result:body,credits_charged:charged,request_id:requestId});
  } catch { output=json({error:"Upstream request failed; credit reservation remains pending if charge unknown"},502); }
  const settled=await db.rpc("settle_tenant_request",{p_request:requestId,p_credits:charged,p_status:charged===null?"unknown":status});
  if(settled.error)return json({error:"Credit settlement unavailable; request reserved for reconciliation"},503);
  return output;
});