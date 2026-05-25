(() => {
  const STORAGE_KEY = 'wsp_settings';

  // detectSale / parsePrice / SALE_KEYWORDS は shared/detect.js (manifest で先行読み込み) から取得
  const { detectSale, SALE_KEYWORDS } = window.__WSP__;
  const { LANGUAGE_KEY, createTranslator, getLanguage } = window.__WSP_I18N__;
  let t = createTranslator('ja');

  const STATE = {
    filterEnabled: false,
    minDiscountPercent: 0,
    maxPrice: 0,
    saleCount: 0,
    fullyLoaded: false,
    isLoading: false,
    sortMethod: 'discount-desc', // discount-desc | discount-asc | price-asc | price-desc
    language: 'ja',
  };

  const ITEM_SELECTOR = [
    '#g-items li[id^="item_"]',
    '#g-items li[data-itemid]',
    '#g-items li[data-reposition-action-params]',
    '#g-items li[data-id]',
  ].join(', ');

  function isWishlistItem(node) {
    if (!node || !node.matches?.('li')) return false;
    return !!(
      node.querySelector('[id^="itemPrice_"], .a-price .a-offscreen, .itemPriceDrop, [id^="itemName_"]') ||
      node.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]') ||
      node.querySelector('img[src], img[data-a-hires]')
    );
  }

  function getWishlistItems(root = document) {
    return [...root.querySelectorAll(ITEM_SELECTOR)].filter(isWishlistItem);
  }

  function containsWishlistItem(node) {
    if (!node || node.nodeType !== 1) return false;
    return isWishlistItem(node) || !!node.querySelector?.(ITEM_SELECTOR);
  }

  function scanItems() {
    const items = getWishlistItems();
    let saleCount = 0;
    items.forEach((item, index) => {
      // オリジナル順を初回のみ記録（lazy load で後から追加された分は次の番号で続く）
      if (!item.dataset.wspOriginalIndex) {
        item.dataset.wspOriginalIndex = String(index);
      }
      try {
        const { isSale, discountPercent, currentPrice, currencySymbol } = detectSale(item);
        item.dataset.wspSale = isSale ? '1' : '0';
        item.dataset.wspDiscount = String(discountPercent);
        item.dataset.wspPrice = currentPrice != null ? String(currentPrice) : '';
        item.dataset.wspCurrency = currencySymbol || '';
        if (isSale) saleCount++;
      } catch (e) {
        console.warn('[WSP] detectSale failed for item', item, e);
        item.dataset.wspSale = '0';
        item.dataset.wspDiscount = '0';
        item.dataset.wspPrice = '';
        item.dataset.wspCurrency = '';
      }
    });
    STATE.saleCount = saleCount;
    updateBadge(saleCount);
    updateSettingsPanel();
    notifyPopup();
    return saleCount;
  }

  function calculateStats() {
    const items = getWishlistItems();
    let maxDiscount = 0;
    items.forEach((item) => {
      if (item.dataset.wspSale === '1') {
        const discount = parseInt(item.dataset.wspDiscount || '0', 10);
        maxDiscount = Math.max(maxDiscount, discount);
      }
    });
    return { saleCount: STATE.saleCount, maxDiscount };
  }

  function notifyPopup() {
    try {
      const stats = calculateStats();
      chrome.runtime.sendMessage({ type: 'statsUpdated', ...stats }).catch(() => {
        // popup が未開状態で失敗しても無視
      });
    } catch (e) {
      // error 無視
    }
  }

  function updateBadge(count) {
    try {
      chrome.runtime.sendMessage({ type: 'setBadge', count });
    } catch (e) {
      // background が未起動などで失敗しても無視
    }
  }

  function sortItems() {
    const container = document.querySelector('#g-items');
    if (!container) return;
    const items = getWishlistItems(container);
    items.sort((a, b) => {
      const aSale = a.dataset.wspSale === '1';
      const bSale = b.dataset.wspSale === '1';
      if (aSale !== bSale) return aSale ? -1 : 1; // セール商品を先頭に

      if (aSale && bSale) {
        const aDiscount = parseInt(a.dataset.wspDiscount || '0', 10);
        const bDiscount = parseInt(b.dataset.wspDiscount || '0', 10);
        const aPrice = a.dataset.wspPrice !== '' ? Number(a.dataset.wspPrice || '0') : null;
        const bPrice = b.dataset.wspPrice !== '' ? Number(b.dataset.wspPrice || '0') : null;

        switch (STATE.sortMethod) {
          case 'discount-asc':
            return aDiscount - bDiscount;
          case 'price-asc':
            if (aPrice == null) return 1;
            if (bPrice == null) return -1;
            return aPrice - bPrice;
          case 'price-desc':
            if (aPrice == null) return 1;
            if (bPrice == null) return -1;
            return bPrice - aPrice;
          case 'discount-desc':
          default:
            return bDiscount - aDiscount;
        }
      }
      return parseInt(a.dataset.wspOriginalIndex || '0', 10) - parseInt(b.dataset.wspOriginalIndex || '0', 10);
    });
    items.forEach((item) => container.appendChild(item));
  }

  function restoreOrder() {
    const container = document.querySelector('#g-items');
    if (!container) return;
    const items = getWishlistItems(container);
    items.sort((a, b) =>
      parseInt(a.dataset.wspOriginalIndex || '0', 10) - parseInt(b.dataset.wspOriginalIndex || '0', 10)
    );
    items.forEach((item) => container.appendChild(item));
  }

  function applyFilter() {
    const items = getWishlistItems();
    items.forEach((item) => {
      const isSale = item.dataset.wspSale === '1';
      const discount = parseInt(item.dataset.wspDiscount || '0', 10);
      const price = item.dataset.wspPrice !== '' ? Number(item.dataset.wspPrice || '0') : null;
      let hidden = false;
      if (STATE.filterEnabled) {
        if (!isSale) {
          hidden = true;
        } else if (STATE.minDiscountPercent > 0 && discount < STATE.minDiscountPercent) {
          hidden = true;
        } else if (STATE.maxPrice > 0 && price != null && price > STATE.maxPrice) {
          hidden = true;
        }
      }
      item.classList.toggle('wsp-hidden', hidden);
    });
  }

  function findInjectionTarget() {
    return (
      document.querySelector('#profile-list-name')?.closest('#wl-list-info') ||
      document.querySelector('#wl-list-info') ||
      document.querySelector('#g-items')?.parentElement ||
      null
    );
  }

  function injectControls() {
    if (document.getElementById('wsp-controls')) return true;
    const target = findInjectionTarget();
    if (!target) return false;

    const container = document.createElement('div');
    container.id = 'wsp-controls';
    container.innerHTML = `
      <div class="wsp-controls-row">
        <button id="wsp-toggle-btn" class="wsp-btn" type="button">
          <span class="wsp-btn-label"></span>
          (<span id="wsp-count">0</span><span id="wsp-count-unit"></span>)
        </button>
        <span id="wsp-status" class="wsp-status"></span>
      </div>
      <div class="wsp-filter-settings">
        <div class="wsp-setting-row">
          <label for="wsp-discount-input" class="wsp-setting-label" data-wsp-i18n="minDiscount"></label>
          <div class="wsp-setting-input-group">
            <input id="wsp-discount-input" type="range" min="0" max="90" step="5" value="0" class="wsp-range-input">
            <span id="wsp-discount-value" class="wsp-setting-value">0</span>
            <span class="wsp-setting-unit">%</span>
          </div>
        </div>
        <div class="wsp-setting-row">
          <label for="wsp-price-input" class="wsp-setting-label" data-wsp-i18n="maxPrice"></label>
          <div class="wsp-setting-input-group">
            <input id="wsp-price-input" type="number" min="0" step="500" value="0" class="wsp-number-input">
            <span class="wsp-setting-unit">¥</span>
          </div>
        </div>
      </div>
      <div id="wsp-sort-controls" class="wsp-sort-controls" style="display: none;">
        <label for="wsp-sort-select" class="wsp-sort-label" data-wsp-i18n="sort"></label>
        <select id="wsp-sort-select" class="wsp-sort-select">
          <option value="discount-desc" data-wsp-i18n="sortDiscountDesc"></option>
          <option value="discount-asc" data-wsp-i18n="sortDiscountAsc"></option>
          <option value="price-asc" data-wsp-i18n="sortPriceAsc"></option>
          <option value="price-desc" data-wsp-i18n="sortPriceDesc"></option>
        </select>
      </div>
    `;
    target.appendChild(container);

    document.getElementById('wsp-toggle-btn').addEventListener('click', onToggleClick);

    const discountInput = document.getElementById('wsp-discount-input');
    const discountValue = document.getElementById('wsp-discount-value');
    discountInput.addEventListener('input', (e) => {
      discountValue.textContent = e.target.value;
    });
    discountInput.addEventListener('change', () => saveSettingsFromUI());

    const priceInput = document.getElementById('wsp-price-input');
    priceInput.addEventListener('change', () => saveSettingsFromUI());

    document.getElementById('wsp-sort-select').addEventListener('change', (e) => {
      STATE.sortMethod = e.target.value;
      if (STATE.filterEnabled) {
        sortItems();
      }
    });

    // 初期値をUIに反映
    discountInput.value = STATE.minDiscountPercent;
    discountValue.textContent = STATE.minDiscountPercent;
    priceInput.value = STATE.maxPrice;
    updateLanguageText();
    updateUI();

    return true;
  }

  function saveSettingsFromUI() {
    const minDiscountPercent = parseInt(document.getElementById('wsp-discount-input').value, 10);
    const maxPrice = parseInt(document.getElementById('wsp-price-input').value, 10) || 0;
    STATE.minDiscountPercent = minDiscountPercent;
    STATE.maxPrice = maxPrice;
    chrome.storage.local.set({
      [STORAGE_KEY]: { minDiscountPercent, maxPrice },
    }).catch((e) => console.warn('[WSP] failed to save settings', e));
  }

  function updateSettingsPanel() {
    // 設定UIは常に表示されているので不要
  }

  function updateLanguageText() {
    document.querySelectorAll('#wsp-controls [data-wsp-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.wspI18n);
    });
    const priceInput = document.getElementById('wsp-price-input');
    if (priceInput) priceInput.placeholder = t('noLimitPlaceholder');
    const countUnit = document.getElementById('wsp-count-unit');
    if (countUnit) countUnit.textContent = t('itemCountSuffix');

    const overlayTitle = document.querySelector('#wsp-overlay .wsp-overlay-title');
    if (overlayTitle) overlayTitle.textContent = t('overlayTitle');
    const overlaySubtitle = document.querySelector('#wsp-overlay .wsp-overlay-subtitle');
    if (overlaySubtitle) overlaySubtitle.textContent = t('overlaySubtitle');
  }

  async function onToggleClick() {
    if (STATE.isLoading) return;

    if (!STATE.filterEnabled && !STATE.fullyLoaded) {
      STATE.isLoading = true;
      const originalScrollY = window.scrollY;
      const totalEstimate = getTotalItemCount();
      showOverlay();
      updateOverlayProgress(0, totalEstimate);
      updateUI();
      try {
        await loadAllItems((count) => {
          updateOverlayProgress(count, totalEstimate);
        });
      } finally {
        window.scrollTo(0, originalScrollY);
        STATE.isLoading = false;
        STATE.fullyLoaded = true;
        scanItems();
        hideOverlay();
      }
    }

    STATE.filterEnabled = !STATE.filterEnabled;
    if (STATE.filterEnabled) {
      sortItems();
      const sortControls = document.getElementById('wsp-sort-controls');
      if (sortControls) sortControls.style.display = 'flex';
    } else {
      restoreOrder();
      const sortControls = document.getElementById('wsp-sort-controls');
      if (sortControls) sortControls.style.display = 'none';
    }
    applyFilter();
    updateSettingsPanel();
    updateUI();
  }

  function showOverlay() {
    if (document.getElementById('wsp-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'wsp-overlay';
    overlay.innerHTML = `
      <div class="wsp-overlay-card">
        <div class="wsp-spinner"></div>
        <div class="wsp-overlay-text">
          <div class="wsp-overlay-title">全件読み込み中</div>
          <div class="wsp-overlay-subtitle">セール判定のため、ウィッシュリストを末尾までスキャンしています</div>
          <div class="wsp-overlay-progress" id="wsp-overlay-progress"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    updateLanguageText();
  }

  function updateOverlayProgress(count, total) {
    const el = document.getElementById('wsp-overlay-progress');
    if (!el) return;
    if (total && total > 0) {
      el.textContent = t('overlayProgressWithTotal', { count, total });
    } else {
      el.textContent = t('overlayProgress', { count });
    }
  }

  function hideOverlay() {
    document.getElementById('wsp-overlay')?.remove();
  }

  function getTotalItemCount() {
    const candidates = [
      document.querySelector('#wl-list-info'),
      document.querySelector('#profile-list-name')?.parentElement,
      document.querySelector('#g-items')?.parentElement,
    ];
    for (const el of candidates) {
      if (!el) continue;
      const text = (el.textContent || '').slice(0, 4000);
      const m = text.match(/商品数[:：]?\s*([\d,]+)\s*件?/);
      if (m) {
        const n = parseInt(m[1].replace(/,/g, ''), 10);
        if (n > 0) return n;
      }
    }
    // テキスト解析が外れた場合: 現在読み込まれている li 件数をフォールバックとして返す
    const currentCount = getWishlistItems().length;
    return currentCount > 0 ? currentCount : null;
  }

  function waitForNewItems(timeoutMs = 800, settleMs = 80) {
    return new Promise((resolve) => {
      const container = document.querySelector('#g-items');
      if (!container) {
        setTimeout(resolve, timeoutMs);
        return;
      }
      let settled = false;
      let settleTimer = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timeoutTimer);
        clearTimeout(settleTimer);
        resolve();
      };
      const observer = new MutationObserver((mutations) => {
        const added = mutations.some((m) => Array.from(m.addedNodes).some(containsWishlistItem));
        if (added) {
          if (settleTimer) clearTimeout(settleTimer);
          settleTimer = setTimeout(finish, settleMs);
        }
      });
      observer.observe(container, { childList: true });
      const timeoutTimer = setTimeout(finish, timeoutMs);
    });
  }

  /** ページが可視（document.hidden === false）になるまで待つ。 */
  function waitUntilVisible() {
    if (!document.hidden) return Promise.resolve();
    return new Promise((resolve) => {
      const onVis = () => {
        if (!document.hidden) {
          document.removeEventListener('visibilitychange', onVis);
          resolve();
        }
      };
      document.addEventListener('visibilitychange', onVis);
    });
  }

  async function loadAllItems(onProgress, opts = {}) {
    const MAX_ITERATIONS = 80;
    const STABLE_THRESHOLD = 2;
    // 可視タブでも初動に少し余裕を持たせる
    const newItemTimeout = opts.headless ? 1500 : 600;
    const newItemSettle = opts.headless ? 250 : 80;

    const countItems = () => getWishlistItems().length;
    let lastCount = countItems();
    let stableIterations = 0;

    onProgress?.(lastCount);

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // 遅延ロードは可視状態でないと発火しないため、隠れていたら可視に戻るまで待つ
      if (opts.headless) await waitUntilVisible();

      const endMarker = document.querySelector('#endOfListMarker');
      if (endMarker) {
        endMarker.scrollIntoView({ block: 'end' });
      } else {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }

      await waitForNewItems(newItemTimeout, newItemSettle);

      const currentCount = countItems();
      onProgress?.(currentCount);

      if (currentCount === lastCount) {
        stableIterations++;
        if (stableIterations >= STABLE_THRESHOLD) break;
      } else {
        stableIterations = 0;
        lastCount = currentCount;
      }
    }
  }

  function updateUI() {
    const btn = document.getElementById('wsp-toggle-btn');
    if (!btn) return;
    btn.classList.toggle('wsp-active', STATE.filterEnabled);
    btn.classList.toggle('wsp-loading', STATE.isLoading);
    btn.disabled = STATE.isLoading;

    const label = btn.querySelector('.wsp-btn-label');
    if (label) {
      if (STATE.isLoading) {
        label.textContent = t('loading');
      } else if (STATE.filterEnabled) {
        label.textContent = t('showAllItems');
      } else {
        label.textContent = t('showSaleOnly');
      }
    }
    const countEl = document.getElementById('wsp-count');
    if (countEl) countEl.textContent = STATE.saleCount;

    const status = document.getElementById('wsp-status');
    if (!status) return;
    if (STATE.isLoading) {
      return;
    } else if (STATE.filterEnabled && STATE.saleCount === 0) {
      status.textContent = t('noSaleItems');
    } else if (STATE.filterEnabled) {
      const parts = [];
      if (STATE.minDiscountPercent > 0) {
        parts.push(t('filterMinDiscount', { value: STATE.minDiscountPercent }));
      }
      if (STATE.maxPrice > 0) {
        parts.push(t('filterMaxPrice', { value: STATE.maxPrice.toLocaleString() }));
      }
      status.textContent = parts.length > 0 ? t('filtering', { filters: parts.join(' / ') }) : '';
    } else {
      status.textContent = '';
    }
  }

  let scanTimer = null;
  function scheduleRescan() {
    if (STATE.isLoading) return;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanItems();
      injectControls();
      applyFilter();
      updateUI();
    }, 200);
  }

  async function loadSettings() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const s = data[STORAGE_KEY] || {};
      STATE.minDiscountPercent = Number(s.minDiscountPercent) || 0;
      STATE.maxPrice = Number(s.maxPrice) || 0;
    } catch (e) {
      console.warn('[WSP] failed to load settings', e);
    }
  }

  async function loadLanguage() {
    STATE.language = await getLanguage();
    t = createTranslator(STATE.language);
  }

  function watchItems() {
    const itemsContainer = document.querySelector('#g-items');
    if (!itemsContainer) {
      const bodyObs = new MutationObserver(() => {
        if (document.querySelector('#g-items')) {
          bodyObs.disconnect();
          watchItems();
        }
      });
      bodyObs.observe(document.body, { childList: true, subtree: true });
      return;
    }

    scanItems();
    injectControls();
    applyFilter();
    updateUI();

    const observer = new MutationObserver((mutations) => {
      const hasNewItems = mutations.some((m) => Array.from(m.addedNodes).some(containsWishlistItem));
      if (hasNewItems) scheduleRescan();
    });
    observer.observe(itemsContainer, { childList: true });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      const s = changes[STORAGE_KEY].newValue || {};
      STATE.minDiscountPercent = Number(s.minDiscountPercent) || 0;
      STATE.maxPrice = Number(s.maxPrice) || 0;
      applyFilter();
      updateSettingsPanel();
      updateUI();
    }
    if (area === 'local' && changes[LANGUAGE_KEY]) {
      STATE.language = changes[LANGUAGE_KEY].newValue || 'ja';
      t = createTranslator(STATE.language);
      updateLanguageText();
      updateUI();
    }
  });

  // --- 横断セール確認（複数ウィッシュリスト横断スキャン）用 ---

  /**
   * サイドバー・各種リンクから、ユーザーが持つウィッシュリストを列挙する。
   * @returns {{id: string, name: string, url: string}[]}
   */
  function enumerateLists() {
    const links = document.querySelectorAll(
      'a[href*="/hz/wishlist/ls/"], a[href*="/hz/wishlist/genericItemsPage/"]'
    );
    const map = new Map();
    links.forEach((a) => {
      const m = (a.href || '').match(/\/hz\/wishlist\/(?:ls|genericItemsPage)\/([A-Za-z0-9]+)/);
      if (!m) return;
      const id = m[1];
      const name = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (!name || name.length > 80) return;
      if (!map.has(id)) {
        map.set(id, { id, name, url: `${location.origin}/hz/wishlist/ls/${id}` });
      }
    });
    // サイドバーに current list が別マークアップで出る場合に備え、URL から確実に追加する
    const cur = location.pathname.match(
      /\/hz\/wishlist\/(?:ls|genericItemsPage)\/([A-Za-z0-9]+)/
    );
    if (cur) {
      const id = cur[1];
      if (!map.has(id)) {
        const curName =
          (document.querySelector('#profile-list-name')?.textContent || '').trim() ||
          t('currentList');
        map.set(id, { id, name: curName, url: `${location.origin}/hz/wishlist/ls/${id}` });
      }
    }
    return [...map.values()];
  }

  /** セール判定済みの商品から、結果ページ表示用のデータを収集する。 */
  function collectSaleItems() {
    const items = getWishlistItems();
    const result = [];
    items.forEach((item) => {
      if (item.dataset.wspSale !== '1') return;
      const link =
        item.querySelector('a[id^="itemName_"]') ||
        item.querySelector('h2 a, h3 a, .a-link-normal[title]');
      const img = item.querySelector('img');
      const priceStr = item.dataset.wspPrice;
      result.push({
        title: (link?.textContent || link?.getAttribute('title') || t('unknownItemTitle')).trim(),
        url: link?.href || '',
        image: img?.src || '',
        discount: parseInt(item.dataset.wspDiscount || '0', 10),
        price: priceStr !== '' && priceStr != null ? Number(priceStr) : null,
        currency: item.dataset.wspCurrency || '',
      });
    });
    return result;
  }

  /** #g-items が現れるまで待つ。 */
  function waitForContainer(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('#g-items')) return resolve();
      const obs = new MutationObserver(() => {
        if (document.querySelector('#g-items')) {
          obs.disconnect();
          clearTimeout(timer);
          resolve();
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        obs.disconnect();
        reject(new Error(t('productListNotFound')));
      }, timeoutMs);
    });
  }

  let headlessScanPromise = null;
  /** バックグラウンドタブで全件読み込み + セール判定し、セール商品を返す。 */
  async function runHeadlessScan() {
    if (headlessScanPromise) return headlessScanPromise;
    headlessScanPromise = (async () => {
      await waitForContainer();
      // スキャン用ウィンドウに進捗オーバーレイを表示（次のリストへ遷移するまで出したまま）
      showOverlay();
      const totalEstimate = getTotalItemCount();
      updateOverlayProgress(0, totalEstimate);
      await loadAllItems(
        (count) => updateOverlayProgress(count, totalEstimate),
        { headless: true }
      );
      scanItems();
      return { items: collectSaleItems() };
    })();
    try {
      return await headlessScanPromise;
    } finally {
      headlessScanPromise = null;
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'getStats') {
      sendResponse(calculateStats());
      return;
    }
    if (msg.type === 'wspPing') {
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'enumerateLists') {
      try {
        sendResponse({ lists: enumerateLists() });
      } catch (e) {
        sendResponse({ lists: [], error: String(e) });
      }
      return;
    }
    if (msg.type === 'scanList') {
      runHeadlessScan()
        .then((r) => sendResponse(r))
        .catch((e) => sendResponse({ error: String((e && e.message) || e) }));
      return true; // 非同期レスポンス
    }
  });

  function init() {
    Promise.all([loadSettings(), loadLanguage()]).then(() => {
      watchItems();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
