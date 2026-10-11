const express = require('express');
const router = express.Router();
const r = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/overview', r.overview);
router.get('/export', r.exportCsv);

module.exports = router;
