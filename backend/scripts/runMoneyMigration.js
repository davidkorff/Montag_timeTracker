const db = require('../config/database');

async function runMoneyFieldsMigration() {
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
    
    console.log('Money fields migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Run the migration
runMoneyFieldsMigration();