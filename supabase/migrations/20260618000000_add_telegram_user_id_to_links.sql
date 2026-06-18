-- Migration: add telegram_user_id column to telegram_links
-- This column stores the Telegram user ID alongside the chat_id so that
-- the Mini App can look up the linked phone directly by the Telegram user ID
-- returned from window.Telegram.WebApp.initDataUnsafe.user.id

ALTER TABLE telegram_links
    ADD COLUMN IF NOT EXISTS telegram_user_id TEXT;

-- Index for fast Mini App lookups
CREATE INDEX IF NOT EXISTS idx_telegram_links_telegram_user_id
    ON telegram_links (telegram_user_id);

-- Backfill: for existing rows, chat_id IS the telegram_user_id for DMs
UPDATE telegram_links
SET telegram_user_id = chat_id
WHERE telegram_user_id IS NULL AND chat_id IS NOT NULL;
