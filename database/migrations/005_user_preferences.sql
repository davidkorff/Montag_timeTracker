-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE(user_id, preference_key)
);

-- Create index for faster lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at_trigger
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_user_preferences_updated_at();