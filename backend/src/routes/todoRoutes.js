const express = require('express');
const router = express.Router();
const { updateTodo, deleteTodo, getMyDay } = require('../controllers/todoController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/my-day', getMyDay);
router.route('/:id').put(updateTodo).delete(deleteTodo);

module.exports = router;
