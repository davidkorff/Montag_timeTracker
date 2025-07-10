const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');
const { projectValidation, idValidation } = require('../middleware/validation');

router.use(authenticate);

router.get('/', projectController.getAllProjects);
router.get('/:id', idValidation, projectController.getProjectById);
router.post('/', projectValidation.create, projectController.createProject);
router.put('/:id', idValidation, projectValidation.update, projectController.updateProject);
router.delete('/:id', idValidation, projectController.deleteProject);

module.exports = router;