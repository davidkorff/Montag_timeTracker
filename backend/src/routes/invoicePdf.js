const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { generateInvoicePDF } = require('../utils/pdfGenerator');

router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice details
    const invoiceResult = await db.query(
      `SELECT 
        i.*,
        c.name as client_name,
        c.code as client_code,
        c.contact_email,
        c.contact_phone,
        c.address as client_address,
        c.invoice_email,
        c.invoice_cc_email,
        c.invoice_recipient_name,
        c.billed_to,
        c.company_name,
        c.company_address,
        c.payment_terms as client_payment_terms,
        c.invoice_notes as client_invoice_notes,
        c.default_rate
      FROM invoices i
      INNER JOIN clients c ON i.client_id = c.id
      WHERE i.id = $1`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    // Get invoice items
    const itemsResult = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at',
      [id]
    );

    // Generate PDF with client information
    const pdf = await generateInvoicePDF(invoice, itemsResult.rows, null, invoice);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${invoice.invoice_number}.pdf"`);
    
    res.send(pdf);
  } catch (error) {
    console.error('Generate PDF error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Error generating PDF',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;