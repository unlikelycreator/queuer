const express = require('express');
const router = express.Router();
const t = require('../controllers/ticketController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/counts', t.getTicketCounts);
router.post('/bulk', t.bulkUpdateTickets);
router.route('/').get(t.getTickets).post(t.createTicket);
router.route('/:id').get(t.getTicket).put(t.updateTicket).delete(t.deleteTicket);
router.post('/:id/updates', t.addTicketUpdate);
router.post('/:id/files', t.addTicketFiles);
router.post('/:id/reply', t.replyToTicket);
router.post('/:id/checklist', t.addChecklistItem);
router.route('/:id/checklist/:itemId').put(t.updateChecklistItem).delete(t.deleteChecklistItem);

module.exports = router;
