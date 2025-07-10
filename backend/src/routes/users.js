const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { userValidation, idValidation } = require('../middleware/validation');

router.use(authenticate);

router.get('/', authorize(['admin']), userController.getAllUsers);
router.get('/:id', idValidation, userController.getUserById);
router.post('/', authorize(['admin']), userValidation.create, userController.createUser);
router.put('/:id', authorize(['admin']), idValidation, userValidation.update, userController.updateUser);
router.delete('/:id', authorize(['admin']), idValidation, userController.deleteUser);

module.exports = router;