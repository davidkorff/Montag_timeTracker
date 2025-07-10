const fs = require('fs');
const path = require('path');
const db = require('../config/database');
require('dotenv').config();

async function migrateRenderDB() {
  try {
    console.log('Starting Render database migration (safe mode)...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../database/render_schema_from_local.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error('Schema file not found! Run dumpLocalSchema.js first.');
      process.exit(1);
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Confirm before proceeding
    console.log('\n⚠️  WARNING: This will DROP and recreate all tables!');
    console.log('Make sure you have backed up any important data.');
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\nExecuting migration...');
    
    // Split SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute statements one by one
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements
      if (!statement || statement.length < 5) continue;
      
      try {
        // Show what we're executing (first 100 chars)
        const preview = statement.substring(0, 100).replace(/\n/g, ' ');
        console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}...`);
        
        await db.query(statement);
        console.log('✓ Success');
      } catch (error) {
        console.error(`\n❌ Failed at statement ${i + 1}:`);
        console.error('Statement:', statement.substring(0, 500));
        console.error('Error:', error.message);
        
        // Ask if should continue
        console.log('\nDo you want to continue? (This error might be ignorable)');
        console.log('Press Ctrl+C to stop, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log('\n✅ Schema migration completed!');
    
    // Create admin user
    console.log('\nCreating admin user...');
    
    const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    try {
      await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, user_type_id, hourly_rate, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          user_type_id = EXCLUDED.user_type_id,
          is_active = EXCLUDED.is_active
      `, [
        'david@42consultingllc.com',
        hashedPassword,
        'David',
        'Korff',
        1, // Admin
        175,
        true
      ]);
      
      console.log(`\n✅ Admin user created!`);
      console.log(`Email: david@42consultingllc.com`);
      console.log(`Password: ${adminPassword}`);
    } catch (error) {
      console.error('Failed to create admin user:', error.message);
    }
    
    // Verify the migration
    console.log('\n📊 Migration Summary:');
    
    try {
      const tableCount = await db.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);
      console.log(`Tables created: ${tableCount.rows[0].count}`);
      
      const userCount = await db.query('SELECT COUNT(*) as count FROM users');
      console.log(`Users: ${userCount.rows[0].count}`);
    } catch (error) {
      console.error('Failed to get summary:', error.message);
    }
    
    console.log('\n✅ Migration process completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
migrateRenderDB();