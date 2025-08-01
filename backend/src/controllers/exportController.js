const db = require('../../config/database');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');

const exportComprehensiveData = async (req, res) => {
  try {
    console.log('Export request received:', { format: req.query.format, startDate: req.query.startDate, endDate: req.query.endDate, userId: req.user?.id });
    
    const { format = 'csv', startDate, endDate } = req.query;
    const userId = req.user.userTypeId === 1 ? null : req.user.id; // Admin sees all, others see own data
    
    // Prepare date filters
    const dateFilter = (startDate && endDate) ? 
      'AND te.date BETWEEN $1 AND $2' : 
      '';
    const dateParams = (startDate && endDate) ? [startDate, endDate] : [];
    
    // 1. Time Entries Query
    const timeEntriesQuery = `
      SELECT 
        te.id,
        te.date,
        te.hours,
        te.description,
        te.is_billable,
        te.status,
        te.timer_start,
        te.timer_end,
        te.invoice_number,
        te.created_at,
        te.updated_at,
        u.email as user_email,
        u.first_name || ' ' || u.last_name as user_name,
        p.name as project_name,
        p.code as project_code,
        c.name as client_name,
        c.code as client_code,
        COALESCE(p.hourly_rate, c.billing_rate, 175) as hourly_rate,
        te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) as amount
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE (te.is_deleted = false OR te.is_deleted IS NULL)
      ${dateFilter}
      ${userId ? `AND te.user_id = $${dateParams.length + 1}` : ''}
      ORDER BY te.date DESC, te.created_at DESC
    `;
    
    // 2. Invoices Query
    const invoicesQuery = `
      SELECT 
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.subtotal,
        i.tax_rate,
        i.tax_amount,
        i.total_amount,
        i.status,
        i.payment_status,
        i.payment_terms,
        i.notes,
        i.created_at,
        i.updated_at,
        c.name as client_name,
        c.code as client_code,
        c.contact_email as client_email,
        u.email as created_by_email,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN users u ON i.created_by = u.id
      ${dateFilter ? dateFilter.replace('te.date', 'i.invoice_date') : ''}
      ${userId ? `${dateFilter ? 'AND' : 'WHERE'} i.created_by = $${dateParams.length + 1}` : ''}
      ORDER BY i.invoice_date DESC, i.created_at DESC
    `;
    
    // 3. Invoice Items Query
    const invoiceItemsQuery = `
      SELECT 
        ii.id,
        ii.description,
        ii.quantity,
        ii.rate,
        ii.amount,
        ii.created_at,
        i.invoice_number,
        c.name as client_name
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      JOIN clients c ON i.client_id = c.id
      ${dateFilter ? dateFilter.replace('te.date', 'i.invoice_date') : ''}
      ${userId ? `${dateFilter ? 'AND' : 'WHERE'} i.created_by = $${dateParams.length + 1}` : ''}
      ORDER BY i.invoice_date DESC, ii.created_at DESC
    `;
    
    // 4. Clients Query
    const clientsQuery = `
      SELECT 
        c.id,
        c.name,
        c.code,
        c.contact_email,
        c.contact_phone,
        c.address,
        c.billing_rate,
        c.is_active,
        c.created_at,
        c.updated_at,
        u.email as created_by_email,
        u.first_name || ' ' || u.last_name as created_by_name,
        COUNT(DISTINCT p.id) as project_count,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable THEN te.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN te.is_billable THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as total_revenue
      FROM clients c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN projects p ON c.id = p.client_id
      LEFT JOIN time_entries te ON p.id = te.project_id AND (te.is_deleted = false OR te.is_deleted IS NULL)
      ${userId ? `WHERE EXISTS (
        SELECT 1 FROM time_entries te2 
        JOIN projects p2 ON te2.project_id = p2.id 
        WHERE p2.client_id = c.id AND te2.user_id = $1
      )` : ''}
      GROUP BY c.id, c.name, c.code, c.contact_email, c.contact_phone, c.address, 
               c.billing_rate, c.is_active, c.created_at, c.updated_at, u.email, u.first_name, u.last_name
      ORDER BY c.name
    `;
    
    // 5. Projects Query
    const projectsQuery = `
      SELECT 
        p.id,
        p.name,
        p.code,
        p.description,
        p.budget_hours,
        p.budget_amount,
        p.start_date,
        p.end_date,
        p.status,
        p.hourly_rate,
        p.created_at,
        p.updated_at,
        c.name as client_name,
        c.code as client_code,
        u.email as created_by_email,
        u.first_name || ' ' || u.last_name as created_by_name,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable THEN te.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN te.is_billable THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as total_revenue,
        COUNT(DISTINCT te.user_id) as consultant_count
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN time_entries te ON p.id = te.project_id AND (te.is_deleted = false OR te.is_deleted IS NULL)
      ${userId ? `WHERE EXISTS (
        SELECT 1 FROM time_entries te2 
        WHERE te2.project_id = p.id AND te2.user_id = $1
      )` : ''}
      GROUP BY p.id, p.name, p.code, p.description, p.budget_hours, p.budget_amount,
               p.start_date, p.end_date, p.status, p.hourly_rate, p.created_at, p.updated_at,
               c.name, c.code, u.email, u.first_name, u.last_name
      ORDER BY c.name, p.name
    `;
    
    // 6. Users Query (Admin only)
    const usersQuery = userId ? null : `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.is_active,
        u.hourly_rate,
        u.created_at,
        u.updated_at,
        COUNT(DISTINCT te.id) as time_entries_count,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable THEN te.hours ELSE 0 END) as billable_hours,
        COUNT(DISTINCT p.id) as projects_worked,
        COUNT(DISTINCT c.id) as clients_served
      FROM users u
      LEFT JOIN time_entries te ON u.id = te.user_id AND (te.is_deleted = false OR te.is_deleted IS NULL)
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.hourly_rate, u.created_at, u.updated_at
      ORDER BY u.last_name, u.first_name
    `;
    
    // Execute all queries
    const queryParams = userId ? [...dateParams, userId] : dateParams;
    
    const [timeEntries, invoices, invoiceItems, clients, projects, users] = await Promise.all([
      db.query(timeEntriesQuery, queryParams),
      db.query(invoicesQuery, queryParams),
      db.query(invoiceItemsQuery, queryParams),
      db.query(clientsQuery, userId ? [userId] : []),
      db.query(projectsQuery, userId ? [userId] : []),
      usersQuery ? db.query(usersQuery) : Promise.resolve({ rows: [] })
    ]);
    
    if (format === 'excel') {
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = '42 Consulting Time Tracker';
      workbook.created = new Date();
      
      // Time Entries Sheet
      const timeEntriesSheet = workbook.addWorksheet('Time Entries');
      timeEntriesSheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'User', key: 'user_name', width: 20 },
        { header: 'Client', key: 'client_name', width: 25 },
        { header: 'Project', key: 'project_name', width: 25 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Hours', key: 'hours', width: 10 },
        { header: 'Hourly Rate', key: 'hourly_rate', width: 12 },
        { header: 'Amount', key: 'amount', width: 12 },
        { header: 'Billable', key: 'is_billable', width: 10 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Invoice #', key: 'invoice_number', width: 15 },
        { header: 'Created', key: 'created_at', width: 20 }
      ];
      timeEntriesSheet.addRows(timeEntries.rows);
      
      // Invoices Sheet
      const invoicesSheet = workbook.addWorksheet('Invoices');
      invoicesSheet.columns = [
        { header: 'Invoice #', key: 'invoice_number', width: 15 },
        { header: 'Client', key: 'client_name', width: 25 },
        { header: 'Invoice Date', key: 'invoice_date', width: 12 },
        { header: 'Due Date', key: 'due_date', width: 12 },
        { header: 'Subtotal', key: 'subtotal', width: 12 },
        { header: 'Tax Rate', key: 'tax_rate', width: 10 },
        { header: 'Tax Amount', key: 'tax_amount', width: 12 },
        { header: 'Total Amount', key: 'total_amount', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Payment Status', key: 'payment_status', width: 15 },
        { header: 'Created By', key: 'created_by_name', width: 20 }
      ];
      invoicesSheet.addRows(invoices.rows);
      
      // Invoice Items Sheet
      const invoiceItemsSheet = workbook.addWorksheet('Invoice Items');
      invoiceItemsSheet.columns = [
        { header: 'Invoice #', key: 'invoice_number', width: 15 },
        { header: 'Client', key: 'client_name', width: 25 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Rate', key: 'rate', width: 10 },
        { header: 'Amount', key: 'amount', width: 12 }
      ];
      invoiceItemsSheet.addRows(invoiceItems.rows);
      
      // Clients Sheet
      const clientsSheet = workbook.addWorksheet('Clients');
      clientsSheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Code', key: 'code', width: 15 },
        { header: 'Email', key: 'contact_email', width: 25 },
        { header: 'Phone', key: 'contact_phone', width: 15 },
        { header: 'Billing Rate', key: 'billing_rate', width: 12 },
        { header: 'Projects', key: 'project_count', width: 10 },
        { header: 'Total Hours', key: 'total_hours', width: 12 },
        { header: 'Billable Hours', key: 'billable_hours', width: 12 },
        { header: 'Total Revenue', key: 'total_revenue', width: 15 },
        { header: 'Active', key: 'is_active', width: 10 }
      ];
      clientsSheet.addRows(clients.rows);
      
      // Projects Sheet
      const projectsSheet = workbook.addWorksheet('Projects');
      projectsSheet.columns = [
        { header: 'Client', key: 'client_name', width: 25 },
        { header: 'Project', key: 'name', width: 25 },
        { header: 'Code', key: 'code', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Budget Hours', key: 'budget_hours', width: 12 },
        { header: 'Total Hours', key: 'total_hours', width: 12 },
        { header: 'Billable Hours', key: 'billable_hours', width: 12 },
        { header: 'Total Revenue', key: 'total_revenue', width: 15 },
        { header: 'Consultants', key: 'consultant_count', width: 12 },
        { header: 'Start Date', key: 'start_date', width: 12 },
        { header: 'End Date', key: 'end_date', width: 12 }
      ];
      projectsSheet.addRows(projects.rows);
      
      // Users Sheet (Admin only)
      if (users.rows.length > 0) {
        const usersSheet = workbook.addWorksheet('Users');
        usersSheet.columns = [
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Email', key: 'email', width: 25 },
          { header: 'Role', key: 'role', width: 15 },
          { header: 'Hourly Rate', key: 'hourly_rate', width: 12 },
          { header: 'Total Hours', key: 'total_hours', width: 12 },
          { header: 'Billable Hours', key: 'billable_hours', width: 12 },
          { header: 'Projects', key: 'projects_worked', width: 10 },
          { header: 'Clients', key: 'clients_served', width: 10 },
          { header: 'Active', key: 'is_active', width: 10 }
        ];
        // Transform user data
        const userData = users.rows.map(u => ({
          ...u,
          name: `${u.first_name} ${u.last_name}`
        }));
        usersSheet.addRows(userData);
      }
      
      // Apply formatting
      workbook.eachSheet((worksheet) => {
        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Add filters
        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: worksheet.columns.length }
        };
        
        // Format currency columns
        worksheet.columns.forEach((column) => {
          if (['amount', 'subtotal', 'total_amount', 'tax_amount', 'total_revenue', 'hourly_rate', 'billing_rate', 'rate'].includes(column.key)) {
            column.numFmt = '$#,##0.00';
          }
          if (['hours', 'total_hours', 'billable_hours', 'budget_hours'].includes(column.key)) {
            column.numFmt = '#,##0.00';
          }
        });
      });
      
      // Generate filename
      const filename = `42Consulting_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } else {
      // CSV Export - create separate files as a zip
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="42Consulting_Export_${new Date().toISOString().split('T')[0]}.zip"`);
      
      archive.pipe(res);
      
      // Time Entries CSV
      if (timeEntries.rows.length > 0) {
        const parser = new Parser({
          fields: ['date', 'user_name', 'user_email', 'client_name', 'project_name', 'description', 'hours', 'hourly_rate', 'amount', 'is_billable', 'status', 'invoice_number', 'created_at']
        });
        const csv = parser.parse(timeEntries.rows);
        archive.append(csv, { name: 'time_entries.csv' });
      }
      
      // Invoices CSV
      if (invoices.rows.length > 0) {
        const parser = new Parser({
          fields: ['invoice_number', 'client_name', 'invoice_date', 'due_date', 'subtotal', 'tax_rate', 'tax_amount', 'total_amount', 'status', 'payment_status', 'payment_terms', 'created_by_name', 'created_at']
        });
        const csv = parser.parse(invoices.rows);
        archive.append(csv, { name: 'invoices.csv' });
      }
      
      // Invoice Items CSV
      if (invoiceItems.rows.length > 0) {
        const parser = new Parser({
          fields: ['invoice_number', 'client_name', 'description', 'quantity', 'rate', 'amount']
        });
        const csv = parser.parse(invoiceItems.rows);
        archive.append(csv, { name: 'invoice_items.csv' });
      }
      
      // Clients CSV
      if (clients.rows.length > 0) {
        const parser = new Parser({
          fields: ['name', 'code', 'contact_email', 'contact_phone', 'billing_rate', 'project_count', 'total_hours', 'billable_hours', 'total_revenue', 'is_active']
        });
        const csv = parser.parse(clients.rows);
        archive.append(csv, { name: 'clients.csv' });
      }
      
      // Projects CSV
      if (projects.rows.length > 0) {
        const parser = new Parser({
          fields: ['client_name', 'name', 'code', 'status', 'budget_hours', 'total_hours', 'billable_hours', 'total_revenue', 'consultant_count', 'start_date', 'end_date']
        });
        const csv = parser.parse(projects.rows);
        archive.append(csv, { name: 'projects.csv' });
      }
      
      // Users CSV (Admin only)
      if (users.rows.length > 0) {
        const userData = users.rows.map(u => ({
          name: `${u.first_name} ${u.last_name}`,
          ...u
        }));
        const parser = new Parser({
          fields: ['name', 'email', 'role', 'hourly_rate', 'total_hours', 'billable_hours', 'projects_worked', 'clients_served', 'is_active']
        });
        const csv = parser.parse(userData);
        archive.append(csv, { name: 'users.csv' });
      }
      
      await archive.finalize();
    }
    
  } catch (error) {
    console.error('Export comprehensive data error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to export data', details: error.message });
  }
};

module.exports = {
  exportComprehensiveData
};