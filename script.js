// EXPRMNTL — shared behavior across pages
document.addEventListener('DOMContentLoaded', () => {
  // mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // mark active nav link
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.primary-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path) a.classList.add('active');
  });

  // countdown leader: cycles 8..1 in sync with the ring animation (8s, steps(8))
  const numberEl = document.querySelector('.leader-number');
  if (numberEl) {
    let n = 8;
    numberEl.textContent = n;
    setInterval(() => {
      n = n === 1 ? 8 : n - 1;
      numberEl.textContent = n;
    }, 1000);
  }

  // (Static gallery-modal wiring removed — editions.html galleries and posters
  // now use the auto-discovered gallery system below, which builds its own
  // self-contained modal per click instead of relying on pre-existing markup.)
});

// ---------- Site search (overlay, powered by search-data.js) ----------
document.addEventListener('DOMContentLoaded', () => {
  if (typeof EXPRMNTL_SEARCH_INDEX === 'undefined') return;

  // detect path prefix so links work from both root and subfolder pages
  const inSubfolder = /\/(films|people)\/[^/]*$/.test(location.pathname);
  const prefix = inSubfolder ? '../' : '';

  // inject search trigger button into header, before the nav-toggle
  const headerRow = document.querySelector('.header-row');
  const navToggle = document.querySelector('.nav-toggle');
  if (!headerRow || !navToggle) return;

  const trigger = document.createElement('button');
  trigger.className = 'search-trigger';
  trigger.setAttribute('aria-label', 'Search the archive');
  trigger.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4"/><line x1="10.3" y1="10.3" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  headerRow.insertBefore(trigger, navToggle);

  // build overlay
  const overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.id = 'siteSearchOverlay';
  overlay.innerHTML = `
    <div class="search-panel">
      <div class="search-field">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4"/><line x1="10.3" y1="10.3" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        <input type="text" id="siteSearchInput" placeholder="Search films and people…" autocomplete="off" aria-label="Search films and people">
        <button class="search-close" aria-label="Close search">&times;</button>
      </div>
      <p class="search-hint" id="siteSearchHint">Type to search across ${EXPRMNTL_SEARCH_INDEX.length} catalogued films and people.</p>
      <div class="search-results" id="siteSearchResults"></div>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#siteSearchInput');
  const results = overlay.querySelector('#siteSearchResults');
  const hint = overlay.querySelector('#siteSearchHint');
  const closeBtn = overlay.querySelector('.search-close');

  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function openSearch() {
    overlay.classList.add('open');
    document.body.classList.add('search-lock');
    input.value = '';
    results.innerHTML = '';
    hint.style.display = 'block';
    setTimeout(() => input.focus(), 30);
  }
  function closeSearch() {
    overlay.classList.remove('open');
    document.body.classList.remove('search-lock');
  }

  trigger.addEventListener('click', openSearch);
  closeBtn.addEventListener('click', closeSearch);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSearch(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && !overlay.classList.contains('open')) {
      e.preventDefault();
      openSearch();
    } else if (e.key === 'Escape' && overlay.classList.contains('open')) {
      closeSearch();
    }
  });

  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    if (!q) {
      results.innerHTML = '';
      hint.style.display = 'block';
      return;
    }
    hint.style.display = 'none';
    const matches = EXPRMNTL_SEARCH_INDEX.filter(item =>
      norm(item.t).includes(q) || norm(item.s).includes(q)
    ).slice(0, 40);

    if (!matches.length) {
      results.innerHTML = '<p class="search-empty">No matches in the catalogue.</p>';
      return;
    }
    results.innerHTML = matches.map(item => `
      <a class="search-result" href="${prefix}${item.u}">
        <span class="search-result-kicker">${item.k}${item.c ? ' · ' + item.c : ''}</span>
        <span class="search-result-title">${item.t}</span>
        <span class="search-result-sub">${item.s}</span>
      </a>`).join('');
  });
});

// ---------- Collapsible film grids (2 rows visible, expand to show all) ----------
(function () {
  const state = new Map(); // wrap -> { toggle, collapsedHeight, expanded }

  function measure(wrap) {
    const grid = wrap.querySelector('.grid');
    if (!grid) return null;
    const cards = Array.from(grid.children);
    if (!cards.length) return null;
    const tops = [...new Set(cards.map(c => c.offsetTop))].sort((a, b) => a - b);
    if (tops.length <= 2) return { collapsedHeight: null, fullHeight: grid.scrollHeight };
    const collapsedHeight = tops[2] - tops[0];
    return { collapsedHeight, fullHeight: grid.scrollHeight };
  }

  function applyHeight(wrap, entry) {
    const s = state.get(wrap);
    if (!s) return;
    if (entry.collapsedHeight === null) {
      // two rows or fewer total: nothing to collapse
      wrap.style.maxHeight = 'none';
      const fade = wrap.querySelector('.grid-fade');
      if (fade) fade.style.display = 'none';
      s.toggle.style.display = 'none';
      return;
    }
    s.collapsedHeight = entry.collapsedHeight;
    s.fullHeight = entry.fullHeight;
    wrap.style.maxHeight = (s.expanded ? s.fullHeight : s.collapsedHeight) + 'px';
  }

  function init() {
    document.querySelectorAll('.grid-wrap[data-collapsible]').forEach(wrap => {
      const toggle = wrap.nextElementSibling;
      if (!toggle || !toggle.classList.contains('grid-toggle')) return;
      state.set(wrap, { toggle, collapsedHeight: 0, fullHeight: 0, expanded: false });
      const entry = measure(wrap);
      if (!entry) return;
      applyHeight(wrap, entry);
      if (entry.collapsedHeight === null) return;

      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        const s = state.get(wrap);
        s.expanded = !s.expanded;
        wrap.classList.toggle('expanded', s.expanded);
        wrap.style.maxHeight = (s.expanded ? s.fullHeight : s.collapsedHeight) + 'px';
        toggle.textContent = s.expanded ? toggle.dataset.toggleLabelLess : toggle.dataset.toggleLabelMore;
        toggle.setAttribute('aria-expanded', s.expanded ? 'true' : 'false');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      state.forEach((s, wrap) => {
        const entry = measure(wrap);
        if (entry) applyHeight(wrap, entry);
      });
    }, 200);
  });
})();

// ---------- Auto-discovered photo galleries (film stills / director portraits) ----------
// Any element with data-gallery-probe="path/to/base" is probed for
// {base}-01.jpg, {base}-02.jpg, ... and turned into a "View Gallery" button
// if 2 or more are found. Fully self-contained: builds and tears down its
// own modal, so it never needs to touch the static editions.html galleries.
(function () {
  const MAX_PROBE = 12;

  function probe(base) {
    const found = [];
    let i = 1;
    function next() {
      if (i > MAX_PROBE) return Promise.resolve(found);
      const n = String(i).padStart(2, '0');
      const url = `${base}-${n}.jpg`;
      i++;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { found.push(url); resolve(next()); };
        img.onerror = () => resolve(found); // stop at first gap
        img.src = url;
      });
    }
    return next();
  }

  function openLightbox(images, title) {
    let index = 0;
    const modal = document.createElement('div');
    modal.className = 'gallery-modal open';
    modal.innerHTML = `
      <div class="gallery-container">
        <button class="gallery-close" aria-label="Close">&times;</button>
        <div class="gallery-main">
          <img class="gallery-image active" src="${images[0]}" alt="${title} — photo 1">
        </div>
        <button class="gallery-nav gallery-prev" aria-label="Previous">&larr;</button>
        <button class="gallery-nav gallery-next" aria-label="Next">&rarr;</button>
        <div class="gallery-thumbs">
          ${images.map((src, i) => `<button class="gallery-thumb${i === 0 ? ' active' : ''}"><img src="${src}" alt="Thumb ${i + 1}"></button>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.body.classList.add('search-lock');

    const mainImg = modal.querySelector('.gallery-image');
    const thumbs = modal.querySelectorAll('.gallery-thumb');

    function show(i) {
      index = (i + images.length) % images.length;
      mainImg.src = images[index];
      mainImg.alt = `${title} — photo ${index + 1}`;
      thumbs.forEach((t, j) => t.classList.toggle('active', j === index));
    }
    function close() {
      modal.remove();
      document.body.classList.remove('search-lock');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    }

    modal.querySelector('.gallery-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('.gallery-prev').addEventListener('click', () => show(index - 1));
    modal.querySelector('.gallery-next').addEventListener('click', () => show(index + 1));
    thumbs.forEach((t, i) => t.addEventListener('click', () => show(i)));
    document.addEventListener('keydown', onKey);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-gallery-probe]').forEach((el) => {
      const base = el.getAttribute('data-gallery-probe');
      const title = el.getAttribute('data-gallery-title') || '';
      probe(base).then((images) => {
        if (el.classList.contains('poster-frame')) {
          // Poster area: only becomes clickable if there's more than one
          // poster image to browse. A single poster just displays as-is.
          if (images.length < 2) return;
          el.style.cursor = 'pointer';
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', `View gallery: ${title}`);
          const hint = document.createElement('span');
          hint.className = 'poster-gallery-hint';
          hint.textContent = `\u{1F4F7} ${images.length} versions`;
          el.appendChild(hint);
          el.addEventListener('click', () => openLightbox(images, title));
          return;
        }
        if (images.length < 2) return; // 0 or 1: leave "To be added" as-is
        const btn = document.createElement('button');
        btn.className = 'doc-status gallery-btn';
        btn.textContent = 'View Gallery';
        btn.addEventListener('click', () => openLightbox(images, title));
        el.replaceWith(btn);
        const sub = btn.closest('.doc-row')?.querySelector('.doc-sub');
        if (sub) sub.textContent = `${images.length} photos`;
      });
    });
  });
})();
