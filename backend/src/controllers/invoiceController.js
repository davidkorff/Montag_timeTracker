const { validationResult } = require('express-validator');
const db = require('../../config/database');
const { generateInvoiceNumber } = require('../utils/invoiceUtils');

const getAllInvoices = async (req, res) => {
  try {
    const { clientId, status, paymentStatus } = req.query;
    let query = `
      SELECT 
        i.*,
        c.name as client_name,
        c.code as client_code,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM invoices i
      INNER JOIN clients c ON i.client_id = c.id
      INNER JOIN users u ON i.created_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    if (clientId) {
      paramCount++;
      query += ` AND i.client_id = $${paramCount}`;
      params.push(clientId);
    }

    if (status) {
      paramCount++;
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
    }

    if (paymentStatus) {
      paramCount++;
      query += ` AND i.payment_status = $${paramCount}`;
      params.push(paymentStatus);
    }

    query += ' ORDER BY i.invoice_date DESC, i.invoice_number DESC';
    
    const result = await db.query(query, params);
    res.json({ invoices: result.rows });
  } catch (error) {
    console.error('Get all invoices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoiceResult = await db.query(
      `SELECT 
        i.*,
        c.name as client_name,
        c.code as client_code,
        c.contact_email,
        c.contact_phone,
        c.address as client_address,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM invoices i
      INNER JOIN clients c ON i.client_id = c.id
      INNER JOIN users u ON i.created_by = u.id
      WHERE i.id = $1`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const itemsResult = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at',
      [id]
    );

    // Get time entries associated with this invoice
    const timeEntriesResult = await db.query(
      `SELECT 
        te.*,
        p.name as project_name,
        u.first_name || ' ' || u.last_name as user_name
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN users u ON te.user_id = u.id
      WHERE te.invoice_id = $1
      ORDER BY te.date, te.created_at`,
      [id]
    );

    res.json({ 
      invoice: invoiceResult.rows[0],
      items: itemsResult.rows,
      timeEntries: timeEntriesResult.rows
    });
  } catch (error) {
    console.error('Get invoice by id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createInvoice = async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      clientId, 
      timeEntryIds,
      invoiceDate,
      dueDate,
      taxRate = 0,
      paymentTerms,
      notes
    } = req.body;

    // Get unbilled time entries for the client
    let timeEntriesQuery = `
      SELECT 
        te.*,
        p.name as project_name,
        c.billing_rate as client_rate,
        u.hourly_rate as user_rate
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN clients c ON p.client_id = c.id
      INNER JOIN users u ON te.user_id = u.id
      WHERE p.client_id = $1 
        AND te.invoice_id IS NULL 
        AND te.is_billable = true
        AND te.status IN ('draft', 'submitted', 'approved')
    `;
    
    const params = [clientId];
    
    if (timeEntryIds && timeEntryIds.length > 0) {
      timeEntriesQuery += ` AND te.id = ANY($2)`;
      params.push(timeEntryIds);
    }
    
    const timeEntriesResult = await client.query(timeEntriesQuery, params);
    
    if (timeEntriesResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No billable time entries found' });
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(client);

    // Calculate totals
    let subtotal = 0;
    const itemsData = [];

    // Group time entries by project
    const projectGroups = {};
    timeEntriesResult.rows.forEach(entry => {
      if (!projectGroups[entry.project_id]) {
        projectGroups[entry.project_id] = {
          projectName: entry.project_name,
          entries: [],
          totalHours: 0,
          rate: entry.client_rate || entry.user_rate || 0
        };
      }
      projectGroups[entry.project_id].entries.push(entry);
      projectGroups[entry.project_id].totalHours += parseFloat(entry.hours);
    });

    // Get date range for all entries
    let startDate = null;
    let endDate = null;
    timeEntriesResult.rows.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (!startDate || entryDate < startDate) startDate = entryDate;
      if (!endDate || entryDate > endDate) endDate = entryDate;
    });

    // Create a single invoice item for consulting services with date range
    const totalHours = timeEntriesResult.rows.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
    const rate = timeEntriesResult.rows[0].client_rate || timeEntriesResult.rows[0].user_rate || 175;
    const amount = totalHours * rate;
    subtotal = amount;
    
    const startDateStr = startDate ? startDate.toISOString().split('T')[0] : '';
    const endDateStr = endDate ? endDate.toISOString().split('T')[0] : '';
    
    itemsData.push({
      description: `Consulting Services ${startDateStr} - ${endDateStr}`,
      quantity: totalHours,
      rate: rate,
      amount: amount,
      timeEntryIds: timeEntriesResult.rows.map(e => e.id)
    });

    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    // Create invoice
    const invoiceResult = await client.query(
      `INSERT INTO invoices 
       (invoice_number, client_id, invoice_date, due_date, subtotal, tax_rate, tax_amount, total_amount, payment_terms, notes, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [invoiceNumber, clientId, invoiceDate || 'CURRENT_DATE', dueDate, subtotal, taxRate, taxAmount, totalAmount, paymentTerms, notes, req.user.id]
    );

    const invoice = invoiceResult.rows[0];

    // Create invoice items
    for (const item of itemsData) {
      await client.query(
        `INSERT INTO invoice_items 
         (invoice_id, description, quantity, rate, amount, time_entry_ids) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, item.description, item.quantity, item.rate, item.amount, item.timeEntryIds]
      );

      // Update time entries with invoice info
      if (item.timeEntryIds.length > 0) {
        await client.query(
          `UPDATE time_entries 
           SET invoice_id = $1, invoice_number = $2 
           WHERE id = ANY($3)`,
          [invoice.id, invoiceNumber, item.timeEntryIds]
        );
      }
    }

    await client.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'create_invoice', 'invoice', invoice.id, req.ip]
    );

    await client.query('COMMIT');

    res.status(201).json({ invoice });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

const updateInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const allowedUpdates = ['status', 'payment_status', 'payment_terms', 'notes', 'due_date'];
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
      `UPDATE invoices SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'update_invoice', 'invoice', id, JSON.stringify(actualUpdates), req.ip]
    );

    res.json({ invoice: result.rows[0] });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteInvoice = async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;

    // Check if invoice can be deleted
    const invoiceResult = await client.query(
      'SELECT status FROM invoices WHERE id = $1',
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoiceResult.rows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    }

    // Remove invoice references from time entries
    await client.query(
      'UPDATE time_entries SET invoice_id = NULL, invoice_number = NULL WHERE invoice_id = $1',
      [id]
    );

    // Delete invoice (cascade will delete invoice_items)
    await client.query('DELETE FROM invoices WHERE id = $1', [id]);

    await client.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'delete_invoice', 'invoice', id, req.ip]
    );

    await client.query('COMMIT');

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

