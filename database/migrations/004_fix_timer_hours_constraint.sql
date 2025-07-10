-- Remove the CHECK constraint that requires hours > 0 to allow timer entries to start with 0 hours
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_hours_check;

-- Add a new CHECK constraint that allows hours >= 0
ALTER TABLE time_entries ADD CONSTRAINT time_entries_hours_check CHECK (hours >= 0);