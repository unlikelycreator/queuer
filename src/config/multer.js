const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(10).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|svg|pdf|docx?|xlsx?|pptx?|txt|csv|zip|log)$/i;

const fileFilter = (req, file, cb) => {
  if (ALLOWED_EXT.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 }, // 15MB per file, up to 5 at once
});

module.exports = { upload, uploadDir };
