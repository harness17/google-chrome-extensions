(function () {
  const sorter = window.__YT_PDS__;
  const i18n = window.__YT_PDS_I18N__;
  if (!sorter || !i18n) return;

  const MAX_ITEMS = 120;
  const FETCH_CONCURRENCY = 4;
  const SETTINGS_KEY = 'ytpds:settings';
  const state = {
    order: 'asc',
    language: 'ja',
    autoAdvance: false,
    sortedItems: [],
    dateByVideoId: Object.create(null),
    fetchStats: { ok: 0, httpError: 0, noDate: 0, networkError: 0 },
    lastFetchDebug: '',
    loading: false,
    progress: { current: 0, total: 0, phaseKey: '' },
    panel: null,
    lastUrl: location.href,
    lastPathname: location.pathname,
    playlistId: sorter.getPlaylistIdFromUrl(location.href),
    visualObserver: null,
    visualObserverRoot: null,
    visualApplyTimer: 0,
    applyingVisualOrder: false,
    restoredPlaylistId: '',
    badgesEnabled: false,
    visualMode: 'idle',
    forceOrderWithoutBadges: false,
    statusRenderer: null,
  };

  function isPlaylistWatchPage() {
    return Boolean(sorter.getVideoIdFromUrl(location.href) && sorter.getPlaylistIdFromUrl(location.href));
  }

  function isSupportedPlaylistPage() {
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    return Boolean(playlistId && (location.pathname === '/watch' || location.pathname === '/playlist'));
  }

  function t(key, ...args) {
    return i18n.translate(state.language, key, ...args);
  }

  function renderStatus() {
    const node = state.panel && state.panel.querySelector('[data-ytpds-status]');
    if (node) node.textContent = state.statusRenderer ? state.statusRenderer() : t('ready');
  }

  function setStatusKey(key, ...args) {
    state.statusRenderer = () => t(key, ...args);
    renderStatus();
  }

  function setSummaryStatus() {
    state.statusRenderer = () => buildSummaryText();
    renderStatus();
  }

  function refreshPanelText() {
    if (!state.panel) return;
    const title = state.panel.querySelector('[data-ytpds-title]');
    const order = state.panel.querySelector('[data-ytpds-order]');
    const language = state.panel.querySelector('[data-ytpds-language]');
    const sortButton = state.panel.querySelector('[data-ytpds-sort]');
    const nextButton = state.panel.querySelector('[data-ytpds-next]');
    const autoButton = state.panel.querySelector('[data-ytpds-auto]');
    if (title) title.textContent = t('title');
    if (order) {
      order.setAttribute('aria-label', t('orderLabel'));
      const asc = order.querySelector('option[value="asc"]');
      const desc = order.querySelector('option[value="desc"]');
      if (asc) asc.textContent = t('oldestFirst');
      if (desc) desc.textContent = t('newestFirst');
    }
    if (language) {
      language.setAttribute('aria-label', t('languageLabel'));
      language.value = state.language;
    }
    if (sortButton) sortButton.textContent = state.loading ? t('sorting') : t('sort');
    if (nextButton) nextButton.textContent = t('next');
    if (autoButton) autoButton.textContent = t('auto', state.autoAdvance);
    updateLoadingUi();
    renderStatus();
  }

  function ensurePanel() {
    if (!isSupportedPlaylistPage()) {
      if (state.panel) state.panel.remove();
      state.panel = null;
      return;
    }
    if (state.panel && document.contains(state.panel)) return;

    const panel = document.createElement('section');
    panel.className = 'ytpds-panel';
    panel.innerHTML = `
      <p class="ytpds-title" data-ytpds-title></p>
      <div class="ytpds-row ytpds-controls-row">
        <select class="ytpds-select ytpds-order-select" data-ytpds-order>
          <option value="asc"></option>
          <option value="desc"></option>
        </select>
        <select class="ytpds-select ytpds-language-select" data-ytpds-language>
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>
      <div class="ytpds-row">
        <button class="ytpds-button" type="button" data-ytpds-sort></button>
        <button class="ytpds-button ytpds-button-primary" type="button" data-ytpds-next></button>
      </div>
      <div class="ytpds-row">
        <button class="ytpds-button" type="button" data-ytpds-auto></button>
      </div>
      <div class="ytpds-progress" data-ytpds-progress hidden>
        <div class="ytpds-progress-track">
          <div class="ytpds-progress-bar" data-ytpds-progress-bar></div>
        </div>
        <div class="ytpds-progress-label" data-ytpds-progress-label></div>
      </div>
      <div class="ytpds-status" data-ytpds-status></div>
    `;

    panel.querySelector('[data-ytpds-order]').addEventListener('change', (event) => {
      state.order = event.target.value === 'desc' ? 'desc' : 'asc';
      if (state.sortedItems.length > 0) {
        state.sortedItems = sorter.sortItemsByPublishDate(
          state.sortedItems,
          state.dateByVideoId,
          state.order
        );
        applyVisualOrder();
        saveSortState();
        setSummaryStatus();
      }
    });
    panel.querySelector('[data-ytpds-language]').addEventListener('change', (event) => {
      state.language = i18n.normalizeLanguage(event.target.value);
      saveSettings();
      refreshPanelText();
      if (state.badgesEnabled && state.sortedItems.length > 0) {
        applyVisualOrder();
      }
    });
    panel.querySelector('[data-ytpds-sort]').addEventListener('click', () => refreshSortedItems());
    panel.querySelector('[data-ytpds-next]').addEventListener('click', () => goNextByPublishDate());
    panel.querySelector('[data-ytpds-auto]').addEventListener('click', (event) => {
      state.autoAdvance = !state.autoAdvance;
      event.currentTarget.textContent = t('auto', state.autoAdvance);
      attachEndedHandler();
    });

    document.documentElement.appendChild(panel);
    state.panel = panel;
    refreshPanelText();
    updateLoadingUi();
  }

  function setLoading(isLoading, phaseKey, current, total) {
    state.loading = isLoading;
    state.progress = {
      phaseKey: phaseKey || '',
      current: Number.isFinite(current) ? current : 0,
      total: Number.isFinite(total) ? total : 0,
    };
    updateLoadingUi();
  }

  function updateProgress(phaseKey, current, total) {
    state.progress = {
      phaseKey: phaseKey || state.progress.phaseKey,
      current: Number.isFinite(current) ? current : state.progress.current,
      total: Number.isFinite(total) ? total : state.progress.total,
    };
    updateLoadingUi();
  }

  function updateLoadingUi() {
    if (!state.panel) return;
    const sortButton = state.panel.querySelector('[data-ytpds-sort]');
    const nextButton = state.panel.querySelector('[data-ytpds-next]');
    const progress = state.panel.querySelector('[data-ytpds-progress]');
    const bar = state.panel.querySelector('[data-ytpds-progress-bar]');
    const label = state.panel.querySelector('[data-ytpds-progress-label]');
    if (sortButton) {
      sortButton.disabled = state.loading;
      sortButton.textContent = state.loading ? t('sorting') : t('sort');
    }
    if (nextButton) {
      nextButton.disabled = state.loading;
    }
    if (progress) {
      progress.hidden = !state.loading;
    }
    if (bar) {
      const ratio =
        state.progress.total > 0
          ? Math.max(0, Math.min(1, state.progress.current / state.progress.total))
          : 0.2;
      bar.style.width = `${Math.round(ratio * 100)}%`;
    }
    if (label) {
      const count =
        state.progress.total > 0
          ? ` ${state.progress.current}/${state.progress.total}`
          : '';
      const phase = state.progress.phaseKey ? t(state.progress.phaseKey) : t('defaultProgress');
      label.textContent = `${phase}${count}`;
    }
  }

  function buildSummaryText() {
    const known = state.sortedItems.filter((item) => state.dateByVideoId[item.videoId]).length;
    const failed = state.fetchStats.httpError + state.fetchStats.noDate + state.fetchStats.networkError;
    const debug =
      state.lastFetchDebug && (failed || state.lastFetchDebug.startsWith('visual '))
        ? state.lastFetchDebug
        : '';
    return t(
      'summary',
      state.sortedItems.length,
      state.order,
      known,
      failed,
      state.fetchStats,
      debug
    );
  }

  async function refreshSortedItems() {
    if (state.loading) return;
    ensurePanel();

    setLoading(true, 'waitingPhase', 0, 0);
    setStatusKey('waitingStatus');

    const items = (await waitForPlaylistItems()).slice(0, MAX_ITEMS);
    if (items.length === 0) {
      setStatusKey('noItems');
      setLoading(false);
      return;
    }

    state.fetchStats = { ok: 0, httpError: 0, noDate: 0, networkError: 0 };
    state.lastFetchDebug = '';
    updateProgress('fetchingPhase', 0, items.length);
    state.statusRenderer = () => t('fetchingStatus', items.length);
    renderStatus();
    await fetchDates(items);
    updateProgress('sortingPhase', items.length, items.length);
    state.sortedItems = sorter.sortItemsByPublishDate(items, state.dateByVideoId, state.order);
    state.badgesEnabled = true;
    state.visualMode = 'sorted';
    applyVisualOrder();
    state.visualMode = 'badges';
    ensureVisualObserver();
    await saveSortState();
    setLoading(false);
    setSummaryStatus();
  }

  async function waitForPlaylistItems() {
    const deadline = Date.now() + 6000;
    let lastItems = [];
    while (Date.now() < deadline) {
      lastItems = sorter.extractPlaylistItemsFromDocument(document);
      if (lastItems.length > 0) return lastItems;
      await delay(200);
    }
    return lastItems;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchDates(items) {
    let cursor = 0;
    let completed = 0;
    async function worker() {
      while (cursor < items.length) {
        const item = items[cursor++];
        if (!state.dateByVideoId[item.videoId]) {
          state.dateByVideoId[item.videoId] = await fetchPublishDate(item.videoId);
        }
        completed += 1;
        updateProgress('fetchingPhase', completed, items.length);
        state.statusRenderer = () => t('fetchingStatus', items.length, completed);
        renderStatus();
      }
    }
    await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, () => worker()));
  }

  async function fetchPublishDate(videoId) {
    const url = new URL('/watch', location.origin);
    url.searchParams.set('v', videoId);
    url.searchParams.set('hl', 'en');
    url.searchParams.set('persist_hl', '1');
    url.searchParams.set('bpctr', '9999999999');
    url.searchParams.set('has_verified', '1');

    try {
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) {
        state.fetchStats.httpError += 1;
        state.lastFetchDebug = `${videoId} HTTP ${response.status}`;
        return null;
      }
      const html = await response.text();
      const date = sorter.extractPublishDateFromHtml(html);
      if (date) {
        state.fetchStats.ok += 1;
      } else {
        state.fetchStats.noDate += 1;
        state.lastFetchDebug = `${videoId} no date, ${html.length} bytes, title=${extractHtmlTitle(html)}`;
      }
      return date;
    } catch (error) {
      state.fetchStats.networkError += 1;
      state.lastFetchDebug = `${videoId} ${error && error.name ? error.name : 'network error'}`;
      return null;
    }
  }

  function extractHtmlTitle(html) {
    const match = String(html).match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim().slice(0, 40) : 'none';
  }

  function getPlaylistRows() {
    const selectors =
      location.pathname === '/playlist'
        ? [
            'ytd-playlist-video-renderer',
            'ytd-playlist-video-list-renderer ytd-playlist-video-renderer',
          ]
        : [
            'ytd-playlist-panel-video-renderer',
            'ytd-playlist-panel-video-wrapper-renderer',
            'ytd-playlist-panel-renderer a[href*="/watch"][href*="v="]',
            'ytd-playlist-video-renderer',
          ];
    const rows = [];
    const seen = new Set();
    for (const selector of selectors) {
      for (const candidate of document.querySelectorAll(selector)) {
        const row = normalizePlaylistRow(candidate);
        if (!row || seen.has(row)) continue;
        if (!getVideoIdFromRow(row)) continue;
        seen.add(row);
        rows.push(row);
      }
    }
    return rows;
  }

  function normalizePlaylistRow(candidate) {
    if (!candidate) return null;
    if (candidate.matches && candidate.matches('a[href*="/watch"][href*="v="]')) {
      return (
        candidate.closest(
          'ytd-playlist-panel-video-renderer, ytd-playlist-panel-video-wrapper-renderer, ytd-playlist-video-renderer, ytd-rich-item-renderer'
        ) || candidate
      );
    }
    return candidate;
  }

  function getVideoIdFromRow(row) {
    if (!row || !row.querySelector) return '';
    const anchor =
      row.matches && row.matches('a[href*="/watch"][href*="v="]')
        ? row
        : row.querySelector('a[href*="/watch"][href*="v="]');
    if (!anchor) return '';
    return sorter.getVideoIdFromUrl(anchor.href || anchor.getAttribute('href') || '');
  }

  function applyVisualOrder() {
    if (state.applyingVisualOrder || state.sortedItems.length === 0) return;

    const rows = getPlaylistRows();
    if (rows.length === 0) return;

    const rowByVideoId = new Map();
    for (const row of rows) {
      const videoId = getVideoIdFromRow(row);
      if (videoId && !rowByVideoId.has(videoId)) {
        rowByVideoId.set(videoId, row);
      }
    }

    const sortedRows = state.sortedItems
      .map((item) => rowByVideoId.get(item.videoId))
      .filter(Boolean);
    if (sortedRows.length === 0) {
      state.lastFetchDebug = `visual rows=${rows.length}, matched=0`;
      setSummaryStatus();
      return;
    }

    const parent = sortedRows[0].parentElement;
    if (!parent || sortedRows.some((row) => row.parentElement !== parent)) {
      state.lastFetchDebug = `visual rows=${rows.length}, matched=${sortedRows.length}, mixed parents`;
      setSummaryStatus();
      return;
    }

    const currentOrder = Array.from(parent.children)
      .filter((node) => rowByVideoId.has(getVideoIdFromRow(node)))
      .map((node) => getVideoIdFromRow(node));
    const desiredOrder = state.sortedItems
      .filter((item) => rowByVideoId.has(item.videoId))
      .map((item) => item.videoId);
    if (sameOrder(currentOrder, desiredOrder)) {
      safelyDecorateRows(rowByVideoId);
      state.lastFetchDebug = `visual rows=${rows.length}, matched=${sortedRows.length}, already sorted`;
      return;
    }

    if (state.visualMode !== 'sorted' && !state.forceOrderWithoutBadges) {
      state.badgesEnabled = false;
      clearDecorations();
      state.lastFetchDebug = `visual rows=${rows.length}, matched=${sortedRows.length}, native order detected`;
      setSummaryStatus();
      return;
    }

    state.applyingVisualOrder = true;
    try {
      const marker = document.createComment('ytpds-order-marker');
      parent.insertBefore(marker, sortedRows[0]);
      for (let i = desiredOrder.length - 1; i >= 0; i -= 1) {
        const row = rowByVideoId.get(desiredOrder[i]);
        if (row && row.parentElement === parent) {
          parent.insertBefore(row, marker.nextSibling);
        }
      }
      marker.remove();
      decorateRows(rowByVideoId);
      state.lastFetchDebug = `visual rows=${rows.length}, matched=${sortedRows.length}, sorted`;
    } finally {
      setTimeout(() => {
        state.applyingVisualOrder = false;
      }, 300);
    }
  }

  function sameOrder(left, right) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }

  function decorateRows(rowByVideoId) {
    if (!state.badgesEnabled) {
      clearDecorations();
      return;
    }
    clearDecorations();
    const currentVideoId = sorter.getVideoIdFromUrl(location.href);
    state.sortedItems.forEach((item, index) => {
      const row = rowByVideoId.get(item.videoId);
      if (!row) return;

      const isCurrent = item.videoId === currentVideoId;
      if (row.classList.contains('ytpds-current-video') !== isCurrent) {
        row.classList.toggle('ytpds-current-video', isCurrent);
      }
      if (row.dataset.ytpdsSorted !== '1') {
        row.dataset.ytpdsSorted = '1';
      }
      const sortIndex = String(index + 1);
      if (row.dataset.ytpdsSortIndex !== sortIndex) {
        row.dataset.ytpdsSortIndex = sortIndex;
      }

      const badge = ensureBadge(row);
      const badgeText = t(
        'badge',
        index + 1,
        state.dateByVideoId[item.videoId] || t('unknownDate')
      );
      if (badge.textContent !== badgeText) {
        badge.textContent = badgeText;
      }
    });
  }

  function safelyDecorateRows(rowByVideoId) {
    if (state.applyingVisualOrder) return;
    state.applyingVisualOrder = true;
    try {
      decorateRows(rowByVideoId);
    } finally {
      setTimeout(() => {
        state.applyingVisualOrder = false;
      }, 150);
    }
  }

  function clearDecorations() {
    for (const row of getPlaylistRows()) {
      row.classList.remove('ytpds-current-video');
      if (row.dataset.ytpdsSorted) {
        delete row.dataset.ytpdsSorted;
      }
      if (row.dataset.ytpdsSortIndex) {
        delete row.dataset.ytpdsSortIndex;
      }
    }
    for (const badge of document.querySelectorAll('.ytpds-date-badge')) {
      badge.remove();
    }
  }

  function ensureBadge(row) {
    let badge = row.querySelector('.ytpds-date-badge');
    if (badge) return badge;

    badge = document.createElement('span');
    badge.className = 'ytpds-date-badge';
    const target =
      row.querySelector('#meta, #byline-container, #video-info, .metadata, #video-title') || row;
    target.appendChild(badge);
    return badge;
  }

  function ensureVisualObserver() {
    const root =
      document.querySelector('ytd-playlist-panel-renderer') ||
      document.querySelector('ytd-playlist-video-list-renderer') ||
      document;
    if (state.visualObserver && state.visualObserverRoot === root) return;
    if (state.visualObserver) {
      state.visualObserver.disconnect();
    }

    const observer = new MutationObserver(() => {
      if (state.applyingVisualOrder || state.sortedItems.length === 0) return;
      clearTimeout(state.visualApplyTimer);
      state.visualApplyTimer = setTimeout(() => applyVisualOrder(), 120);
    });
    observer.observe(root, { attributes: true, childList: true, subtree: true });
    state.visualObserver = observer;
    state.visualObserverRoot = root;
  }

  function storageKeyForPlaylist(playlistId) {
    return `ytpds:${playlistId}`;
  }

  function canUseChromeStorage() {
    return Boolean(
      typeof chrome !== 'undefined' &&
        chrome.storage &&
        chrome.storage.local &&
        chrome.storage.local.get &&
        chrome.storage.local.set
    );
  }

  function storageGet(key) {
    if (!canUseChromeStorage()) return Promise.resolve(null);
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result && result[key] ? result[key] : null);
      });
    });
  }

  function storageSet(key, value) {
    if (!canUseChromeStorage()) return Promise.resolve();
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }

  async function saveSettings() {
    await storageSet(SETTINGS_KEY, { language: state.language });
  }

  async function restoreSettings() {
    const saved = await storageGet(SETTINGS_KEY);
    state.language = i18n.normalizeLanguage(saved && saved.language);
    refreshPanelText();
  }

  async function saveSortState() {
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    if (!playlistId || state.sortedItems.length === 0) return;
    await storageSet(storageKeyForPlaylist(playlistId), {
      playlistId,
      order: state.order,
      sortedItems: state.sortedItems,
      dateByVideoId: Object.assign({}, state.dateByVideoId),
      savedAt: Date.now(),
    });
  }

  async function restoreSortState() {
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    if (!playlistId || state.restoredPlaylistId === playlistId) return;
    const saved = await storageGet(storageKeyForPlaylist(playlistId));
    if (!saved || !Array.isArray(saved.sortedItems) || saved.sortedItems.length === 0) return;

    state.restoredPlaylistId = playlistId;
    state.order = saved.order === 'desc' ? 'desc' : 'asc';
    state.sortedItems = saved.sortedItems;
    state.dateByVideoId = Object.assign(Object.create(null), saved.dateByVideoId || {});
    state.badgesEnabled = false;
    const select = state.panel && state.panel.querySelector('[data-ytpds-order]');
    if (select) select.value = state.order;
    applySavedOrderWithoutBadges();
    ensureVisualObserver();
    scheduleSavedOrderApply(250);
    scheduleSavedOrderApply(1000);
    scheduleSavedOrderApply(2500);
    setStatusKey('saved', state.sortedItems.length);
  }

  function applySavedOrderWithoutBadges() {
    state.badgesEnabled = false;
    state.forceOrderWithoutBadges = true;
    try {
      state.visualMode = 'sorted';
      applyVisualOrder();
      clearDecorations();
    } finally {
      state.visualMode = 'badges';
      state.forceOrderWithoutBadges = false;
    }
  }

  function scheduleSavedOrderApply(ms) {
    setTimeout(() => {
      if (state.sortedItems.length > 0 && !state.badgesEnabled) {
        applySavedOrderWithoutBadges();
      }
    }, ms);
  }

  function scheduleVisualOrderApply(ms) {
    setTimeout(() => {
      if (state.sortedItems.length > 0) {
        applyVisualOrder();
        highlightCurrentVideo();
      }
    }, ms);
  }

  async function goNextByPublishDate() {
    if (state.sortedItems.length === 0) {
      await refreshSortedItems();
    }
    const currentVideoId = sorter.getVideoIdFromUrl(location.href);
    const nextVideoId =
      currentVideoId && state.sortedItems.some((item) => item.videoId === currentVideoId)
        ? sorter.findNextVideoId(state.sortedItems, currentVideoId)
        : state.sortedItems[0] && state.sortedItems[0].videoId;
    if (!nextVideoId) {
      setStatusKey('noNext');
      return;
    }

    location.href = sorter.buildWatchUrl(nextVideoId, sorter.getPlaylistIdFromUrl(location.href));
  }

  function attachEndedHandler() {
    const video = document.querySelector('video');
    if (!video || video.dataset.ytpdsEndedBound === '1') return;
    video.dataset.ytpdsEndedBound = '1';
    video.addEventListener('ended', () => {
      if (state.autoAdvance && isPlaylistWatchPage()) {
        goNextByPublishDate();
      }
    });
  }

  function onNavigationMaybeChanged() {
    const urlChanged = state.lastUrl !== location.href;
    const pathChanged = state.lastPathname !== location.pathname;
    if (urlChanged) {
      state.lastUrl = location.href;
    }
    if (pathChanged) {
      state.lastPathname = location.pathname;
    }
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    if (playlistId !== state.playlistId) {
      state.playlistId = playlistId;
      state.sortedItems = [];
      state.restoredPlaylistId = '';
      state.badgesEnabled = false;
      clearDecorations();
    }
    const panelMissingBeforeEnsure = isSupportedPlaylistPage() && !state.panel;
    ensurePanel();
    if (pathChanged && state.sortedItems.length > 0) {
      state.badgesEnabled = false;
      applySavedOrderWithoutBadges();
      scheduleSavedOrderApply(250);
      scheduleSavedOrderApply(1000);
      scheduleSavedOrderApply(2500);
    } else if (urlChanged || panelMissingBeforeEnsure) {
      restoreSortState();
    }
    if (state.sortedItems.length > 0) {
      ensureVisualObserver();
      if (state.badgesEnabled) {
        scheduleVisualOrderApply(250);
        scheduleVisualOrderApply(1000);
        scheduleVisualOrderApply(2500);
      } else {
        scheduleSavedOrderApply(250);
        scheduleSavedOrderApply(1000);
        scheduleSavedOrderApply(2500);
      }
    }
    highlightCurrentVideo();
    attachEndedHandler();
  }

  function highlightCurrentVideo() {
    if (state.sortedItems.length === 0) return;
    const rowByVideoId = new Map();
    for (const row of getPlaylistRows()) {
      const videoId = getVideoIdFromRow(row);
      if (videoId) rowByVideoId.set(videoId, row);
    }
    safelyDecorateRows(rowByVideoId);
  }

  ensurePanel();
  restoreSettings();
  restoreSortState();
  attachEndedHandler();
  document.addEventListener('yt-navigate-finish', onNavigationMaybeChanged);
  window.addEventListener('popstate', onNavigationMaybeChanged);
  setInterval(onNavigationMaybeChanged, 1000);
  setInterval(() => {
    if (!state.loading && state.badgesEnabled && state.sortedItems.length > 0) {
      applyVisualOrder();
    }
  }, 1500);
})();
