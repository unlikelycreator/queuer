const express = require('express');
const router = express.Router();
const { upload } = require('../config/multer');
const { uploadFiles } = require('../controllers/uploadController');
const {
  getPublicForm,
  submitPublicForm,
  getPublicTicket,
  emailWebhook,
} = require('../controllers/publicController');

// Embeddable project intake form
router.get('/forms/:token', getPublicForm);
router.post('/forms/:token/submit', submitPublicForm);

// Optional file attachment upload from the public form (screenshots, etc.)
router.post('/uploads', upload.array('files', 5), uploadFiles);

// Read-only ticket status tracking for whoever submitted it
router.get('/tickets/:token', getPublicTicket);

// Inbound email -> ticket webhook (wire this up in Mailgun/SendGrid/Postmark inbound routing)
router.post('/email/:companyId/:secret', express.urlencoded({ extended: true }), emailWebhook);

module.exports = router;
