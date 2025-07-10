-- Connect to the database and run the migration
-- Run this file using: psql -d consulting_time_tracker -f apply_migration.sql

-- Add support for paused timers and elapsed time tracking
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_elapsed_seconds INTEGER DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_is_paused BOOLEAN DEFAULT false;

-- Add 'deleted' to the time_entry_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'deleted' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'time_entry_status')
    ) THEN
        ALTER TYPE time_entry_status ADD VALUE 'deleted';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_entries' 
AND column_name IN ('timer_elapsed_seconds', 'timer_is_paused');

-- Verify enum values
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'time_entry_status') ORDER BY enumsortorder;

-- Add soft delete functionality
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_time_entries_is_deleted ON time_entries(is_deleted);

-- Add invoice configuration fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_cc_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_recipient_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billed_to VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'Net 30';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_rate DECIMAL(10,2) DEFAULT 175.00;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_address TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_invoice_email ON clients(invoice_email);

-- Success message
SELECT 'Migration completed successfully!' as status;