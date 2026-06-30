-- Add language column to telegram_users table
ALTER TABLE public.telegram_users ADD COLUMN IF NOT EXISTS language text;
