import type {
  FeedAnalytics,
  FeedItem,
  HeatCell,
  RankedTerm,
  Sentiment,
  SourceShare,
  TimeBucket,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Sentiment (lexicon + negation + intensifier scoring, no external API)       */
/* -------------------------------------------------------------------------- */

const POSITIVE_WORDS: Record<string, number> = {
  growth: 1.5, surge: 2, soar: 2, soars: 2, soared: 2, record: 1.5, profit: 1.8, profits: 1.8,
  gain: 1.5, gains: 1.5, rally: 1.6, boost: 1.5, boosted: 1.5, win: 1.6, wins: 1.6, won: 1.5,
  success: 1.8, successful: 1.8, breakthrough: 2, innovative: 1.5, innovation: 1.4, launch: 0.8,
  upgrade: 1.4, upgraded: 1.4, outperform: 1.8, beat: 1.2, beats: 1.2, strong: 1.3, robust: 1.3,
  optimistic: 1.6, positive: 1.5, praise: 1.7, praised: 1.7, award: 1.5, awarded: 1.5, best: 1.4,
  excellent: 2, great: 1.3, good: 1.0, love: 1.6, loves: 1.4, amazing: 1.9, impressive: 1.7,
  improve: 1.3, improved: 1.4, improvement: 1.4, expand: 1.1, expansion: 1.1, partnership: 1.1,
  approval: 1.4, approved: 1.4, milestone: 1.3, popular: 1.1, celebrate: 1.6, celebrated: 1.6,
  recovery: 1.4, rebound: 1.5, bullish: 1.8, upside: 1.3, thrive: 1.7, thriving: 1.7, safe: 1.0,
  secure: 1.0, efficient: 1.2, promising: 1.5, potential: 0.6, opportunity: 1.2, support: 0.9,
  helpful: 1.2, favourite: 1.4, favorite: 1.4, happy: 1.5, exciting: 1.5, excited: 1.4,
};

const NEGATIVE_WORDS: Record<string, number> = {
  crash: 2, crashes: 2, plunge: 2, plunges: 2, plummet: 2, slump: 1.8, decline: 1.5, declines: 1.5,
  drop: 1.3, drops: 1.3, fall: 1.2, falls: 1.2, fell: 1.2, loss: 1.6, losses: 1.6, lawsuit: 1.8,
  sue: 1.6, sued: 1.6, fraud: 2.2, scandal: 2.2, investigation: 1.5, probe: 1.4, fine: 1.2,
  fined: 1.6, penalty: 1.5, recall: 1.7, layoff: 2, layoffs: 2, fired: 1.5, cut: 0.9, cuts: 1.0,
  shutdown: 1.7, bankruptcy: 2.3, debt: 1.2, risk: 1.1, risks: 1.1, warning: 1.4, warns: 1.4,
  concern: 1.2, concerns: 1.2, criticism: 1.6, criticized: 1.6, backlash: 1.9, protest: 1.6,
  boycott: 1.9, outage: 1.7, breach: 2, hack: 1.9, hacked: 2, malware: 1.8, vulnerability: 1.5,
  delay: 1.2, delayed: 1.2, fail: 1.8, fails: 1.8, failure: 1.9, failed: 1.8, weak: 1.3, poor: 1.4,
  bad: 1.3, worst: 1.9, terrible: 2, awful: 2, hate: 1.9, angry: 1.6, disappointing: 1.7,
  disappointed: 1.6, bearish: 1.8, downgrade: 1.6, downgraded: 1.6, missed: 1.2, miss: 1.0,
  controversy: 1.7, controversial: 1.5, crisis: 2, death: 1.8, dead: 1.7, killed: 2, war: 1.6,
  attack: 1.8, threat: 1.5, ban: 1.5, banned: 1.6, banning: 1.5, halt: 1.3, halted: 1.3,
  problem: 1.3, problems: 1.3, issue: 0.8, issues: 0.8, bug: 1.2, broken: 1.4, scam: 2.2,
};

const NEGATIONS = new Set(["not", "no", "never", "without", "isn't", "aren't", "won't", "cannot", "can't", "don't", "doesn't", "didn't"]);
const INTENSIFIERS: Record<string, number> = { very: 1.5, extremely: 1.8, hugely: 1.7, massively: 1.8, slightly: 0.6, somewhat: 0.7, really: 1.4, deeply: 1.5 };

export function analyzeSentiment(text: string): { sentiment: Sentiment; score: number } {
  const tokens = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let score = 0;
  let hits = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const base = POSITIVE_WORDS[token] ?? -(NEGATIVE_WORDS[token] ?? 0);
    if (!base) continue;
    let value = base;
    const prev = tokens[i - 1];
    if (prev && INTENSIFIERS[prev]) value *= INTENSIFIERS[prev];
    if (prev && NEGATIONS.has(prev)) value *= -0.85;
    const prev2 = tokens[i - 2];
    if (prev2 && NEGATIONS.has(prev2)) value *= -0.7;
    score += value;
    hits++;
  }

  if (!hits) return { sentiment: "neutral", score: 0 };
  const normalized = Math.max(-1, Math.min(1, score / Math.sqrt(hits * 4)));
  const sentiment: Sentiment = normalized > 0.14 ? "positive" : normalized < -0.14 ? "negative" : "neutral";
  return { sentiment, score: Number(normalized.toFixed(3)) };
}

