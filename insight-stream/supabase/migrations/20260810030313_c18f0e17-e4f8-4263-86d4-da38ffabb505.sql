-- 1. Archive of every fetched item
CREATE TABLE public.monitored_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  url_key text NOT NULL,
  kind text NOT NULL DEFAULT 'news',
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  source text,
  source_key text,
  author text,
  image_url text,
  language text,
  country text,
  category text,
  sentiment text,
  sentiment_score numeric,
  ai_sentiment text,
  ai_sentiment_confidence numeric,
  ai_topic text,
  ai_summary text,
  keywords text[] NOT NULL DEFAULT '{}',
  engagement integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  published_at timestamp with time zone,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT monitored_items_url_key_unique UNIQUE (url_key)
);

CREATE INDEX monitored_items_published_at_idx ON public.monitored_items (published_at DESC);
CREATE INDEX monitored_items_kind_idx ON public.monitored_items (kind);
CREATE INDEX monitored_items_keywords_idx ON public.monitored_items USING gin (keywords);
CREATE INDEX monitored_items_title_trgm_idx ON public.monitored_items (lower(title));

GRANT SELECT ON public.monitored_items TO authenticated;
GRANT ALL ON public.monitored_items TO service_role;
ALTER TABLE public.monitored_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitored_items_read" ON public.monitored_items FOR SELECT TO authenticated USING (true);

CREATE TRIGGER monitored_items_touch BEFORE UPDATE ON public.monitored_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Daily aggregate per keyword
CREATE TABLE public.item_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  keyword text NOT NULL,
  kind text NOT NULL DEFAULT 'all',
  total integer NOT NULL DEFAULT 0,
  positive integer NOT NULL DEFAULT 0,
  neutral integer NOT NULL DEFAULT 0,
  negative integer NOT NULL DEFAULT 0,
  engagement bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_metrics_daily_unique UNIQUE (day, keyword, kind)
);

CREATE INDEX item_metrics_daily_keyword_idx ON public.item_metrics_daily (keyword, day DESC);

GRANT SELECT ON public.item_metrics_daily TO authenticated;
GRANT ALL ON public.item_metrics_daily TO service_role;
ALTER TABLE public.item_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_metrics_daily_read" ON public.item_metrics_daily FOR SELECT TO authenticated USING (true);

CREATE TRIGGER item_metrics_daily_touch BEFORE UPDATE ON public.item_metrics_daily
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Per-user keyword watchlist
CREATE TABLE public.keyword_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  language text NOT NULL DEFAULT 'id',
  country text NOT NULL DEFAULT 'ID',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT keyword_watchlist_unique UNIQUE (user_id, keyword)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.keyword_watchlist TO authenticated;
GRANT ALL ON public.keyword_watchlist TO service_role;
ALTER TABLE public.keyword_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "keyword_watchlist_own" ON public.keyword_watchlist FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER keyword_watchlist_touch BEFORE UPDATE ON public.keyword_watchlist
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Short-lived feed cache (system only)
CREATE TABLE public.feed_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX feed_cache_expires_at_idx ON public.feed_cache (expires_at);

GRANT ALL ON public.feed_cache TO service_role;
ALTER TABLE public.feed_cache ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER feed_cache_touch BEFORE UPDATE ON public.feed_cache
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();