/* BookChain SwapSafe — API-connected frontend */

const COVER_COLORS = [
  '#FAEEDA', '#E1F5EE', '#FAECE7', '#E6F1FB',
  '#EAF3DE', '#EEEDFE', '#FCEBEB', '#F1EFE8'
];
const STEP_LABELS = ['Requested', 'Accepted', 'Hand-off', 'Completed'];
const state = {
  user: null,
  books: [],
  myBooks: [],
  currentSwapTab: 'incoming',
  editingBookId: null,
  pendingPage: null,
  swapTargetBook: null,
  searchTimer: null
};

async function api(path, options = {}) {
  const fetchOptions = {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  };
  const response = await fetch(`/api${path}`, fetchOptions);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function conditionLabel(condition) {
  if (condition === 'like-new') return 'Like New';
  return condition ? condition.charAt(0).toUpperCase() + condition.slice(1) : 'Good';
}

function showDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}
function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && dialog.open) dialog.close();
}
function openAuth(mode = 'login', nextPage = null) {
  state.pendingPage = nextPage || state.pendingPage;
  setAuthMode(mode);
  showDialog('auth-dialog');
}

function showPage(id) {
  if (['list', 'swaps', 'profile'].includes(id) && !state.user) {
    openAuth('login', id);
    showToast('Sign in to access your BookChain workspace.', 'error');
    return;
  }
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === `page-${id}`));
  document.querySelectorAll('.navbar__tab').forEach(tab => tab.classList.toggle('active', tab.dataset.page === id));
  if (id === 'swaps') loadSwaps(state.currentSwapTab);
  if (id === 'profile') loadProfile();
  if (id === 'list') {
    document.getElementById('f-campus').value ||= state.user?.campus && state.user.campus !== 'Not specified' ? state.user.campus : '';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setAuthMode(mode) {
  const isRegister = mode === 'register';
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('active', button.dataset.authMode === mode));
  document.getElementById('register-fields').hidden = !isRegister;
  document.getElementById('auth-name').required = isRegister;
  document.getElementById('auth-campus').required = isRegister;
  document.getElementById('auth-password').autocomplete = isRegister ? 'new-password' : 'current-password';
  document.getElementById('auth-title').textContent = isRegister ? 'Join BookChain' : 'Welcome back';
  document.getElementById('auth-subtitle').textContent = isRegister
    ? 'Create your student account and start swapping.'
    : 'Sign in to manage your listings and swaps.';
  document.getElementById('auth-submit').textContent = isRegister ? 'Create account' : 'Sign in';
  document.getElementById('auth-error').hidden = true;
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-form').dataset.mode = mode;
}

function updateAuthUI() {
  const authButton = document.getElementById('auth-button');
  const avatar = document.getElementById('navbar-avatar');
  if (state.user) {
    authButton.textContent = 'Sign out';
    authButton.classList.add('navbar__auth-btn--signed-in');
    avatar.textContent = state.user.initials || state.user.name.slice(0, 1).toUpperCase();
    avatar.style.background = state.user.avatarColor || '#854F0B';
    avatar.title = `Signed in as ${state.user.name}`;
    avatar.setAttribute('aria-label', 'Open profile');
  } else {
    authButton.textContent = 'Sign in';
    authButton.classList.remove('navbar__auth-btn--signed-in');
    avatar.textContent = '?';
    avatar.style.background = '';
    avatar.title = 'Sign in to BookChain';
    avatar.setAttribute('aria-label', 'Sign in');
  }
  refreshNotificationDot().catch(() => {});
}

function showToast(message, type = 'success') {
  const toastEl = document.querySelector('.toast') || document.createElement('div');
  toastEl.className = `toast toast--${type}`;
  toastEl.replaceChildren();
  const icon = document.createElement('i');
  icon.className = `ti ti-${type === 'success' ? 'circle-check' : 'alert-circle'}`;
  const text = document.createElement('span');
  text.textContent = message;
  toastEl.append(icon, text);
  if (!toastEl.isConnected) document.body.appendChild(toastEl);
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove('show'), 3400);
}

