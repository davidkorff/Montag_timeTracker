const PDFDocument = require('pdfkit');

const generateInvoicePDFWithKit = async (invoice, items, company, client) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: 18,
          bottom: 18,
          left: 50,
          right: 50
        }
      });

      // Collect the PDF data
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Company info
      const companyInfo = company || {
        name: '42 Consulting LLC',
        consultant: 'David Korff',
        phone: '(516) 659-8138',
        email: 'david@42consultingllc.com'
      };

      // Header
      doc.fontSize(18).font('Helvetica-Bold')
         .text(companyInfo.name, { align: 'center' });
      
      doc.fontSize(10).font('Helvetica')
         .fillColor('#666666')
         .text(`${companyInfo.consultant} | ${companyInfo.phone} | ${companyInfo.email}`, { align: 'center' });

      // Horizontal line
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown();

      // Reset text color
      doc.fillColor('#000000');

      // Billing information
      doc.fontSize(11).font('Helvetica-Bold')
         .text(`Billed To: ${client.billed_to || client.company_name || client.name}`);
      
      doc.font('Helvetica')
         .text(`Customer: ${client.company_name || client.name}`);
      
      if (client.company_address) {
        doc.text(`Address: ${client.company_address}`);
      }

      // Separator
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      // Invoice details
      doc.text(`Invoice #: ${invoice.invoice_number}`);
      doc.text(`Invoice Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-US')}`);

      // Separator
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      // Notes section if provided
      const notes = client.invoice_notes || invoice.notes;
      if (notes && notes.trim()) {
        doc.text('Notes:');
        doc.text(notes);
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
        doc.moveDown(0.5);
      }

      // Payment information
      const paymentTerms = client.payment_terms || invoice.payment_terms || 'Net 30';
      let daysUntilDue = 30;
      if (paymentTerms.includes('15')) daysUntilDue = 15;
      else if (paymentTerms.includes('45')) daysUntilDue = 45;
      else if (paymentTerms.includes('60')) daysUntilDue = 60;
      else if (paymentTerms.includes('Receipt')) daysUntilDue = 0;

      doc.text('Payment Information');
      doc.text(`Payment Due Date: ${daysUntilDue} days from invoice date`);
      doc.text('Bank Name: Chase Bank');
      doc.text('Routing Number: 021202337');
      doc.text('Account Number: 573392639');

      // Separator
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.5);

      // Service details table
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 350;
      const col3 = 420;
      const col4 = 480;

      // Table header
      doc.font('Helvetica-Bold');
      doc.text('Description', col1, tableTop);
      doc.text('Rate', col2, tableTop);
      doc.text('Hours', col3, tableTop);
      doc.text('Amount', col4, tableTop);

      // Draw header line
      doc.moveTo(col1, tableTop + 15).lineTo(562, tableTop + 15).stroke();

      // Table rows
      doc.font('Helvetica');
      let yPosition = tableTop + 25;
      let subtotal = 0;

      // Group items by description for cleaner display
      const groupedItems = {};
      console.log('Processing invoice items for PDF:', items.length, 'items');
      items.forEach(item => {
        console.log('Item:', { description: item.description, quantity: item.quantity, rate: item.rate, amount: item.amount });
        const key = item.description || 'Consulting Services';
        if (!groupedItems[key]) {
          groupedItems[key] = {
            hours: 0,
            amount: 0,
            rate: item.rate || 175
          };
        }
        groupedItems[key].hours += parseFloat(item.quantity) || 0;
        groupedItems[key].amount += parseFloat(item.amount) || 0;
      });
      console.log('Grouped items:', groupedItems);

      // Find date range from items
      let startDate = null;
      let endDate = null;
      items.forEach(item => {
        const dateRangeMatch = item.description?.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
        if (dateRangeMatch) {
          const itemStart = new Date(dateRangeMatch[1]);
          const itemEnd = new Date(dateRangeMatch[2]);
          if (!startDate || itemStart < startDate) startDate = itemStart;
          if (!endDate || itemEnd > endDate) endDate = itemEnd;
        }
      });

      const formatDate = (date) => {
        return date ? date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '';
      };

      const dateRange = startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : '';

      // Display grouped items
      Object.entries(groupedItems).forEach(([description, data]) => {
        let displayDescription = description;
        if (dateRange && !description.includes('-')) {
          displayDescription = `Consulting ${dateRange}`;
        }

        doc.text(displayDescription, col1, yPosition, { width: 290 });
        doc.text(`$${data.rate}`, col2, yPosition);
        doc.text(data.hours.toFixed(1), col3, yPosition);
        doc.text(`$${data.amount.toFixed(2)}`, col4, yPosition);
        
        subtotal += data.amount;
        yPosition += 20;
      });

      // Draw bottom line
      doc.moveTo(col1, yPosition).lineTo(562, yPosition).stroke();

      // Totals
      yPosition += 20;
      doc.text('Subtotal:', col3, yPosition);
      doc.text(`$${subtotal.toFixed(2)}`, col4, yPosition);

      yPosition += 20;
      doc.font('Helvetica-Bold');
      doc.text('Total:', col3, yPosition);
      doc.text(`$${subtotal.toFixed(2)}`, col4, yPosition);

      // Footer
      doc.font('Helvetica').fontSize(10).fillColor('#666666');
      doc.text(
        'If you have any questions regarding this invoice, please reach out to david@42consultingllc.com',
        50,
        700,
        { align: 'center', width: 512 }
      );

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateInvoicePDFWithKit
};