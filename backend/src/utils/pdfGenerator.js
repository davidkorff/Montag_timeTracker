const puppeteer = require('puppeteer');
const { generateInvoicePDFWithKit } = require('./pdfKitGenerator');

const generateInvoiceHTML = (invoice, items, company, client) => {
  const companyInfo = company || {
    name: '42 Consulting LLC',
    consultant: 'David Korff',
    phone: '(516) 659-8138',
    email: 'david@42consultingllc.com'
  };

  // Calculate payment due date based on terms
  const invoiceDate = new Date(invoice.invoice_date);
  const paymentTerms = client.payment_terms || invoice.payment_terms || 'Net 30';
  let daysUntilDue = 30;
  
  if (paymentTerms.includes('15')) daysUntilDue = 15;
  else if (paymentTerms.includes('45')) daysUntilDue = 45;
  else if (paymentTerms.includes('60')) daysUntilDue = 60;
  else if (paymentTerms.includes('Receipt')) daysUntilDue = 0;

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px 50px;
                color: #333;
                font-size: 14px;
                line-height: 1.5;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 1px solid #ccc;
                padding-bottom: 20px;
            }
            .header h1 {
                font-size: 18px;
                margin: 0 0 10px 0;
                color: #333;
            }
            .header p {
                margin: 2px 0;
                font-size: 10px;
                color: #666;
            }
            hr {
                border: none;
                border-top: 1px solid #ccc;
                margin: 20px 0;
            }
            .section {
                margin: 15px 0;
            }
            .section-title {
                font-weight: bold;
                margin-bottom: 5px;
            }
            .info-grid {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
            }
            .info-block {
                flex: 1;
            }
            .info-block p {
                margin: 2px 0;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                border: 1px solid #ccc;
            }
            th {
                background: #f5f5f5;
                padding: 10px;
                text-align: left;
                font-weight: bold;
                border: 1px solid #ccc;
            }
            td {
                padding: 10px;
                border: 1px solid #ccc;
            }
            .text-right {
                text-align: right;
            }
            .totals {
                margin-top: 20px;
                text-align: right;
            }
            .totals-table {
                width: 250px;
                margin-left: auto;
                border: none;
            }
            .totals-table td {
                padding: 5px 10px;
                border: none;
            }
            .total-row {
                font-weight: bold;
                font-size: 16px;
            }
            .notes {
                margin: 20px 0;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 3px;
            }
            .payment-info {
                margin: 30px 0;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 3px;
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                color: #666;
                font-size: 10px;
                border-top: 1px solid #ccc;
                padding-top: 20px;
            }
            .label {
                font-weight: bold;
                display: inline-block;
                min-width: 150px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${companyInfo.name}</h1>
            <p>${companyInfo.consultant} | ${companyInfo.phone} | ${companyInfo.email}</p>
        </div>

        <hr>

        <div class="section">
            <p><span class="label">Billed To:</span> ${client.billed_to || client.contact_email || ''}</p>
            <p><span class="label">Customer:</span> ${client.company_name || client.name}</p>
            <p><span class="label">Address:</span> ${client.company_address || client.address || ''}</p>
        </div>

        <hr>

        <div class="section">
            <p><span class="label">Invoice #:</span> ${invoice.invoice_number}</p>
            <p><span class="label">Invoice Date:</span> ${new Date(invoice.invoice_date).toLocaleDateString('en-US')}</p>
        </div>

        <hr>

        ${client.invoice_notes || invoice.notes ? `
            <div class="notes">
                <p><strong>Notes:</strong></p>
                <p>${(client.invoice_notes || invoice.notes || '').replace(/\n/g, '<br>')}</p>
            </div>
            <hr>
        ` : ''}

        <div class="payment-info">
            <p><strong>Payment Information</strong></p>
            <p>Payment Due Date: ${daysUntilDue} days from invoice date</p>
            <p>Bank Name: Chase Bank</p>
            <p>Routing Number: 021202337</p>
            <p>Account Number: 573392639</p>
        </div>

        <hr>

        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-right" style="width: 80px;">Rate</th>
                    <th class="text-right" style="width: 80px;">Hours</th>
                    <th class="text-right" style="width: 100px;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => {
                    // Parse the description to extract date range if it's in the format we expect
                    let description = item.description;
                    const dateRangeMatch = description.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
                    if (dateRangeMatch) {
                        const startDate = new Date(dateRangeMatch[1]).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                        const endDate = new Date(dateRangeMatch[2]).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                        description = `Consulting ${startDate} - ${endDate}`;
                    }
                    
                    return `
                        <tr>
                            <td>${description}</td>
                            <td class="text-right">$${parseFloat(item.rate).toFixed(0)}</td>
                            <td class="text-right">${parseFloat(item.quantity).toFixed(1)}</td>
                            <td class="text-right">${parseFloat(item.amount).toFixed(2)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <div class="totals">
            <table class="totals-table">
                <tr>
                    <td>Subtotal:</td>
                    <td class="text-right">${parseFloat(invoice.subtotal).toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                    <td>Total:</td>
                    <td class="text-right">${parseFloat(invoice.total_amount).toFixed(2)}</td>
                </tr>
            </table>
        </div>

        <div class="footer">
            <p>If you have any questions regarding this invoice, please reach out to ${companyInfo.email}</p>
        </div>
    </body>
    </html>
  `;
};

const generateInvoicePDF = async (invoice, items, company, client) => {
  // Try PDFKit first in production, Puppeteer in development
  if (process.env.NODE_ENV === 'production' || process.env.USE_PDFKIT === 'true') {
    console.log('Using PDFKit for PDF generation');
    try {
      return await generateInvoicePDFWithKit(invoice, items, company, client);
    } catch (error) {
      console.error('PDFKit error:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  // Fallback to Puppeteer for development
  let browser;
  try {
    console.log('Using Puppeteer for PDF generation');
    const puppeteerConfig = {
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    };

    browser = await puppeteer.launch(puppeteerConfig);
    
    const page = await browser.newPage();
    const html = generateInvoiceHTML(invoice, items, company, client);
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '18px',
        right: '50px',
        bottom: '18px',
        left: '50px'
      },
      timeout: 30000 // 30 second timeout
    });
    
    return pdf;
  } catch (error) {
    console.error('Puppeteer error:', error);
    // Try PDFKit as fallback
    console.log('Falling back to PDFKit');
    try {
      return await generateInvoicePDFWithKit(invoice, items, company, client);
    } catch (pdfkitError) {
      console.error('PDFKit fallback error:', pdfkitError);
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  generateInvoicePDF,
  generateInvoiceHTML
};