const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const client = await db.getClient();
  
  try {
    console.log('Starting database migrations...\n');
    
    // Migration 1: Create invoice tables
    console.log('1. Creating invoice tables...');
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
    console.log('2. Adding invoice fields to time_entries...');
    await client.query(`
      ALTER TABLE time_entries 
      ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id),
      ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50)
    `);
    
    // Migration 3: Create indexes
    console.log('3. Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_invoice_id ON time_entries(invoice_id)`);
    
    // Migration 4: Create trigger for invoices updated_at
    console.log('4. Creating invoice triggers...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_invoices_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS invoices_updated_at ON invoices
    `);
    
    await client.query(`
      CREATE TRIGGER invoices_updated_at
        BEFORE UPDATE ON invoices
        FOR EACH ROW
        EXECUTE FUNCTION update_invoices_updated_at()
    `);
    
    // Migration 5: Add client invoice configuration fields
    console.log('5. Adding client invoice configuration fields...');
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
    
    // Migration 6: Add timer and soft delete fields
    console.log('6. Adding timer and soft delete fields...');
    await client.query(`
      ALTER TABLE time_entries 
      ADD COLUMN IF NOT EXISTS timer_elapsed_seconds INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS timer_is_paused BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_is_deleted ON time_entries(is_deleted)`);
    
    console.log('\n✅ All migrations completed successfully!\n');
    
    // Show table info
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Current database tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run migrations
runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});