const express = require('express');
const router = express.Router();
const subcontractorController = require('../controllers/subcontractorController');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation rules
const subcontractorValidation = {
  create: [
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('hourlyRate').optional().isFloat({ min: 0 })
  ],
  update: [
    body('firstName').optional().notEmpty().trim(),
    body('lastName').optional().notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('hourlyRate').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean()
  ],
  timeEntry: [
    body('subcontractorId').isUUID(),
    body('projectId').isUUID(),
    body('date').isDate(),
    body('hours').isFloat({ min: 0.01, max: 24 }),
    body('description').optional().trim(),
    body('isBillable').optional().isBoolean()
  ]
};

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', subcontractorController.getAllSubcontractors);
router.get('/:id', subcontractorController.getSubcontractorById);
router.post('/', authorize(['admin']), subcontractorValidation.create, subcontractorController.createSubcontractor);
router.put('/:id', authorize(['admin']), subcontractorValidation.update, subcontractorController.updateSubcontractor);
router.delete('/:id', authorize(['admin']), subcontractorController.deleteSubcontractor);
router.post('/time-entry', subcontractorValidation.timeEntry, subcontractorController.createTimeEntryForSubcontractor);

module.exports = router;