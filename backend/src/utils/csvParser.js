const fs = require('fs');
const csv = require('csv-parse');
const path = require('path');

const parseCSVFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const records = [];
    const parser = csv.parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true // Allow variable column counts
    });

    parser.on('readable', function() {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });

    parser.on('error', function(err) {
      reject(err);
    });

    parser.on('end', function() {
      resolve(records);
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(parser);
  });
};

const parseHistoricalData = async (csvData) => {
  const entries = [];
  const clientInfo = {};
  
  for (const row of csvData) {
    // Skip header rows or empty rows
    if (!row.Company || row.Company === 'Company' || !row.Date) {
      continue;
    }
    
    const company = row.Company.trim();
    
    // Extract client info from the first occurrence
    if (!clientInfo[company] && row['']) {
      // Parse additional columns that contain client info
      const additionalData = Object.values(row).slice(8); // Skip main data columns
      
      // Look for email patterns
      const emails = additionalData.filter(val => val && val.includes('@'));
      if (emails.length > 0) {
        clientInfo[company] = {
          invoiceEmail: emails[0],
          ccEmail: emails[1] || null,
          paymentTerms: null
        };
      }
      
      // Look for payment terms
      const termsIndex = additionalData.findIndex(val => val === 'Terms');
      if (termsIndex >= 0 && additionalData[termsIndex + 1]) {
        if (!clientInfo[company]) clientInfo[company] = {};
        clientInfo[company].paymentTerms = `Net ${additionalData[termsIndex + 1]}`;
      }
    }
    
    // Find hours value - check all possible column names
    let hoursValue = 0;
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().startsWith('hours')) {
        hoursValue = parseFloat(row[key]) || 0;
        if (hoursValue > 0) break; // Found valid hours
      }
    }
    
    // Find money value - check all possible column names
    let moneyValue = 0;
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().startsWith('money')) {
        moneyValue = parseFloat(row[key]) || 0;
        if (moneyValue > 0) break; // Found valid money
      }
    }
    
    // Parse the time entry
    const entry = {
      company: company,
      date: row.Date,
      hours: hoursValue,
      context: row.Context || '',
      money: moneyValue,
      status: row.Status || 'Not Billed',
      invoiceNumber: row.invoice || row.Invoice || null,
      billedDate: row['Billed Date'] || null
    };
    
    // Calculate hourly rate if possible
    if (entry.hours > 0 && entry.money > 0) {
      entry.hourlyRate = Math.round(entry.money / entry.hours);
    } else if (entry.money > 0 && entry.hours === 0) {
      // If we have money but no hours, assume a default rate
      entry.hourlyRate = 175;
    }
    
    entries.push(entry);
  }
  
  return { entries, clientInfo };
};

const convertDateFormat = (dateStr) => {
  if (!dateStr) return null;
  
  // Handle various date formats
  const patterns = [
    // MM/DD/YY or M/D/YY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    // MM/DD/YYYY or M/D/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      let [_, month, day, year] = match;
      
      // Convert 2-digit year to 4-digit
      if (year.length === 2) {
        // Assume 20XX for years 00-50, 19XX for 51-99
        year = parseInt(year) <= 50 ? '20' + year : '19' + year;
      }
      
      // Pad month and day with zeros
      month = month.padStart(2, '0');
      day = day.padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }
  }
  
  // If no pattern matches, return original
  console.warn(`Could not parse date: ${dateStr}`);
  return dateStr;
};

const getUniqueClients = (entries) => {
  const clients = new Map();
  
  entries.forEach(entry => {
    if (!clients.has(entry.company)) {
      clients.set(entry.company, {
        name: entry.company,
        hourlyRate: entry.hourlyRate || 175,
        invoiceNumbers: new Set(),
        totalHours: 0,
        totalRevenue: 0,
        calculatedRates: []
      });
    }
    
    const client = clients.get(entry.company);
    client.totalHours += entry.hours;
    client.totalRevenue += entry.money;
    
    // Collect all calculated rates to find the most common one
    if (entry.hours > 0 && entry.money > 0) {
      const rate = Math.round(entry.money / entry.hours);
      client.calculatedRates.push(rate);
    }
    
    if (entry.invoiceNumber) {
      client.invoiceNumbers.add(entry.invoiceNumber);
    }
  });
  
  // Calculate the most common hourly rate for each client
  clients.forEach(client => {
    if (client.calculatedRates.length > 0) {
      // Find the most frequent rate
      const rateCount = {};
      client.calculatedRates.forEach(rate => {
        rateCount[rate] = (rateCount[rate] || 0) + 1;
      });
      
      // Get the rate with highest count
      let maxCount = 0;
      let mostCommonRate = 175;
      Object.entries(rateCount).forEach(([rate, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonRate = parseInt(rate);
        }
      });
      
      client.hourlyRate = mostCommonRate;
    } else if (client.totalHours > 0 && client.totalRevenue > 0) {
      // Fallback: calculate from totals
      client.hourlyRate = Math.round(client.totalRevenue / client.totalHours);
    }
    
    // Remove the temporary calculatedRates array
    delete client.calculatedRates;
  });
  
  return Array.from(clients.values());
};

const getUniqueInvoices = (entries) => {
  const invoices = new Map();
  
  entries.forEach(entry => {
    if (entry.invoiceNumber && entry.status !== 'Not Billed') {
      if (!invoices.has(entry.invoiceNumber)) {
        invoices.set(entry.invoiceNumber, {
          invoiceNumber: entry.invoiceNumber,
          client: entry.company,
          billedDate: entry.billedDate,
          status: entry.status === 'Paid' ? 'paid' : 'sent',
          entries: []
        });
      }
      
      invoices.get(entry.invoiceNumber).entries.push(entry);
    }
  });
  
  // Calculate totals for each invoice
  invoices.forEach(invoice => {
    invoice.totalHours = invoice.entries.reduce((sum, e) => sum + e.hours, 0);
    invoice.totalAmount = invoice.entries.reduce((sum, e) => sum + e.money, 0);
    
    // Get date range
    const dates = invoice.entries.map(e => convertDateFormat(e.date)).filter(d => d);
    if (dates.length > 0) {
      dates.sort();
      invoice.startDate = dates[0];
      invoice.endDate = dates[dates.length - 1];
    }
  });
  
  return Array.from(invoices.values());
};

module.exports = {
  parseCSVFile,
  parseHistoricalData,
  convertDateFormat,
  getUniqueClients,
  getUniqueInvoices
};