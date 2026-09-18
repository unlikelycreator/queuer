const express = require('express');
const router = express.Router();
const { registerOwner, joinCompany, login, getMe } = require('../controllers/authController');
const { googleAuth } = require('../controllers/googleAuthController');
const { protect } = require('../middleware/auth');

router.post('/register', registerOwner);
router.post('/join', joinCompany);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', protect, getMe);

module.exports = router;
