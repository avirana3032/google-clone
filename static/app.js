let currentPage = 1;
let currentQuery = '';
let currentTab = 'search'; // 'search', 'images', 'news', 'videos'
let allResults = [];
let pageSize = 10;

// ====== DOM REFS ======
const body = document.getElementById('body');
const mainHome = document.getElementById('mainHome');
const resultsPage = document.getElementById('resultsPage');
const searchInput = document.getElementById('searchInput');
const searchInputSmall = document.getElementById('searchInputSmall');
const resultsList = document.getElementById('resultsList');
const resultsInfo = document.getElementById('resultsInfo');
const pagination = document.getElementById('pagination');
const suggestions = document.getElementById('suggestions');
const themePanel = document.getElementById('themePanel');
const addSitePanel = document.getElementById('addSitePanel');
const overlay = document.getElementById('overlay');
const favouritesDiv = document.getElementById('favourites');

// ====== THEME ======
const savedTheme = localStorage.getItem('gc_theme') || 'theme-light';
applyTheme(savedTheme);

document.querySelectorAll('.theme-swatch').forEach(sw => {
  if (sw.dataset.theme === savedTheme) sw.classList.add('active');
  sw.addEventListener('click', () => {
    document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    applyTheme(sw.dataset.theme);
    localStorage.setItem('gc_theme', sw.dataset.theme);
  });
});

function applyTheme(theme) {
  body.className = theme;
}

document.getElementById('themeBtn').addEventListener('click', () => openPanel(themePanel));
document.getElementById('closeTheme').addEventListener('click', closeAllPanels);

// ====== ADD SITE ======
const defaultFavs = [
  { name: 'YouTube', url: 'https://youtube.com', emoji: '▶️' },
  { name: 'Gmail', url: 'https://gmail.com', emoji: '✉️' },
  { name: 'Maps', url: 'https://maps.google.com', emoji: '🗺️' },
  { name: 'Facebook', url: 'https://facebook.com', emoji: '👤' },
  { name: 'Wikipedia', url: 'https://wikipedia.org', emoji: '📖' },
  { name: 'Twitter/X', url: 'https://x.com', emoji: '🐦' },
];

let favourites = JSON.parse(localStorage.getItem('gc_favs') || JSON.stringify(defaultFavs));

function saveFavs() {
  localStorage.setItem('gc_favs', JSON.stringify(favourites));
}

function renderFavourites() {
  favouritesDiv.innerHTML = '';
  favourites.forEach((fav, idx) => {
    const a = document.createElement('div');
    a.className = 'fav-item';
    const hostname = (() => { try { return new URL(fav.url).hostname; } catch { return ''; } })();
    a.innerHTML = `
      <div class="fav-icon">
        ${fav.emoji
          ? `<span>${fav.emoji}</span>`
          : `<img src="https://www.google.com/s2/favicons?domain=${hostname}&sz=32" onerror="this.parentElement.innerHTML='🌐'">`
        }
      </div>
      <span class="fav-label">${fav.name}</span>
      <button class="fav-remove" title="Remove" data-idx="${idx}">✕</button>
    `;
    a.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav-remove') || e.target.closest('.fav-remove')) return;
      window.open(fav.url, '_blank');
    });
    a.querySelector('.fav-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      favourites.splice(idx, 1);
      saveFavs();
      renderFavourites();
    });
    favouritesDiv.appendChild(a);
  });
}
renderFavourites();

document.getElementById('addSiteBtn').addEventListener('click', () => openPanel(addSitePanel));
document.getElementById('closeAddSite').addEventListener('click', closeAllPanels);
document.getElementById('saveSite').addEventListener('click', () => {
  const name = document.getElementById('siteNameInput').value.trim();
  const url = document.getElementById('siteUrlInput').value.trim();
  if (!name || !url) { alert('Please enter both name and URL.'); return; }
  const validUrl = url.startsWith('http') ? url : 'https://' + url;
  favourites.push({ name, url: validUrl, emoji: '' });
  saveFavs();
  renderFavourites();
  document.getElementById('siteNameInput').value = '';
  document.getElementById('siteUrlInput').value = '';
  closeAllPanels();
});

// ====== PANELS ======
function openPanel(panel) {
  closeAllPanels();
  panel.classList.add('open');
  overlay.classList.add('open');
}
function closeAllPanels() {
  [themePanel, addSitePanel].forEach(p => p.classList.remove('open'));
  overlay.classList.remove('open');
}
overlay.addEventListener('click', closeAllPanels);

