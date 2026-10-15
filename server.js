require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const swapRoutes = require('./routes/swaps');
const User = require('./models/User');
const Book = require('./models/Book');
const SwapRequest = require('./models/SwapRequest');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Startup blocked: set JWT_SECRET in your .env file to a random string of at least 32 characters.');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('Startup blocked: set MONGODB_URI in your .env file. See README.md for setup instructions.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
      styleSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://www.googleapis.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again.' }
});
app.use('/api', generalApiLimiter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'BookChain API' }));
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/swaps', swapRoutes);

app.get('/api/stats', async (_req, res, next) => {
  try {
    const [books, students, pendingRequests, completedSwaps] = await Promise.all([
      Book.countDocuments({ status: 'available' }),
      User.countDocuments(),
      SwapRequest.countDocuments({ status: 'pending' }),
      SwapRequest.countDocuments({ status: 'completed' })
    ]);
    res.json({ stats: { books, students, pendingRequests, completedSwaps } });
  } catch (err) { next(err); }
});

app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'ignore',
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found.' }));
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map(item => item.message).join(' ') });
  }
  if (err && err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID or data value.' });
  if (err && err.code === 11000) return res.status(409).json({ message: 'That value is already in use.' });
  console.error('API error:', err && err.message ? err.message : err);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`BookChain is running at http://localhost:${PORT}`);
      console.log('Connected to MongoDB. Stop the server with Ctrl+C.');
    });
  })
  .catch(err => {
    console.error('Could not connect to MongoDB. Check MONGODB_URI and your Atlas network access list.');
    console.error(err.message);
    process.exit(1);
  });

module.exports = app;
