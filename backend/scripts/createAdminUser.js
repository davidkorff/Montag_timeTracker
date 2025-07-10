const bcrypt = require('bcryptjs');
const db = require('../config/database');
require('dotenv').config();

async function createAdminUser() {
  try {
    // Get user input
    const username = process.argv[2];
    const email = process.argv[3];
    const password = process.argv[4];
    const firstName = process.argv[5] || 'Admin';
    const lastName = process.argv[6] || 'User';

    if (!username || !email || !password) {
      console.error('Usage: node createAdminUser.js <username> <email> <password> [firstName] [lastName]');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      console.error('User with this username or email already exists');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, user_type_id, hourly_rate, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, email`,
      [username, email, passwordHash, firstName, lastName, 1, 175, true]
    );

    console.log('Admin user created successfully:');
    console.log(result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();