const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testLogin() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('Database connected successfully:', testResult.rows[0].now);

    // Check admin user
    console.log('\nChecking admin user...');
    const userResult = await pool.query(
      "SELECT id, email, password_hash, is_active FROM users WHERE email = 'admin@42consulting.com'"
    );
    
    if (userResult.rows.length === 0) {
      console.log('ERROR: Admin user not found!');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log('User found:', {
      id: user.id,
      email: user.email,
      is_active: user.is_active,
      has_password: !!user.password_hash
    });

    // Test password
    const testPassword = 'admin123';
    const isMatch = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`\nPassword test for '${testPassword}':`, isMatch ? 'MATCH' : 'NO MATCH');

    if (!isMatch) {
      console.log('\nGenerating new hash for admin123...');
      const newHash = await bcrypt.hash('admin123', 10);
      console.log('New hash:', newHash);
      console.log('\nRun this SQL to fix the password:');
      console.log(`UPDATE users SET password_hash = '${newHash}' WHERE email = 'admin@42consulting.com';`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testLogin();