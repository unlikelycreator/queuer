const express = require('express');
const router = express.Router();
const t = require('../controllers/timeController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/running', t.getRunning);
router.get('/summary', t.getSummary);
router.post('/start', t.startTimer);
router.post('/stop', t.stopTimer);
router.route('/').get(t.listEntries).post(t.createEntry);
router.route('/:id').put(t.updateEntry).delete(t.deleteEntry);

module.exports = router;
