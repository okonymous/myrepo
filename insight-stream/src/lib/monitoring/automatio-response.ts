import { z } from 'zod';
import { validatePublicUrl } from '../security/safe-url';
const RecordSchema=z.record(z.unknown());
export function creditsCharged(body: unknown): number | null {
 const parsed=RecordSchema.safeParse(body);if(!parsed.success)return null;
 const metadata=RecordSchema.safeParse(parsed.data.automatio);if(!metadata.success)return null;
 const charge=z.number().finite().nonnegative().max(100000000).safeParse(metadata.data.credits_charged);
 return charge.success?charge.data:null;
}
export interface SearchHit {title:string; url:string; snippet:string; publishedAt:string|null}
// Direct tool result only. Known common aliases are accepted without assuming a data/result wrapper.
export function parseSearchHits(body:unknown):SearchHit[] {
 const parsed=RecordSchema.safeParse(body);if(!parsed.success)return [];
 const rows=parsed.data.organic_results??parsed.data.organic??parsed.data.results;
 if(!Array.isArray(rows))return [];
 const hits:SearchHit[]=[];
 for(const raw of rows.slice(0,50)) {
  const row=RecordSchema.safeParse(raw);if(!row.success)continue;
  const title=row.data.title;const link=row.data.url??row.data.link;const snippet=row.data.description??row.data.snippet??'';
  if(typeof title!=='string'||typeof link!=='string'||typeof snippet!=='string')continue;
  try {const url=validatePublicUrl(link);const date=row.data.published_at??row.data.date;hits.push({title:title.slice(0,500),url:url.href,snippet:snippet.slice(0,2000),publishedAt:typeof date==='string'&&Number.isFinite(Date.parse(date))?new Date(date).toISOString():null});}catch{/* Reject unsafe result links. */}
 }
 return hits;
}
export function parseReadText(body:unknown):string|null {
 const parsed=RecordSchema.safeParse(body);if(!parsed.success)return null;
 const value=parsed.data.markdown??parsed.data.content;
 return typeof value==='string'?value.slice(0,100000):null;
}