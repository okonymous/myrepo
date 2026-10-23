import type { FeedItem } from "./types";
import { STOPWORDS } from "./indonesia";

/* ------------------------------ Normalisation ----------------------------- */

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}#@\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ID_PREFIXES = ["memper", "menge", "meng", "meny", "mem", "men", "me", "peng", "peny", "pem", "pen", "per", "ber", "ter", "di", "ke", "se"];
const ID_SUFFIXES = ["kannya", "annya", "inya", "nya", "kan", "lah", "kah", "pun", "an", "i"];

/** Light Indonesian/English stemmer: enough to match "kebakaran" ~ "bakar", "runs" ~ "run". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && (w.endsWith("es") || w.endsWith("s")) && !w.endsWith("ss")) {
    w = w.endsWith("es") ? w.slice(0, -2) : w.slice(0, -1);
  }
  for (const suffix of ID_SUFFIXES) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  for (const prefix of ID_PREFIXES) {
    if (w.length - prefix.length >= 4 && w.startsWith(prefix)) {
      w = w.slice(prefix.length);
      break;
    }
  }
  return w;
}

export function tokenize(value: string): string[] {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

/* -------------------------------- Query ---------------------------------- */

export interface ParsedQuery {
  /** Exact phrases that must appear verbatim ("..."). */
  phrases: string[];
  /** Terms that must not appear (-term). */
  excluded: string[];
  /** Regular terms, each with its stem. */
  terms: { raw: string; stem: string }[];
  /** True when the query carries no usable signal. */
  empty: boolean;
}

export function parseQuery(raw: string): ParsedQuery {
  const input = (raw ?? "").trim();
  const phrases: string[] = [];
  const excluded: string[] = [];
  const terms: { raw: string; stem: string }[] = [];

  const rest = input.replace(/"([^"]+)"/g, (_m, phrase: string) => {
    const norm = normalizeText(phrase);
    if (norm) phrases.push(norm);
    return " ";
  });

  for (const chunk of rest.split(/\s+/)) {
    if (!chunk) continue;
    if (chunk.startsWith("-") && chunk.length > 1) {
      const t = normalizeText(chunk.slice(1));
      if (t) excluded.push(t);
      continue;
    }
    const cleaned = chunk.startsWith("+") ? chunk.slice(1) : chunk;
    for (const t of tokenize(cleaned)) {
      if (t.length < 2) continue;
      terms.push({ raw: t, stem: stem(t) });
    }
  }

  // Drop stopwords only when meaningful terms remain.
  const meaningful = terms.filter((t) => !STOPWORDS.has(t.raw));
  const finalTerms = meaningful.length ? meaningful : terms;

  return {
    phrases,
    excluded,
    terms: finalTerms,
    empty: !phrases.length && !finalTerms.length,
  };
}

/* ------------------------------- Matching -------------------------------- */

export interface ItemIndex {
  titleTokens: Set<string>;
  titleStems: Set<string>;
  bodyTokens: Set<string>;
  bodyStems: Set<string>;
  titleText: string;
  bodyText: string;
}

export function indexItem(item: FeedItem): ItemIndex {
  const titleText = normalizeText(item.title);
  const bodyText = normalizeText(`${item.summary} ${item.source} ${item.author ?? ""}`);
  const titleTokens = titleText.split(/\s+/).filter(Boolean);
  const bodyTokens = bodyText.split(/\s+/).filter(Boolean);
  return {
    titleText,
    bodyText,
    titleTokens: new Set(titleTokens),
    titleStems: new Set(titleTokens.map(stem)),
    bodyTokens: new Set(bodyTokens),
    bodyStems: new Set(bodyTokens.map(stem)),
  };
}

export interface MatchResult {
  /** Fraction of query terms found anywhere (0..1). */
  coverage: number;
  /** Weighted relevance contribution. */
  score: number;
  /** All phrases present. */
  phrasesOk: boolean;
  /** No excluded term present. */
  allowed: boolean;
  exactTitleHits: number;
}

export function matchItem(index: ItemIndex, query: ParsedQuery, idf: Map<string, number>): MatchResult {
  const allowed = !query.excluded.some((t) => index.titleText.includes(t) || index.bodyText.includes(t));
  const phrasesOk = query.phrases.every((p) => index.titleText.includes(p) || index.bodyText.includes(p));

  let score = 0;
  let found = 0;
  let exactTitleHits = 0;

  for (const term of query.terms) {
    const weight = idf.get(term.raw) ?? 1;
    let best = 0;
    if (index.titleTokens.has(term.raw)) {
      best = 10;
      exactTitleHits += 1;
    } else if (index.titleStems.has(term.stem)) {
      best = 7;
      exactTitleHits += 1;
    } else if (index.bodyTokens.has(term.raw)) {
      best = 4;
    } else if (index.bodyStems.has(term.stem)) {
      best = 2.5;
    } else if (term.raw.length >= 5 && (index.titleText.includes(term.raw) || index.bodyText.includes(term.raw))) {
      best = 1.5; // substring fallback for compounds/hashtags
    }
    if (best > 0) found += 1;
    score += best * weight;
  }

  // Phrase hits are the strongest precision signal.
  for (const p of query.phrases) {
    if (index.titleText.includes(p)) score += 25;
    else if (index.bodyText.includes(p)) score += 12;
  }

  // Reward adjacency: query terms appearing next to each other in the title.
  if (query.terms.length > 1) {
    const seq = query.terms.map((t) => t.raw).join(" ");
    if (index.titleText.includes(seq)) score += 18;
    else if (index.bodyText.includes(seq)) score += 8;
  }

  const total = query.terms.length || 1;
  return { coverage: query.terms.length ? found / total : phrasesOk ? 1 : 0, score, phrasesOk, allowed, exactTitleHits };
}

/** Inverse document frequency so common words weigh less than distinctive ones. */
export function buildIdf(indexes: ItemIndex[], query: ParsedQuery): Map<string, number> {
  const n = Math.max(1, indexes.length);
  const idf = new Map<string, number>();
  for (const term of query.terms) {
    let df = 0;
    for (const idx of indexes) {
      if (idx.titleTokens.has(term.raw) || idx.bodyTokens.has(term.raw) || idx.titleStems.has(term.stem) || idx.bodyStems.has(term.stem)) {
        df += 1;
      }
    }
    // Clamp so a term present everywhere still counts a little.
    idf.set(term.raw, Math.min(2.2, Math.max(0.45, Math.log((n + 1) / (df + 1)) + 0.6)));
  }
  return idf;
}

/** Signature used to drop near-duplicate coverage of the exact same story. */
export function titleSignature(title: string): string {
  const tokens = tokenize(title)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t))
    .map(stem);
  return Array.from(new Set(tokens)).sort().slice(0, 6).join("|");
}