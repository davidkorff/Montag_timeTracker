-- Add support for paused timers
-- This is a safe version that checks if columns exist before adding them

DO $$
BEGIN
    -- Add timer_elapsed_seconds column if it doesn't exist
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'time_entries' 
        AND column_name = 'timer_elapsed_seconds'
    ) THEN
        ALTER TABLE time_entries ADD COLUMN timer_elapsed_seconds INTEGER DEFAULT 0;
    END IF;

    -- Add timer_is_paused column if it doesn't exist
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'time_entries' 
        AND column_name = 'timer_is_paused'
    ) THEN
        ALTER TABLE time_entries ADD COLUMN timer_is_paused BOOLEAN DEFAULT false;
    END IF;
END $$;