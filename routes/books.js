const express = require('express');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const SwapRequest = require('../models/SwapRequest');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_FIELDS = ['title', 'author', 'subject', 'condition', 'isbn', 'wantInReturn', 'notes', 'campus'];

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function serializeBook(book, currentUserId) {
  const owner = book.owner && typeof book.owner === 'object' && book.owner.name
    ? book.owner : null;
  const ownerId = owner ? owner._id.toString() : book.owner.toString();
  const ownerName = owner ? owner.name : 'Student';
  return {
    id: book._id.toString(), title: book.title, author: book.author,
    subject: book.subject, condition: book.condition, isbn: book.isbn || '',
    wantInReturn: book.wantInReturn || '', notes: book.notes || '', campus: book.campus,
    emoji: book.emoji || '📚', status: book.status,
    owner: { id: ownerId, name: ownerName, campus: owner ? owner.campus : book.campus,
      initials: ownerName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(),
      color: owner ? owner.avatarColor : '#854F0B' },
    isMine: Boolean(currentUserId && ownerId === currentUserId.toString()),
    createdAt: book.createdAt, updatedAt: book.updatedAt
  };
}

function validateBookInput(body, partial = false) {
  const data = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string') return { error: `Invalid ${key} value.` };
      data[key] = body[key].trim();
    }
  }
  if (!partial || data.title !== undefined) {
    if (!data.title || data.title.length > 140) return { error: 'Book title is required and must be 140 characters or fewer.' };
  }
  if (!partial || data.author !== undefined) {
    if (!data.author || data.author.length > 120) return { error: 'Author is required and must be 120 characters or fewer.' };
  }
  if (!partial || data.subject !== undefined) {
    if (!Book.SUBJECTS.includes(data.subject)) return { error: 'Choose a valid subject.' };
  }
  if (data.condition !== undefined && !Book.CONDITIONS.includes(data.condition)) return { error: 'Choose a valid book condition.' };
  if (!partial || data.campus !== undefined) {
    if (!data.campus || data.campus.length < 2 || data.campus.length > 100) return { error: 'Campus is required and must be 2–100 characters.' };
  }
  for (const [key, max] of [['isbn', 30], ['wantInReturn', 180], ['notes', 1000]]) {
    if (data[key] !== undefined && data[key].length > max) return { error: `${key} must be ${max} characters or fewer.` };
  }
  return { data };
}

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filter = { status: 'available' };
    if (req.query.mine === 'true') {
      if (!req.user) return res.status(401).json({ message: 'Please sign in to view your listings.' });
      delete filter.status;
      filter.owner = req.user._id;
      filter.status = { $ne: 'swapped' };
    }
    if (req.query.subject && Book.SUBJECTS.includes(String(req.query.subject))) filter.subject = String(req.query.subject);
    if (req.query.condition && Book.CONDITIONS.includes(String(req.query.condition))) filter.condition = String(req.query.condition);
    if (req.query.q) {
      const query = String(req.query.q).trim().slice(0, 100);
      if (query) {
        const safe = new RegExp(escapeRegex(query), 'i');
        filter.$or = [{ title: safe }, { author: safe }, { subject: safe }, { campus: safe }];
      }
    }
    const books = await Book.find(filter).sort({ createdAt: -1 }).populate('owner', 'name campus avatarColor');
    res.json({ books: books.map(book => serializeBook(book, req.user && req.user._id)) });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = validateBookInput(req.body);
    if (error) return res.status(400).json({ message: error });
    const book = await Book.create({ ...data, owner: req.user._id, emoji: '📚' });
    await book.populate('owner', 'name campus avatarColor');
    res.status(201).json({ book: serializeBook(book, req.user._id) });
  } catch (err) { next(err); }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid book ID.' });
    const { data, error } = validateBookInput(req.body, true);
    if (error) return res.status(400).json({ message: error });
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Provide at least one field to update.' });
    const book = await Book.findOne({ _id: req.params.id, owner: req.user._id });
    if (!book) return res.status(404).json({ message: 'Book not found in your listings.' });
    if (book.status !== 'available') return res.status(409).json({ message: 'This book has an active swap or is no longer available.' });
    Object.assign(book, data);
    await book.save();
    await book.populate('owner', 'name campus avatarColor');
    res.json({ book: serializeBook(book, req.user._id) });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid book ID.' });
    const book = await Book.findOne({ _id: req.params.id, owner: req.user._id });
    if (!book) return res.status(404).json({ message: 'Book not found in your listings.' });
    if (book.status !== 'available') return res.status(409).json({ message: 'This book cannot be deleted while reserved or already swapped.' });
    const activeSwap = await SwapRequest.exists({ $or: [{ requestedBook: book._id }, { offeredBook: book._id }], status: { $in: ['pending', 'accepted'] } });
    if (activeSwap) return res.status(409).json({ message: 'This book has an active swap request. Resolve it before deleting the listing.' });
    await book.deleteOne();
    res.json({ message: 'Book listing deleted.' });
  } catch (err) { next(err); }
});

router.serializeBook = serializeBook;
module.exports = router;
