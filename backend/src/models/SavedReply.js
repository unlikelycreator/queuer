const mongoose = require('mongoose');

// Canned responses with {{variables}}, shared with the whole team or private.
const savedReplySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 8000 },
    shared: { type: Boolean, default: true },
    useCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SavedReply', savedReplySchema);
