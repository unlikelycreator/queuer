const express = require('express');
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  regenerateInviteCode,
  transferOwnership,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getUsers);
router.post('/', authorize('owner', 'admin'), createUser);
router.put('/:id', authorize('owner', 'admin'), updateUser);
router.delete('/:id', authorize('owner'), deleteUser);
router.post('/invite-code/regenerate', authorize('owner', 'admin'), regenerateInviteCode);
router.post('/:id/transfer-ownership', authorize('owner'), transferOwnership);

module.exports = router;
