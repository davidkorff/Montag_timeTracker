const { parseHistoricalData, convertDateFormat, getUniqueClients, getUniqueInvoices } = require('../utils/csvParser');
const db = require('../../config/database');

const analyzeCSV = async (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData) {
      return res.status(400).json({ error: 'No CSV data provided' });
    }
    
    // Parse CSV data directly (already parsed by frontend)
    const { entries, clientInfo } = await parseHistoricalData(csvData);
    
    // Get unique clients and invoices
    const uniqueClients = getUniqueClients(entries);
    const uniqueInvoices = getUniqueInvoices(entries);
    
    // Get all existing clients and their projects from database
    const clientsResult = await db.query(
      `SELECT c.id, c.name, c.billing_rate, c.default_rate,
              p.id as project_id, p.name as project_name
       FROM clients c
       LEFT JOIN projects p ON c.id = p.client_id
       WHERE c.is_active = true
       ORDER BY c.name, p.name`
    );
    
    // Organize clients and projects
    const existingClientsMap = {};
    clientsResult.rows.forEach(row => {
      if (!existingClientsMap[row.id]) {
        existingClientsMap[row.id] = {
          id: row.id,
          name: row.name,
          billing_rate: row.billing_rate || row.default_rate || 175,
          projects: []
        };
      }
      if (row.project_id) {
        existingClientsMap[row.id].projects.push({
          id: row.project_id,
          name: row.project_name
        });
      }
    });
    
    const existingClientsList = Object.values(existingClientsMap).sort((a, b) => a.name.localeCompare(b.name));
    
    // Map CSV companies to existing clients
    const companyToClient = {};
    uniqueClients.forEach(csvClient => {
      const match = existingClientsList.find(
        dbClient => dbClient.name.toLowerCase() === csvClient.name.toLowerCase()
      );
      if (match) {
        companyToClient[csvClient.name] = match.id;
      }
    });
    
    res.json({
      summary: {
        totalEntries: entries.length,
        uniqueCompanies: uniqueClients.length,
        uniqueInvoices: uniqueInvoices.length,
        dateRange: {
          start: entries.reduce((min, e) => {
            const date = convertDateFormat(e.date);
            return !min || date < min ? date : min;
          }, null),
          end: entries.reduce((max, e) => {
            const date = convertDateFormat(e.date);
            return !max || date > max ? date : max;
          }, null)
        }
      },
      entries: entries.map((entry, index) => ({
        ...entry,
        id: index,
        date: convertDateFormat(entry.date),
        suggestedClientId: companyToClient[entry.company] || null
      })),
      existingClients: existingClientsList,
      csvCompanies: uniqueClients.map(c => c.name),
      companyToClient
    });
  } catch (error) {
    console.error('Analyze CSV error:', error);
    res.status(500).json({ error: 'Failed to analyze CSV data' });
  }
};

const importCSV = async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { entries, mappings } = req.body;
    
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'No entries provided' });
    }
    
    if (!mappings || typeof mappings !== 'object') {
      return res.status(400).json({ error: 'No client/project mappings provided' });
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    const results = {
      entries: { imported: 0, skipped: 0, errors: 0 },
      invoices: { created: 0, existing: 0 }
    };
    
    // Track unique invoices
    const invoiceMap = new Map();
    
    // Import each entry
    for (const entry of entries) {
      try {
        const clientId = mappings[entry.id]?.clientId;
        const projectId = mappings[entry.id]?.projectId;
        
        if (!clientId || !projectId) {
          results.entries.skipped++;
          continue;
        }
        
        // Skip if hours is 0 or invalid
        if (!entry.hours || entry.hours <= 0) {
          results.entries.skipped++;
          continue;
        }
        
        // Handle invoice creation/lookup if needed
        let invoiceId = null;
        if (entry.invoiceNumber && entry.status === 'Paid') {
          if (!invoiceMap.has(entry.invoiceNumber)) {
            // Check if invoice exists
            const existingInvoice = await client.query(
              'SELECT id FROM invoices WHERE invoice_number = $1',
              [entry.invoiceNumber]
            );
            
            if (existingInvoice.rows.length > 0) {
              invoiceMap.set(entry.invoiceNumber, existingInvoice.rows[0].id);
              results.invoices.existing++;
            } else {
              // Create the invoice - use entry.date since it's already converted in analysis
              const invoiceDate = entry.billedDate || entry.date;
              
              // Calculate due date as 30 days after invoice date
              const invoiceDateObj = new Date(invoiceDate);
              const dueDateObj = new Date(invoiceDateObj);
              dueDateObj.setDate(dueDateObj.getDate() + 30);
              const dueDate = dueDateObj.toISOString().split('T')[0];
              
              const invoiceResult = await client.query(
                `INSERT INTO invoices 
                 (invoice_number, client_id, invoice_date, due_date, subtotal, tax_rate, tax_amount, total_amount, status, payment_status, created_by) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                 RETURNING id`,
                [
                  entry.invoiceNumber,
                  clientId,
                  invoiceDate,
                  dueDate,
                  0, // Will be calculated later
                  0,
                  0,
                  0, // Will be calculated later
                  'sent',
                  'paid',
                  req.user.id
                ]
              );
              
              invoiceMap.set(entry.invoiceNumber, invoiceResult.rows[0].id);
              results.invoices.created++;
            }
          }
          
          invoiceId = invoiceMap.get(entry.invoiceNumber);
        }
        
        // Determine status
        let status = 'draft';
        if (entry.status === 'Paid') {
          status = 'approved';
        } else if (entry.status === 'Billed') {
          status = 'submitted';
        }
        
        // Insert time entry
        await client.query(
          `INSERT INTO time_entries 
           (user_id, project_id, date, hours, description, is_billable, status, invoice_id, invoice_number, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
          [
            req.user.id,
            projectId,
            entry.date,
            entry.hours,
            entry.context || 'Consulting services',
            true,
            status,
            invoiceId,
            entry.invoiceNumber
          ]
        );
        
        results.entries.imported++;
      } catch (err) {
        console.error('Error importing entry:', err.message, entry);
        results.entries.errors++;
      }
    }
    
    // Update invoice totals for all created/updated invoices
    for (const [invoiceNumber, invoiceId] of invoiceMap) {
      const totalResult = await client.query(
        `SELECT SUM(hours) as total_hours, 
                SUM(hours * COALESCE(c.billing_rate, c.default_rate, 175)) as total_amount
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         JOIN clients c ON p.client_id = c.id
         WHERE te.invoice_id = $1`,
        [invoiceId]
      );
      
      if (totalResult.rows.length > 0) {
        const { total_hours, total_amount } = totalResult.rows[0];
        
        await client.query(
          `UPDATE invoices 
           SET subtotal = $1, total_amount = $1 
           WHERE id = $2`,
          [total_amount || 0, invoiceId]
        );
        
        // Create invoice item
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            invoiceId,
            'Consulting Services',
            total_hours || 0,
            total_hours > 0 ? Math.round(total_amount / total_hours) : 0,
            total_amount || 0
          ]
        );
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    res.json({
      success: true,
      results,
      message: `Successfully imported ${results.entries.imported} time entries`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import CSV error:', error);
    res.status(500).json({ error: 'Failed to import CSV data' });
  } finally {
    client.release();
  }
};

module.exports = {
  analyzeCSV,
  importCSV
};