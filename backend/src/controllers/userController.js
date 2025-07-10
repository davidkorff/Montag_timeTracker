const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const db = require('../../config/database');

const getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.hourly_rate, u.is_active, u.created_at,
        u.user_type_id, ut.name as user_type_name
      FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      ORDER BY u.created_at DESC
    `;
    
    const result = await db.query(query);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const userResult = await db.query(
      `SELECT 
        u.id, u.email, u.first_name, u.last_name, u.hourly_rate, u.is_active, u.created_at,
        u.user_type_id, ut.name as user_type_name
      FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const timeStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total_entries,
        SUM(hours) as total_hours,
        SUM(CASE WHEN is_billable THEN hours ELSE 0 END) as billable_hours
      FROM time_entries 
      WHERE user_id = $1
    `, [id]);

    res.json({ 
      user: userResult.rows[0],
      stats: timeStatsResult.rows[0]
    });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, userTypeId, hourlyRate } = req.body;

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, user_type_id, hourly_rate) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, first_name, last_name, user_type_id, hourly_rate`,
      [email.toLowerCase(), hashedPassword, firstName, lastName, userTypeId || 2, hourlyRate]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'create_user', 'user', result.rows[0].id, req.ip]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const allowedUpdates = ['email', 'first_name', 'last_name', 'hourly_rate', 'is_active'];
    const actualUpdates = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        actualUpdates[field] = updates[field];
      }
    });

    if (Object.keys(actualUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    if (actualUpdates.email) {
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [actualUpdates.email.toLowerCase(), id]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      actualUpdates.email = actualUpdates.email.toLowerCase();
    }

    const setClause = Object.keys(actualUpdates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(actualUpdates)];
    
    const result = await db.query(
      `UPDATE users SET ${setClause} WHERE id = $1 
       RETURNING id, email, first_name, last_name, user_type_id, hourly_rate, is_active`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'update_user', 'user', id, JSON.stringify(actualUpdates), req.ip]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'deactivate_user', 'user', id, req.ip]
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};