const express = require('express');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const SwapRequest = require('../models/SwapRequest');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function idOf(value) { return value && value._id ? value._id.toString() : value ? value.toString() : ''; }
function userMini(user) {
  if (!user) return null;
  const name = user.name || 'Student';
  return { id: idOf(user), name, campus: user.campus || '', initials: name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(), color: user.avatarColor || '#854F0B' };
}
function bookMini(book) {
  if (!book) return null;
  const owner = book.owner && book.owner.name ? userMini(book.owner) : null;
  return { id: idOf(book), title: book.title, author: book.author, subject: book.subject, condition: book.condition, emoji: book.emoji || '📚', status: book.status, campus: book.campus, owner };
}
function serializeSwap(swap, currentUserId) {
  const isIncoming = idOf(swap.owner) === currentUserId.toString();
  return {
    id: idOf(swap), status: swap.status, message: swap.message || '', isIncoming,
    requester: userMini(swap.requester), owner: userMini(swap.owner),
    requestedBook: bookMini(swap.requestedBook), offeredBook: bookMini(swap.offeredBook),
    createdAt: swap.createdAt, respondedAt: swap.respondedAt, completedAt: swap.completedAt
  };
}

router.get('/summary', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [incoming, outgoing, completed] = await Promise.all([
      SwapRequest.countDocuments({ owner: userId, status: 'pending' }),
      SwapRequest.countDocuments({ requester: userId, status: { $in: ['pending', 'accepted'] } }),
      SwapRequest.countDocuments({ $or: [{ owner: userId }, { requester: userId }], status: 'completed' })
    ]);
    res.json({ summary: { incoming, outgoing, completed } });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const tab = String(req.query.tab || 'incoming');
    let filter;
    if (tab === 'incoming') filter = { owner: req.user._id, status: { $in: ['pending', 'accepted'] } };
    else if (tab === 'outgoing') filter = { requester: req.user._id, status: { $in: ['pending', 'accepted'] } };
    else if (tab === 'completed') filter = { $or: [{ owner: req.user._id }, { requester: req.user._id }], status: 'completed' };
    else return res.status(400).json({ message: 'Choose incoming, outgoing or completed.' });

    const swaps = await SwapRequest.find(filter).sort({ createdAt: -1 })
      .populate('requester', 'name campus avatarColor')
      .populate('owner', 'name campus avatarColor')
      .populate({ path: 'requestedBook', populate: { path: 'owner', select: 'name campus avatarColor' } })
      .populate({ path: 'offeredBook', populate: { path: 'owner', select: 'name campus avatarColor' } });
    res.json({ swaps: swaps.map(swap => serializeSwap(swap, req.user._id)) });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const requestedBookId = String(req.body.requestedBookId || '');
    const offeredBookId = String(req.body.offeredBookId || '');
    const message = String(req.body.message || '').trim();
    if (!mongoose.isValidObjectId(requestedBookId) || !mongoose.isValidObjectId(offeredBookId)) {
      return res.status(400).json({ message: 'Choose a book to request and one of your books to offer.' });
    }
    if (requestedBookId === offeredBookId) return res.status(400).json({ message: 'You cannot offer the same book you are requesting.' });
    if (message.length > 500) return res.status(400).json({ message: 'Message must be 500 characters or fewer.' });

    const [requestedBook, offeredBook] = await Promise.all([
      Book.findById(requestedBookId), Book.findById(offeredBookId)
    ]);
    if (!requestedBook || requestedBook.status !== 'available') return res.status(409).json({ message: 'That book is no longer available.' });
    if (requestedBook.owner.equals(req.user._id)) return res.status(400).json({ message: 'You cannot request a book you listed yourself.' });
    if (!offeredBook || !offeredBook.owner.equals(req.user._id)) return res.status(400).json({ message: 'You can only offer a book from your own listings.' });
    if (offeredBook.status !== 'available') return res.status(409).json({ message: 'Your offered book is not available for swapping.' });

    const existing = await SwapRequest.findOne({ requestedBook: requestedBook._id, requester: req.user._id, status: { $in: ['pending', 'accepted'] } });
    if (existing) return res.status(409).json({ message: 'You already have an active request for this book.' });

    const swap = await SwapRequest.create({ requestedBook: requestedBook._id, offeredBook: offeredBook._id, requester: req.user._id, owner: requestedBook.owner, message });
    res.status(201).json({ swap: { id: swap._id.toString(), status: swap.status }, message: 'Swap request sent.' });
  } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid swap request ID.' });
    const nextStatus = String(req.body.status || '');
    if (!['accepted', 'declined', 'completed', 'cancelled'].includes(nextStatus)) return res.status(400).json({ message: 'Invalid swap status.' });
    const swap = await SwapRequest.findById(req.params.id);
    if (!swap) return res.status(404).json({ message: 'Swap request not found.' });
    const isOwner = swap.owner.equals(req.user._id);
    const isRequester = swap.requester.equals(req.user._id);

    if (nextStatus === 'accepted' || nextStatus === 'declined') {
      if (!isOwner) return res.status(403).json({ message: 'Only the book owner can accept or decline this request.' });
      if (swap.status !== 'pending') return res.status(409).json({ message: 'This request has already been handled.' });
      if (nextStatus === 'accepted') {
        const [requestedBook, offeredBook] = await Promise.all([Book.findById(swap.requestedBook), Book.findById(swap.offeredBook)]);
        if (!requestedBook || !offeredBook || requestedBook.status !== 'available' || offeredBook.status !== 'available') {
          return res.status(409).json({ message: 'One of these books is no longer available.' });
        }
        requestedBook.status = 'reserved';
        offeredBook.status = 'reserved';
        await Promise.all([requestedBook.save(), offeredBook.save()]);
      }
      swap.status = nextStatus;
      swap.respondedAt = new Date();
    } else if (nextStatus === 'completed') {
      if (!isOwner && !isRequester) return res.status(403).json({ message: 'You are not part of this swap.' });
      if (swap.status !== 'accepted') return res.status(409).json({ message: 'Only an accepted swap can be completed.' });
      swap.status = 'completed';
      swap.completedAt = new Date();
      const [requestedBook, offeredBook] = await Promise.all([Book.findById(swap.requestedBook), Book.findById(swap.offeredBook)]);
      if (requestedBook) requestedBook.status = 'swapped';
      if (offeredBook) offeredBook.status = 'swapped';
      await Promise.all([requestedBook && requestedBook.save(), offeredBook && offeredBook.save()].filter(Boolean));
    } else if (nextStatus === 'cancelled') {
      if (!isRequester) return res.status(403).json({ message: 'Only the requester can cancel this request.' });
      if (swap.status !== 'pending') return res.status(409).json({ message: 'Only a pending request can be cancelled.' });
      swap.status = 'cancelled';
    }
    await swap.save();
    res.json({ message: `Swap ${nextStatus}.`, status: swap.status });
  } catch (err) { next(err); }
});

module.exports = router;
