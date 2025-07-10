require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const db = require('../../config/database');
const { parseCSVFile, parseHistoricalData, convertDateFormat, getUniqueClients, getUniqueInvoices } = require('../utils/csvParser');

const HISTORICAL_DATA_DIR = path.join(__dirname, '../../../../historical data');

const importHistoricalData = async () => {
  const client = await db.getClient();
  
  try {
    console.log('Starting historical data import...\n');
    
    // Get all CSV files in the historical data directory
    const files = fs.readdirSync(HISTORICAL_DATA_DIR).filter(f => f.endsWith('.csv'));
    console.log(`Found ${files.length} CSV files to process:`, files);
    
    // Process each file
    let allEntries = [];
    let allClientInfo = {};
    
    for (const file of files) {
      console.log(`\nProcessing ${file}...`);
      const filePath = path.join(HISTORICAL_DATA_DIR, file);
      
      try {
        const csvData = await parseCSVFile(filePath);
        const { entries, clientInfo } = await parseHistoricalData(csvData);
        
        console.log(`  - Found ${entries.length} time entries`);
        console.log(`  - Client info:`, Object.keys(clientInfo));
        
        allEntries = allEntries.concat(entries);
        Object.assign(allClientInfo, clientInfo);
      } catch (err) {
        console.error(`  - Error processing ${file}:`, err.message);
      }
    }
    
    console.log(`\nTotal entries found: ${allEntries.length}`);
    
    // Get unique clients and invoices
    const uniqueClients = getUniqueClients(allEntries);
    const uniqueInvoices = getUniqueInvoices(allEntries);
    
    console.log(`\nUnique clients: ${uniqueClients.length}`);
    uniqueClients.forEach(c => {
      console.log(`  - ${c.name}: ${c.totalHours} hours, $${c.totalRevenue}`);
    });
    
    console.log(`\nUnique invoices: ${uniqueInvoices.length}`);
    
    // Start transaction
    await client.query('BEGIN');
    
    // Step 1: Create clients
    console.log('\nStep 1: Creating clients...');
    const clientMap = new Map();
    
    for (const clientData of uniqueClients) {
      // Check if client already exists
      const existingClient = await client.query(
        'SELECT id FROM clients WHERE name = $1',
        [clientData.name]
      );
      
      if (existingClient.rows.length > 0) {
        clientMap.set(clientData.name, existingClient.rows[0].id);
        console.log(`  - Client "${clientData.name}" already exists`);
      } else {
        // Get additional client info if available
        const additionalInfo = allClientInfo[clientData.name] || {};
        
        const result = await client.query(
          `INSERT INTO clients (name, code, billing_rate, default_rate, invoice_email, invoice_cc_email, payment_terms, created_by, is_active) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
           RETURNING id`,
          [
            clientData.name,
            clientData.name.replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 10), // Generate code
            clientData.hourlyRate,
            clientData.hourlyRate,
            additionalInfo.invoiceEmail || null,
            additionalInfo.ccEmail || null,
            additionalInfo.paymentTerms || 'Net 30',
            1, // Admin user
            true
          ]
        );
        
        clientMap.set(clientData.name, result.rows[0].id);
        console.log(`  - Created client "${clientData.name}"`);
      }
    }
    
    // Step 2: Create default projects for each client
    console.log('\nStep 2: Creating projects...');
    const projectMap = new Map();
    
    for (const [clientName, clientId] of clientMap) {
      // Check if default project exists
      const existingProject = await client.query(
        'SELECT id FROM projects WHERE client_id = $1 AND name = $2',
        [clientId, 'General Consulting']
      );
      
      if (existingProject.rows.length > 0) {
        projectMap.set(clientName, existingProject.rows[0].id);
        console.log(`  - Project for "${clientName}" already exists`);
      } else {
        const result = await client.query(
          `INSERT INTO projects (client_id, name, description, status, created_by) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING id`,
          [
            clientId,
            'General Consulting',
            'Historical time entries imported from spreadsheet',
            'active',
            1 // Admin user
          ]
        );
        
        projectMap.set(clientName, result.rows[0].id);
        console.log(`  - Created project for "${clientName}"`);
      }
    }
    
    // Step 3: Create invoices
    console.log('\nStep 3: Creating invoices...');
    const invoiceMap = new Map();
    
    for (const invoiceData of uniqueInvoices) {
      const clientId = clientMap.get(invoiceData.client);
      if (!clientId) {
        console.warn(`  - Skipping invoice ${invoiceData.invoiceNumber}: client not found`);
        continue;
      }
      
      // Check if invoice already exists
      const existingInvoice = await client.query(
        'SELECT id FROM invoices WHERE invoice_number = $1',
        [invoiceData.invoiceNumber]
      );
      
      if (existingInvoice.rows.length > 0) {
        invoiceMap.set(invoiceData.invoiceNumber, existingInvoice.rows[0].id);
        console.log(`  - Invoice ${invoiceData.invoiceNumber} already exists`);
      } else {
        // Convert dates
        const invoiceDate = invoiceData.billedDate ? convertDateFormat(invoiceData.billedDate) : invoiceData.endDate;
        const dueDate = null; // Will use default payment terms
        
        const result = await client.query(
          `INSERT INTO invoices 
           (invoice_number, client_id, invoice_date, due_date, subtotal, tax_rate, tax_amount, total_amount, status, payment_status, created_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
           RETURNING id`,
          [
            invoiceData.invoiceNumber,
            clientId,
            invoiceDate,
            dueDate,
            invoiceData.totalAmount,
            0, // No tax in historical data
            0,
            invoiceData.totalAmount,
            'sent',
            invoiceData.status,
            1 // Admin user
          ]
        );
        
        invoiceMap.set(invoiceData.invoiceNumber, result.rows[0].id);
        
        // Create invoice item
        await client.query(
          `INSERT INTO invoice_items 
           (invoice_id, description, quantity, rate, amount) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            result.rows[0].id,
            `Consulting Services ${invoiceData.startDate || ''} - ${invoiceData.endDate || ''}`.trim(),
            invoiceData.totalHours,
            invoiceData.totalHours > 0 ? Math.round(invoiceData.totalAmount / invoiceData.totalHours) : 0,
            invoiceData.totalAmount
          ]
        );
        
        console.log(`  - Created invoice ${invoiceData.invoiceNumber}`);
      }
    }
    
    // Step 4: Import time entries
    console.log('\nStep 4: Importing time entries...');
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const entry of allEntries) {
      try {
        const projectId = projectMap.get(entry.company);
        if (!projectId) {
          console.warn(`  - Skipping entry: project not found for ${entry.company}`);
          skippedCount++;
          continue;
        }
        
        const date = convertDateFormat(entry.date);
        if (!date || date.includes('Invalid')) {
          console.warn(`  - Skipping entry: invalid date ${entry.date}`);
          skippedCount++;
          continue;
        }
        
        // Determine status based on invoice status
        let status = 'draft';
        if (entry.status === 'Paid') {
          status = 'approved';
        } else if (entry.status === 'Billed') {
          status = 'submitted';
        }
        
        const invoiceId = entry.invoiceNumber ? invoiceMap.get(entry.invoiceNumber) : null;
        
        await client.query(
          `INSERT INTO time_entries 
           (user_id, project_id, date, hours, description, is_billable, status, invoice_id, invoice_number, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
          [
            1, // Admin user
            projectId,
            date,
            entry.hours,
            entry.context || 'Consulting services',
            true,
            status,
            invoiceId,
            entry.invoiceNumber
          ]
        );
        
        importedCount++;
        
        if (importedCount % 100 === 0) {
          console.log(`  - Imported ${importedCount} entries...`);
        }
      } catch (err) {
        console.error(`  - Error importing entry:`, err.message, entry);
        errorCount++;
      }
    }
    
    console.log(`\nImport complete:`);
    console.log(`  - Imported: ${importedCount} entries`);
    console.log(`  - Skipped: ${skippedCount} entries`);
    console.log(`  - Errors: ${errorCount} entries`);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\nTransaction committed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error);
    throw error;
  } finally {
    client.release();
    process.exit();
  }
};

// Run the import
importHistoricalData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});