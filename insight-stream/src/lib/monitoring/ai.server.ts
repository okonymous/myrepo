import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { createLovableResponsesProvider, LOVABLE_CHAT_MODEL } from "@/lib/ai-gateway.server";
import type { FeedItem, Sentiment } from "./types";

const SentimentEnum = z.enum(["positive", "neutral", "negative"]);

const ClassificationSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      sentiment: SentimentEnum,
      topic: z.string(),
    }),
  ),
});

const BriefSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  issues: z.array(
    z.object({
      title: z.string(),
      insight: z.string(),
      sentiment: SentimentEnum,
      mentions: z.number(),
    }),
  ),
});

export interface AiClassification {
  sentiment: Sentiment;
  topic: string;
}

export interface DailyBrief {
  headline: string;
  summary: string;
  issues: { title: string; insight: string; sentiment: Sentiment; mentions: number }[];
  generatedAt: string;
}

function apiKey(): string | null {
  return process.env["LOVABLE_API_KEY"] ?? null;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * AI sentiment + topic labelling for Indonesian/English coverage.
 * Falls back to an empty map on any failure — the lexicon result stays in place.
 */
export async function classifyItems(items: FeedItem[], max = 60): Promise<Map<string, AiClassification>> {
  const out = new Map<string, AiClassification>();
  const key = apiKey();
  if (!key || !items.length) return out;

  const target = items.slice(0, max);
  const gateway = createLovableResponsesProvider(key);
  const model = gateway.responses(LOVABLE_CHAT_MODEL);

  const batches = chunk(target, 20);
  const runs = batches.map(async (batch, batchIndex) => {
    const lines = batch
      .map((item, i) => `${i}. [${item.source}] ${item.title} — ${item.summary.slice(0, 220)}`)
      .join("\n");

    try {
      const result = streamText({
        model,
      abortSignal: AbortSignal.timeout(20000),
      maxOutputTokens: 4000,

        providerOptions: { openai: { store: false } },
        system:
          "Anda analis media Indonesia. Nilai sentimen setiap berita/postingan dari sudut pandang subjek utamanya " +
          "(positive/neutral/negative), pahami sarkasme, bahasa gaul, dan konteks politik Indonesia. " +
          "Beri juga label topik singkat 1-3 kata dalam Bahasa Indonesia (contoh: 'kebijakan pajak', 'kecelakaan lalu lintas'). " +
          "Kembalikan satu entri untuk setiap nomor, gunakan index yang sama persis.",
        prompt: lines,
        output: Output.object({ schema: ClassificationSchema }),
      });

      const parsed = await result.output;
      for (const row of parsed.results) {
        const item = batch[row.index];
        if (!item) continue;
        out.set(item.id, { sentiment: row.sentiment, topic: row.topic.trim().slice(0, 60) });
      }
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        console.error(`[ai] classify batch ${batchIndex} failed:`, "provider unavailable");
      }
    }
  });

  await Promise.allSettled(runs);
  return out;
}

/** Short Indonesian editorial brief over the current result set. */
export async function buildDailyBrief(items: FeedItem[], query: string): Promise<DailyBrief | null> {
  const key = apiKey();
  if (!key || items.length < 3) return null;

  const gateway = createLovableResponsesProvider(key);
  const model = gateway.responses(LOVABLE_CHAT_MODEL);

  const lines = items
    .slice(0, 40)
    .map((i, idx) => `${idx + 1}. [${i.source} | ${i.sentiment}] ${i.title}`)
    .join("\n");

  try {
    const result = streamText({
      model,
      abortSignal: AbortSignal.timeout(20000),
      maxOutputTokens: 4000,
      providerOptions: { openai: { store: false } },
      system:
        "Anda analis media monitoring. Dari daftar judul berita/postingan, rangkum isu terbesar hari ini dalam Bahasa Indonesia. " +
        "headline: satu kalimat pendek. summary: 2-3 kalimat. issues: maksimal 5 isu, masing-masing dengan judul isu singkat, " +
        "insight satu kalimat, sentimen dominan, dan perkiraan jumlah pemberitaan terkait. Jangan mengarang fakta di luar daftar.",
      prompt: `Kata kunci pantauan: ${query || "(umum)"}\n\n${lines}`,
      output: Output.object({ schema: BriefSchema }),
    });

    const parsed = await result.output;
    return {
      headline: parsed.headline,
      summary: parsed.summary,
      issues: parsed.issues.slice(0, 5),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[ai] daily brief failed:", "provider unavailable");
    return null;
  }
}