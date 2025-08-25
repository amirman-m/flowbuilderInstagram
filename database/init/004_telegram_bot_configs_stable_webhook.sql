-- 004_telegram_bot_configs_stable_webhook.sql
-- Purpose: Add stable webhook support fields and indexes for TelegramBotConfig
-- Timestamp: 2025-08-25 07:37:01 UTC

BEGIN;

-- Add new columns if they do not exist
ALTER TABLE IF EXISTS telegram_bot_configs
    ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(100),
    ADD COLUMN IF NOT EXISTS default_flow_id INTEGER,
    ADD COLUMN IF NOT EXISTS default_node_id VARCHAR(100);

-- Create composite index on (user_id, bot_id)
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_user_bot
    ON telegram_bot_configs (user_id, bot_id);

-- Create index on is_active for filtering active configs
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_is_active
    ON telegram_bot_configs (is_active);

-- Create index on webhook_secret to speed up secret lookup
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_webhook_secret
    ON telegram_bot_configs (webhook_secret);

COMMIT;
