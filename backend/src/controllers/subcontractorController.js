const { validationResult } = require('express-validator');
const db = require('../../config/database');

const getAllSubcontractors = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        COUNT(DISTINCT te.id) as total_entries,
        SUM(te.hours) as total_hours,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM subcontractors s
      LEFT JOIN time_entries te ON s.id = te.subcontractor_id
      LEFT JOIN users u ON s.created_by = u.id
      GROUP BY s.id, u.first_name, u.last_name
      ORDER BY s.first_name, s.last_name
    `;
    
    const result = await db.query(query);
    res.json({ subcontractors: result.rows });
  } catch (error) {
    console.error('Get all subcontractors error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getSubcontractorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const subcontractorResult = await db.query(
      'SELECT * FROM subcontractors WHERE id = $1',
      [id]
    );

    if (subcontractorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const timeEntriesResult = await db.query(
      `SELECT 
        te.*,
        p.name as project_name,
        c.name as client_name,
        u.first_name || ' ' || u.last_name as entered_by_name
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON te.entered_by_user_id = u.id
      WHERE te.subcontractor_id = $1
      ORDER BY te.date DESC
      LIMIT 50`,
      [id]
    );

    res.json({ 
      subcontractor: subcontractorResult.rows[0],
      recentTimeEntries: timeEntriesResult.rows
    });
  } catch (error) {
    console.error('Get subcontractor by id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createSubcontractor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, phone, hourlyRate } = req.body;

    if (email) {
      const existingSubcontractor = await db.query(
        'SELECT id FROM subcontractors WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingSubcontractor.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }
    
    const result = await db.query(
      `INSERT INTO subcontractors (first_name, last_name, email, phone, hourly_rate, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [firstName, lastName, email?.toLowerCase(), phone, hourlyRate, req.user.id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'create_subcontractor', 'subcontractor', result.rows[0].id, req.ip]
    );

    res.status(201).json({ subcontractor: result.rows[0] });
  } catch (error) {
    console.error('Create subcontractor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateSubcontractor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const allowedUpdates = ['first_name', 'last_name', 'email', 'phone', 'hourly_rate', 'is_active'];
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
      const existingSubcontractor = await db.query(
        'SELECT id FROM subcontractors WHERE email = $1 AND id != $2',
        [actualUpdates.email.toLowerCase(), id]
      );

      if (existingSubcontractor.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      actualUpdates.email = actualUpdates.email.toLowerCase();
    }

    const setClause = Object.keys(actualUpdates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(actualUpdates)];
    
    const result = await db.query(
      `UPDATE subcontractors SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'update_subcontractor', 'subcontractor', id, JSON.stringify(actualUpdates), req.ip]
    );

    res.json({ subcontractor: result.rows[0] });
  } catch (error) {
    console.error('Update subcontractor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteSubcontractor = async (req, res) => {
  try {
    const { id } = req.params;

    const timeEntries = await db.query(
      'SELECT COUNT(*) FROM time_entries WHERE subcontractor_id = $1',
      [id]
    );

    if (parseInt(timeEntries.rows[0].count) > 0) {
      // Soft delete if has time entries
      const result = await db.query(
        'UPDATE subcontractors SET is_active = false WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Subcontractor not found' });
      }

      await db.query(
        'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'deactivate_subcontractor', 'subcontractor', id, req.ip]
      );

      res.json({ message: 'Subcontractor deactivated successfully' });
    } else {
      // Hard delete if no time entries
      const result = await db.query(
        'DELETE FROM subcontractors WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Subcontractor not found' });
      }

      await db.query(
        'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'delete_subcontractor', 'subcontractor', id, req.ip]
      );

      res.json({ message: 'Subcontractor deleted successfully' });
    }
  } catch (error) {
    console.error('Delete subcontractor error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createTimeEntryForSubcontractor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subcontractorId, projectId, date, hours, description, isBillable } = req.body;

    // Verify subcontractor exists
    const subcontractor = await db.query(
      'SELECT id FROM subcontractors WHERE id = $1 AND is_active = true',
      [subcontractorId]
    );

    if (subcontractor.rows.length === 0) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }
    
    const result = await db.query(
      `INSERT INTO time_entries 
       (subcontractor_id, project_id, date, hours, description, is_billable, status, entered_by_user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [subcontractorId, projectId, date, hours, description, isBillable !== false, 'approved', req.user.id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'create_subcontractor_time_entry', 'time_entry', result.rows[0].id, 
       JSON.stringify({ subcontractorId }), req.ip]
    );

    res.status(201).json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Create subcontractor time entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllSubcontractors,
  getSubcontractorById,
  createSubcontractor,
  updateSubcontractor,
  deleteSubcontractor,
  createTimeEntryForSubcontractor
};