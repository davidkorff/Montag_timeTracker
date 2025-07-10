const { validationResult } = require('express-validator');
const db = require('../../config/database');

const getAllProjects = async (req, res) => {
  try {
    const { clientId, status } = req.query;
    let query = `
      SELECT 
        p.*,
        c.name as client_name,
        COUNT(DISTINCT te.id) as entry_count,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable THEN te.hours ELSE 0 END) as billable_hours
      FROM projects p
      INNER JOIN clients c ON p.client_id = c.id
      LEFT JOIN time_entries te ON p.id = te.project_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    if (clientId) {
      paramCount++;
      query += ` AND p.client_id = $${paramCount}`;
      params.push(clientId);
    }

    if (status) {
      paramCount++;
      query += ` AND p.status = $${paramCount}`;
      params.push(status);
    }

    query += ' GROUP BY p.id, c.name ORDER BY p.created_at DESC';
    
    const result = await db.query(query, params);
    res.json({ projects: result.rows });
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const projectResult = await db.query(
      `SELECT 
        p.*,
        c.name as client_name,
        c.billing_rate as client_billing_rate,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM projects p
      INNER JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const statsResult = await db.query(
      `SELECT 
        COUNT(DISTINCT te.user_id) as consultant_count,
        COUNT(te.id) as entry_count,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable THEN te.hours ELSE 0 END) as billable_hours,
        MIN(te.date) as first_entry_date,
        MAX(te.date) as last_entry_date
      FROM time_entries te
      WHERE te.project_id = $1`,
      [id]
    );

    const consultantsResult = await db.query(
      `SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        SUM(te.hours) as hours_logged
      FROM time_entries te
      INNER JOIN users u ON te.user_id = u.id
      WHERE te.project_id = $1
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY hours_logged DESC`,
      [id]
    );

    res.json({ 
      project: projectResult.rows[0],
      stats: statsResult.rows[0],
      consultants: consultantsResult.rows
    });
  } catch (error) {
    console.error('Get project by id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createProject = async (req, res) => {
  try {
    console.log('Create project request body:', req.body);
    console.log('User:', req.user);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      clientId, 
      name, 
      code, 
      description, 
      budgetHours, 
      budgetAmount, 
      startDate, 
      endDate, 
      status,
      hourlyRate 
    } = req.body;

    const existingProject = await db.query(
      'SELECT id FROM projects WHERE client_id = $1 AND name = $2',
      [clientId, name]
    );

    if (existingProject.rows.length > 0) {
      return res.status(400).json({ error: 'Project with this name already exists for this client' });
    }
    
    const result = await db.query(
      `INSERT INTO projects 
       (client_id, name, code, description, budget_hours, budget_amount, start_date, end_date, status, created_by, hourly_rate) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [clientId, name, code, description, budgetHours, budgetAmount, startDate, endDate, status || 'active', req.user.id, hourlyRate]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'create_project', 'project', result.rows[0].id, req.ip]
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    console.error('Create project error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
    res.status(500).json({ error: 'Server error' });
  }
};

const updateProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const allowedUpdates = ['name', 'code', 'description', 'budget_hours', 'budget_amount', 'start_date', 'end_date', 'status', 'hourly_rate'];
    const actualUpdates = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        actualUpdates[field] = updates[field];
      }
    });

    if (Object.keys(actualUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const setClause = Object.keys(actualUpdates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(actualUpdates)];
    
    const result = await db.query(
      `UPDATE projects SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'update_project', 'project', id, JSON.stringify(actualUpdates), req.ip]
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const timeEntries = await db.query(
      'SELECT COUNT(*) FROM time_entries WHERE project_id = $1',
      [id]
    );

    if (parseInt(timeEntries.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete project with time entries' });
    }

    const result = await db.query(
      'DELETE FROM projects WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'delete_project', 'project', id, req.ip]
    );

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
};