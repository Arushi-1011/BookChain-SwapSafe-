// ── BookChain app.js ────────────────────────────────────────

// Page routing
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');

  document.querySelectorAll('.navbar__tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === id);
  });

  // init pages that need it
  // init pages that need it
  if (id === 'swaps')   initSwapsPage();
  if (id === 'profile') initProfilePage();
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
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📭</div>
        <div class="empty-state__title">No books found</div>
        <div class="empty-state__sub">Try a different search or clear your filters.</div>
      </div>`;
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
  showToast(`Swap request sent to ${book.owner}!`, 'success');
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

  const valid = [
    validateField('f-title',   'err-title'),
    validateField('f-author',  'err-author'),
    validateField('f-subject', 'err-subject'),
    validateField('f-campus',  'err-campus'),
  ].every(Boolean);

  if (!valid) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

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

  const saved = JSON.parse(localStorage.getItem('bookchain_books') || '[]');
  saved.push(newBook);
  localStorage.setItem('bookchain_books', JSON.stringify(saved));
  BOOKS.unshift(newBook);

  document.getElementById('list-form').reset();
  document.querySelectorAll('.cond-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('.cond-option[data-value="like-new"]').classList.add('selected');

  const banner = document.getElementById('success-banner');
  banner.classList.add('visible');
  setTimeout(() => banner.classList.remove('visible'), 4000);

  showToast('Book listed! Students can now request a swap.', 'success');
}

// Load any previously listed books from localStorage on startup
function loadSavedBooks() {
  const saved = JSON.parse(localStorage.getItem('bookchain_books') || '[]');
  saved.forEach(b => BOOKS.unshift(b));
}

loadSavedBooks();
renderBooks(BOOKS);
// ── My Swaps Page ───────────────────────────────────────────

const STEP_LABELS = ['Requested', 'Matched', 'Meetup set', 'Done'];

function dotClass(steps, index) {
  if (steps[index]) {
    // last true step and not all done = active pulse
    const lastTrue = steps.lastIndexOf(true);
    if (index === lastTrue && !steps.every(Boolean)) return 'dot--active';
    return 'dot--done';
  }
  return 'dot--pending';
}

function renderSwaps(tab) {
  const list = SWAPS[tab];
  const container = document.getElementById('swaps-list');

  if (!list || !list.length) {
    container.innerHTML = '<p class="no-swaps">No swaps here yet.</p>';
    return;
  }

  container.innerHTML = list.map(swap => `
    <div class="swap-card" id="swap-${swap.id}">

      <div class="swap-card__top">
        <!-- Their book -->
        <div class="swap-book">
          <div class="swap-book__cover">${swap.theirBook.emoji}</div>
          <div>
            <div class="swap-book__title">${swap.theirBook.title}</div>
            <div class="swap-book__label">from <strong>${swap.from}</strong></div>
          </div>
        </div>

        <div class="swap-arrow">⇄</div>

        <!-- Your book -->
        <div class="swap-book">
          <div class="swap-book__cover">${swap.myBook.emoji}</div>
          <div>
            <div class="swap-book__title">${swap.myBook.title}</div>
            <div class="swap-book__label">your book</div>
          </div>
        </div>

        <span class="swap-status status--${swap.status}">
          ${swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
        </span>
      </div>

      <!-- Timeline -->
      <div class="swap-timeline">
        ${STEP_LABELS.map((label, i) => `
          <div class="timeline-step ${swap.steps[i] ? 'done' : ''}">
            <div class="timeline-dot ${dotClass(swap.steps, i)}"></div>
            <div class="timeline-label">${label}</div>
          </div>
        `).join('')}
      </div>

      <!-- Actions -->
      ${swap.status === 'pending' ? `
        <div class="swap-actions">
          <button class="btn-accept" onclick="acceptSwap(${swap.id})">
            <i class="ti ti-check"></i> Accept
          </button>
          <button class="btn-message" onclick="messageUser('${swap.from}')">
            <i class="ti ti-message"></i> Message
          </button>
          <button class="btn-decline" onclick="declineSwap(${swap.id})">
            Decline
          </button>
        </div>
      ` : swap.status === 'active' ? `
        <div class="swap-actions">
          <button class="btn-message" onclick="messageUser('${swap.from}')">
            <i class="ti ti-message"></i> Message
          </button>
          <button class="btn-accept" onclick="completeSwap(${swap.id})">
            <i class="ti ti-circle-check"></i> Mark as Complete
          </button>
        </div>
      ` : ''}

    </div>
  `).join('');
}

// Tab switching
document.getElementById('swap-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.swap-tab');
  if (!tab) return;
  document.querySelectorAll('.swap-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  renderSwaps(tab.dataset.tab);
});

// Actions
function acceptSwap(id) {
  const swap = SWAPS.incoming.find(s => s.id === id);
  if (!swap) return;
  swap.status = 'active';
  swap.steps[1] = true;
  renderSwaps('incoming');
}

function declineSwap(id) {
  SWAPS.incoming = SWAPS.incoming.filter(s => s.id !== id);
  renderSwaps('incoming');
  // update tab count
  document.querySelector('.swap-tab[data-tab="incoming"] .swap-tab__count').textContent =
    SWAPS.incoming.length;
}

function completeSwap(id) {
  const swap = SWAPS.outgoing.find(s => s.id === id);
  if (!swap) return;
  swap.status = 'completed';
  swap.steps = [true, true, true, true];
  SWAPS.completed.unshift(swap);
  SWAPS.outgoing = SWAPS.outgoing.filter(s => s.id !== id);
  renderSwaps('outgoing');
}

function messageUser(name) {
  showToast(`Opening chat with ${name}… (coming soon)`, 'success');
}

// Render incoming by default when swaps page is visited
function initSwapsPage() {
  renderSwaps('incoming');
}
// ── Profile Page ────────────────────────────────────────────

function renderStars(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color: ${i < rating ? '#EF9F27' : '#D3D1C7'}">★</span>`
  ).join('');
}

