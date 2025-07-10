-- Add payment_date column to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_date DATE;

-- Update existing paid invoices with payment_date = invoice_date if not set
UPDATE invoices
SET payment_date = invoice_date
WHERE payment_status = 'paid' AND payment_date IS NULL;

-- Add comment
COMMENT ON COLUMN invoices.payment_date IS 'Date when the invoice was marked as paid';