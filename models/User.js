const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true, select: false },
  year: { type: String, trim: true, default: 'Not specified', maxlength: 40 },
  course: { type: String, trim: true, default: 'Not specified', maxlength: 80 },
  campus: { type: String, trim: true, default: 'Not specified', maxlength: 100 },
  avatarColor: { type: String, default: '#854F0B' }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

userSchema.index({ name: 'text', email: 'text' });
module.exports = mongoose.model('User', userSchema);
