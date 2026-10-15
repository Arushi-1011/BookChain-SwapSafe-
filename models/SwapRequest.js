const mongoose = require('mongoose');

const swapRequestSchema = new mongoose.Schema({
  requestedBook: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  offeredBook: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled'], default: 'pending', index: true },
  message: { type: String, trim: true, default: '', maxlength: 500 },
  respondedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

swapRequestSchema.index({ requestedBook: 1, requester: 1, status: 1 });
module.exports = mongoose.model('SwapRequest', swapRequestSchema);