function showFormError(id, message) {
  const element = document.getElementById(id);
  element.textContent = message;
  element.hidden = false;
}
function clearFormError(id) {
  const element = document.getElementById(id);
  element.textContent = '';
  element.hidden = true;
}

function initials(name) {
  return String(name || 'Student').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

// ---------- Browse + real server-side filtering ----------
async function loadBooks() {
  const params = new URLSearchParams();
  const query = document.getElementById('search-input').value.trim();
  const subject = document.getElementById('subject-filter').value;
  const condition = document.querySelector('#condition-pills .pill.active')?.dataset.condition || '';
  if (query) params.set('q', query);
  if (subject) params.set('subject', subject);
  if (condition) params.set('condition', condition);
  const grid = document.getElementById('book-grid');
  grid.setAttribute('aria-busy', 'true');
  try {
    const result = await api(`/books${params.toString() ? `?${params.toString()}` : ''}`);
    state.books = result.books;
    renderBooks(state.books);
  } catch (error) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">Could not load books</div><div class="empty-state__sub">${escapeHTML(error.message)} If you just started the app, check your database connection.</div></div>`;
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

function filterBooks() {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(loadBooks, 220);
}

function renderBooks(books) {
  const grid = document.getElementById('book-grid');
  if (!books.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📭</div><div class="empty-state__title">No books found</div><div class="empty-state__sub">Try a different search or clear your filters. You can also be the first to list a book.</div></div>`;
    return;
  }
  grid.innerHTML = books.map((book, index) => {
    const owner = book.owner || {};
    const mine = book.isMine;
    return `
      <article class="book-card">
        <div class="book-card__cover" style="background:${COVER_COLORS[index % COVER_COLORS.length]}">
          <span aria-hidden="true">${escapeHTML(book.emoji || '📚')}</span>
          <span class="book-card__condition cond--${escapeHTML(book.condition)}">${escapeHTML(conditionLabel(book.condition))}</span>
        </div>
        <div class="book-card__body">
          <div class="book-card__title">${escapeHTML(book.title)}</div>
          <div class="book-card__author">${escapeHTML(book.author)}</div>
          ${book.notes ? `<p class="book-card__description">${escapeHTML(book.notes)}</p>` : ''}
          <div class="book-card__footer">
            <span class="book-card__subject">${escapeHTML(book.subject)}</span>
            <div class="book-card__owner" title="${escapeHTML(owner.campus || book.campus || '')}">
              <div class="book-card__owner-av" style="background:${escapeHTML(owner.color || '#854F0B')}">${escapeHTML(owner.initials || initials(owner.name))}</div>
              ${escapeHTML(owner.name || 'Student')}
            </div>
          </div>
          <div class="book-card__campus"><i class="ti ti-map-pin"></i> ${escapeHTML(book.campus || owner.campus || 'Campus not specified')}</div>
          <button class="book-card__swap-btn" type="button" data-action="request-swap" data-id="${escapeHTML(book.id)}" ${mine ? 'disabled' : ''}>
            <i class="ti ti-${mine ? 'book-2' : 'arrows-exchange'}"></i> ${mine ? 'Your listing' : 'Request Swap'}
          </button>
        </div>
      </article>`;
  }).join('');
}

document.getElementById('search-input').addEventListener('input', filterBooks);
document.getElementById('subject-filter').addEventListener('change', loadBooks);
document.getElementById('condition-pills').addEventListener('click', event => {
  const pill = event.target.closest('.pill');
  if (!pill) return;
  document.querySelectorAll('#condition-pills .pill').forEach(button => button.classList.toggle('active', button === pill));
  loadBooks();
});

// ---------- Listing create / edit / delete ----------
const conditionPicker = document.getElementById('condition-picker');
conditionPicker.addEventListener('click', event => {
  const option = event.target.closest('.cond-option');
  if (!option) return;
  conditionPicker.querySelectorAll('.cond-option').forEach(item => item.classList.toggle('selected', item === option));
});
function getSelectedCondition() {
  return document.querySelector('.cond-option.selected')?.dataset.value || 'like-new';
}
function resetListingForm() {
  state.editingBookId = null;
  document.getElementById('list-form').reset();
  document.querySelectorAll('.cond-option').forEach(item => item.classList.toggle('selected', item.dataset.value === 'like-new'));
  document.querySelector('.list-header__title').textContent = 'List a Book';
  document.querySelector('.list-header__sub').textContent = 'Share a textbook you no longer need with another student.';
  document.querySelector('#list-form .submit-btn').innerHTML = '<i class="ti ti-plus"></i> List this book';
  document.getElementById('success-banner').classList.remove('visible');
  document.querySelectorAll('.form-error').forEach(el => el.classList.remove('visible'));
  document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
}
function fillListingForm(book) {
  state.editingBookId = book.id;
  document.getElementById('f-title').value = book.title || '';
  document.getElementById('f-author').value = book.author || '';
  document.getElementById('f-subject').value = book.subject || '';
  document.getElementById('f-isbn').value = book.isbn || '';
  document.getElementById('f-want').value = book.wantInReturn || '';
  document.getElementById('f-notes').value = book.notes || '';
  document.getElementById('f-campus').value = book.campus || state.user?.campus || '';
  document.querySelectorAll('.cond-option').forEach(item => item.classList.toggle('selected', item.dataset.value === book.condition));
  document.querySelector('.list-header__title').textContent = 'Edit your listing';
  document.querySelector('.list-header__sub').textContent = 'Update the details students see before requesting your book.';
  document.querySelector('#list-form .submit-btn').innerHTML = '<i class="ti ti-device-floppy"></i> Save changes';
  showPage('list');
}
function validateListing() {
  const checks = [
    ['f-title', 'err-title'], ['f-author', 'err-author'],
    ['f-subject', 'err-subject'], ['f-campus', 'err-campus']
  ];
  return checks.map(([inputId, errorId]) => {
    const input = document.getElementById(inputId);
    const empty = !input.value.trim();
    input.classList.toggle('error', empty);
    document.getElementById(errorId).classList.toggle('visible', empty);
    return !empty;
  }).every(Boolean);
}

document.getElementById('list-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.user) return openAuth('login', 'list');
  if (!validateListing()) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }
  const payload = {
    title: document.getElementById('f-title').value.trim(),
    author: document.getElementById('f-author').value.trim(),
    subject: document.getElementById('f-subject').value,
    isbn: document.getElementById('f-isbn').value.trim(),
    condition: getSelectedCondition(),
    wantInReturn: document.getElementById('f-want').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    campus: document.getElementById('f-campus').value.trim()
  };
  const submit = document.querySelector('#list-form .submit-btn');
  const oldLabel = submit.innerHTML;
  submit.disabled = true;
  submit.textContent = state.editingBookId ? 'Saving changes…' : 'Publishing listing…';
  try {
    if (state.editingBookId) {
      await api(`/books/${encodeURIComponent(state.editingBookId)}`, { method: 'PATCH', body: payload });
      showToast('Your listing was updated.', 'success');
    } else {
      await api('/books', { method: 'POST', body: payload });
      showToast('Your book is now listed for other students.', 'success');
    }
    resetListingForm();
    document.getElementById('success-banner').classList.add('visible');
    setTimeout(() => document.getElementById('success-banner').classList.remove('visible'), 4200);
    await Promise.all([loadBooks(), refreshStats()]);
    await loadMyBooks();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    submit.disabled = false;
    if (state.editingBookId) submit.innerHTML = oldLabel;
    else submit.innerHTML = '<i class="ti ti-plus"></i> List this book';
  }
});

// ---------- Swap request flow ----------
async function requestSwap(bookId) {
  if (!state.user) return openAuth('login', 'browse');
  const target = state.books.find(book => book.id === bookId);
  if (!target) return showToast('This listing is no longer available. Refreshing the marketplace…', 'error');
  state.swapTargetBook = target;
  try {
    await loadMyBooks();
    const offers = state.myBooks.filter(book => book.status === 'available');
    if (!offers.length) {
      showToast('List an available book before requesting a swap.', 'error');
      showPage('list');
      return;
    }
    document.getElementById('swap-requested-book-id').value = target.id;
    document.getElementById('swap-dialog-title').textContent = `Swap for “${target.title}”`;
    document.getElementById('swap-dialog-subtitle').textContent = `Choose a book to offer ${target.owner?.name || 'this student'} in return.`;
    document.getElementById('swap-offered-book').innerHTML = offers.map(book => `<option value="${escapeHTML(book.id)}">${escapeHTML(book.title)} · ${escapeHTML(conditionLabel(book.condition))}</option>`).join('');
    document.getElementById('swap-message').value = '';
    clearFormError('swap-error');
    showDialog('swap-dialog');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

document.getElementById('swap-form').addEventListener('submit', async event => {
  event.preventDefault();
  const requestedBookId = document.getElementById('swap-requested-book-id').value;
  const offeredBookId = document.getElementById('swap-offered-book').value;
  const message = document.getElementById('swap-message').value.trim();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Sending request…';
  try {
    await api('/swaps', { method: 'POST', body: { requestedBookId, offeredBookId, message } });
    closeDialog('swap-dialog');
    showToast('Swap request sent! You can track it in My Swaps.', 'success');
    await refreshStats();
    await refreshSwapSummary();
  } catch (error) {
    showFormError('swap-error', error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Send swap request';
  }
});

// ---------- My Swaps: persisted request states ----------
function dotClass(steps, index) {
  if (!steps[index]) return 'dot--pending';
  const lastTrue = steps.lastIndexOf(true);
  if (index === lastTrue && !steps.every(Boolean)) return 'dot--active';
  return 'dot--done';
}

function swapSteps(swap) {
  if (swap.status === 'completed') return [true, true, true, true];
  if (swap.status === 'accepted') return [true, true, false, false];
  return [true, false, false, false];
}

function renderSwaps(swaps, tab) {
  const container = document.getElementById('swaps-list');
  if (!swaps.length) {
    const message = tab === 'incoming' ? 'Incoming swap requests will appear here.'
      : tab === 'outgoing' ? 'Requests you send to other students will appear here.'
      : 'Completed exchanges will be saved here for easy reference.';
    container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${tab === 'completed' ? '🤝' : '📚'}</div><div class="empty-state__title">Nothing here yet</div><div class="empty-state__sub">${escapeHTML(message)}</div><button class="empty-state__action" type="button" data-page="browse">Browse books</button></div>`;
    return;
  }
  container.innerHTML = swaps.map(swap => {
    const steps = swapSteps(swap);
    const requested = swap.requestedBook || {};
    const offered = swap.offeredBook || {};
    const counterpart = swap.isIncoming ? swap.requester : swap.owner;
    let actions = '';
    if (swap.status === 'pending' && swap.isIncoming) {
      actions = `<div class="swap-actions"><button class="btn-accept" type="button" data-action="swap-status" data-id="${escapeHTML(swap.id)}" data-status="accepted"><i class="ti ti-check"></i> Accept</button><button class="btn-decline" type="button" data-action="swap-status" data-id="${escapeHTML(swap.id)}" data-status="declined">Decline</button></div>`;
    } else if (swap.status === 'pending' && !swap.isIncoming) {
      actions = `<div class="swap-actions"><button class="btn-decline" type="button" data-action="swap-status" data-id="${escapeHTML(swap.id)}" data-status="cancelled">Cancel request</button></div>`;
    } else if (swap.status === 'accepted') {
      actions = `<div class="swap-actions"><button class="btn-accept" type="button" data-action="swap-status" data-id="${escapeHTML(swap.id)}" data-status="completed"><i class="ti ti-circle-check"></i> Mark as complete</button><span class="swap-handoff-hint">Arrange a safe campus hand-off with ${escapeHTML(counterpart?.name || 'the other student')}.</span></div>`;
    }
    const date = swap.createdAt ? new Date(swap.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return `<article class="swap-card">
      <div class="swap-card__top">
        <div class="swap-book"><div class="swap-book__cover">${escapeHTML(requested.emoji || '📚')}</div><div><div class="swap-book__title">${escapeHTML(requested.title || 'Requested book')}</div><div class="swap-book__label">Requested ${swap.isIncoming ? 'by' : 'from'} <strong>${escapeHTML(counterpart?.name || 'Student')}</strong></div></div></div>
        <div class="swap-arrow" aria-hidden="true">⇄</div>
        <div class="swap-book"><div class="swap-book__cover">${escapeHTML(offered.emoji || '📚')}</div><div><div class="swap-book__title">${escapeHTML(offered.title || 'Offered book')}</div><div class="swap-book__label">${swap.isIncoming ? 'Offered in return' : 'Your offer'}</div></div></div>
        <span class="swap-status status--${escapeHTML(swap.status)}">${escapeHTML(swap.status.charAt(0).toUpperCase() + swap.status.slice(1))}</span>
      </div>
      ${swap.message ? `<p class="swap-message"><strong>Message:</strong> ${escapeHTML(swap.message)}</p>` : ''}
      <div class="swap-timeline">${STEP_LABELS.map((label, index) => `<div class="timeline-step ${steps[index] ? 'done' : ''}"><div class="timeline-dot ${dotClass(steps, index)}"></div><div class="timeline-label">${label}</div></div>`).join('')}</div>
      <div class="swap-card__bottom"><span class="swap-date">${date ? `Requested ${escapeHTML(date)}` : ''}</span>${actions}</div>
    </article>`;
  }).join('');
}

async function loadSwaps(tab = state.currentSwapTab) {
  state.currentSwapTab = tab;
  if (!state.user) return openAuth('login', 'swaps');
  const container = document.getElementById('swaps-list');
  container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⏳</div><div class="empty-state__title">Loading swaps…</div></div>';
  document.querySelectorAll('.swap-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  try {
    const result = await api(`/swaps?tab=${encodeURIComponent(tab)}`);
    renderSwaps(result.swaps, tab);
    await refreshSwapSummary();
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__title">Could not load swaps</div><div class="empty-state__sub">${escapeHTML(error.message)}</div></div>`;
  }
}

async function refreshSwapSummary() {
  if (!state.user) return;
  const result = await api('/swaps/summary');
  document.getElementById('incoming-count').textContent = result.summary.incoming;
  document.getElementById('outgoing-count').textContent = result.summary.outgoing;
  document.getElementById('completed-count').textContent = result.summary.completed;
  const dot = document.getElementById('navbar-notif-dot');
  dot.hidden = result.summary.incoming === 0;
}
async function refreshNotificationDot() {
  const dot = document.getElementById('navbar-notif-dot');
  if (!state.user) { dot.hidden = true; return; }
  try {
    const result = await api('/swaps/summary');
    dot.hidden = result.summary.incoming === 0;
  } catch (_error) { dot.hidden = true; }
}

async function changeSwapStatus(id, status) {
  const labels = { accepted: 'Request accepted.', declined: 'Request declined.', cancelled: 'Request cancelled.', completed: 'Swap marked complete.' };
  try {
    await api(`/swaps/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
    showToast(labels[status] || 'Swap updated.', 'success');
    await Promise.all([loadSwaps(state.currentSwapTab), loadBooks(), refreshStats(), loadMyBooks()]);
  } catch (error) {
    showToast(error.message, 'error');
    await loadSwaps(state.currentSwapTab);
  }
}

document.getElementById('swap-tabs').addEventListener('click', event => {
  const tab = event.target.closest('.swap-tab');
  if (!tab) return;
  loadSwaps(tab.dataset.tab);
});

// ---------- Profile and personal listings ----------
async function loadMyBooks() {
  if (!state.user) { state.myBooks = []; return; }
  const result = await api('/books?mine=true');
  state.myBooks = result.books;
  return state.myBooks;
}

async function loadProfile() {
  if (!state.user) return openAuth('login', 'profile');
  try {
    const [booksResult, statsResult] = await Promise.all([
      api('/books?mine=true'), api('/auth/profile/stats')
    ]);
    state.myBooks = booksResult.books;
    const user = state.user;
    document.getElementById('profile-avatar').textContent = user.initials || initials(user.name);
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-sub').textContent = `${user.year} · ${user.course} · ${user.campus}`;
    document.getElementById('profile-trust').innerHTML = '<i class="ti ti-shield-check" style="font-size:13px"></i> BookChain member';
    const stats = statsResult.stats;
    document.getElementById('profile-stats').innerHTML = `
      <div class="profile-stat"><div class="profile-stat__num">${stats.listed}</div><div class="profile-stat__lbl">Active listings</div></div>
      <div class="profile-stat"><div class="profile-stat__num">${stats.swapped}</div><div class="profile-stat__lbl">Swaps completed</div></div>
      <div class="profile-stat"><div class="profile-stat__num">${stats.activeRequests}</div><div class="profile-stat__lbl">Active requests</div></div>`;
    renderProfileBooks(state.myBooks);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderProfileBooks(books) {
  const container = document.getElementById('profile-books');
  if (!books.length) {
    container.innerHTML = '<div class="profile-empty">You have not listed a book yet. Use “List a Book” to add your first one.</div>';
    return;
  }
  container.innerHTML = books.map(book => `<div class="profile-book">
    <div class="profile-book__emoji">${escapeHTML(book.emoji || '📚')}</div>
    <div class="profile-book__copy"><div class="profile-book__title">${escapeHTML(book.title)}</div><div class="profile-book__cond">${escapeHTML(conditionLabel(book.condition))} · ${escapeHTML(book.status)}</div></div>
    <div class="profile-book__actions">${book.status === 'available' ? `<button class="profile-book__action" type="button" data-action="edit-book" data-id="${escapeHTML(book.id)}" aria-label="Edit ${escapeHTML(book.title)}" title="Edit listing"><i class="ti ti-pencil"></i></button><button class="profile-book__action profile-book__action--danger" type="button" data-action="delete-book" data-id="${escapeHTML(book.id)}" aria-label="Delete ${escapeHTML(book.title)}" title="Delete listing"><i class="ti ti-trash"></i></button>` : '<span class="profile-book__locked" title="This book is reserved or swapped"><i class="ti ti-lock"></i></span>'}</div>
  </div>`).join('');
}

async function deleteBook(id) {
  const book = state.myBooks.find(item => item.id === id);
  if (!book) return;
  if (!window.confirm(`Delete your listing “${book.title}”? This cannot be undone.`)) return;
  try {
    await api(`/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('Book listing deleted.', 'success');
    await Promise.all([loadProfile(), loadBooks(), refreshStats()]);
  } catch (error) { showToast(error.message, 'error'); }
}

// ---------- Profile edit dialog ----------
function openProfileEditor() {
  if (!state.user) return openAuth('login', 'profile');
  document.getElementById('profile-edit-name').value = state.user.name || '';
  document.getElementById('profile-edit-year').value = state.user.year === 'Not specified' ? '' : (state.user.year || '');
  document.getElementById('profile-edit-course').value = state.user.course === 'Not specified' ? '' : (state.user.course || '');
  document.getElementById('profile-edit-campus').value = state.user.campus === 'Not specified' ? '' : (state.user.campus || '');
  clearFormError('profile-error');
  showDialog('profile-dialog');
}
document.getElementById('edit-profile-button').addEventListener('click', openProfileEditor);
document.getElementById('profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Saving profile…';
  try {
    const result = await api('/auth/profile', { method: 'PATCH', body: {
      name: document.getElementById('profile-edit-name').value.trim(),
      year: document.getElementById('profile-edit-year').value.trim() || 'Not specified',
      course: document.getElementById('profile-edit-course').value.trim() || 'Not specified',
      campus: document.getElementById('profile-edit-campus').value.trim()
    } });
    state.user = result.user;
    updateAuthUI();
    closeDialog('profile-dialog');
    await loadProfile();
    showToast('Profile updated.', 'success');
  } catch (error) { showFormError('profile-error', error.message); }
  finally { button.disabled = false; button.textContent = 'Save profile'; }
});

// ---------- Real marketplace stats ----------
async function refreshStats() {
  try {
    const { stats } = await api('/stats');
    document.getElementById('stat-books').textContent = stats.books.toLocaleString();
    document.getElementById('stat-students').textContent = stats.students.toLocaleString();
    document.getElementById('stat-requests').textContent = stats.pendingRequests.toLocaleString();
    document.getElementById('stat-completed').textContent = stats.completedSwaps.toLocaleString();
  } catch (_error) {
    ['stat-books', 'stat-students', 'stat-requests', 'stat-completed'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
  }
}

// ---------- Event wiring ----------
document.getElementById('nav-tabs').addEventListener('click', event => {
  const tab = event.target.closest('.navbar__tab');
  if (tab) showPage(tab.dataset.page);
});
document.querySelector('.navbar__logo').addEventListener('click', () => showPage('browse'));
document.querySelector('.navbar__logo').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showPage('browse'); }
});
document.getElementById('notifications-button').addEventListener('click', () => showPage('swaps'));
document.getElementById('navbar-avatar').addEventListener('click', () => state.user ? showPage('profile') : openAuth('login'));
document.getElementById('auth-button').addEventListener('click', async () => {
  if (!state.user) return openAuth('login');
  try {
    await api('/auth/logout', { method: 'POST' });
    state.user = null;
    state.myBooks = [];
    updateAuthUI();
    showPage('browse');
    showToast('You have signed out.', 'success');
    await Promise.all([loadBooks(), refreshStats()]);
  } catch (error) { showToast(error.message, 'error'); }
});
document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.dataset.closeDialog)));
// Click outside the panel to close native dialogs.
document.querySelectorAll('.app-dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
}));

