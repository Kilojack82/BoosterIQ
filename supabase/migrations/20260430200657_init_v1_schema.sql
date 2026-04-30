-- BoosterIQ V1 — initial schema
-- Source documents: BUILD_BRIEF.md (data model), DECISIONS.md (D8, D11)
--
-- Conventions:
--   - All IDs are UUIDs via gen_random_uuid()
--   - All timestamps use TIMESTAMPTZ
--   - Money in cents (INTEGER)
--   - Append-only ledger pattern for stock_movements; current_stock on
--     catalog_items is denormalized cache, recomputable from movements
--
-- RLS posture (V1 — single-tenant pilot, no app auth per DECISIONS.md D4):
--   - All tables have RLS enabled
--   - Permissive SELECT policy for the anon role so the publishable key
--     can read for server-rendered pages
--   - All mutations go through the Secret key (admin client) which
--     bypasses RLS
--   - When auth lands (D4), tighten these to authenticated users with
--     proper club_id scoping

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at trigger function (used by tables that mutate)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Clubs
-- Single-tenant V1, but every other table FKs to clubs.id so V2
-- multi-tenant doesn't need a migration.
-- ---------------------------------------------------------------------------
CREATE TABLE public.clubs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  shortname   TEXT NOT NULL UNIQUE,
  sport       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trig_clubs_updated_at
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Club settings (one row per club, per DECISIONS.md D11)
-- ---------------------------------------------------------------------------
CREATE TABLE public.club_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                     UUID NOT NULL UNIQUE REFERENCES public.clubs(id) ON DELETE CASCADE,
  square_location_id          TEXT,
  google_drive_folder         TEXT,
  signupgenius_url_pattern    TEXT,
  critical_par_buffer         NUMERIC(4,2) NOT NULL DEFAULT 0.5,
  low_par_buffer              NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  cost_change_threshold_pct   NUMERIC(4,2) NOT NULL DEFAULT 5.0,
  theme_primary               TEXT NOT NULL DEFAULT '#1F4D9E',
  theme_accent                TEXT NOT NULL DEFAULT '#F5C518',
  theme_dark                  TEXT NOT NULL DEFAULT '#0F2C66',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trig_club_settings_updated_at
  BEFORE UPDATE ON public.club_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalog items — what the club stocks
-- DECISIONS.md D11: code, square_token, reference_handle, category added.
-- is_merch flag added per the merch-inclusion decision (concessions vs merch
-- live in the same table; the dashboard filters).
-- ---------------------------------------------------------------------------
CREATE TABLE public.catalog_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT,
  unit              TEXT NOT NULL DEFAULT 'each',
  par_level         INTEGER,
  current_stock     INTEGER NOT NULL DEFAULT 0,
  cost_basis_cents  INTEGER,
  vendor            TEXT,
  square_token      TEXT,
  reference_handle  TEXT,
  is_merch          BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, code)
);

CREATE INDEX idx_catalog_items_club           ON public.catalog_items(club_id);
CREATE INDEX idx_catalog_items_square_token   ON public.catalog_items(square_token) WHERE square_token IS NOT NULL;
CREATE INDEX idx_catalog_items_is_merch       ON public.catalog_items(club_id, is_merch);

CREATE TRIGGER trig_catalog_items_updated_at
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Menu items — Square's menu, mapped to catalog_items
-- 1:1 SKU mapping in V1 (no recipes — see Recipes (V2) tab in master sheet).
-- ---------------------------------------------------------------------------
CREATE TABLE public.menu_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  catalog_item_id   UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  square_item_name  TEXT NOT NULL,
  variation         TEXT,
  category          TEXT,
  price_cents       INTEGER,
  square_token      TEXT,
  reference_handle  TEXT,
  sku               TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_club          ON public.menu_items(club_id);
CREATE INDEX idx_menu_items_square_token  ON public.menu_items(square_token) WHERE square_token IS NOT NULL;
CREATE INDEX idx_menu_items_catalog       ON public.menu_items(catalog_item_id) WHERE catalog_item_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Events — games
-- ---------------------------------------------------------------------------
CREATE TABLE public.events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  opponent              TEXT,
  is_home               BOOLEAN,
  date                  DATE NOT NULL,
  attendance_actual     INTEGER,
  attendance_predicted  INTEGER,
  weather               TEXT,
  signupgenius_url      TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_club_date ON public.events(club_id, date);

