const express = require('express');
const router = express.Router();
const i = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

// Billing is restricted to owners and admins.
router.use(protect, authorize('owner', 'admin'));

router.get('/unbilled', i.getUnbilled);
router.route('/').get(i.listInvoices).post(i.createInvoice);
router.route('/:id').get(i.getInvoice).put(i.updateInvoice).delete(i.deleteInvoice);
router.get('/:id/pdf', i.downloadPdf);
router.post('/:id/send', i.sendInvoice);
router.post('/:id/payments', i.addPayment);
router.delete('/:id/payments/:paymentId', i.deletePayment);

module.exports = router;