document.getElementById('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const mode = event.currentTarget.dataset.mode || 'login';
  const button = document.getElementById('auth-submit');
  const payload = {
    email: document.getElementById('auth-email').value.trim(),
    password: document.getElementById('auth-password').value
  };
  if (mode === 'register') Object.assign(payload, {
    name: document.getElementById('auth-name').value.trim(),
    year: document.getElementById('auth-year').value,
    course: document.getElementById('auth-course').value.trim() || 'Not specified',
    campus: document.getElementById('auth-campus').value.trim()
  });
  clearFormError('auth-error');
  button.disabled = true;
  button.textContent = mode === 'register' ? 'Creating account…' : 'Signing in…';
  try {
    const result = await api(`/auth/${mode}`, { method: 'POST', body: payload });
    state.user = result.user;
    updateAuthUI();
    closeDialog('auth-dialog');
    const destination = state.pendingPage || 'browse';
    state.pendingPage = null;
    showPage(destination);
    showToast(mode === 'register' ? 'Welcome to BookChain!' : 'Welcome back!', 'success');
    await Promise.all([loadBooks(), refreshStats()]);
    if (state.user) await loadMyBooks().catch(() => {});
  } catch (error) { showFormError('auth-error', error.message); }
  finally { button.disabled = false; button.textContent = mode === 'register' ? 'Create account' : 'Sign in'; }
});

