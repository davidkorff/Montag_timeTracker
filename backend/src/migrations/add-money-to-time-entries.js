const db = require('../../config/database');

const addMoneyToTimeEntries = async () => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    console.log('Adding money fields to time_entries table...');
    
    // Add rate and amount columns to time_entries
    await client.query(`
      ALTER TABLE time_entries
      ADD COLUMN IF NOT EXISTS rate DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2)
    `);
    
    console.log('Columns added successfully');
    
    // Update existing time entries with calculated money values
    console.log('Calculating money for existing time entries...');
    
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
    
    console.log(`Updated ${updateResult.rowCount} billable time entries with money values`);
    
    // Set non-billable entries to 0
    await client.query(`
      UPDATE time_entries
      SET rate = 0, amount = 0
      WHERE is_billable = false
      AND rate IS NULL
    `);
    
    // Add rate column to projects for project-specific rates
    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2)
    `);
    
    console.log('Added hourly_rate to projects table for project-specific rates');
    
    // Update invoice totals based on actual time entry amounts
    console.log('Recalculating invoice totals based on time entry amounts...');
    
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
    
    console.log('Invoice totals updated');
    
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the migration
addMoneyToTimeEntries()
  .then(() => {
    console.log('Money migration completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Money migration error:', err);
    process.exit(1);
  });