-- Add support for paused timers and elapsed time tracking
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_elapsed_seconds INTEGER DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_is_paused BOOLEAN DEFAULT false;

-- Remove the constraint that was preventing multiple timers per user
-- This allows multiple concurrent timers