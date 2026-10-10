CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TABLE positions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text NOT NULL CHECK(length(trim(sku))>0),
 location text NOT NULL CHECK(length(trim(location))>0), name text NOT NULL,
 supplier text, owner text, currency text NOT NULL DEFAULT 'NZD' CHECK(currency ~ '^[A-Z]{3}$'),
 on_hand numeric CHECK(on_hand>=0), allocated numeric CHECK(allocated>=0), unit_cost numeric CHECK(unit_cost>=0),
 lead_days integer CHECK(lead_days>=0), review_days integer CHECK(review_days>=0), safety_days integer CHECK(safety_days>=0),
 moq numeric CHECK(moq>=0), pack numeric CHECK(pack>0), stock_asof date,
 history_start date, history_through date, source_value numeric, source_model_value numeric,
 active boolean NOT NULL DEFAULT true, source jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(sku,location), CHECK(history_through IS NULL OR history_start<=history_through)
);
CREATE TABLE demand (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), position_id uuid NOT NULL REFERENCES positions(id),
 day date NOT NULL, units numeric NOT NULL CHECK(units>=0), source_ref text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(position_id,day)
);
CREATE TABLE orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text NOT NULL UNIQUE,
 position_id uuid NOT NULL REFERENCES positions(id), units numeric NOT NULL CHECK(units>0),
 received numeric NOT NULL DEFAULT 0 CHECK(received>=0 AND received<=units), due date NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','cancelled')), evidence text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE overrides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), position_id uuid NOT NULL REFERENCES positions(id),
 daily_units numeric NOT NULL CHECK(daily_units>=0), valid_until date NOT NULL, reason text NOT NULL,
 actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), position_id uuid NOT NULL REFERENCES positions(id),
 note text NOT NULL, actor text NOT NULL, due date NOT NULL, resolved boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), position_id uuid REFERENCES positions(id),
 action text NOT NULL, actor text NOT NULL, before_data jsonb, after_data jsonb, evidence text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), filename text NOT NULL, sha256 text NOT NULL,
 kind text NOT NULL, row_count integer NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['positions','demand','orders','overrides','reviews','activity','imports'] LOOP
 EXECUTE format('CREATE TRIGGER touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated()',t);
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM public',t);
END LOOP; END $$;
CREATE INDEX demand_lookup ON demand(position_id,day);
CREATE INDEX order_lookup ON orders(position_id,due);
CREATE VIEW v_demand AS
SELECT p.*, coalesce(d.units_90,0) AS units_90,coalesce(d.units_30,0) AS units_30,
 coalesce(d.units_prev60,0) AS units_prev60,
 coalesce(o.daily_units, coalesce(d.units_90,0)/90.0) AS daily_units,
 CASE WHEN o.id IS NULL THEN '90-day mean' ELSE 'dated override' END AS forecast_basis,
 o.valid_until AS override_until,
 CASE WHEN p.on_hand IS NULL OR p.allocated IS NULL OR p.unit_cost IS NULL OR p.lead_days IS NULL
 OR p.review_days IS NULL OR p.safety_days IS NULL OR p.moq IS NULL OR p.pack IS NULL
 OR p.supplier IS NULL OR p.owner IS NULL THEN 'missing planning inputs'
 WHEN p.stock_asof IS NULL OR p.stock_asof<current_date-7 OR p.stock_asof>current_date THEN 'stock snapshot stale or future'
 WHEN p.history_start IS NULL OR p.history_start>current_date-90 OR p.history_through IS NULL
 OR p.history_through<current_date-1 OR p.history_through>=current_date THEN '90-day demand coverage unconfirmed'
 ELSE 'ready' END AS readiness
FROM positions p
LEFT JOIN LATERAL (SELECT sum(units) FILTER(WHERE day>=current_date-90 AND day<current_date) units_90,
 sum(units) FILTER(WHERE day>=current_date-30 AND day<current_date) units_30,
 sum(units) FILTER(WHERE day>=current_date-90 AND day<current_date-30) units_prev60
 FROM demand WHERE position_id=p.id) d ON true
