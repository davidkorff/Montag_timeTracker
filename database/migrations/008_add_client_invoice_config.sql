-- Add invoice configuration fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_cc_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_recipient_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billed_to VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'Net 30';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_rate DECIMAL(10,2) DEFAULT 175.00;

-- Add company information for invoicing
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_address TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_clients_invoice_email ON clients(invoice_email);