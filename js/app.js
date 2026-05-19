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