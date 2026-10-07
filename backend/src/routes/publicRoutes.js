const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { upload } = require('../config/multer');
const { uploadFiles } = require('../controllers/uploadController');
const p = require('../controllers/publicController');

// Anonymous write endpoints get a tighter limit to keep spam out of the ticket queue.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many submissions — please wait a few minutes and try again.' },
});
const readLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });

router.use(readLimiter);

// Client portal (same token as the embeddable form)
router.get('/portal/:token', p.getPortal);
router.get('/portal/:token/tickets', p.getPortalTickets);
router.post('/portal/:token/tickets', writeLimiter, p.submitPortalTicket);

// Legacy embeddable intake form — kept so existing iframes keep working
router.get('/forms/:token', p.getPublicForm);
router.post('/forms/:token/submit', writeLimiter, p.submitPublicForm);

// Optional file attachment upload (screenshots, etc.)
router.post('/uploads', writeLimiter, upload.array('files', 5), uploadFiles);

// Ticket tracking + client replies
router.get('/tickets/:token', p.getPublicTicket);
router.post('/tickets/:token/comments', writeLimiter, p.addPublicComment);

// Inbound email -> ticket webhook (Mailgun/SendGrid/Postmark inbound routing)
router.post('/email/:companyId/:secret', express.urlencoded({ extended: true }), p.emailWebhook);

module.exports = router;
