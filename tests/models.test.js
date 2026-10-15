const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Book = require('../models/Book');
const SwapRequest = require('../models/SwapRequest');

const objectId = () => new mongoose.Types.ObjectId();

test('User model accepts valid account details', () => {
  const user = new User({ name: 'Riya Student', email: 'riya@example.edu', passwordHash: 'hashed-password' });
  assert.equal(user.validateSync(), undefined);
});

test('User model rejects an invalid email address', () => {
  const user = new User({ name: 'Riya Student', email: 'not-an-email', passwordHash: 'hashed-password' });
  assert.ok(user.validateSync().errors.email);
});

test('Book model requires title, author, subject, campus and owner', () => {
  const book = new Book({});
  const errors = book.validateSync().errors;
  for (const field of ['title', 'author', 'subject', 'campus', 'owner']) assert.ok(errors[field], `expected ${field} to be required`);
});

test('Book model rejects unsupported subjects and conditions', () => {
  const book = new Book({ title: 'Algorithms', author: 'A. Author', subject: 'Astrology', condition: 'destroyed', campus: 'Campus', owner: objectId() });
  const errors = book.validateSync().errors;
  assert.ok(errors.subject);
  assert.ok(errors.condition);
});

test('Book model accepts a supported listing', () => {
  const book = new Book({ title: 'Algorithms', author: 'A. Author', subject: 'Computer Science', condition: 'good', campus: 'Campus', owner: objectId() });
  assert.equal(book.validateSync(), undefined);
});

test('SwapRequest model rejects unsupported status values', () => {
  const swap = new SwapRequest({
    requestedBook: objectId(), offeredBook: objectId(), requester: objectId(), owner: objectId(), status: 'magically-done'
  });
  assert.ok(swap.validateSync().errors.status);
});

test('SwapRequest model accepts a pending exchange', () => {
  const swap = new SwapRequest({
    requestedBook: objectId(), offeredBook: objectId(), requester: objectId(), owner: objectId(), status: 'pending'
  });
  assert.equal(swap.validateSync(), undefined);
});
