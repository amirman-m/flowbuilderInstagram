-- 005_telegram_bot_configs_add_name.sql
-- Purpose: Add config_name to store user-provided friendly name for Telegram bot configs
-- Timestamp: 2025-08-25 07:52:54 UTC

BEGIN;

ALTER TABLE IF EXISTS telegram_bot_configs
    ADD COLUMN IF NOT EXISTS config_name VARCHAR(100);

-- Optional indexes to speed up lookups by user/name reuse
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_config_name
    ON telegram_bot_configs (config_name);

CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_user_config_name
    ON telegram_bot_configs (user_id, config_name);

COMMIT;
