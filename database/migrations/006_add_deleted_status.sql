-- Add 'deleted' to the time_entry_status enum
ALTER TYPE time_entry_status ADD VALUE IF NOT EXISTS 'deleted';