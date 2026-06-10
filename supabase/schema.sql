-- ==============================================================================
-- NAVBATGO — PRODUCTION DATABASE SCHEMA (IDEMPOTENT)
-- ==============================================================================
-- Safe to run multiple times in the Supabase SQL Editor.
-- Preserves existing data. Always run the full file top-to-bottom.
-- Last updated: 2026-06-04
-- ==============================================================================

-- ==============================================================================
-- 1. BARBERS TABLE (phone-based identity, no Supabase Auth required)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.barbers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fullname        TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    office_name     TEXT,
    working_hours   TEXT,
    average_price   NUMERIC,
    profile_img     TEXT,
    office_img      TEXT,
    services        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    address         TEXT,
    location        JSONB,
    status          TEXT         NOT NULL DEFAULT 'available',
    lunch_break     TEXT,
    telegram_chat_id TEXT,
    telegram_notifications BOOLEAN NOT NULL DEFAULT false,
    photo_1         TEXT,
    photo_2         TEXT,
    photo_3         TEXT,
    rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
    review_count    INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Check constraints (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barbers_status_check') THEN
        ALTER TABLE public.barbers ADD CONSTRAINT barbers_status_check
            CHECK (status IN ('available', 'working-busy', 'lunch', 'closed'));
    END IF;
END $$;

-- Remove old subscription/tier columns if they exist (safe migration)
ALTER TABLE public.barbers
    DROP COLUMN IF EXISTS tier,
    DROP COLUMN IF EXISTS tier_expires_at,
    DROP COLUMN IF EXISTS booking_count_this_month,
    DROP COLUMN IF EXISTS boost_until,
    DROP COLUMN IF EXISTS is_subscribed,
    DROP COLUMN IF EXISTS sub_expires_at,
    DROP COLUMN IF EXISTS trial_expires_at,
    DROP COLUMN IF EXISTS telegram_notify;

-- ==============================================================================
-- 2. CLIENTS TABLE (phone-based identity or legacy registered clients)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fullname   TEXT NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    phone      TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS profile_img TEXT;

-- Safely drop fkey constraint if migrating from old schema
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_id_fkey;
ALTER TABLE public.clients ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ==============================================================================
-- 3. GUESTS TABLE (phone-based identity — no Supabase Auth required)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.guests (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone      TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index: one guest record per phone number
CREATE UNIQUE INDEX IF NOT EXISTS guests_phone_unique ON public.guests(phone);

-- ==============================================================================
-- 4. BOOKINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id     UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
    client_id     UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    booking_hours TEXT NOT NULL,
    booking_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure all V2 columns exist
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS service_name      TEXT,
    ADD COLUMN IF NOT EXISTS service_price     TEXT,
    ADD COLUMN IF NOT EXISTS service_duration  TEXT,
    ADD COLUMN IF NOT EXISTS guest_name        TEXT,
    ADD COLUMN IF NOT EXISTS guest_phone       TEXT,
    ADD COLUMN IF NOT EXISTS deposit_amount    NUMERIC   DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deposit_status    TEXT      DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS payment_provider  TEXT,
    ADD COLUMN IF NOT EXISTS payment_ref       TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_by      TEXT;

-- Check constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check') THEN
        ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
            CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_deposit_status_check') THEN
        ALTER TABLE public.bookings ADD CONSTRAINT bookings_deposit_status_check
            CHECK (deposit_status IN ('none', 'paid', 'refunded', 'forfeited'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_cancelled_by_check') THEN
        ALTER TABLE public.bookings ADD CONSTRAINT bookings_cancelled_by_check
            CHECK (cancelled_by IN ('client', 'barber', 'system') OR cancelled_by IS NULL);
    END IF;
END $$;

-- Unique index: prevent double-booking an active/accepted slot for the same barber
DROP INDEX IF EXISTS public.bookings_barber_date_time_active_uidx;
CREATE UNIQUE INDEX bookings_barber_date_time_active_uidx
    ON public.bookings (barber_id, booking_date, booking_hours)
    WHERE status NOT IN ('rejected', 'cancelled');

-- Prevent bookings in past calendar days
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_date_not_past;
ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_date_not_past CHECK (booking_date >= CURRENT_DATE) NOT VALID;

-- ==============================================================================
-- 5. VERIFICATION CODES (phone OTP via Telegram bot)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.verification_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone      TEXT NOT NULL,
    code       TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified   BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_codes_phone_idx ON public.verification_codes(phone);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_code ON public.verification_codes (phone, code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_expires ON public.verification_codes (phone, expires_at DESC);

-- ==============================================================================
-- 6. TELEGRAM LINKS (phone ↔ chat_id mapping for verification codes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.telegram_links (
    phone TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_links_select_policy" ON public.telegram_links;
DROP POLICY IF EXISTS "telegram_links_insert_policy" ON public.telegram_links;
DROP POLICY IF EXISTS "telegram_links_update_policy" ON public.telegram_links;

CREATE POLICY "telegram_links_select_policy"
    ON public.telegram_links FOR SELECT USING (true);

CREATE POLICY "telegram_links_insert_policy"
    ON public.telegram_links FOR INSERT WITH CHECK (true);

CREATE POLICY "telegram_links_update_policy"
    ON public.telegram_links FOR UPDATE USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. REVIEWS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id  UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
    client_id  UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    guest_phone TEXT,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    rating     INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_barber_idx ON public.reviews(barber_id);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_unique ON public.reviews(booking_id)
    WHERE booking_id IS NOT NULL;

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE public.barbers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews       ENABLE ROW LEVEL SECURITY;

-- ── Barbers (anyone can select, insert, update — no Supabase Auth) ─────────
DROP POLICY IF EXISTS "Barbers are viewable by everyone"    ON public.barbers;
DROP POLICY IF EXISTS "Barbers can insert their own profile" ON public.barbers;
DROP POLICY IF EXISTS "Barbers can update own profile"       ON public.barbers;

CREATE POLICY "Barbers are viewable by everyone"
    ON public.barbers FOR SELECT USING (true);

CREATE POLICY "Barbers can insert their own profile"
    ON public.barbers FOR INSERT WITH CHECK (true);

CREATE POLICY "Barbers can update own profile"
    ON public.barbers FOR UPDATE USING (true);

-- ── Clients ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients are viewable by everyone"     ON public.clients;
DROP POLICY IF EXISTS "Clients can insert their own profile" ON public.clients;
DROP POLICY IF EXISTS "Clients can update own profile"       ON public.clients;

CREATE POLICY "Clients are viewable by everyone"
    ON public.clients FOR SELECT USING (true);

CREATE POLICY "Clients can insert their own profile"
    ON public.clients FOR INSERT WITH CHECK (true);

CREATE POLICY "Clients can update own profile"
    ON public.clients FOR UPDATE USING (true);

-- ── Guests ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can select guests" ON public.guests;
DROP POLICY IF EXISTS "Anyone can insert guests" ON public.guests;

CREATE POLICY "Anyone can select guests"
    ON public.guests FOR SELECT USING (true);

CREATE POLICY "Anyone can insert guests"
    ON public.guests FOR INSERT WITH CHECK (true);

-- ── Bookings (anyone can read, insert, update — no Supabase Auth) ──────────
DROP POLICY IF EXISTS "Parties can read own bookings"       ON public.bookings;
DROP POLICY IF EXISTS "Users can view their own bookings"   ON public.bookings;
DROP POLICY IF EXISTS "Clients or guests can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can create bookings"         ON public.bookings;
DROP POLICY IF EXISTS "Participants can update bookings"    ON public.bookings;
DROP POLICY IF EXISTS "Barbers can update own bookings"     ON public.bookings;
DROP POLICY IF EXISTS "Clients can update own bookings"     ON public.bookings;
DROP POLICY IF EXISTS "Guests can update own bookings"      ON public.bookings;
DROP POLICY IF EXISTS "Anyone can read bookings"            ON public.bookings;
DROP POLICY IF EXISTS "Anyone can insert bookings"          ON public.bookings;
DROP POLICY IF EXISTS "Anyone can update bookings"          ON public.bookings;

CREATE POLICY "Anyone can read bookings"
    ON public.bookings FOR SELECT USING (true);

CREATE POLICY "Anyone can insert bookings"
    ON public.bookings FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update bookings"
    ON public.bookings FOR UPDATE USING (true);

-- ── Verification Codes (anyone can insert/select/update — no Supabase Auth) ────────
DROP POLICY IF EXISTS "Anyone can insert verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Anyone can select verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Anyone can update verification codes" ON public.verification_codes;

CREATE POLICY "Anyone can insert verification codes"
    ON public.verification_codes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can select verification codes"
    ON public.verification_codes FOR SELECT USING (true);

CREATE POLICY "Anyone can update verification codes"
    ON public.verification_codes FOR UPDATE USING (true) WITH CHECK (true);

-- ── Reviews ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read reviews"   ON public.reviews;
DROP POLICY IF EXISTS "Clients can insert review" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can insert review"  ON public.reviews;

CREATE POLICY "Anyone can read reviews"
    ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Anyone can insert review"
    ON public.reviews FOR INSERT
    WITH CHECK (true);

-- ==============================================================================
-- STORAGE BUCKETS
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('Images', 'Images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Access"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

CREATE POLICY "Public Read Access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'Images');

CREATE POLICY "Authenticated Upload Access"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'Images');

CREATE POLICY "Authenticated Update Access"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'Images');

CREATE POLICY "Authenticated Delete Access"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'Images');
