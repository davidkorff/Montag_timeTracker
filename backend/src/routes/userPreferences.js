const express = require('express');
const router = express.Router();
const userPreferencesController = require('../controllers/userPreferencesController');

// Get all user preferences
router.get('/', userPreferencesController.getUserPreferences);

// Update/create a preference
router.post('/', userPreferencesController.updateUserPreference);

// Delete a preference
router.delete('/:key', userPreferencesController.deleteUserPreference);

module.exports = router;