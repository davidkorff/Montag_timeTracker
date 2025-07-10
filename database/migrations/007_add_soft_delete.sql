-- Add soft delete functionality to time_entries
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_time_entries_is_deleted ON time_entries(is_deleted);

-- Update any entries that might have been marked as 'deleted' status back to 'draft'
-- This won't run if there are no such entries
UPDATE time_entries SET status = 'draft' WHERE status = 'deleted';