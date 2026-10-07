const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  regeneratePublicToken,
} = require('../controllers/projectController');
const { getProjectTodos, createTodo } = require('../controllers/todoController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getProjects).post(createProject);
router.route('/:id').get(getProject).put(updateProject).delete(deleteProject);
router.post('/:id/regenerate-public-token', regeneratePublicToken);
router.route('/:projectId/todos').get(getProjectTodos).post(createTodo);

module.exports = router;
