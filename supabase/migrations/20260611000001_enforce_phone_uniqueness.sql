-- =============================================================================
-- Migration: Enforce phone uniqueness across clients and barbers
-- =============================================================================

-- Add unique constraint to barbers table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'barbers_phone_key'
    ) THEN
        ALTER TABLE public.barbers ADD CONSTRAINT barbers_phone_key UNIQUE (phone);
    END IF;
END $$;

-- Create the trigger function to prevent cross-registration
CREATE OR REPLACE FUNCTION public.check_phone_unique()
RETURNS TRIGGER AS $$
BEGIN
  -- We only validate if the phone is not null and not empty
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'barbers' THEN
    IF EXISTS (SELECT 1 FROM public.clients WHERE phone = NEW.phone AND id != NEW.id) THEN
      RAISE EXCEPTION 'Phone number % is already registered as a client', NEW.phone;
    END IF;
  ELSIF TG_TABLE_NAME = 'clients' THEN
    IF EXISTS (SELECT 1 FROM public.barbers WHERE phone = NEW.phone AND id != NEW.id) THEN
      RAISE EXCEPTION 'Phone number % is already registered as a barber', NEW.phone;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to barbers
DROP TRIGGER IF EXISTS check_barber_phone ON public.barbers;
CREATE TRIGGER check_barber_phone 
BEFORE INSERT OR UPDATE ON public.barbers
FOR EACH ROW EXECUTE FUNCTION public.check_phone_unique();

-- Apply trigger to clients
DROP TRIGGER IF EXISTS check_client_phone ON public.clients;
CREATE TRIGGER check_client_phone 
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.check_phone_unique();
