-- Add support for manual invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;

-- Add index for manual invoices
CREATE INDEX IF NOT EXISTS idx_invoices_is_manual ON invoices(is_manual);

-- Comment for clarity
COMMENT ON COLUMN invoices.is_manual IS 'Indicates if invoice was manually created rather than generated from time entries';
