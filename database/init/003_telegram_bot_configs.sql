-- Create telegram_bot_configs table for storing Telegram bot configurations
CREATE TABLE IF NOT EXISTS telegram_bot_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    access_token VARCHAR(255) NOT NULL,
    webhook_url TEXT,
    bot_username VARCHAR(100),
    bot_id VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_validated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_user_id ON telegram_bot_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_active ON telegram_bot_configs(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_token ON telegram_bot_configs(access_token);

-- Add comments for documentation
COMMENT ON TABLE telegram_bot_configs IS 'Stores Telegram bot configurations per user';
COMMENT ON COLUMN telegram_bot_configs.user_id IS 'Reference to the user who owns this bot configuration';
COMMENT ON COLUMN telegram_bot_configs.access_token IS 'Telegram bot API access token from @BotFather';
COMMENT ON COLUMN telegram_bot_configs.webhook_url IS 'Currently configured webhook URL for this bot';
COMMENT ON COLUMN telegram_bot_configs.bot_username IS 'Bot username from Telegram API';
COMMENT ON COLUMN telegram_bot_configs.bot_id IS 'Bot ID from Telegram API';
COMMENT ON COLUMN telegram_bot_configs.is_active IS 'Whether this bot configuration is currently active';
COMMENT ON COLUMN telegram_bot_configs.last_validated_at IS 'Last time the bot token was validated against Telegram API';
