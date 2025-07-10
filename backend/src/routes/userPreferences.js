const express = require('express');
const router = express.Router();
const userPreferencesController = require('../controllers/userPreferencesController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all user preferences
router.get('/', userPreferencesController.getUserPreferences);

// Update/create a preference
router.post('/', userPreferencesController.updateUserPreference);

// Delete a preference
router.delete('/:key', userPreferencesController.deleteUserPreference);

module.exports = router;