-- ---------------------------------------------------------------------------
-- Receipts — supply runs, parsed from photos by Claude API
-- drive_file_id is the Google Drive file ID (per DECISIONS.md D3 — files
-- live in Drive, database stores the pointer).
-- ---------------------------------------------------------------------------
CREATE TABLE public.receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  vendor            TEXT,
  receipt_date      DATE,
  total_cents       INTEGER,
  photo_url         TEXT NOT NULL,
  drive_file_id     TEXT,
  parsed_data_json  JSONB,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipts_club ON public.receipts(club_id);

-- ---------------------------------------------------------------------------
-- Square imports — CSV uploads after games
-- ---------------------------------------------------------------------------
CREATE TABLE public.square_imports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_id          UUID REFERENCES public.events(id) ON DELETE SET NULL,
  csv_url           TEXT NOT NULL,
  drive_file_id     TEXT,
  parsed_data_json  JSONB,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_square_imports_club  ON public.square_imports(club_id);
CREATE INDEX idx_square_imports_event ON public.square_imports(event_id) WHERE event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Stock movements — append-only ledger (per BUILD_BRIEF.md)
-- Never UPDATE catalog_items.current_stock directly; insert a movement and
-- recompute. This is the audit trail.
-- ---------------------------------------------------------------------------
CREATE TYPE public.stock_source_type AS ENUM ('receipt', 'sale', 'manual', 'reconcile');

CREATE TABLE public.stock_movements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id  UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  delta            INTEGER NOT NULL,
  source_type      public.stock_source_type NOT NULL,
  source_id        UUID,
  notes            TEXT,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_item   ON public.stock_movements(catalog_item_id, occurred_at);
CREATE INDEX idx_stock_movements_source ON public.stock_movements(source_type, source_id) WHERE source_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Volunteer slots — scraped from SignUp Genius (or pasted via D6 fallback)
-- ---------------------------------------------------------------------------
CREATE TABLE public.volunteer_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  slot_position   INTEGER NOT NULL,
  filled_by_name  TEXT,
  filled_at       TIMESTAMPTZ,
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, role, slot_position)
);

CREATE INDEX idx_volunteer_slots_event ON public.volunteer_slots(event_id);

-- ---------------------------------------------------------------------------
-- Volunteer contacts — dormant in V1 per DECISIONS.md D8 (SMS deferred).
-- Kept in the schema so V2 SMS launch doesn't need a migration.
-- ---------------------------------------------------------------------------
CREATE TABLE public.volunteer_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  opted_in_at   TIMESTAMPTZ,
  opted_out_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, phone)
);

CREATE INDEX idx_volunteer_contacts_club ON public.volunteer_contacts(club_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.clubs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_imports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_slots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read clubs"              ON public.clubs              FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read club_settings"      ON public.club_settings      FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read catalog_items"      ON public.catalog_items      FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read menu_items"         ON public.menu_items         FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read events"             ON public.events             FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read receipts"           ON public.receipts           FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read square_imports"     ON public.square_imports     FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read stock_movements"    ON public.stock_movements    FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read volunteer_slots"    ON public.volunteer_slots    FOR SELECT TO anon USING (TRUE);
CREATE POLICY "anon read volunteer_contacts" ON public.volunteer_contacts FOR SELECT TO anon USING (TRUE);

-- ---------------------------------------------------------------------------
-- Seed: Lago Vista Vikings Booster (the V1 pilot club)
-- Settings row with defaults from the master sheet.
-- ---------------------------------------------------------------------------
INSERT INTO public.clubs (name, shortname, sport)
VALUES ('Lago Vista Vikings Booster', 'LakeVistaVikings', 'Multi-sport');

INSERT INTO public.club_settings (club_id)
SELECT id FROM public.clubs WHERE shortname = 'LakeVistaVikings';
