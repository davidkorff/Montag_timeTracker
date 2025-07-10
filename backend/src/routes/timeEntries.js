const express = require('express');
const router = express.Router();
const timeEntryController = require('../controllers/timeEntryController');
const { authenticate } = require('../middleware/auth');
const { timeEntryValidation, idValidation } = require('../middleware/validation');

router.use(authenticate);

router.get('/', timeEntryController.getAllTimeEntries);
router.get('/today', timeEntryController.getTodayEntries);
router.get('/active-timer', timeEntryController.getActiveTimer);
router.get('/active-timers', timeEntryController.getAllActiveTimers);
router.get('/:id', idValidation, timeEntryController.getTimeEntryById);
router.post('/', timeEntryValidation.create, timeEntryController.createTimeEntry);
router.post('/timer/start', timeEntryValidation.timer, timeEntryController.startTimer);
router.post('/timer/stop/:id', idValidation, timeEntryController.stopTimer);
router.post('/timer/pause/:id', idValidation, timeEntryController.pauseTimer);
router.post('/timer/resume/:id', idValidation, timeEntryController.resumeTimer);
router.post('/timer/commit/:id', idValidation, timeEntryController.commitTimer);
router.post('/submit', timeEntryController.submitTimeEntries);
router.put('/:id', idValidation, timeEntryValidation.update, timeEntryController.updateTimeEntry);
router.delete('/:id', idValidation, timeEntryController.deleteTimeEntry);

module.exports = router;