const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetRenderDB() {
  try {
    console.log('🚀 Starting complete database reset...\n');
    
    // Read the manual schema file
    const schemaPath = path.join(__dirname, '../../database/render_manual_schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('⚠️  WARNING: This will DROP and recreate all tables!');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📦 Executing database schema...');
    
    try {
      // Execute the entire schema at once
      await db.query(schemaSQL);
      console.log('✅ Database schema created successfully!\n');
    } catch (error) {
      console.error('❌ Schema execution failed:', error.message);
      console.error('Attempting to continue...\n');
    }
    
    // Create admin user
    console.log('👤 Creating admin user...');
    
    const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';
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
      
      console.log('✅ Admin user created successfully!');
      console.log(`   Email: david@42consultingllc.com`);
      console.log(`   Password: ${adminPassword}\n`);
    } catch (error) {
      console.error('❌ Failed to create admin user:', error.message);
    }
    
    // Create a sample client and project
    console.log('🏢 Creating sample data...');
    
    try {
      // Get admin user ID
      const userResult = await db.query('SELECT id FROM users WHERE email = $1', ['david@42consultingllc.com']);
      const adminId = userResult.rows[0].id;
      
      // Create sample client
      const clientResult = await db.query(`
        INSERT INTO clients (name, code, is_active, created_by, billing_rate, default_rate)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, ['Sample Client', 'SAMPLE', true, adminId, 175, 175]);
      
      const clientId = clientResult.rows[0].id;
      
      // Create sample project
      await db.query(`
        INSERT INTO projects (name, client_id, status, created_by)
        VALUES ($1, $2, $3, $4)
      `, ['Sample Project', clientId, 'active', adminId]);
      
      console.log('✅ Sample data created successfully!\n');
    } catch (error) {
      console.error('❌ Failed to create sample data:', error.message);
    }
    
    // Verify the setup
    console.log('📊 Database Summary:');
    
    try {
      const tables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      console.log(`\nTables created (${tables.rows.length}):`);
      tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
      
      const users = await db.query('SELECT COUNT(*) as count FROM users');
      const clients = await db.query('SELECT COUNT(*) as count FROM clients');
      const projects = await db.query('SELECT COUNT(*) as count FROM projects');
      
      console.log(`\nData summary:`);
      console.log(`  - Users: ${users.rows[0].count}`);
      console.log(`  - Clients: ${clients.rows[0].count}`);
      console.log(`  - Projects: ${projects.rows[0].count}`);
      
    } catch (error) {
      console.error('Failed to get summary:', error.message);
    }
    
    console.log('\n✅ Database reset completed successfully!');
    console.log('🎉 You can now login at https://consulting-tracker-frontend.onrender.com\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run it
resetRenderDB();