/* -------------------------------------------------------------------------- */
/* Entity + keyword extraction                                                 */
/* -------------------------------------------------------------------------- */

const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself new no nor not now of off on once only or other our ours out over own re said same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very via was we were what when where which while who whom why will with would you your yours amp http https com www one two says say will get got make made like time year years day days week month via first last next best via also may might much many back still even since around according reuters news report reports update updates video watch photo`.split(
    /\s+/,
  ),
);

const COMPANY_SUFFIX = /\b(inc|ltd|llc|corp|corporation|group|holdings|plc|gmbh|technologies|labs|motors|bank|airlines|studios|media|systems)\b/i;

const KNOWN_LOCATIONS = new Set(
  ["united states", "usa", "us", "uk", "united kingdom", "china", "india", "russia", "ukraine", "germany", "france", "japan", "canada", "australia", "brazil", "mexico", "israel", "iran", "spain", "italy", "netherlands", "sweden", "norway", "poland", "turkey", "egypt", "nigeria", "kenya", "south africa", "singapore", "korea", "taiwan", "new york", "london", "paris", "berlin", "tokyo", "beijing", "moscow", "dubai", "san francisco", "silicon valley", "washington", "california", "texas", "florida", "chicago", "boston", "seattle", "toronto", "sydney", "mumbai", "delhi"],
);

function titleCaseTokens(text: string): string[] {
  const cleaned = text.replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s'-]/gu, " ");
  const matches = cleaned.match(/\b[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2}\b/gu) ?? [];
  return matches.filter((m) => !STOPWORDS.has(m.toLowerCase()) && m.length > 2);
}

interface Tally {
  count: number;
  positive: number;
  negative: number;
}

function bump(map: Map<string, Tally>, key: string, sentiment: Sentiment) {
  const entry = map.get(key) ?? { count: 0, positive: 0, negative: 0 };
  entry.count += 1;
  if (sentiment === "positive") entry.positive += 1;
  if (sentiment === "negative") entry.negative += 1;
  map.set(key, entry);
}

function rank(map: Map<string, Tally>, limit: number): RankedTerm[] {
  return [...map.entries()]
    .map(([term, t]) => ({ term, count: t.count, positive: t.positive, negative: t.negative }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                 */
/* -------------------------------------------------------------------------- */

export function buildAnalytics(items: FeedItem[]): FeedAnalytics {
  const keywords = new Map<string, Tally>();
  const hashtags = new Map<string, Tally>();
  const people = new Map<string, Tally>();
  const companies = new Map<string, Tally>();
  const locations = new Map<string, Tally>();
  const authors = new Map<string, Tally>();
  const sources = new Map<string, number>();
  const buckets = new Map<string, TimeBucket>();
  const heat = new Map<string, HeatCell>();

  const now = Date.now();
  const dayAgo = now - 24 * 3600 * 1000;
  const twoDaysAgo = now - 48 * 3600 * 1000;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let newsToday = 0;
  let socialToday = 0;
  let totalNews = 0;
  let totalSocial = 0;
  let totalEngagement = 0;
  let currentWindow = 0;
  let previousWindow = 0;

  for (const item of items) {
    const ts = new Date(item.publishedAt).getTime();
    const isToday = ts >= dayAgo;

    if (item.kind === "news") {
      totalNews++;
      if (isToday) newsToday++;
    } else {
      totalSocial++;
      if (isToday) socialToday++;
    }

    if (item.sentiment === "positive") positive++;
    else if (item.sentiment === "negative") negative++;
    else neutral++;

    totalEngagement += item.engagement;
    if (ts >= dayAgo) currentWindow++;
    else if (ts >= twoDaysAgo) previousWindow++;

    sources.set(item.source, (sources.get(item.source) ?? 0) + 1);
    if (item.author) bump(authors, item.author, item.sentiment);

    const text = `${item.title} ${item.summary}`;

    for (const tag of text.match(/#[\p{L}\p{N}_]{2,30}/gu) ?? []) {
      bump(hashtags, tag.toLowerCase(), item.sentiment);
    }

    for (const word of text.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)) {
      if (word.length < 4 || STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
      bump(keywords, word, item.sentiment);
    }

    for (const phrase of titleCaseTokens(text)) {
      const lower = phrase.toLowerCase();
      if (KNOWN_LOCATIONS.has(lower)) {
        bump(locations, phrase, item.sentiment);
      } else if (COMPANY_SUFFIX.test(phrase) || /^[A-Z]{2,5}$/.test(phrase)) {
        bump(companies, phrase, item.sentiment);
      } else if (/^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(phrase)) {
        bump(people, phrase, item.sentiment);
      } else {
        bump(companies, phrase, item.sentiment);
      }
    }

    const d = new Date(ts);
    const bucketKey = `${d.toISOString().slice(0, 13)}:00`;
    const bucket = buckets.get(bucketKey) ?? {
      bucket: bucketKey,
      label: `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}h`,
      total: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      news: 0,
      social: 0,
    };
    bucket.total++;
    bucket[item.sentiment]++;
    bucket[item.kind]++;
    buckets.set(bucketKey, bucket);

    const heatKey = `${d.getUTCDay()}-${d.getUTCHours()}`;
    const cell = heat.get(heatKey) ?? { day: dayNames[d.getUTCDay()], hour: d.getUTCHours(), count: 0 };
    cell.count++;
    heat.set(heatKey, cell);
  }

  const mentionGrowth = previousWindow === 0
    ? currentWindow > 0 ? 100 : 0
    : Number((((currentWindow - previousWindow) / previousWindow) * 100).toFixed(1));

  const keywordRanking = rank(keywords, 60);
  const sourceShare: SourceShare[] = [...sources.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    totalNews,
    totalSocial,
    newsToday,
    socialToday,
    positive,
    neutral,
    negative,
    totalEngagement,
    mentionGrowth,
    keywords: keywordRanking,
    hashtags: rank(hashtags, 30),
    people: rank(people, 15),
    companies: rank(companies, 15),
    locations: rank(locations, 15),
    authors: rank(authors, 15),
    topPositiveTopics: [...keywordRanking].filter((k) => k.positive > 0).sort((a, b) => b.positive - a.positive).slice(0, 8),
    topNegativeTopics: [...keywordRanking].filter((k) => k.negative > 0).sort((a, b) => b.negative - a.negative).slice(0, 8),
    timeline: [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-48),
    sources: sourceShare,
    heatmap: [...heat.values()],
  };
}