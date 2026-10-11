const express = require('express');
const router = express.Router();
const a = require('../controllers/automationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', a.listAutomations);
router.post('/', authorize('owner', 'admin'), a.createAutomation);
router.put('/:id', authorize('owner', 'admin'), a.updateAutomation);
router.delete('/:id', authorize('owner', 'admin'), a.deleteAutomation);
router.post('/:id/test', authorize('owner', 'admin'), a.testAutomation);

module.exports = router;
