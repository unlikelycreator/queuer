// @desc    Upload one or more files, returns their public URLs/metadata
// @route   POST /api/uploads
// @access  Private (and also used, unauthenticated, from the public form route)
const uploadFiles = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400);
      throw new Error('No files uploaded');
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const files = req.files.map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      url: `${baseUrl}/uploads/${f.filename}`,
      size: f.size,
    }));
    res.status(201).json({ files });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFiles };
