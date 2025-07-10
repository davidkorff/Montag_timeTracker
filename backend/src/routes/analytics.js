const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(authenticate);

// Overview statistics
router.get('/overview', analyticsController.getOverviewStats);

// Time series data
router.get('/revenue-over-time', analyticsController.getRevenueOverTime);
router.get('/hours-over-time', analyticsController.getHoursOverTime);

// Entity analytics
router.get('/clients', analyticsController.getClientAnalytics);
router.get('/projects', analyticsController.getProjectAnalytics);
router.get('/invoices', analyticsController.getInvoiceAnalytics);
router.get('/consultants', analyticsController.getConsultantAnalytics);

module.exports = router;