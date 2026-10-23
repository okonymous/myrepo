export interface IdMedia {
  key: string;
  name: string;
  url: string;
  tier: 1 | 2;
}

/** Major Indonesian news outlets (national, highest-traffic) with public RSS feeds. */
export const ID_MEDIA: IdMedia[] = [
  { key: "detik", name: "detikcom", url: "https://news.detik.com/berita/rss", tier: 1 },
  { key: "detik_finance", name: "detikFinance", url: "https://finance.detik.com/rss", tier: 1 },
  { key: "cnnid", name: "CNN Indonesia", url: "https://www.cnnindonesia.com/nasional/rss", tier: 1 },
  { key: "cnbcid", name: "CNBC Indonesia", url: "https://www.cnbcindonesia.com/news/rss", tier: 1 },
  { key: "tempo", name: "Tempo.co", url: "https://rss.tempo.co/nasional", tier: 1 },
  { key: "antara", name: "ANTARA News", url: "https://www.antaranews.com/rss/terkini.xml", tier: 1 },
  { key: "republika", name: "Republika", url: "https://www.republika.co.id/rss", tier: 1 },
  { key: "okezone", name: "Okezone", url: "https://sindikasi.okezone.com/index.php/rss/0/RSS2.0", tier: 1 },
  { key: "mediaindonesia", name: "Media Indonesia", url: "https://mediaindonesia.com/feed", tier: 1 },
  { key: "sindo", name: "Sindonews", url: "https://nasional.sindonews.com/rss", tier: 2 },
  { key: "viva", name: "VIVA", url: "https://www.viva.co.id/get/all", tier: 2 },
  { key: "katadata", name: "Katadata", url: "https://katadata.co.id/rss", tier: 2 },
];

/** Majors without a reachable public RSS feed — mirrored through Google News site: search. */
export const ID_MEDIA_VIA_GOOGLE = [
  "kompas.com",
  "liputan6.com",
  "tribunnews.com",
  "suara.com",
  "merdeka.com",
  "kumparan.com",
  "tirto.id",
  "bisnis.com",
  "kontan.co.id",
  "inews.id",
];

/** Hostnames considered major Indonesian media, used to boost relevance ranking. */
export const ID_MEDIA_DOMAINS = [
  "detik.com",
  "kompas.com",
  "kompas.id",
  "cnnindonesia.com",
  "cnbcindonesia.com",
  "tempo.co",
  "antaranews.com",
  "liputan6.com",
  "republika.co.id",
  "tribunnews.com",
  "okezone.com",
  "sindonews.com",
  "merdeka.com",
  "suara.com",
  "jpnn.com",
  "bisnis.com",
  "katadata.co.id",
  "kontan.co.id",
  "viva.co.id",
  "kumparan.com",
  "tirto.id",
  "beritasatu.com",
  "mediaindonesia.com",
  "inews.id",
  "idntimes.com",
];

export function isIndonesianContext(filters: { language?: string; country?: string }): boolean {
  return filters.language === "id" || (filters.country ?? "").toUpperCase() === "ID";
}

export function isMajorIdDomain(url: string, source: string): boolean {
  const haystack = `${url} ${source}`.toLowerCase();
  return ID_MEDIA_DOMAINS.some((d) => haystack.includes(d));
}

/** Words ignored when matching a query (Indonesian + English stopwords). */
export const STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "pada", "dengan", "adalah", "itu", "ini",
  "para", "atau", "akan", "juga", "oleh", "dalam", "tidak", "sudah", "bisa", "saja",
  "the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "has", "have",
]);