// ====== SUGGESTIONS ======
let suggTimeout = null;
searchInput.addEventListener('input', () => {
  clearTimeout(suggTimeout);
  const q = searchInput.value.trim();
  if (!q) { suggestions.classList.add('hidden'); return; }
  suggTimeout = setTimeout(() => fetchSuggestions(q, suggestions, searchInput), 250);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { doSearch(); }
  if (e.key === 'Escape') { suggestions.classList.add('hidden'); }
});

searchInputSmall.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearchFromResults();
});

async function fetchSuggestions(q, sugDiv, inputEl) {
  try {
    const res = await fetch(`/suggest?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    renderSuggestions(data.suggestions || [], sugDiv, inputEl);
  } catch {
    sugDiv.classList.add('hidden');
  }
}

function renderSuggestions(items, sugDiv, inputEl) {
  if (!items.length) { sugDiv.classList.add('hidden'); return; }
  sugDiv.innerHTML = items.slice(0, 8).map(s =>
    `<div class="suggestion-item" data-q="${escapeHtml(s)}">
      <i class="fa fa-search"></i>${escapeHtml(s)}
    </div>`
  ).join('');
  sugDiv.classList.remove('hidden');
  sugDiv.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      inputEl.value = el.dataset.q;
      sugDiv.classList.add('hidden');
      doSearch();
    });
  });
}

// ====== SEARCH ======
async function doSearch(lucky = false) {
  const q = searchInput.value.trim();
  if (!q) return;
  suggestions.classList.add('hidden');
  currentQuery = q;
  currentPage = 1;
  searchInputSmall.value = q;

  mainHome.classList.add('hidden');
  resultsPage.classList.remove('hidden');
  window.scrollTo(0, 0);

  if (lucky) {
    history.pushState({q, page: 1}, '', `/?q=${encodeURIComponent(q)}&lucky=1`);
    await fetchResults(q, 1, true);
  } else {
    history.pushState({q, page: 1}, '', `/?q=${encodeURIComponent(q)}`);
    await fetchResults(q, 1);
  }
}

window.addEventListener('popstate', async (e) => {
  if (e.state && e.state.q) {
    searchInputSmall.value = e.state.q;
    searchInput.value = e.state.q;
    currentQuery = e.state.q;
    currentPage = e.state.page || 1;
    mainHome.classList.add('hidden');
    resultsPage.classList.remove('hidden');
    await fetchResults(e.state.q, currentPage);
  } else {
    resultsPage.classList.add('hidden');
    mainHome.classList.remove('hidden');
    searchInput.value = '';
    searchInputSmall.value = '';
  }
});

async function doSearchFromResults() {
  const q = searchInputSmall.value.trim();
  if (!q) return;
  searchInput.value = q;
  currentQuery = q;
  currentPage = 1;
  searchInputSmall.value = q;
  window.scrollTo(0, 0);
  history.pushState({q, page: 1}, '', `/?q=${encodeURIComponent(q)}`);
  await fetchResults(q, 1);
}

async function fetchResults(q, page, lucky = false) {
  resultsList.innerHTML = `
    <div class="skeleton-container">
      ${Array(5).fill(`
      <div class="skeleton-result">
        <div class="skeleton-url skeleton-box"></div>
        <div class="skeleton-title skeleton-box"></div>
        <div class="skeleton-line skeleton-box"></div>
        <div class="skeleton-line skeleton-box short"></div>
      </div>
      `).join('')}
    </div>
  `;
  resultsInfo.textContent = '';
  pagination.innerHTML = '';

  try {
    const endpoint = currentTab === 'search' ? '/search' : `/search/${currentTab}`;
    const url = `${endpoint}?q=${encodeURIComponent(q)}&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      resultsList.innerHTML = `<div class="error-msg">⚠️ ${data.error}</div>`;
      return;
    }

    allResults = data.results || [];
    const total = data.total || allResults.length;
    const timeTaken = data.time || '0.45';

    resultsInfo.textContent = `About ${total.toLocaleString()} results (${timeTaken} seconds)`;

    if (lucky && allResults.length > 0) {
      window.open(allResults[0].url, '_blank');
    }

    renderResults(allResults);
    renderPagination(total, page);

  } catch (err) {
    resultsList.innerHTML = `<div class="error-msg">❌ Search failed. Please try again.<br><small>${err.message}</small></div>`;
  }
}

