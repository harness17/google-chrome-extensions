(() => {
  const STORAGE_KEY = 'wsp_settings';

  // detectSale / parsePrice / SALE_KEYWORDS は shared/detect.js (manifest で先行読み込み) から取得
  const { detectSale, SALE_KEYWORDS } = window.__WSP__;

  const STATE = {
    filterEnabled: false,
    minDiscountPercent: 0,
    maxPrice: 0,
    saleCount: 0,
    fullyLoaded: false,
    isLoading: false,
    sortMethod: 'discount-desc', // discount-desc | discount-asc | price-asc | price-desc
  };

  function scanItems() {
    const items = document.querySelectorAll('#g-items li[data-id]');
    let saleCount = 0;
    items.forEach((item, index) => {
      // オリジナル順を初回のみ記録（lazy load で後から追加された分は次の番号で続く）
      if (!item.dataset.wspOriginalIndex) {
        item.dataset.wspOriginalIndex = String(index);
      }
      try {
        const { isSale, discountPercent, currentPrice } = detectSale(item);
        item.dataset.wspSale = isSale ? '1' : '0';
        item.dataset.wspDiscount = String(discountPercent);
        item.dataset.wspPrice = currentPrice != null ? String(currentPrice) : '';
        if (isSale) saleCount++;
      } catch (e) {
        console.warn('[WSP] detectSale failed for item', item, e);
        item.dataset.wspSale = '0';
        item.dataset.wspDiscount = '0';
        item.dataset.wspPrice = '';
      }
    });
    STATE.saleCount = saleCount;
    updateBadge(saleCount);
    updateSettingsPanel();
    notifyPopup();
    return saleCount;
  }

  function calculateStats() {
    const items = document.querySelectorAll('#g-items li[data-id]');
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
    const items = [...container.querySelectorAll(':scope > li[data-id]')];
    items.sort((a, b) => {
      const aSale = a.dataset.wspSale === '1';
      const bSale = b.dataset.wspSale === '1';
      if (aSale !== bSale) return aSale ? -1 : 1; // セール商品を先頭に

      if (aSale && bSale) {
        const aDiscount = parseInt(a.dataset.wspDiscount || '0', 10);
        const bDiscount = parseInt(b.dataset.wspDiscount || '0', 10);
        const aPrice = a.dataset.wspPrice !== '' ? parseInt(a.dataset.wspPrice || '0', 10) : null;
        const bPrice = b.dataset.wspPrice !== '' ? parseInt(b.dataset.wspPrice || '0', 10) : null;

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
    const items = [...container.querySelectorAll(':scope > li[data-id]')];
    items.sort((a, b) =>
      parseInt(a.dataset.wspOriginalIndex || '0', 10) - parseInt(b.dataset.wspOriginalIndex || '0', 10)
    );
    items.forEach((item) => container.appendChild(item));
  }

  function applyFilter() {
    const items = document.querySelectorAll('#g-items li[data-id]');
    items.forEach((item) => {
      const isSale = item.dataset.wspSale === '1';
      const discount = parseInt(item.dataset.wspDiscount || '0', 10);
      const price = item.dataset.wspPrice !== '' ? parseInt(item.dataset.wspPrice || '0', 10) : null;
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
          <span class="wsp-btn-label">セールのみ表示</span>
          (<span id="wsp-count">0</span>件)
        </button>
        <span id="wsp-status" class="wsp-status"></span>
      </div>
      <div class="wsp-filter-settings">
        <div class="wsp-setting-row">
          <label for="wsp-discount-input" class="wsp-setting-label">最低割引率:</label>
          <div class="wsp-setting-input-group">
            <input id="wsp-discount-input" type="range" min="0" max="90" step="5" value="0" class="wsp-range-input">
            <span id="wsp-discount-value" class="wsp-setting-value">0</span>
            <span class="wsp-setting-unit">%</span>
          </div>
        </div>
        <div class="wsp-setting-row">
          <label for="wsp-price-input" class="wsp-setting-label">最高価格:</label>
          <div class="wsp-setting-input-group">
            <input id="wsp-price-input" type="number" min="0" step="500" value="0" class="wsp-number-input" placeholder="0=制限なし">
            <span class="wsp-setting-unit">¥</span>
          </div>
        </div>
      </div>
      <div id="wsp-sort-controls" class="wsp-sort-controls" style="display: none;">
        <label for="wsp-sort-select" class="wsp-sort-label">ソート:</label>
        <select id="wsp-sort-select" class="wsp-sort-select">
          <option value="discount-desc">割引率: 高い順</option>
          <option value="discount-asc">割引率: 低い順</option>
          <option value="price-asc">価格: 安い順</option>
          <option value="price-desc">価格: 高い順</option>
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
          <div class="wsp-overlay-progress" id="wsp-overlay-progress">0件</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function updateOverlayProgress(count, total) {
    const el = document.getElementById('wsp-overlay-progress');
    if (!el) return;
    if (total && total > 0) {
      el.textContent = `${count} / ${total} 件 読み込み済み`;
    } else {
      el.textContent = `${count}件 読み込み済み`;
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
    const currentCount = document.querySelectorAll('#g-items li[data-id]').length;
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
        const added = mutations.some((m) =>
          Array.from(m.addedNodes).some(
            (n) =>
              n.nodeType === 1 &&
              (n.matches?.('li[data-id]') || n.querySelector?.('li[data-id]'))
          )
        );
        if (added) {
          if (settleTimer) clearTimeout(settleTimer);
          settleTimer = setTimeout(finish, settleMs);
        }
      });
      observer.observe(container, { childList: true });
      const timeoutTimer = setTimeout(finish, timeoutMs);
    });
  }

  async function loadAllItems(onProgress) {
    const MAX_ITERATIONS = 80;
    const STABLE_THRESHOLD = 2;

    const countItems = () => document.querySelectorAll('#g-items li[data-id]').length;
    let lastCount = countItems();
    let stableIterations = 0;

    onProgress?.(lastCount);

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const endMarker = document.querySelector('#endOfListMarker');
      if (endMarker) {
        endMarker.scrollIntoView({ block: 'end' });
      } else {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }

      await waitForNewItems(600, 80);

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
        label.textContent = '読み込み中...';
      } else if (STATE.filterEnabled) {
        label.textContent = '全件表示に戻す';
      } else {
        label.textContent = 'セールのみ表示';
      }
    }
    const countEl = document.getElementById('wsp-count');
    if (countEl) countEl.textContent = STATE.saleCount;

    const status = document.getElementById('wsp-status');
    if (!status) return;
    if (STATE.isLoading) {
      return;
    } else if (STATE.filterEnabled && STATE.saleCount === 0) {
      status.textContent = 'セール中の商品はありません';
    } else if (STATE.filterEnabled) {
      const parts = [];
      if (STATE.minDiscountPercent > 0) parts.push(`${STATE.minDiscountPercent}% 以上`);
      if (STATE.maxPrice > 0) parts.push(`¥${STATE.maxPrice.toLocaleString()} 以下`);
      status.textContent = parts.length > 0 ? `${parts.join(' / ')} で絞り込み中` : '';
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
      const hasNewItems = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (n) =>
            n.nodeType === 1 &&
            (n.matches?.('li[data-id]') || n.querySelector?.('li[data-id]'))
        )
      );
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
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'getStats') {
      const stats = calculateStats();
      sendResponse(stats);
    }
  });

  function init() {
    loadSettings().then(() => {
      watchItems();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
