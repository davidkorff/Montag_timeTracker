-- Run all migrations in order
-- Execute this file with: psql -d consulting_time_tracker -f run_all_migrations.sql

-- First, run the invoice migration (002_add_invoices.sql)
\echo 'Running invoice migration...'

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    payment_terms VARCHAR(100),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'cancelled')),
    CONSTRAINT invoices_payment_status_check CHECK (payment_status IN ('unpaid', 'partial', 'paid'))
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    rate DECIMAL(10,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    time_entry_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add invoice_number to time_entries
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id),
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice_id ON time_entries(invoice_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoices_updated_at();

\echo 'Invoice migration completed.'

-- Now run the client invoice configuration migration
\echo 'Running client invoice configuration migration...'

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

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_clients_invoice_email ON clients(invoice_email);

\echo 'Client invoice configuration migration completed.'

-- Run the soft delete and other migrations from apply_migration.sql
\echo 'Running additional migrations...'

-- Add support for paused timers and elapsed time tracking
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_elapsed_seconds INTEGER DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timer_is_paused BOOLEAN DEFAULT false;

-- Add soft delete functionality
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_time_entries_is_deleted ON time_entries(is_deleted);

\echo 'All migrations completed successfully!'

-- Display current tables
\echo 'Current database tables:'
\dt