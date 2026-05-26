-- ==============================================================================
-- NAVBATGO SUPABASE SQL SCHEMA (SAFE IDEMPOTENT RUN)
-- ==============================================================================
-- Instructions:
-- Run this entire script in the Supabase SQL Editor.
-- This script is fully idempotent and safe to run multiple times.
-- It preserves existing data while safely updating schemas and policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Barbers Table (References Supabase Auth Users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.barbers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    fullname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    office_name TEXT,
    working_hours TEXT,
    average_price NUMERIC,
    profile_img TEXT,
    office_img TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all required columns exist on the barbers table
ALTER TABLE public.barbers 
ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS location jsonb;

COMMENT ON COLUMN public.barbers.services IS 'Array of services provided by the barber, e.g., [{id, name, duration, price}].';
COMMENT ON COLUMN public.barbers.address IS 'Physical address or street name of the barbershop.';
COMMENT ON COLUMN public.barbers.location IS 'JSON geography block containing address details and coordinate pair: [longitude, latitude].';

-- ------------------------------------------------------------------------------
-- 2. Clients Table (References Supabase Auth Users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    fullname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure the profile image column exists (required for ClientOnboarding & Settings)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS profile_img TEXT;

COMMENT ON COLUMN public.clients.profile_img IS 'Direct HTTPS URL to client profile picture stored in the Images bucket.';

-- ------------------------------------------------------------------------------
-- 3. Bookings Table (Manages Client-to-Barber Appointments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    booking_hours TEXT NOT NULL, -- Format: 'HH:MM'
    booking_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure service and date columns exist on older booking databases
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS booking_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS service_name TEXT,
ADD COLUMN IF NOT EXISTS service_price TEXT;

-- Safely migrate any NULL values of booking_date
UPDATE public.bookings
SET booking_date = COALESCE(booking_date, (created_at AT TIME ZONE 'UTC')::date, CURRENT_DATE)
WHERE booking_date IS NULL;

-- Enforce NOT NULL and default values
ALTER TABLE public.bookings ALTER COLUMN booking_date SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN booking_date SET DEFAULT CURRENT_DATE;

COMMENT ON COLUMN public.bookings.booking_date IS 'Calendar day chosen by the client for the appointment (YYYY-MM-DD).';
COMMENT ON COLUMN public.bookings.booking_hours IS 'Time slot on booking_date in 24h format (HH:MM).';
COMMENT ON COLUMN public.bookings.status IS 'Status of the appointment (pending, active/accepted, rejected, completed/bajarildi, cancelled).';
COMMENT ON COLUMN public.bookings.service_name IS 'Name of the specific service selected for this booking.';
COMMENT ON COLUMN public.bookings.service_price IS 'Cost of the specific service at the time of booking.';

-- ------------------------------------------------------------------------------
-- 4. Constraints and Indexes
-- ------------------------------------------------------------------------------

-- Unique Index: Prevent double-booking active/accepted time slots for a specific barber
DROP INDEX IF EXISTS public.bookings_barber_date_time_active_uidx;
CREATE UNIQUE INDEX bookings_barber_date_time_active_uidx
ON public.bookings (barber_id, booking_date, booking_hours)
WHERE status NOT IN ('rejected', 'cancelled');

-- Check Constraint: Prevent booking slots in past calendar days (NOT VALID prevents historical validation failures)
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_date_not_past;
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_date_not_past CHECK (booking_date >= CURRENT_DATE) NOT VALID;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - TABLES
-- ==============================================================================

-- Enable RLS safely on all active tables
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Barber Table Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Barbers are viewable by everyone" ON public.barbers;
CREATE POLICY "Barbers are viewable by everyone" ON public.barbers 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Barbers can insert their own profile" ON public.barbers;
CREATE POLICY "Barbers can insert their own profile" ON public.barbers 
FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Barbers can update own profile" ON public.barbers;
CREATE POLICY "Barbers can update own profile" ON public.barbers 
FOR UPDATE USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Client Table Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients are viewable by everyone" ON public.clients;
CREATE POLICY "Clients are viewable by everyone" ON public.clients 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Clients can insert their own profile" ON public.clients;
CREATE POLICY "Clients can insert their own profile" ON public.clients 
FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Clients can update own profile" ON public.clients;
CREATE POLICY "Clients can update own profile" ON public.clients 
FOR UPDATE USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Booking Table Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
CREATE POLICY "Users can view their own bookings" ON public.bookings 
FOR SELECT USING (auth.uid() = client_id OR auth.uid() = barber_id);

DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;
CREATE POLICY "Clients can create bookings" ON public.bookings 
FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Participants can update bookings" ON public.bookings;
CREATE POLICY "Participants can update bookings" ON public.bookings 
FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = barber_id);


-- ==============================================================================
-- STORAGE BUCKETS & SECURITY POLICIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Initialize images storage bucket if it does not exist
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('Images', 'Images', true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- Storage Object Policies (Fully Idempotent)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'Images');

DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Images');

DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
CREATE POLICY "Authenticated Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'Images');

DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;
CREATE POLICY "Authenticated Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'Images');
