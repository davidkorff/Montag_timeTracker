const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { analyzeCSV, importCSV } = require('../controllers/importController');

// Analyze CSV data
router.post('/analyze', authenticate, authorize(['admin']), analyzeCSV);

// Import CSV data
router.post('/import', authenticate, authorize(['admin']), importCSV);

module.exports = router;