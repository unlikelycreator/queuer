const express = require('express');
const router = express.Router();
const {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  addTicketUpdate,
  addTicketFiles,
  replyToTicket,
  deleteTicket,
} = require('../controllers/ticketController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getTickets).post(createTicket);
router.route('/:id').get(getTicket).put(updateTicket).delete(deleteTicket);
router.post('/:id/updates', addTicketUpdate);
router.post('/:id/files', addTicketFiles);
router.post('/:id/reply', replyToTicket);

module.exports = router;
