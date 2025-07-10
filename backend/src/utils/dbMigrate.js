const fs = require('fs');
const path = require('path');
const db = require('../../config/database');

async function runMigrations() {
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
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Get already executed migrations
    const executed = await db.query('SELECT filename FROM migrations');
    const executedFiles = new Set(executed.rows.map(r => r.filename));

    // Run pending migrations
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
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations on startup in production
if (process.env.NODE_ENV === 'production') {
  runMigrations();
}

module.exports = { runMigrations };