function initProfilePage() {
  // Avatar & name
  document.getElementById('profile-avatar').textContent = USER.initials;
  document.getElementById('profile-name').textContent   = USER.name;
  document.getElementById('profile-sub').textContent    =
    `${USER.year} · ${USER.course} · ${USER.campus}`;

  // Trust score
  document.getElementById('profile-trust').innerHTML =
    `<i class="ti ti-shield-check" style="font-size:13px"></i> ${USER.trustScore}% Trust Score`;

  // Stats
  document.getElementById('profile-stats').innerHTML = `
    <div class="profile-stat">
      <div class="profile-stat__num">${USER.stats.listed}</div>
      <div class="profile-stat__lbl">Books Listed</div>
    </div>
    <div class="profile-stat">
      <div class="profile-stat__num">${USER.stats.swapped}</div>
      <div class="profile-stat__lbl">Swaps Done</div>
    </div>
    <div class="profile-stat">
      <div class="profile-stat__num">${USER.stats.saved}</div>
      <div class="profile-stat__lbl">Total Saved</div>
    </div>
  `;

  // Listed books — seed + any user-added books from localStorage
  const saved = JSON.parse(localStorage.getItem('bookchain_books') || '[]');
  const allBooks = [
    ...saved.map(b => ({ emoji: b.emoji, title: b.title, condition: b.condition })),
    ...MY_BOOKS,
  ];

  document.getElementById('profile-books').innerHTML = allBooks.map(b => `
    <div class="profile-book">
      <div class="profile-book__emoji">${b.emoji}</div>
      <div>
        <div class="profile-book__title">${b.title}</div>
        <div class="profile-book__cond">${
          b.condition === 'like-new' ? 'Like New' :
          b.condition.charAt(0).toUpperCase() + b.condition.slice(1)
        }</div>
      </div>
    </div>
  `).join('');

  // Reviews
  document.getElementById('profile-reviews').innerHTML = REVIEWS.map(r => `
    <div class="review-card">
      <div class="review-card__header">
        <div class="review-card__reviewer">
          <div class="review-card__avatar" style="background: ${r.color}">${r.initials}</div>
          <div>
            <div>${r.from}</div>
            <div class="review-card__date">${r.date}</div>
          </div>
        </div>
        <div class="review-card__stars">${renderStars(r.rating)}</div>
      </div>
      <div class="review-card__text">${r.text}</div>
    </div>
  `).join('');
}
// ── Toast notification system ───────────────────────────────

// Inject toast element once
const toastEl = document.createElement('div');
toastEl.className = 'toast';
document.body.appendChild(toastEl);

let toastTimer;

function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  toastEl.className = `toast toast--${type} show`;
  toastEl.innerHTML = `<i class="ti ti-${type === 'success' ? 'circle-check' : 'alert-circle'}"></i> ${message}`;
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}