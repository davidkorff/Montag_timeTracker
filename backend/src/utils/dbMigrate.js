const fs = require('fs');
const path = require('path');
const db = require('../../config/database');

async function runMigrations() {
  let retryCount = 0;
  const maxRetries = 30; // Wait up to 30 seconds for database
  
  // Wait for database to be ready
  while (retryCount < maxRetries) {
    try {
      await db.query('SELECT 1');
      console.log('Database connection established');
      break;
    } catch (error) {
      retryCount++;
      console.log(`Waiting for database... (${retryCount}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (retryCount === maxRetries) {
    console.error('Could not connect to database after 30 seconds');
    process.exit(1);
  }

  try {
    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../../../database/migrations');
    
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }

    // Get already executed migrations
    const executed = await db.query('SELECT filename FROM migrations');
    const executedFiles = new Set(executed.rows.map(r => r.filename));

    // Run pending migrations
    let successCount = 0;
    for (const file of files) {
      if (!executedFiles.has(file)) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        await db.query('BEGIN');
        try {
          await db.query(sql);
          await db.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
          await db.query('COMMIT');
          console.log(`✓ Migration ${file} completed`);
          successCount++;
        } catch (error) {
          await db.query('ROLLBACK');
          console.error(`✗ Migration ${file} failed:`, error.message);
          // Continue with other migrations instead of failing completely
          if (file === '000_initial_schema.sql') {
            // If initial schema fails, we should stop
            throw error;
          }
        }
      }
    }

    console.log(`Migrations completed: ${successCount} successful`);
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  }
}

// Run migrations on startup in production
if (process.env.NODE_ENV === 'production') {
  runMigrations();
}

module.exports = { runMigrations };