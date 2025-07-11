const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticate } = require('../middleware/auth');
const { idValidation } = require('../middleware/validation');
const invoiceValidation = require('../middleware/invoiceValidation');
const invoicePdfRoutes = require('./invoicePdf');

// All invoice routes require authentication
router.use(authenticate);

// Get all invoices
router.get('/', invoiceController.getAllInvoices);

// Get unbilled summary for all clients
router.get('/unbilled-summary', invoiceController.getUnbilledSummary);

// Get unbilled time entries for a client
router.get('/unbilled/:clientId', idValidation, invoiceController.getUnbilledTimeEntries);

// Get invoice by ID
router.get('/:id', idValidation, invoiceController.getInvoiceById);

// Create new invoice
router.post('/', invoiceValidation.create, invoiceController.createInvoice);

// Create manual invoice (admin only)
router.post('/manual', invoiceController.createManualInvoice);

// Update invoice
router.put('/:id', idValidation, invoiceValidation.update, invoiceController.updateInvoice);

// Update invoice payment status (admin only)
router.put('/:id/payment-status', idValidation, invoiceController.updatePaymentStatus);

// Delete invoice
router.delete('/:id', idValidation, invoiceController.deleteInvoice);

// PDF routes
router.use('/', invoicePdfRoutes);

module.exports = router;