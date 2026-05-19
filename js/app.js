// ── BookChain app.js ────────────────────────────────────────

// Page routing
function showPage(id) {
  // hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // show target
  document.getElementById('page-' + id).classList.add('active');

  // update nav tab highlight
  document.querySelectorAll('.navbar__tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === id);
  });
}

// Wire up nav tab clicks
document.getElementById('nav-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.navbar__tab');
  if (tab) showPage(tab.dataset.page);
});

console.log('BookChain Phase 2 ✅ — routing ready');
// ── Browse Page ─────────────────────────────────────────────

let activeCondition = '';

function renderBooks(list) {
  const grid = document.getElementById('book-grid');
  if (!list.length) {
    grid.innerHTML = '<p class="no-results">No books match your search. Try different filters.</p>';
    return;
  }

  grid.innerHTML = list.map((book, i) => `
    <div class="book-card">
      <div class="book-card__cover" style="background: ${COVER_COLORS[i % COVER_COLORS.length]}">
        <span>${book.emoji}</span>
        <span class="book-card__condition cond--${book.condition}">
          ${book.condition === 'like-new' ? 'Like New' : book.condition.charAt(0).toUpperCase() + book.condition.slice(1)}
        </span>
      </div>
      <div class="book-card__body">
        <div class="book-card__title">${book.title}</div>
        <div class="book-card__author">${book.author}</div>
        <div class="book-card__footer">
          <span class="book-card__subject">${book.subject}</span>
          <div class="book-card__owner">
            <div class="book-card__owner-av" style="background: ${book.ownerColor}">${book.ownerInitials}</div>
            ${book.owner}
          </div>
        </div>
        <button class="book-card__swap-btn" onclick="requestSwap(${book.id})">
          <i class="ti ti-arrows-exchange"></i> Request Swap
        </button>
      </div>
    </div>
  `).join('');
}

function filterBooks() {
  const query   = document.getElementById('search-input').value.toLowerCase();
  const subject = document.getElementById('subject-filter').value;

  const filtered = BOOKS.filter(b => {
    const matchQuery   = !query   || b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query);
    const matchSubject = !subject || b.subject === subject;
    const matchCond    = !activeCondition || b.condition === activeCondition;
    return matchQuery && matchSubject && matchCond;
  });

  renderBooks(filtered);
}

function requestSwap(bookId) {
  const book = BOOKS.find(b => b.id === bookId);
  alert(`Swap request sent for "${book.title}" by ${book.owner}!\n\n(Messaging UI coming in Phase 5)`);
}

// Condition pill clicks
document.getElementById('condition-pills').addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;

  document.querySelectorAll('#condition-pills .pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  activeCondition = pill.dataset.condition;
  filterBooks();
});

// Initial render
renderBooks(BOOKS);
// ── List a Book Page ────────────────────────────────────────

// Condition picker
document.getElementById('condition-picker').addEventListener('click', e => {
  const option = e.target.closest('.cond-option');
  if (!option) return;
  document.querySelectorAll('.cond-option').forEach(o => o.classList.remove('selected'));
  option.classList.add('selected');
});

function getSelectedCondition() {
  const selected = document.querySelector('.cond-option.selected');
  return selected ? selected.dataset.value : 'like-new';
}

// Validation helper
function validateField(inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  const empty = !input.value.trim();
  input.classList.toggle('error', empty);
  error.classList.toggle('visible', empty);
  return !empty;
}

function submitListing(e) {
  e.preventDefault();

  // Validate required fields
  const valid = [
    validateField('f-title',   'err-title'),
    validateField('f-author',  'err-author'),
    validateField('f-subject', 'err-subject'),
    validateField('f-campus',  'err-campus'),
  ].every(Boolean);

  if (!valid) return;

  // Build the new book object
  const newBook = {
    id:            Date.now(),
    title:         document.getElementById('f-title').value.trim(),
    author:        document.getElementById('f-author').value.trim(),
    subject:       document.getElementById('f-subject').value,
    condition:     getSelectedCondition(),
    campus:        document.getElementById('f-campus').value.trim(),
    wantInReturn:  document.getElementById('f-want').value.trim(),
    notes:         document.getElementById('f-notes').value.trim(),
    emoji:         '📚',
    owner:         'You',
    ownerInitials: 'ME',
    ownerColor:    '#854F0B',
  };

  // Save to localStorage
  const saved = JSON.parse(localStorage.getItem('bookchain_books') || '[]');
  saved.push(newBook);
  localStorage.setItem('bookchain_books', JSON.stringify(saved));

  // Add to the live BOOKS array so Browse updates instantly
  BOOKS.unshift(newBook);

  // Reset form
  document.getElementById('list-form').reset();
  document.querySelectorAll('.cond-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('.cond-option[data-value="like-new"]').classList.add('selected');

  // Show success banner
  const banner = document.getElementById('success-banner');
  banner.classList.add('visible');
  setTimeout(() => banner.classList.remove('visible'), 4000);
}

// Load any previously listed books from localStorage on startup
function loadSavedBooks() {
  const saved = JSON.parse(localStorage.getItem('bookchain_books') || '[]');
  saved.forEach(b => BOOKS.unshift(b));
}

loadSavedBooks();
renderBooks(BOOKS);