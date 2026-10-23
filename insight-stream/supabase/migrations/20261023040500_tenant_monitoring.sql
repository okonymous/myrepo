-- Additive tenant storage; legacy shared archives are no longer used by this app.
CREATE TABLE public.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL DEFAULT 'Personal workspace',
 personal_user_id uuid UNIQUE, provider text NOT NULL DEFAULT 'existing' CHECK(provider IN ('existing','hybrid','automatio')),
 monthly_query_limit integer NOT NULL DEFAULT 1000 CHECK(monthly_query_limit BETWEEN 1 AND 100000),
 monthly_credit_limit numeric NOT NULL DEFAULT 1000 CHECK(monthly_credit_limit >= 0),
 automatio_call_limit integer NOT NULL DEFAULT 100 CHECK(automatio_call_limit BETWEEN 0 AND 10000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.organization_memberships (
 org_id uuid NOT NULL REFERENCES public.organizations(id), user_id uuid NOT NULL,
 role text NOT NULL DEFAULT 'analyst' CHECK(role IN ('owner','admin','analyst','viewer')),
 PRIMARY KEY(org_id,user_id), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_memberships TO authenticated;
GRANT ALL ON public.organization_memberships TO service_role;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.is_org_member(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_memberships WHERE org_id=p_org AND user_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated,service_role;
CREATE POLICY org_read ON public.organizations FOR SELECT TO authenticated USING(public.is_org_member(id));
CREATE POLICY member_read ON public.organization_memberships FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE TABLE public.tenant_monthly_usage (
 org_id uuid NOT NULL REFERENCES public.organizations(id), month date NOT NULL,
 queries integer NOT NULL DEFAULT 0, credits numeric NOT NULL DEFAULT 0, reserved_credits numeric NOT NULL DEFAULT 0,
 automatio_calls integer NOT NULL DEFAULT 0, PRIMARY KEY(org_id,month)
);
GRANT SELECT ON public.tenant_monthly_usage TO authenticated;
GRANT ALL ON public.tenant_monthly_usage TO service_role;
ALTER TABLE public.tenant_monthly_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_read ON public.tenant_monthly_usage FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE TABLE public.tenant_credit_usage (
 request_id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES public.organizations(id), user_id uuid NOT NULL,
 month date NOT NULL, operation text NOT NULL, provider text NOT NULL,
 reserved numeric NOT NULL DEFAULT 0, credits_charged numeric, status text NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
GRANT SELECT ON public.tenant_credit_usage TO authenticated;
GRANT ALL ON public.tenant_credit_usage TO service_role;
ALTER TABLE public.tenant_credit_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_read ON public.tenant_credit_usage FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE INDEX tenant_requests_rate ON public.tenant_credit_usage(org_id,created_at DESC);
CREATE TABLE public.tenant_monitored_items (
 org_id uuid NOT NULL REFERENCES public.organizations(id), url_key text NOT NULL, payload jsonb NOT NULL,
 last_seen_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(org_id,url_key)
);
GRANT SELECT ON public.tenant_monitored_items TO authenticated;
GRANT ALL ON public.tenant_monitored_items TO service_role;
ALTER TABLE public.tenant_monitored_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY archive_read ON public.tenant_monitored_items FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE TABLE public.tenant_item_metrics_daily (
 org_id uuid NOT NULL REFERENCES public.organizations(id), day date NOT NULL, keyword text NOT NULL, kind text NOT NULL,
 total integer NOT NULL DEFAULT 0, positive integer NOT NULL DEFAULT 0, neutral integer NOT NULL DEFAULT 0,
 negative integer NOT NULL DEFAULT 0, engagement bigint NOT NULL DEFAULT 0, PRIMARY KEY(org_id,day,keyword,kind)
);
GRANT SELECT ON public.tenant_item_metrics_daily TO authenticated;
GRANT ALL ON public.tenant_item_metrics_daily TO service_role;
ALTER TABLE public.tenant_item_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY metrics_read ON public.tenant_item_metrics_daily FOR SELECT TO authenticated USING(public.is_org_member(org_id));
CREATE TABLE public.tenant_feed_cache (
 org_id uuid NOT NULL REFERENCES public.organizations(id), cache_key text NOT NULL, payload jsonb NOT NULL,
 expires_at timestamptz NOT NULL, PRIMARY KEY(org_id,cache_key)
);
GRANT SELECT ON public.tenant_feed_cache TO authenticated;
GRANT ALL ON public.tenant_feed_cache TO service_role;
ALTER TABLE public.tenant_feed_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY cache_read ON public.tenant_feed_cache FOR SELECT TO authenticated USING(public.is_org_member(org_id));
-- Backfill only personal workspaces, not unowned shared history.
INSERT INTO public.organizations(personal_user_id) SELECT id FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.organization_memberships(org_id,user_id,role)
 SELECT id,personal_user_id,'owner' FROM public.organizations WHERE personal_user_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE FUNCTION public.create_personal_workspace() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid;
BEGIN
 INSERT INTO public.organizations(personal_user_id) VALUES(NEW.id) ON CONFLICT(personal_user_id) DO UPDATE SET personal_user_id=EXCLUDED.personal_user_id RETURNING id INTO org;
 INSERT INTO public.organization_memberships(org_id,user_id,role) VALUES(org,NEW.id,'owner') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.create_personal_workspace() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profiles_workspace AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_personal_workspace();
-- Serialize all admission decisions on the organization row. No client can reserve/settle credits.
CREATE FUNCTION public.reserve_tenant_request(p_org uuid,p_user uuid,p_request uuid,p_operation text,p_provider text,p_reserve numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg public.organizations; usage public.tenant_monthly_usage; m date:=date_trunc('month',now())::date; member_role text;
BEGIN
 SELECT * INTO cfg FROM public.organizations WHERE id=p_org FOR UPDATE;
 SELECT role INTO member_role FROM public.organization_memberships WHERE org_id=p_org AND user_id=p_user;
 IF cfg.id IS NULL OR member_role IS NULL OR (member_role='viewer' AND p_operation<>'trend') THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_operation NOT IN ('feed','brief','trend','instagram','automatio') OR p_provider NOT IN ('existing','automatio') OR p_reserve<0 OR p_reserve>10000 THEN RAISE EXCEPTION 'Invalid request'; END IF;
 IF EXISTS(SELECT 1 FROM public.tenant_credit_usage WHERE request_id=p_request) THEN RAISE EXCEPTION 'Duplicate request'; END IF;
 IF (SELECT count(*) FROM public.tenant_credit_usage WHERE org_id=p_org AND created_at>now()-interval '1 minute')>=20 THEN RAISE EXCEPTION 'Rate limit reached'; END IF;
 IF (SELECT count(*) FROM public.tenant_credit_usage WHERE org_id=p_org AND status='pending' AND created_at>now()-interval '5 minutes')>=3 THEN RAISE EXCEPTION 'Concurrent request limit reached'; END IF;
 INSERT INTO public.tenant_monthly_usage(org_id,month) VALUES(p_org,m) ON CONFLICT DO NOTHING;
 SELECT * INTO usage FROM public.tenant_monthly_usage WHERE org_id=p_org AND month=m FOR UPDATE;
 IF usage.queries>=cfg.monthly_query_limit OR usage.credits+usage.reserved_credits+p_reserve>cfg.monthly_credit_limit THEN RAISE EXCEPTION 'Monthly quota reached'; END IF;
 IF p_provider='automatio' AND (cfg.provider='existing' OR usage.automatio_calls>=cfg.automatio_call_limit OR p_reserve<=0) THEN RAISE EXCEPTION 'Provider disabled or limited'; END IF;
 UPDATE public.tenant_monthly_usage SET queries=queries+1,reserved_credits=reserved_credits+p_reserve,automatio_calls=automatio_calls+CASE WHEN p_provider='automatio' THEN 1 ELSE 0 END WHERE org_id=p_org AND month=m;
 INSERT INTO public.tenant_credit_usage(request_id,org_id,user_id,month,operation,provider,reserved) VALUES(p_request,p_org,p_user,m,p_operation,p_provider,p_reserve);
END $$;
CREATE FUNCTION public.settle_tenant_request(p_request uuid,p_credits numeric,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE entry public.tenant_credit_usage;
BEGIN
 IF p_status NOT IN ('success','failed','unknown') OR (p_credits IS NOT NULL AND (p_credits<0 OR p_credits>100000000)) THEN RAISE EXCEPTION 'Invalid settlement'; END IF;
 SELECT * INTO entry FROM public.tenant_credit_usage WHERE request_id=p_request FOR UPDATE;
 IF entry.request_id IS NULL THEN RAISE EXCEPTION 'Unknown request'; END IF;
 IF entry.status<>'pending' THEN RETURN; END IF;
 -- Unknown billing retains the reservation until manual reconciliation; never assume zero on timeouts.
 UPDATE public.tenant_monthly_usage SET credits=credits+COALESCE(p_credits,0),reserved_credits=reserved_credits-CASE WHEN p_credits IS NULL THEN 0 ELSE entry.reserved END WHERE org_id=entry.org_id AND month=entry.month;
 UPDATE public.tenant_credit_usage SET credits_charged=p_credits,status=p_status,finished_at=now() WHERE request_id=p_request;
END $$;
REVOKE ALL ON FUNCTION public.reserve_tenant_request(uuid,uuid,uuid,text,text,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.settle_tenant_request(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tenant_request(uuid,uuid,uuid,text,text,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_tenant_request(uuid,numeric,text) TO service_role;
-- Restrictive policies close existing global reads without destroying legacy rows.
CREATE POLICY legacy_archive_isolation ON public.monitored_items AS RESTRICTIVE FOR SELECT TO authenticated USING(false);
CREATE POLICY legacy_metrics_isolation ON public.item_metrics_daily AS RESTRICTIVE FOR SELECT TO authenticated USING(false);
COMMENT ON TABLE public.monitored_items IS 'DEPRECATED: tenant_monitored_items; legacy unowned archive retained, inaccessible to clients';
COMMENT ON TABLE public.item_metrics_daily IS 'DEPRECATED: tenant_item_metrics_daily; unowned history not assigned to tenants';
COMMENT ON TABLE public.feed_cache IS 'DEPRECATED: tenant_feed_cache';