import type { TenantContext } from '../security/tenant.server';
import { reserveRequest,settleRequest } from '../security/tenant.server';
import { boundedText,validateCustomRead } from '../security/http.server';
import { creditsCharged,parseSearchHits,parseReadText } from './automatio-response';
import { analyzeSentiment } from './analysis.server';
import type { FeedItem,FeedFilters } from './types';
function reserveLimit():number|null {
 const value=Number(process.env['AUTOMATIO_MAX_CREDITS_PER_CALL']);
 return Number.isFinite(value)&&value>0&&value<=10000?value:null;
}
export function automatioEnabled():boolean{return Boolean(process.env['AUTOMATIO_API_KEY'])&&reserveLimit()!==null;}
async function query(tenant:TenantContext,tool:'web_search'|'web_read_url',params:{query:string}|{url:string}):Promise<unknown> {
 const key=process.env['AUTOMATIO_API_KEY'];const limit=reserveLimit();
 if(!key||limit===null)throw new Error('Automatio is disabled.');
 if('url' in params)await validateCustomRead(params.url);
 const id=await reserveRequest(tenant,'automatio','automatio',limit);
 let charged:number|null=null;let status:'success'|'failed'|'unknown'='unknown';
 try {
  const response=await fetch('https://automatio.ai/api/v1/query',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({tool,params}),redirect:'error',signal:AbortSignal.timeout(20000)});
  const body:unknown=JSON.parse(await boundedText(response));
  charged=creditsCharged(body);
  // Only documented pre-execution rejections without billing metadata can be zero.
  if(charged===null&&[400,401,402,429].includes(response.status))charged=0;
  status=response.ok?'success':'failed';
  if(!response.ok)throw new Error('Automatio source unavailable.');
  return body;
 } finally {await settleRequest(id,charged,charged===null?'unknown':status);}
}
export async function searchAutomatio(tenant:TenantContext,filters:FeedFilters):Promise<FeedItem[]> {
 const body=await query(tenant,'web_search',{query:(filters.query?.trim()||'berita terkini').slice(0,200)});
 return parseSearchHits(body).map(hit=>{
  const sentiment=analyzeSentiment(`${hit.title}. ${hit.snippet}`);
  return {id:`automatio:${hit.url}`,kind:'news',title:hit.title,summary:hit.snippet,url:hit.url,source:new URL(hit.url).hostname,sourceKey:'automatio',author:null,imageUrl:null,language:null,country:null,category:null,publishedAt:hit.publishedAt??new Date().toISOString(),sentiment:sentiment.sentiment,sentimentScore:sentiment.score,engagement:0,likes:0,comments:0,shares:0};
 });
}
/** Deliberately not exposed as an RPC; disabled until audited connection-pinned egress exists. */
export async function readAutomatioUrl(tenant:TenantContext,url:string):Promise<string|null>{return parseReadText(await query(tenant,'web_read_url',{url}));}