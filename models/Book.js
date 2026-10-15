const mongoose = require('mongoose');

const SUBJECTS = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Economics', 'Engineering', 'Chemistry', 'Other'];
const CONDITIONS = ['like-new', 'good', 'fair'];

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 140 },
  author: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  subject: { type: String, required: true, enum: SUBJECTS },
  condition: { type: String, required: true, enum: CONDITIONS, default: 'good' },
  isbn: { type: String, trim: true, default: '', maxlength: 30 },
  wantInReturn: { type: String, trim: true, default: '', maxlength: 180 },
  notes: { type: String, trim: true, default: '', maxlength: 1000 },
  campus: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  emoji: { type: String, default: '📚' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['available', 'reserved', 'swapped'], default: 'available', index: true }
}, { timestamps: true });

bookSchema.index({ title: 'text', author: 'text', subject: 'text' });
bookSchema.statics.SUBJECTS = SUBJECTS;
bookSchema.statics.CONDITIONS = CONDITIONS;
module.exports = mongoose.model('Book', bookSchema);
