const express = require('express');
const router = express.Router();
const {
  getCompany,
  updateCompany,
  testImapConnection,
  testSmtp,
  checkEmailNow,
  regenerateEmailSecret,
} = require('../controllers/companyController');
const { protect, authorize } = require('../middleware/auth');
const ws = require('../controllers/workspaceController');

router.use(protect);

router.get('/', getCompany);
router.get('/workspace', ws.getWorkspace);
router.put('/workspace', authorize('owner', 'admin'), ws.updateWorkspace);
router.post('/workspace/template', authorize('owner', 'admin'), ws.applyTemplate);
router.put('/billing', authorize('owner', 'admin'), ws.updateBilling);
router.put('/', authorize('owner', 'admin'), updateCompany);
router.post('/test-imap-connection', authorize('owner', 'admin'), testImapConnection);
router.post('/test-smtp', authorize('owner', 'admin'), testSmtp);
router.post('/check-email-now', authorize('owner', 'admin'), checkEmailNow);
router.post('/email-secret/regenerate', authorize('owner', 'admin'), regenerateEmailSecret);

module.exports = router;
