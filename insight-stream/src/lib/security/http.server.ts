import { ID_MEDIA } from '../monitoring/indonesia';
import { isPublicIp, validatePublicUrl } from './safe-url';
const TRUSTED_HOSTS=new Set(['news.google.com','api.gdeltproject.org','newsapi.org','www.reddit.com','old.reddit.com','api.reddit.com','public.api.bsky.app','mastodon.social','www.googleapis.com','search.brave.com','r.jina.ai',...ID_MEDIA.map(m=>new URL(m.url).hostname)]);
export async function boundedText(response: Response, maxBytes=2_000_000): Promise<string> {
 if (Number(response.headers.get('content-length'))>maxBytes) {await response.body?.cancel();throw new Error('Response too large');}
 const reader=response.body?.getReader();
 if (!reader) return '';
 let bytes=0; const chunks: Uint8Array[]=[];
 try { while(true) {const {done,value}=await reader.read(); if(done)break; bytes+=value.length; if(bytes>maxBytes)throw new Error('Response too large'); chunks.push(value);} }
 catch(error){await reader.cancel();throw error;} finally {reader.releaseLock();}
 const combined=new Uint8Array(bytes); let offset=0; for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder().decode(combined);
}
export async function validateDns(url: URL): Promise<void> {
 for (const type of ['A','AAAA']) {
  const endpoint=new URL('https://cloudflare-dns.com/dns-query');endpoint.searchParams.set('name',url.hostname);endpoint.searchParams.set('type',type);
  const response=await fetch(endpoint,{headers:{Accept:'application/dns-json'},redirect:'error',signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw new Error('DNS validation unavailable');
  const result=JSON.parse(await boundedText(response,32000)) as {Status?:number;Answer?:{type:number;data:string}[]};
  if(result.Status!==0)throw new Error('DNS validation failed');
  const addresses=(result.Answer??[]).filter(a=>a.type===1||a.type===28);
  if(addresses.some(a=>!isPublicIp(a.data)))throw new Error('URL not permitted');
 }
}
export async function validateCustomRead(raw:string):Promise<never> {
 const url=validatePublicUrl(raw); await validateDns(url);
 // DNS preflight cannot pin Worker fetch or a remote provider connection. Fail closed on rebinding.
 throw new Error('Custom URL reading disabled until connection-pinned egress is configured.');
}
export async function trustedFetch(raw:string,init:RequestInit,timeoutMs=12000):Promise<Response> {
 let url=validatePublicUrl(raw);
 const signal=AbortSignal.timeout(Math.min(timeoutMs,20000));
 for(let hop=0;hop<=3;hop++) {
  if(!TRUSTED_HOSTS.has(url.hostname))throw new Error('Source destination not permitted');
  const response=await fetch(url,{...init,redirect:'manual',signal});
  if(![301,302,303,307,308].includes(response.status))return response;
  const location=response.headers.get('location');await response.body?.cancel();
  if(!location || hop===3)throw new Error('Source redirect rejected');
  const next=validatePublicUrl(new URL(location,url).href);
  // Never forward provider credentials across origins.
  if(next.origin!==url.origin && (new Headers(init.headers).has('Authorization') || new Headers(init.headers).has('X-Api-Key') || url.searchParams.has('key')))throw new Error('Source redirect rejected');
  url=next;
 }
 throw new Error('Source unavailable');
}
export async function mapLimited<T,R>(values:T[],limit:number,run:(value:T)=>Promise<R>):Promise<R[]> {
 const results:R[]=new Array(values.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{while(cursor<values.length){const index=cursor++;results[index]=await run(values[index]);}}));
 return results;
}