const express = require('express');
const router = express.Router();
const { upload } = require('../config/multer');
const { uploadFiles } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

router.post('/', protect, upload.array('files', 5), uploadFiles);

module.exports = router;
