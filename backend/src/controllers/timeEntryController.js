const { validationResult } = require('express-validator');
const db = require('../../config/database');
const { getEasternDate, toEasternDateString } = require('../utils/timezone');

const getAllTimeEntries = async (req, res) => {
  try {
    const { userId, projectId, startDate, endDate, status } = req.query;
    const isAdmin = req.user.user_type_id === 1 || req.user.userTypeId === 1;
    
    let query = `
      SELECT 
        te.*,
        p.name as project_name,
        c.name as client_name,
        u.first_name || ' ' || u.last_name as user_name
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN clients c ON p.client_id = c.id
      INNER JOIN users u ON te.user_id = u.id
      WHERE (te.is_deleted = false OR te.is_deleted IS NULL)
    `;
    
    const params = [];
    let paramCount = 0;

    if (!isAdmin || userId) {
      paramCount++;
      query += ` AND te.user_id = $${paramCount}`;
      params.push(userId || req.user.id);
    }

    if (projectId) {
      paramCount++;
      query += ` AND te.project_id = $${paramCount}`;
      params.push(projectId);
    }

    if (startDate && endDate) {
      // Special handling for date range queries
      paramCount++;
      const startParam = paramCount;
      paramCount++;
      const endParam = paramCount;
      
      // Show entries that were either:
      // 1. Created/dated in the range (manual entries)
      // 2. Timer ended in the range (timer entries) - converting timer_end to Eastern timezone for comparison
      query += ` AND (
        (te.date >= $${startParam}::date AND te.date <= $${endParam}::date)
        OR 
        (te.timer_end IS NOT NULL AND 
         to_char(te.timer_end AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') >= $${startParam} AND 
         to_char(te.timer_end AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') <= $${endParam})
      )`;
      params.push(startDate, endDate);
    } else {
      if (startDate) {
        paramCount++;
        query += ` AND te.date >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND te.date <= $${paramCount}`;
        params.push(endDate);
      }
    }

    if (status) {
      paramCount++;
      query += ` AND te.status = $${paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY te.date DESC, te.created_at DESC';
    
    const result = await db.query(query, params);
    res.json({ timeEntries: result.rows });
  } catch (error) {
    console.error('Get all time entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getTimeEntryById = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.user_type_id === 1 || req.user.userTypeId === 1;
    
    let query = `
      SELECT 
        te.*,
        p.name as project_name,
        c.name as client_name,
        u.first_name || ' ' || u.last_name as user_name
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN clients c ON p.client_id = c.id
      INNER JOIN users u ON te.user_id = u.id
      WHERE te.id = $1
    `;

    const params = [id];

    if (!isAdmin) {
      query += ' AND te.user_id = $2';
      params.push(req.user.id);
    }
    
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    res.json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Get time entry by id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createTimeEntry = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId, date, hours, description, isBillable, rate: customRate } = req.body;
    
    // Get the rate for this entry
    let rate = customRate;
    if (!rate) {
      // Get rate from project or client
      const rateQuery = await db.query(
        `SELECT 
          COALESCE(p.hourly_rate, c.billing_rate, c.default_rate, 175) as rate
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.id = $1`,
        [projectId]
      );
      rate = rateQuery.rows[0]?.rate || 175;
    }
    
    const amount = (isBillable !== false) ? hours * rate : 0;
    
    const result = await db.query(
      `INSERT INTO time_entries 
       (user_id, project_id, date, hours, description, is_billable, status, rate, amount) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [req.user.id, projectId, date, hours, description, isBillable !== false, 'draft', rate, amount]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'create_time_entry', 'time_entry', result.rows[0].id, req.ip]
    );

    res.status(201).json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Create time entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateTimeEntry = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;
    const isAdmin = req.user.user_type_id === 1 || req.user.userTypeId === 1;

    const existingEntry = await db.query(
      'SELECT * FROM time_entries WHERE id = $1',
      [id]
    );

    if (existingEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    const entry = existingEntry.rows[0];

    if (!isAdmin && entry.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!isAdmin && entry.status !== 'draft' && entry.status !== 'rejected') {
      return res.status(400).json({ error: 'Can only edit draft or rejected entries' });
    }

    const allowedUpdates = ['project_id', 'date', 'hours', 'description', 'is_billable', 'timer_elapsed_seconds', 'rate'];
    if (isAdmin) {
      allowedUpdates.push('status');
    }

    const actualUpdates = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        actualUpdates[field] = updates[field];
      }
    });

    if (Object.keys(actualUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    
    // Recalculate amount if hours, rate, or billable status changed
    if (actualUpdates.hours || actualUpdates.rate || actualUpdates.is_billable !== undefined) {
      const hours = actualUpdates.hours || entry.hours;
      const isBillable = actualUpdates.is_billable !== undefined ? actualUpdates.is_billable : entry.is_billable;
      let rate = actualUpdates.rate || entry.rate;
      
      // If no custom rate and project changed, get new project rate
      if (!actualUpdates.rate && actualUpdates.project_id) {
        const rateQuery = await db.query(
          `SELECT 
            COALESCE(p.hourly_rate, c.billing_rate, c.default_rate, 175) as rate
           FROM projects p
           JOIN clients c ON p.client_id = c.id
           WHERE p.id = $1`,
          [actualUpdates.project_id]
        );
        rate = rateQuery.rows[0]?.rate || 175;
        actualUpdates.rate = rate;
      }
      
      actualUpdates.amount = isBillable ? hours * rate : 0;
    }

    const setClause = Object.keys(actualUpdates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(actualUpdates)];
    
    const result = await db.query(
      `UPDATE time_entries SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'update_time_entry', 'time_entry', id, JSON.stringify(actualUpdates), req.ip]
    );

    res.json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Update time entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteTimeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.user_type_id === 1 || req.user.userTypeId === 1;

    // Check if entry exists and user has permission
    let checkQuery = 'SELECT * FROM time_entries WHERE id = $1';
    const checkParams = [id];
    
    if (!isAdmin) {
      checkQuery += ' AND user_id = $2';
      checkParams.push(req.user.id);
    }
    
    const existingEntry = await db.query(checkQuery, checkParams);
    
    if (existingEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Time entry not found or access denied' });
    }
    
    // Set is_deleted flag instead of changing status
    const result = await db.query(
      'UPDATE time_entries SET is_deleted = true WHERE id = $1 RETURNING id',
      [id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'delete_time_entry', 'time_entry', id, req.ip]
    );

    res.json({ message: 'Time entry deleted successfully' });
  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const startTimer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId, description, isBillable, rate: customRate } = req.body;

    // Allow multiple timers - no check for existing timers
    
    // Get the current timestamp
    const now = new Date();
    
    // Get the date in Eastern timezone
    const easternDate = getEasternDate();
    
    // Get the rate for this entry
    let rate = customRate;
    if (!rate) {
      // Get rate from project or client
      const rateQuery = await db.query(
        `SELECT 
          COALESCE(p.hourly_rate, c.billing_rate, c.default_rate, 175) as rate
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.id = $1`,
        [projectId]
      );
      rate = rateQuery.rows[0]?.rate || 175;
    }
    
    const result = await db.query(
      `INSERT INTO time_entries 
       (user_id, project_id, date, hours, description, is_billable, status, timer_start, timer_elapsed_seconds, timer_is_paused, rate, amount) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *,
       (SELECT name FROM projects WHERE id = $2) as project_name,
       (SELECT name FROM clients WHERE id = (SELECT client_id FROM projects WHERE id = $2)) as client_name`,
      [req.user.id, projectId, easternDate, 0, description, isBillable !== false, 'draft', now, 0, false, rate, 0]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'start_timer', 'time_entry', result.rows[0].id, req.ip]
    );

    res.status(201).json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Start timer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const stopTimer = async (req, res) => {
  try {
    const { id } = req.params;

    const timerEntry = await db.query(
      'SELECT * FROM time_entries WHERE id = $1 AND user_id = $2 AND timer_start IS NOT NULL AND timer_end IS NULL',
      [id, req.user.id]
    );

    if (timerEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Active timer not found' });
    }

    const entry = timerEntry.rows[0];
    const endTime = new Date();
    
    // Calculate hours based on time difference and round UP to nearest 0.1
    const totalSeconds = Math.floor((endTime - new Date(entry.timer_start)) / 1000);
    const hours = Math.ceil((totalSeconds / 3600) * 10) / 10;
    
    // Ensure minimum of 0.1 hours if any time was tracked
    const finalHours = totalSeconds > 0 ? Math.max(0.1, hours) : 0;
    
    // Calculate amount based on rate
    const amount = entry.is_billable ? finalHours * (entry.rate || 175) : 0;
    
    const result = await db.query(
      `UPDATE time_entries 
       SET timer_end = $1, hours = $2, amount = $3
       WHERE id = $4 
       RETURNING *`,
      [endTime, finalHours, amount, id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'stop_timer', 'time_entry', id, JSON.stringify({ hours: finalHours }), req.ip]
    );

    res.json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Stop timer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getActiveTimer = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        te.*,
        p.name as project_name,
        c.name as client_name
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN clients c ON p.client_id = c.id
      WHERE te.user_id = $1 AND te.timer_start IS NOT NULL AND te.timer_end IS NULL
      ORDER BY te.timer_start DESC
      LIMIT 1`,
      [req.user.id]
    );

    res.json({ timer: result.rows[0] || null });
  } catch (error) {
    console.error('Get active timer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getTodayEntries = async (req, res) => {
  try {
    const isAdmin = req.user.user_type_id === 1 || req.user.userTypeId === 1;
    
    // Get today's date in Eastern timezone
    const today = getEasternDate();
    
    let query = `
      SELECT 
        te.*,
        p.name as project_name,
        c.name as client_name,
        u.first_name || ' ' || u.last_name as user_name
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN clients c ON p.client_id = c.id
      INNER JOIN users u ON te.user_id = u.id
      WHERE (te.is_deleted = false OR te.is_deleted IS NULL)
      AND (
        (te.date::text = $1)
        OR 
        (te.timer_end IS NOT NULL AND 
         to_char(te.timer_end AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') = $1)
      )
    `;
    
    const params = [today];
    
    if (!isAdmin) {
      query += ' AND te.user_id = $2';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY te.created_at DESC';
    
    const result = await db.query(query, params);
    
    res.json({ 
      timeEntries: result.rows,
      currentDate: today,
      timezone: 'America/New_York'
    });
  } catch (error) {
    console.error('Get today entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllActiveTimers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        te.*,
        p.name as project_name,
        c.name as client_name,
        te.timer_elapsed_seconds,
        te.timer_is_paused
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN clients c ON p.client_id = c.id
      WHERE te.user_id = $1 AND te.timer_start IS NOT NULL AND te.timer_end IS NULL AND (te.is_deleted = false OR te.is_deleted IS NULL)
      ORDER BY te.timer_start DESC`,
      [req.user.id]
    );

    res.json({ timers: result.rows });
  } catch (error) {
    console.error('Get all active timers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const pauseTimer = async (req, res) => {
  try {
    const { id } = req.params;

    const timerEntry = await db.query(
      'SELECT * FROM time_entries WHERE id = $1 AND user_id = $2 AND timer_start IS NOT NULL AND timer_end IS NULL',
      [id, req.user.id]
    );

    if (timerEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Active timer not found' });
    }

    const entry = timerEntry.rows[0];
    
    // If already paused, just return the current state
    if (entry.timer_is_paused) {
      return res.json({ timeEntry: entry });
    }
    
    const now = new Date();
    
    // Calculate elapsed seconds for this session and add to total
    const currentSessionSeconds = Math.floor((now - new Date(entry.timer_start)) / 1000);
    const totalElapsedSeconds = (entry.timer_elapsed_seconds || 0) + currentSessionSeconds;
    
    const result = await db.query(
      `UPDATE time_entries 
       SET timer_is_paused = true, timer_elapsed_seconds = $1
       WHERE id = $2 
       RETURNING *,
       (SELECT name FROM projects WHERE id = time_entries.project_id) as project_name,
       (SELECT name FROM clients WHERE id = (SELECT client_id FROM projects WHERE id = time_entries.project_id)) as client_name`,
      [totalElapsedSeconds, id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'pause_timer', 'time_entry', id, JSON.stringify({ elapsedSeconds: totalElapsedSeconds }), req.ip]
    );

    res.json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Pause timer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const resumeTimer = async (req, res) => {
  try {
    const { id } = req.params;

    const timerEntry = await db.query(
      'SELECT * FROM time_entries WHERE id = $1 AND user_id = $2 AND timer_start IS NOT NULL AND timer_end IS NULL AND timer_is_paused = true',
      [id, req.user.id]
    );

    if (timerEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Paused timer not found' });
    }

    // Update timer_start to now to track the new session
    const result = await db.query(
      `UPDATE time_entries 
       SET timer_is_paused = false, timer_start = $1
       WHERE id = $2 
       RETURNING *,
       (SELECT name FROM projects WHERE id = time_entries.project_id) as project_name,
       (SELECT name FROM clients WHERE id = (SELECT client_id FROM projects WHERE id = time_entries.project_id)) as client_name`,
      [new Date(), id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'resume_timer', 'time_entry', id, req.ip]
    );

    res.json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Resume timer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const commitTimer = async (req, res) => {
  try {
    const { id } = req.params;

    const timerEntry = await db.query(
      'SELECT * FROM time_entries WHERE id = $1 AND user_id = $2 AND timer_start IS NOT NULL AND timer_end IS NULL',
      [id, req.user.id]
    );

    if (timerEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Timer not found' });
    }

    const entry = timerEntry.rows[0];
    const now = new Date();
    
    // Calculate total elapsed time
    let totalElapsedSeconds = entry.timer_elapsed_seconds || 0;
    if (!entry.timer_is_paused) {
      const currentSessionSeconds = Math.floor((now - new Date(entry.timer_start)) / 1000);
      totalElapsedSeconds += currentSessionSeconds;
    }
    
    // Convert to hours and round UP to nearest 0.1
    const hours = Math.ceil((totalElapsedSeconds / 3600) * 10) / 10;
    
    // Ensure minimum of 0.1 hours if any time was tracked
    const finalHours = totalElapsedSeconds > 0 ? Math.max(0.1, hours) : 0;
    
    const result = await db.query(
      `UPDATE time_entries 
       SET timer_end = $1, hours = $2, timer_elapsed_seconds = $3
       WHERE id = $4 
       RETURNING *`,
      [now, finalHours, totalElapsedSeconds, id]
    );

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'commit_timer', 'time_entry', id, JSON.stringify({ hours: finalHours, totalSeconds: totalElapsedSeconds }), req.ip]
    );

    res.json({ timeEntry: result.rows[0] });
  } catch (error) {
    console.error('Commit timer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const submitTimeEntries = async (req, res) => {
  try {
    const { entryIds } = req.body;

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ error: 'No entries provided' });
    }

    const result = await db.query(
      `UPDATE time_entries 
       SET status = 'submitted' 
       WHERE id = ANY($1) AND user_id = $2 AND status = 'draft'
       RETURNING id`,
      [entryIds, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No valid entries to submit' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'submit_time_entries', JSON.stringify({ count: result.rows.length }), req.ip]
    );

    res.json({ 
      message: `${result.rows.length} time entries submitted successfully`,
      submittedIds: result.rows.map(r => r.id)
    });
  } catch (error) {
    console.error('Submit time entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllTimeEntries,
  getTodayEntries,
  getTimeEntryById,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  commitTimer,
  getActiveTimer,
  getAllActiveTimers,
  submitTimeEntries
};