-- Create chat_history table for storing AI chat conversations
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(100) NOT NULL,
    bot_id VARCHAR(50) NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint on chat_id + bot_id combination
    CONSTRAINT unique_chat_bot UNIQUE (chat_id, bot_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_history_chat_bot ON chat_history(chat_id, bot_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_updated_at ON chat_history(updated_at);

-- Add comments for documentation
COMMENT ON TABLE chat_history IS 'Stores AI chat conversation history per chat_id and bot_id';
COMMENT ON COLUMN chat_history.chat_id IS 'Telegram chat ID or user identifier';
COMMENT ON COLUMN chat_history.bot_id IS 'Bot ID from telegram_bot_configs';
COMMENT ON COLUMN chat_history.messages IS 'JSON array of chat messages with role and content';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_chat_history_updated_at
    BEFORE UPDATE ON chat_history
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_history_updated_at();
