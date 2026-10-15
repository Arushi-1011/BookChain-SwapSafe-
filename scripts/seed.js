require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Book = require('../models/Book');

const demoBooks = [
  { title: 'Engineering Mathematics Vol. 1', author: 'H.K. Dass', subject: 'Mathematics', condition: 'like-new', emoji: '📐', notes: 'Barely used, no highlights. Perfect for first-year coursework.', campus: 'IIT Bengaluru', wantInReturn: 'Any first-year engineering book' },
  { title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest & Stein', subject: 'Computer Science', condition: 'good', emoji: '💻', notes: 'A few pencil marks in early chapters; otherwise in great condition.', campus: 'IIT Bengaluru', wantInReturn: 'Computer science or mathematics book' },
  { title: 'Principles of Economics', author: 'N. Gregory Mankiw', subject: 'Economics', condition: 'fair', emoji: '📊', notes: 'Highlighted throughout, but all text is readable.', campus: 'IIT Bengaluru', wantInReturn: 'Open to suggestions' },
  { title: 'Computer Networks', author: 'Andrew S. Tanenbaum', subject: 'Computer Science', condition: 'like-new', emoji: '🌐', notes: 'Only the first two chapters were used.', campus: 'IIT Bengaluru', wantInReturn: 'Data structures or operating systems book' },
  { title: 'Cell and Molecular Biology', author: 'Gerald Karp', subject: 'Biology', condition: 'good', emoji: '🧬', notes: 'Clean copy, with a few sticky notes.', campus: 'IIT Bengaluru', wantInReturn: 'Any biology reference' },
  { title: 'University Physics', author: 'Young & Freedman', subject: 'Physics', condition: 'fair', emoji: '⚛️', notes: 'Worn cover, pages are clean.', campus: 'IIT Bengaluru', wantInReturn: 'Engineering or mathematics book' },
  { title: 'Data Structures & Algorithm Analysis in Java', author: 'Mark Allen Weiss', subject: 'Computer Science', condition: 'like-new', emoji: '🗂️', notes: 'Purchased last semester and barely used.', campus: 'IIT Bengaluru', wantInReturn: 'Computer science textbook' },
  { title: 'Organic Chemistry', author: 'Morrison & Boyd', subject: 'Chemistry', condition: 'good', emoji: '🧪', notes: 'A few chapters annotated; binding is intact.', campus: 'IIT Bengaluru', wantInReturn: 'Any science textbook' }
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env before seeding.');
  await mongoose.connect(process.env.MONGODB_URI);
  const email = 'demo@bookchain.local';
  let demoUser = await User.findOne({ email });
  if (!demoUser) {
    const demoPassword = process.env.SEED_DEMO_PASSWORD || 'DemoBookChain2026!';
    demoUser = await User.create({
      name: 'BookChain Demo', email,
      passwordHash: await bcrypt.hash(demoPassword, 12),
      year: '3rd year', course: 'Computer Science', campus: 'IIT Bengaluru', avatarColor: '#1D9E75'
    });
    console.log(`Created a local demo account: ${email}`);
    console.log(`Demo password: ${demoPassword}`);
    console.log('Do not keep this public demo account on a live production deployment.');
  }
  const existingCount = await Book.countDocuments({ owner: demoUser._id });
  if (existingCount === 0) {
    await Book.insertMany(demoBooks.map(book => ({ ...book, owner: demoUser._id, status: 'available' })));
    console.log(`Added ${demoBooks.length} sample book listings.`);
  } else {
    console.log(`Demo account already has ${existingCount} book listing(s); leaving them unchanged.`);
  }
  await mongoose.disconnect();
}

main().catch(async err => {
  console.error(err.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
