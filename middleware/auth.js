const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('bookchain_token', token, getCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie('bookchain_token', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/'
  });
}

async function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies && req.cookies.bookchain_token;
    if (!token) return next();
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (user) req.user = user;
  } catch (_err) {
    // Public browsing is allowed even if an old cookie is invalid.
  }
  next();
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies.bookchain_token;
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    req.user = user;
    next();
  } catch (_err) {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

module.exports = { optionalAuth, requireAuth, setAuthCookie, clearAuthCookie };
