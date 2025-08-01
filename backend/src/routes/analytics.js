const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');
const exportController = require('../controllers/exportController');

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

// Consultant-specific analytics (non-monetary)
router.get('/my-projects', analyticsController.getMyProjectHours);
router.get('/my-performance', analyticsController.getMyPerformance);

// Export comprehensive data
router.get('/export', exportController.exportComprehensiveData);

// Diagnostic endpoint for debugging
router.get('/diagnostic', analyticsController.getDiagnosticData);

module.exports = router;