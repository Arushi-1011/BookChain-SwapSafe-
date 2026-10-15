const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Book = require('../models/Book');
const SwapRequest = require('../models/SwapRequest');
const { requireAuth, setAuthCookie, clearAuthCookie } = require('../middleware/auth');

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again in a few minutes.' }
});

function serializeUser(user) {
  return {
    id: user._id.toString(), name: user.name, email: user.email,
    year: user.year, course: user.course, campus: user.campus,
    avatarColor: user.avatarColor, initials: user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  };
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const year = String(req.body.year || 'Not specified').trim();
    const course = String(req.body.course || 'Not specified').trim();
    const campus = String(req.body.campus || 'Not specified').trim();

    if (name.length < 2 || name.length > 60) return res.status(400).json({ message: 'Name must be between 2 and 60 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    if (campus.length < 2 || campus.length > 100) return res.status(400).json({ message: 'Enter your campus or university.' });

    const alreadyExists = await User.findOne({ email });
    if (alreadyExists) return res.status(409).json({ message: 'An account with this email already exists. Please sign in.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, year: year.slice(0, 40), course: course.slice(0, 80), campus, avatarColor: '#854F0B' });
    setAuthCookie(res, user._id);
    return res.status(201).json({ user: serializeUser(user) });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Enter your email and password.' });
    const user = await User.findOne({ email }).select('+passwordHash');
    const valid = user && await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Email or password is incorrect.' });
    setAuthCookie(res, user._id);
    return res.json({ user: serializeUser(user) });
  } catch (err) { next(err); }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Signed out successfully.' });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: serializeUser(req.user) }));

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['name', 'year', 'course', 'campus'];
    for (const key of allowed) {
      if (req.body[key] !== undefined && typeof req.body[key] !== 'string') {
        return res.status(400).json({ message: `Invalid ${key} value.` });
      }
    }
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key].trim();
    }
    if (updates.name !== undefined && (updates.name.length < 2 || updates.name.length > 60)) return res.status(400).json({ message: 'Name must be between 2 and 60 characters.' });
    if (updates.campus !== undefined && (updates.campus.length < 2 || updates.campus.length > 100)) return res.status(400).json({ message: 'Enter your campus or university.' });
    if (updates.year !== undefined) updates.year = updates.year.slice(0, 40);
    if (updates.course !== undefined) updates.course = updates.course.slice(0, 80);
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    res.json({ user: serializeUser(user) });
  } catch (err) { next(err); }
});

router.get('/profile/stats', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [listed, swapped, activeRequests] = await Promise.all([
      Book.countDocuments({ owner: userId, status: { $ne: 'swapped' } }),
      SwapRequest.countDocuments({ $or: [{ requester: userId }, { owner: userId }], status: 'completed' }),
      SwapRequest.countDocuments({ $or: [{ requester: userId }, { owner: userId }], status: { $in: ['pending', 'accepted'] } })
    ]);
    res.json({ stats: { listed, swapped, activeRequests } });
  } catch (err) { next(err); }
});

router.serializeUser = serializeUser;
module.exports = router;
