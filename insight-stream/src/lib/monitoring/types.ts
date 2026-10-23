export type Sentiment = "positive" | "neutral" | "negative";

export type FeedKind = "news" | "social";

export interface FeedItem {
  id: string;
  kind: FeedKind;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceKey: string;
  author: string | null;
  imageUrl: string | null;
  language: string | null;
  country: string | null;
  category: string | null;
  publishedAt: string;
  sentiment: Sentiment;
  sentimentScore: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  /** AI-verified sentiment (Indonesian-aware); null when AI was unavailable. */
  aiSentiment?: Sentiment | null;
  /** Short AI topic label, e.g. "kebijakan pajak". */
  topic?: string | null;
}


export interface RankedTerm {
  term: string;
  count: number;
  positive: number;
  negative: number;
}

export interface TimeBucket {
  bucket: string;
  label: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  news: number;
  social: number;
}

export interface SourceShare {
  source: string;
  count: number;
}

export interface HeatCell {
  day: string;
  hour: number;
  count: number;
}

export interface FeedAnalytics {
  totalNews: number;
  totalSocial: number;
  newsToday: number;
  socialToday: number;
  positive: number;
  neutral: number;
  negative: number;
  totalEngagement: number;
  mentionGrowth: number;
  keywords: RankedTerm[];
  hashtags: RankedTerm[];
  people: RankedTerm[];
  companies: RankedTerm[];
  locations: RankedTerm[];
  authors: RankedTerm[];
  topPositiveTopics: RankedTerm[];
  topNegativeTopics: RankedTerm[];
  timeline: TimeBucket[];
  sources: SourceShare[];
  heatmap: HeatCell[];
}

export interface SourceStatus {
  key: string;
  name: string;
  kind: FeedKind;
  ok: boolean;
  count: number;
  requiresKey: boolean;
  configured: boolean;
  message?: string;
}

export interface FeedResult {
  query: string;
  items: FeedItem[];
  analytics: FeedAnalytics;
  sources: SourceStatus[];
  fetchedAt: string;
  /** True when AI sentiment labelling was applied to this result. */
  aiEnriched?: boolean;
  /** True when the payload was served from the short-lived cache. */
  cached?: boolean;
}


export interface FeedFilters {
  query?: string;
  kind?: "all" | "news" | "social";
  language?: string;
  country?: string;
  category?: string;
  source?: string;
  sentiment?: "all" | Sentiment;
  sinceHours?: number;
}

export const LANGUAGES = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
  { value: "ja", label: "Japanese" },
];

export const COUNTRIES = [
  { value: "ID", label: "Indonesia" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "IN", label: "India" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "ES", label: "Spain" },
  { value: "BR", label: "Brazil" },
  { value: "JP", label: "Japan" },
];

export const CATEGORIES = [
  "business",
  "technology",
  "politics",
  "finance",
  "health",
  "science",
  "sports",
  "entertainment",
];