const getUnbilledTimeEntries = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const result = await db.query(
      `SELECT 
        te.*,
        p.name as project_name,
        u.first_name || ' ' || u.last_name as user_name,
        c.billing_rate as client_rate,
        u.hourly_rate as user_rate
      FROM time_entries te
      INNER JOIN projects p ON te.project_id = p.id
      INNER JOIN clients c ON p.client_id = c.id
      INNER JOIN users u ON te.user_id = u.id
      WHERE p.client_id = $1 
        AND te.invoice_id IS NULL 
        AND te.is_billable = true
        AND te.status IN ('draft', 'submitted', 'approved')
        AND (te.is_deleted = false OR te.is_deleted IS NULL)
      ORDER BY te.date DESC, te.created_at DESC`,
      [clientId]
    );

    // Calculate total amount
    let totalAmount = 0;
    const entries = result.rows.map(entry => {
      const rate = entry.client_rate || entry.user_rate || 0;
      const amount = parseFloat(entry.hours) * rate;
      totalAmount += amount;
      return {
        ...entry,
        rate,
        amount
      };
    });

    res.json({ 
      timeEntries: entries,
      summary: {
        totalHours: entries.reduce((sum, e) => sum + parseFloat(e.hours), 0),
        totalAmount
      }
    });
  } catch (error) {
    console.error('Get unbilled time entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getUnbilledSummary = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        c.id as client_id,
        c.name as client_name,
        c.invoice_email,
        c.payment_terms,
        c.invoice_notes,
        c.default_rate,
        COUNT(DISTINCT te.id) as entry_count,
        SUM(te.hours) as total_hours,
        MIN(te.date) as start_date,
        MAX(te.date) as end_date,
        SUM(te.hours * COALESCE(c.default_rate, c.billing_rate, 175)) as total_amount
      FROM clients c
      INNER JOIN projects p ON c.id = p.client_id
      INNER JOIN time_entries te ON p.id = te.project_id
      WHERE te.invoice_id IS NULL 
        AND te.is_billable = true
        AND te.status IN ('draft', 'submitted', 'approved')
        AND (te.is_deleted = false OR te.is_deleted IS NULL)
        AND c.is_active = true
      GROUP BY c.id, c.name, c.invoice_email, c.payment_terms, c.invoice_notes, c.default_rate
      HAVING COUNT(te.id) > 0
      ORDER BY total_amount DESC, c.name`
    );

    // Get the next invoice number
    const invoiceNumberResult = await db.query(
      `SELECT invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1`
    );
    
    let nextInvoiceNumber = '00001';
    if (invoiceNumberResult.rows.length > 0) {
      const lastNumber = parseInt(invoiceNumberResult.rows[0].invoice_number);
      nextInvoiceNumber = String(lastNumber + 1).padStart(5, '0');
    }

    res.json({ 
      unbilledClients: result.rows,
      nextInvoiceNumber
    });
  } catch (error) {
    console.error('Get unbilled summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.user_type_id !== 1 && req.user.userTypeId !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { paymentStatus, paymentDate } = req.body;

    if (!paymentStatus || !['unpaid', 'partial', 'paid'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }

    const updateQuery = `
      UPDATE invoices 
      SET payment_status = $1,
          payment_date = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(updateQuery, [
      paymentStatus,
      paymentStatus === 'paid' ? (paymentDate || new Date().toISOString()) : null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice: result.rows[0] });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createManualInvoice = async (req, res) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const isAdmin = req.user.user_type_id === 1 || req.user.userTypeId === 1;
    
    if (!isAdmin) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      clientId,
      invoiceDate,
      dueDate,
      description,
      totalAmount,
      totalHours,
      status,
      paymentStatus,
      amountPaid,
      notes,
      isManual
    } = req.body;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(client);

    // Create the invoice
    const invoiceResult = await client.query(
      `INSERT INTO invoices 
       (invoice_number, client_id, invoice_date, due_date, total_amount, 
        total_hours, status, payment_status, amount_paid, notes, created_by, is_manual) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [
        invoiceNumber,
        clientId,
        invoiceDate,
        dueDate,
        totalAmount,
        totalHours || 0,
        status || 'sent',
        paymentStatus || 'pending',
        amountPaid || 0,
        notes || null,
        req.user.id,
        true
      ]
    );

    const invoice = invoiceResult.rows[0];

    // Create a single line item for the manual invoice
    await client.query(
      `INSERT INTO invoice_items 
       (invoice_id, description, hours, rate, amount) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        invoice.id,
        description,
        totalHours || 0,
        totalHours > 0 ? totalAmount / totalHours : 0,
        totalAmount
      ]
    );

    // Log the activity
    await client.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'create_manual_invoice', 'invoice', invoice.id, req.ip]
    );

    await client.query('COMMIT');
    res.status(201).json({ invoice });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create manual invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getUnbilledTimeEntries,
  getUnbilledSummary,
  updatePaymentStatus,
  createManualInvoice
};