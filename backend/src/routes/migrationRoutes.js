const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// All migration routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// Temporary migration endpoint - remove after running
router.post('/run-invoice-migrations', async (req, res) => {
  const client = await db.getClient();
  
  try {
    console.log('Starting invoice migrations...');
    
    // Migration 1: Create invoice tables
    await client.query(`
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
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        rate DECIMAL(10,2) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        time_entry_ids UUID[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Migration 2: Add invoice fields to time_entries
    await client.query(`
      ALTER TABLE time_entries 
      ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id),
      ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50)
    `);
    
    // Migration 3: Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_invoice_id ON time_entries(invoice_id)`);
    
    // Migration 4: Create trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION update_invoices_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await client.query(`DROP TRIGGER IF EXISTS invoices_updated_at ON invoices`);
    
    await client.query(`
      CREATE TRIGGER invoices_updated_at
        BEFORE UPDATE ON invoices
        FOR EACH ROW
        EXECUTE FUNCTION update_invoices_updated_at()
    `);
    
    // Migration 5: Add client invoice fields
    await client.query(`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS invoice_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS invoice_cc_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS invoice_recipient_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS billed_to VARCHAR(255),
      ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'Net 30',
      ADD COLUMN IF NOT EXISTS invoice_notes TEXT,
      ADD COLUMN IF NOT EXISTS default_rate DECIMAL(10,2) DEFAULT 175.00,
      ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS company_address TEXT
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_clients_invoice_email ON clients(invoice_email)`);
    
    // Migration 6: Timer and soft delete fields
    await client.query(`
      ALTER TABLE time_entries 
      ADD COLUMN IF NOT EXISTS timer_elapsed_seconds INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS timer_is_paused BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_is_deleted ON time_entries(is_deleted)`);
    
    res.json({ 
      success: true, 
      message: 'All invoice migrations completed successfully!' 
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      detail: error.detail 
    });
  } finally {
    client.release();
  }
});

router.post('/add-payment-date-field', async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    console.log('Adding payment_date column to invoices...');
    
    // Add payment_date column to invoices
    await client.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS payment_date DATE
    `);
    
    console.log('Column added successfully');
    
    // Update existing paid invoices with payment_date = invoice_date if not set
    await client.query(`
      UPDATE invoices
      SET payment_date = invoice_date
      WHERE payment_status = 'paid' AND payment_date IS NULL
    `);
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Payment date field added successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add payment date field error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post('/add-money-fields', async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    console.log('Adding rate and amount columns to time_entries...');
    
    // Add rate and amount columns to time_entries
    await client.query(`
      ALTER TABLE time_entries
      ADD COLUMN IF NOT EXISTS rate DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2)
    `);
    
    console.log('Updating existing time entries with calculated money values...');
    
    // Update existing time entries with calculated money values
    const updateResult = await client.query(`
      UPDATE time_entries te
      SET 
        rate = COALESCE(c.billing_rate, c.default_rate, 175),
        amount = te.hours * COALESCE(c.billing_rate, c.default_rate, 175)
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE te.project_id = p.id
      AND te.is_billable = true
      AND te.rate IS NULL
    `);
    
    console.log(`Updated ${updateResult.rowCount} billable time entries`);
    
    // Set non-billable entries to 0
    await client.query(`
      UPDATE time_entries
      SET rate = 0, amount = 0
      WHERE is_billable = false
      AND rate IS NULL
    `);
    
    console.log('Adding hourly_rate column to projects...');
    
    // Add rate column to projects for project-specific rates
    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2)
    `);
    
    console.log('Updating invoice totals...');
    
    // Update invoice totals based on actual time entry amounts
    await client.query(`
      UPDATE invoices i
      SET 
        subtotal = COALESCE(totals.total_amount, 0),
        total_amount = COALESCE(totals.total_amount, 0)
      FROM (
        SELECT 
          invoice_id,
          SUM(amount) as total_amount
        FROM time_entries
        WHERE invoice_id IS NOT NULL
        GROUP BY invoice_id
      ) totals
      WHERE i.id = totals.invoice_id
    `);
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Money fields added successfully',
      timeEntriesUpdated: updateResult.rowCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add money fields error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;