LEFT JOIN LATERAL (SELECT * FROM overrides WHERE position_id=p.id AND valid_until>=current_date ORDER BY created_at DESC,id DESC LIMIT 1) o ON true
WHERE p.active;
CREATE FUNCTION planning(demand_factor numeric DEFAULT 1, extra_lead integer DEFAULT 0)
RETURNS TABLE(id uuid,sku text,location text,supplier text,currency text,readiness text,daily_units numeric,
 available numeric,inbound numeric,target_units numeric,buy_units numeric,buy_cost numeric,days_cover numeric,excess_units numeric,forecast_basis text)
LANGUAGE sql STABLE AS $$
 WITH inputs AS (SELECT d.*, d.daily_units*demand_factor rate, greatest(0,d.lead_days+extra_lead) lead,
 (d.on_hand-d.allocated) avail FROM v_demand d),
 needs AS (SELECT i.*, coalesce((SELECT sum(units-received) FROM orders o WHERE o.position_id=i.id AND status='open'
 AND due<=current_date+(i.lead+i.review_days)),0) incoming,
 ceil(i.rate*(i.lead+i.review_days+i.safety_days)) target FROM inputs i),
 rounded AS (SELECT n.*, CASE WHEN readiness<>'ready' THEN NULL WHEN target-avail-incoming<=0 THEN 0
 ELSE ceil(greatest(target-avail-incoming,moq)/pack)*pack END qty FROM needs n)
 SELECT id,sku,location,supplier,currency,readiness,round(rate,3),avail,incoming,target,qty,round(qty*unit_cost,2),
 round(avail/nullif(rate,0),1), CASE WHEN readiness='ready' THEN greatest(0,avail+incoming-target) END,forecast_basis FROM rounded;
$$;
CREATE VIEW v_plan AS SELECT * FROM planning();
CREATE VIEW v_attention AS
 SELECT id,sku,location,'blocked' AS issue,readiness AS detail FROM v_plan WHERE readiness<>'ready'
 UNION ALL SELECT p.id,p.sku,p.location,'late supply',o.reference FROM orders o JOIN positions p ON p.id=o.position_id
 WHERE o.status='open' AND o.received<o.units AND o.due<current_date
 UNION ALL SELECT p.id,p.sku,p.location,'overdue review',r.note FROM reviews r JOIN positions p ON p.id=r.position_id WHERE NOT r.resolved AND r.due<current_date
 UNION ALL SELECT p.id,p.sku,p.location,'expired override',o.reason FROM overrides o JOIN positions p ON p.id=o.position_id
 WHERE o.valid_until<current_date AND NOT EXISTS(SELECT 1 FROM overrides n WHERE n.position_id=o.position_id AND n.created_at>o.created_at);
CREATE VIEW v_compliance AS
 SELECT id,sku,location,'NZ-STOCK' AS rule,'Stock quantity, cost or stock date missing' AS finding FROM positions
 WHERE active AND (on_hand IS NULL OR unit_cost IS NULL OR stock_asof IS NULL)
 UNION ALL SELECT id,sku,location,'CONTROL-OWNER','Replenishment owner missing' FROM positions WHERE active AND owner IS NULL
 UNION ALL SELECT id,sku,location,'CONTROL-COVERAGE','Demand window not confirmed through yesterday' FROM v_demand WHERE readiness='90-day demand coverage unconfirmed'
 UNION ALL SELECT id,sku,location,'CONTROL-FRESHNESS','Snapshot older than seven days or future dated' FROM v_demand WHERE readiness='stock snapshot stale or future';
REVOKE ALL ON v_demand,v_plan,v_attention,v_compliance FROM public;
REVOKE ALL ON FUNCTION planning(numeric,integer) FROM public;
