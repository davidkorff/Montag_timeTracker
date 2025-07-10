const { body } = require('express-validator');

const invoiceValidation = {
  create: [
    body('clientId').isUUID(),
    body('timeEntryIds').optional().isArray(),
    body('dueDate').isDate(),
    body('taxRate').optional().isFloat({ min: 0, max: 100 }),
    body('paymentTerms').optional().trim(),
    body('notes').optional().trim()
  ],
  update: [
    body('status').optional().isIn(['draft', 'sent', 'cancelled']),
    body('paymentStatus').optional().isIn(['unpaid', 'partial', 'paid']),
    body('paymentTerms').optional().trim(),
    body('notes').optional().trim(),
    body('dueDate').optional().isDate()
  ]
};

module.exports = invoiceValidation;