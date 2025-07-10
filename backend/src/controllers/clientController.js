const { validationResult } = require('express-validator');
const db = require('../../config/database');

const getAllClients = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as project_count,
        SUM(te.hours) as total_hours
      FROM clients c
      LEFT JOIN projects p ON c.id = p.client_id
      LEFT JOIN time_entries te ON p.id = te.project_id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `;
    
    const result = await db.query(query);
    res.json({ clients: result.rows });
  } catch (error) {
    console.error('Get all clients error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const clientResult = await db.query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const projectsResult = await db.query(
      `SELECT 
        p.*,
        COUNT(DISTINCT te.id) as entry_count,
        SUM(te.hours) as total_hours
      FROM projects p
      LEFT JOIN time_entries te ON p.id = te.project_id
      WHERE p.client_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC`,
      [id]
    );

    res.json({ 
      client: clientResult.rows[0],
      projects: projectsResult.rows
    });
  } catch (error) {
    console.error('Get client by id error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createClient = async (req, res) => {
  try {
    console.log('Create client request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, code, contactEmail, contactPhone, address, billingRate,
            invoiceEmail, invoiceCcEmail, invoiceRecipientName, billedTo,
            companyName, companyAddress, paymentTerms, invoiceNotes } = req.body;
    console.log('Extracted values:', { name, code, contactEmail, contactPhone, address, billingRate,
                                     invoiceEmail, invoiceCcEmail, invoiceRecipientName, billedTo,
                                     companyName, companyAddress, paymentTerms, invoiceNotes });

    // Convert empty strings to null for database
    const cleanCode = code && code.trim() !== '' ? code.trim() : null;
    const cleanContactEmail = contactEmail && contactEmail.trim() !== '' ? contactEmail.trim() : null;
    const cleanContactPhone = contactPhone && contactPhone.trim() !== '' ? contactPhone.trim() : null;
    const cleanAddress = address && address.trim() !== '' ? address.trim() : null;

    if (cleanCode) {
      const existingClient = await db.query(
        'SELECT id FROM clients WHERE code = $1',
        [cleanCode]
      );

      if (existingClient.rows.length > 0) {
        return res.status(400).json({ error: 'Client code already exists' });
      }
    }
    
    console.log('User info:', req.user);
    console.log('About to insert with values:', [name, cleanCode, cleanContactEmail, cleanContactPhone, cleanAddress, billingRate, req.user.id]);
    
    const result = await db.query(
      `INSERT INTO clients (name, code, contact_email, contact_phone, address, billing_rate, created_by,
                           invoice_email, invoice_cc_email, invoice_recipient_name, billed_to,
                           company_name, company_address, payment_terms, invoice_notes, default_rate) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
       RETURNING *`,
      [name, cleanCode, cleanContactEmail, cleanContactPhone, cleanAddress, billingRate, req.user.id,
       invoiceEmail || null, invoiceCcEmail || null, invoiceRecipientName || null, billedTo || null,
       companyName || null, companyAddress || null, paymentTerms || 'Net 30', invoiceNotes || null, billingRate || 175]
    );
    
    console.log('Insert result:', result.rows[0]);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'create_client', 'client', result.rows[0].id, req.ip]
    );

    res.status(201).json({ client: result.rows[0] });
  } catch (error) {
    console.error('Create client error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint
    });
    res.status(500).json({ error: 'Server error' });
  }
};

const updateClient = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // Allow both camelCase and snake_case field names
    const allowedUpdates = ['name', 'code', 'contact_email', 'contact_phone', 'address', 'billing_rate', 'is_active',
                           'invoice_email', 'invoice_cc_email', 'invoice_recipient_name', 'billed_to',
                           'company_name', 'company_address', 'payment_terms', 'invoice_notes', 'default_rate',
                           // Also allow camelCase versions
                           'contactEmail', 'contactPhone', 'billingRate', 'isActive',
                           'invoiceEmail', 'invoiceCcEmail', 'invoiceRecipientName', 'billedTo',
                           'companyName', 'companyAddress', 'paymentTerms', 'invoiceNotes', 'defaultRate'];
    const actualUpdates = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        actualUpdates[field] = updates[field];
      }
    });

    if (Object.keys(actualUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    // Convert empty strings to null for unique constraint fields
    if (actualUpdates.code !== undefined) {
      actualUpdates.code = actualUpdates.code && actualUpdates.code.trim() !== '' ? actualUpdates.code.trim() : null;
      
      if (actualUpdates.code) {
        const existingClient = await db.query(
          'SELECT id FROM clients WHERE code = $1 AND id != $2',
          [actualUpdates.code, id]
        );

        if (existingClient.rows.length > 0) {
          return res.status(400).json({ error: 'Client code already in use' });
        }
      }
    }
    
    // Convert camelCase to snake_case for database fields
    const fieldMapping = {
      'contactEmail': 'contact_email',
      'contactPhone': 'contact_phone',
      'billingRate': 'billing_rate',
      'isActive': 'is_active',
      'invoiceEmail': 'invoice_email',
      'invoiceCcEmail': 'invoice_cc_email',
      'invoiceRecipientName': 'invoice_recipient_name',
      'billedTo': 'billed_to',
      'companyName': 'company_name',
      'companyAddress': 'company_address',
      'paymentTerms': 'payment_terms',
      'invoiceNotes': 'invoice_notes',
      'defaultRate': 'default_rate'
    };

    // Convert camelCase keys to snake_case
    const dbUpdates = {};
    Object.keys(actualUpdates).forEach(key => {
      const dbKey = fieldMapping[key] || key;
      dbUpdates[dbKey] = actualUpdates[key];
    });

    // Clean other fields
    if (dbUpdates.contact_email !== undefined) {
      dbUpdates.contact_email = dbUpdates.contact_email && dbUpdates.contact_email.trim() !== '' ? dbUpdates.contact_email.trim() : null;
    }
    if (dbUpdates.contact_phone !== undefined) {
      dbUpdates.contact_phone = dbUpdates.contact_phone && dbUpdates.contact_phone.trim() !== '' ? dbUpdates.contact_phone.trim() : null;
    }
    if (dbUpdates.address !== undefined) {
      dbUpdates.address = dbUpdates.address && dbUpdates.address.trim() !== '' ? dbUpdates.address.trim() : null;
    }

    const setClause = Object.keys(dbUpdates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(dbUpdates)];
    
    const result = await db.query(
      `UPDATE clients SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'update_client', 'client', id, JSON.stringify(actualUpdates), req.ip]
    );

    res.json({ client: result.rows[0] });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const activeProjects = await db.query(
      'SELECT COUNT(*) FROM projects WHERE client_id = $1 AND status = $2',
      [id, 'active']
    );

    if (parseInt(activeProjects.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete client with active projects' });
    }

    const result = await db.query(
      'UPDATE clients SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'deactivate_client', 'client', id, req.ip]
    );

    res.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient
};