document.addEventListener('click', event => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton && !pageButton.classList.contains('navbar__tab')) {
    showPage(pageButton.dataset.page);
    return;
  }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const { action, id, status } = actionButton.dataset;
  if (action === 'request-swap') requestSwap(id);
  if (action === 'swap-status') changeSwapStatus(id, status);
  if (action === 'edit-book') {
    const book = state.myBooks.find(item => item.id === id);
    if (book) fillListingForm(book);
  }
  if (action === 'delete-book') deleteBook(id);
});

// Keep validation feedback close to the field being edited.
[['f-title', 'err-title'], ['f-author', 'err-author'], ['f-subject', 'err-subject'], ['f-campus', 'err-campus']].forEach(([inputId, errorId]) => {
  const input = document.getElementById(inputId);
  input.addEventListener('input', () => {
    if (input.value.trim()) {
      input.classList.remove('error');
      document.getElementById(errorId).classList.remove('visible');
    }
  });
  input.addEventListener('change', () => {
    if (input.value.trim()) {
      input.classList.remove('error');
      document.getElementById(errorId).classList.remove('visible');
    }
  });
});

async function initApp() {
  try {
    const result = await api('/auth/me');
    state.user = result.user;
  } catch (_error) { state.user = null; }
  updateAuthUI();
  await Promise.all([loadBooks(), refreshStats()]);
  if (state.user) await refreshSwapSummary().catch(() => {});
}
initApp();
