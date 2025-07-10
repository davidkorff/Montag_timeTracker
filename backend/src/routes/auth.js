const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authValidation } = require('../middleware/validation');

router.post('/signup', authValidation.signup, authController.signup);
router.post('/login', authValidation.login, authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.put('/change-password', authenticate, authValidation.changePassword, authController.changePassword);

module.exports = router;