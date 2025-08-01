const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../../config/database');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName } = req.body;

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if user_types table exists
    const userTypesExist = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_types'
      );
    `);
    
    // Generate username from email (part before @)
    let username = email.split('@')[0].toLowerCase();
    
    // Check if username exists and append number if needed
    let usernameExists = true;
    let counter = 0;
    while (usernameExists) {
      const checkUsername = counter === 0 ? username : `${username}${counter}`;
      const userCheck = await db.query('SELECT id FROM users WHERE username = $1', [checkUsername]);
      if (userCheck.rows.length === 0) {
        username = checkUsername;
        usernameExists = false;
      } else {
        counter++;
      }
    }
    
    let insertQuery;
    let insertParams;
    
    if (userTypesExist.rows[0].exists) {
      insertQuery = `INSERT INTO users (username, email, password_hash, first_name, last_name, user_type_id) 
                     VALUES ($1, $2, $3, $4, $5, $6) 
                     RETURNING id, username, email, first_name, last_name`;
      insertParams = [username, email.toLowerCase(), hashedPassword, firstName, lastName, 2]; // 2 = User
    } else {
      // Fallback for old schema
      insertQuery = `INSERT INTO users (username, email, password_hash, first_name, last_name, role) 
                     VALUES ($1, $2, $3, $4, $5, $6) 
                     RETURNING id, username, email, first_name, last_name`;
      insertParams = [username, email.toLowerCase(), hashedPassword, firstName, lastName, 'consultant'];
    }
    
    const result = await db.query(insertQuery, insertParams);

    const user = result.rows[0];
    const token = generateToken(user.id);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
      [user.id, 'signup', req.ip]
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        userType: 'contractor'
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Login validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    // Check if user_types table exists
    const userTypesExist = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_types'
      );
    `);

    let userResult;
    
    if (userTypesExist.rows[0].exists) {
      // New schema with user_types
      userResult = await db.query(
        `SELECT u.*, ut.name as user_type_name 
         FROM users u
         JOIN user_types ut ON u.user_type_id = ut.id
         WHERE u.email = $1 AND u.is_active = true`,
        [email.toLowerCase()]
      );
    } else {
      // Old schema with role column
      userResult = await db.query(
        'SELECT *, true as can_login FROM users WHERE email = $1 AND is_active = true',
        [email.toLowerCase()]
      );
    }

    if (userResult.rows.length === 0) {
      console.log('User not found or inactive:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    console.log('User found:', { id: user.id, email: user.email, hasPasswordHash: !!user.password_hash });
    
    // Remove can_login check since it doesn't exist in our schema
    // All active users can login
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log('Password comparison result:', isMatch);

    if (!isMatch) {
      console.log('Password mismatch for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
      [user.id, 'login', req.ip]
    );

    // Build response based on schema
    const responseUser = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name
    };
    
    if (user.user_type_name) {
      responseUser.userType = user.user_type_name.toLowerCase();
      responseUser.userTypeId = user.user_type_id;
    } else {
      responseUser.role = user.role;
      responseUser.userType = user.role === 'admin' ? 'admin' : 'contractor';
    }

    res.json({
      token,
      user: responseUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const logout = async (req, res) => {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
      [req.user.id, 'logout', req.ip]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT 
        u.id, u.email, u.first_name, u.last_name, u.hourly_rate, u.created_at,
        u.user_type_id, ut.name as user_type_name
      FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES ($1, $2, $3)',
      [req.user.id, 'password_change', req.ip]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getProfile,
  changePassword
};