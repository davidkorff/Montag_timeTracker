const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticate, authorize } = require('../middleware/auth');
const { clientValidation, idValidation } = require('../middleware/validation');

router.use(authenticate);

router.get('/', clientController.getAllClients);
router.get('/:id', idValidation, clientController.getClientById);
router.post('/', authorize(['admin']), clientValidation.create, clientController.createClient);
router.put('/:id', authorize(['admin']), idValidation, clientValidation.update, clientController.updateClient);
router.delete('/:id', authorize(['admin']), idValidation, clientController.deleteClient);

module.exports = router;