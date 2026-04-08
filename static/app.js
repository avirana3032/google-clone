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
const lensPanel = document.getElementById('lensPanel');
const lensDropZone = document.getElementById('lensDropZone');
const lensFileInput = document.getElementById('lensFileInput');
const lensUrlInput = document.getElementById('lensUrlInput');
const lensSearchBtn = document.getElementById('lensSearchBtn');

// ====== THEME ======
const savedTheme = localStorage.getItem('gc_theme') || 'theme-light';
applyTheme(savedTheme);

const profileDropdown = document.getElementById('profileDropdown');
const avatarBtn = document.getElementById('avatarBtn');
const homeFooter = document.getElementById('homeFooter');

function resetToHome() {
  currentQuery = '';
  isLensSearch = false;
  searchInput.value = '';
  searchInputSmall.value = '';
  mainHome.classList.remove('hidden');
  resultsPage.classList.add('hidden');
  if (homeFooter) homeFooter.classList.remove('hidden');
  window.scrollTo(0, 0);
  history.pushState(null, '', '/');
}

[document.getElementById('homeLogo'), document.getElementById('resultsLogo'), 
 document.getElementById('logoText'), document.getElementById('logoTextSmall')].forEach(el => {
  if (el) el.addEventListener('click', resetToHome);
});

if (document.getElementById('footerSettings')) {
  document.getElementById('footerSettings').addEventListener('click', (e) => {
    e.preventDefault();
    openPanel(themePanel);
  });
}
avatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('open');
});

document.getElementById('imagesLink').addEventListener('click', (e) => {
  e.preventDefault();
  currentTab = 'images';
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    if (t.textContent.includes('Images')) t.classList.add('active');
  });
  if (currentQuery) {
    doSearch();
  } else {
    // Just switch view if no query
    mainHome.classList.add('hidden');
    resultsPage.classList.remove('hidden');
    resultsList.innerHTML = '<div class="results-info">Search for images above</div>';
  }
});

document.addEventListener('click', () => {
  profileDropdown.classList.remove('open');
});
profileDropdown.addEventListener('click', (e) => e.stopPropagation());

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
  [themePanel, addSitePanel, lensPanel].forEach(p => {
    if (p) p.classList.remove('open');
  });
  overlay.classList.remove('open');
}
overlay.addEventListener('click', closeAllPanels);
if (document.getElementById('closeLens')) {
  document.getElementById('closeLens').addEventListener('click', closeAllPanels);
}
// Open lens on camera icon click
document.querySelectorAll('.lens-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openPanel(lensPanel);
  });
});

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
  
  if (!isLensSearch) lensSource = ''; // Reset if not from lens
  
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
  
  // Hide footer on results (optional, depends on look)
  // if (homeFooter) homeFooter.classList.add('hidden');
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
  isLensSearch = false; // Normal search resets lens mode
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
  if (isLensSearch) {
    resultsInfo.innerHTML = `<div class="lens-indicator">📸 Visual search results for: <strong>${escapeHtml(q)}</strong> (${lensSource})</div>`;
  }
  pagination.innerHTML = '';

  try {
    const endpoint = currentTab === 'search' ? '/search' : `/search/${currentTab}`;
    const url = `${endpoint}?q=${encodeURIComponent(q)}&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();

    if (lucky && data.results && data.results.length > 0) {
      window.location.href = data.results[0].url;
      return;
    }

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

// ====== LENS LOGIC ======
if (lensDropZone) {
  // Click to upload
  lensDropZone.addEventListener('click', () => lensFileInput.click());

  lensFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleLensFile(file);
  });

  // Drag & Drop
  lensDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    lensDropZone.classList.add('dragover');
  });
  lensDropZone.addEventListener('dragleave', () => {
    lensDropZone.classList.remove('dragover');
  });
  lensDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    lensDropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleLensFile(file);
  });
}

function handleLensFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }
  // Extract keywords from filename (e.g., "cool_dog_photo.jpg" -> "cool dog photo")
  let name = file.name.split('.')[0];
  name = name.replace(/[-_]/g, ' ');
  performLensSearch(name, 'Uploaded Image');
}

if (lensSearchBtn) {
  lensSearchBtn.addEventListener('click', () => {
    const url = lensUrlInput.value.trim();
    if (!url) return;
    // Extract something from the URL if possible
    let keyword = 'Image';
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      keyword = pathParts[pathParts.length - 1].split('.')[0] || 'Image';
      keyword = keyword.replace(/[-_]/g, ' ');
    } catch(e) {}
    performLensSearch(keyword, 'Image Link');
  });
}

let isLensSearch = false;
let lensSource = '';

function performLensSearch(query, source) {
  isLensSearch = true;
  lensSource = source;
  searchInput.value = query;
  searchInputSmall.value = query;
  closeAllPanels();
  doSearch();
}

// ====== VOICE SEARCH ======
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let voiceModal = null;

function createVoiceModal() {
  if (voiceModal) return voiceModal;
  const modal = document.createElement('div');
  modal.className = 'voice-modal';
  modal.innerHTML = `
    <div class="voice-modal-content">
      <div class="voice-close" id="voiceClose">&times;</div>
      <div class="voice-title">Listening...</div>
      <div class="voice-rings">
        <div class="voice-ring"></div>
        <div class="voice-ring"></div>
        <div class="voice-ring"></div>
        <div class="voice-mic-icon"><i class="fa fa-microphone"></i></div>
      </div>
      <div class="voice-transcript" id="voiceTranscript">Speak now</div>
    </div>
  `;
  document.body.appendChild(modal);
  voiceModal = modal;
  document.getElementById('voiceClose').addEventListener('click', stopVoice);
  modal.addEventListener('click', (e) => { if (e.target === modal) stopVoice(); });
  return modal;
}

let recognition = null;

function startVoice() {
  if (!SpeechRecognition) {
    alert('Voice search is not supported in your browser. Try Chrome or Edge.');
    return;
  }

  const modal = createVoiceModal();
  modal.classList.add('active');
  document.getElementById('voiceTranscript').textContent = 'Speak now';

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    document.getElementById('voiceTranscript').textContent = transcript;

    if (event.results[0].isFinal) {
      searchInput.value = transcript;
      searchInputSmall.value = transcript;
      setTimeout(() => {
        stopVoice();
        doSearch();
      }, 400);
    }
  };

  recognition.onerror = (event) => {
    document.getElementById('voiceTranscript').textContent =
      event.error === 'no-speech' ? 'No speech detected. Try again.' :
      event.error === 'not-allowed' ? 'Microphone access denied.' :
      'Error: ' + event.error;
    setTimeout(stopVoice, 2000);
  };

  recognition.onend = () => {
    // If modal still active but recognition ended without result
    if (voiceModal && voiceModal.classList.contains('active')) {
      setTimeout(stopVoice, 1500);
    }
  };

  recognition.start();
}

function stopVoice() {
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
    recognition = null;
  }
  if (voiceModal) {
    voiceModal.classList.remove('active');
  }
}

// Attach to all mic buttons
document.querySelectorAll('.mic-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    startVoice();
  });
});
