const express = require('express');
const f = require('../controllers/feedController');
const { protect } = require('../middleware/auth');

const activity = express.Router().use(protect);
activity.get('/', f.listActivity);

const notifications = express.Router().use(protect);
notifications.get('/', f.listNotifications);
notifications.get('/unread', f.unreadCount);
notifications.post('/read', f.markRead);
notifications.post('/:id/read', f.markRead);

const replies = express.Router().use(protect);
replies.route('/').get(f.listReplies).post(f.createReply);
replies.route('/:id').put(f.updateReply).delete(f.deleteReply);
replies.post('/:id/use', f.useReply);

module.exports = { activity, notifications, replies };