function renderResults(results) {
  if (!results.length) {
    resultsList.innerHTML = `<div class="error-msg">No results found. Try different keywords.</div>`;
    return;
  }

  if (currentTab === 'images') {
    resultsList.innerHTML = `<div class="image-grid">
      ${results.map(r => `
        <a class="image-card" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(r.image || r.thumbnail)}" alt="Image result" loading="lazy" onerror="this.src='${escapeHtml(r.thumbnail)}'" />
          <div class="image-title">${escapeHtml(r.title)}<br><small>${escapeHtml(r.source)}</small></div>
        </a>
      `).join('')}
    </div>`;
  } else if (currentTab === 'news') {
    resultsList.innerHTML = results.map(r => `
      <div class="result-card news-card">
        <div class="news-source">${escapeHtml(r.source)} <span class="news-date">• ${escapeHtml(r.date)}</span></div>
        <a class="result-title" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a>
        <div class="result-snippet">${escapeHtml(r.snippet || '')}</div>
      </div>
    `).join('');
  } else if (currentTab === 'videos') {
    resultsList.innerHTML = `<div class="video-grid">
      ${results.map(r => `
        <a class="video-card" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">
          <div class="video-thumb-wrapper">
            <img src="${escapeHtml(r.thumbnail)}" alt="Video" loading="lazy" />
            <div class="video-play">▶</div>
            <div class="video-duration">${escapeHtml(r.duration || '')}</div>
          </div>
          <div class="video-info">
            <div class="result-title" style="font-size:14px; margin-bottom:4px">${escapeHtml(r.title)}</div>
            <div class="video-meta">${escapeHtml(r.publisher)} • ${escapeHtml(r.published)}</div>
          </div>
        </a>
      `).join('')}
    </div>`;
  } else {
    // Default standard web results
    resultsList.innerHTML = results.map(r => {
      const hostname = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
      return `
        <div class="result-card">
          <div class="result-url">
            <img class="result-favicon"
              src="https://www.google.com/s2/favicons?domain=${hostname}&sz=32"
              onerror="this.style.display='none'"
            >
            <span>${hostname}</span>
            <span style="opacity:0.5">›</span>
            <span style="opacity:0.7">${escapeHtml(r.url.replace(/^https?:\/\//, '').substring(0, 60))}</span>
          </div>
          <a class="result-title" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">
            ${escapeHtml(r.title || 'Untitled')}
          </a>
          ${r.date ? `<div class="result-date">${escapeHtml(r.date)}</div>` : ''}
          <div class="result-snippet">${escapeHtml(r.snippet || '')}</div>
        </div>
      `;
    }).join('');
  }
}

// ====== TABS EVENTS ======
document.querySelectorAll('.results-tabs .tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.results-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const text = tab.textContent.toLowerCase();
    if (text.includes('images')) currentTab = 'images';
    else if (text.includes('news')) currentTab = 'news';
    else if (text.includes('videos')) currentTab = 'videos';
    else currentTab = 'search';
    
    if (currentQuery) {
      currentPage = 1;
      fetchResults(currentQuery, 1);
    }
  });
});

function renderPagination(total, currentPg) {
  const totalPages = Math.min(Math.ceil(total / pageSize), 10);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }

  let html = '';
  if (currentPg > 1) {
    html += `<button class="page-btn" onclick="goPage(${currentPg - 1})">‹ Prev</button>`;
  }
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPg ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  if (currentPg < totalPages) {
    html += `<button class="page-btn" onclick="goPage(${currentPg + 1})">Next ›</button>`;
  }
  pagination.innerHTML = html;
}

async function goPage(pg) {
  currentPage = pg;
  currentPage = pg;
  window.scrollTo(0, 0);
  history.pushState({q: currentQuery, page: pg}, '', `/?q=${encodeURIComponent(currentQuery)}&page=${pg}`);
  await fetchResults(currentQuery, pg);
}

// ====== GO HOME ======
document.querySelectorAll('.small-logo, #logoTextSmall').forEach(el => {
  el.addEventListener('click', () => {
    resultsPage.classList.add('hidden');
    mainHome.classList.remove('hidden');
    searchInput.value = '';
    searchInput.value = '';
    searchInputSmall.value = '';
    window.scrollTo(0, 0);
    history.pushState(null, '', '/');
  });
});

// ====== UTILITY ======
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
