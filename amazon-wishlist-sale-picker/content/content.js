(() => {
  const STORAGE_KEY = 'wsp_settings';

  // detectSale / parsePrice / SALE_KEYWORDS は shared/detect.js (manifest で先行読み込み) から取得
  const { detectSale, SALE_KEYWORDS } = window.__WSP__;

  const STATE = {
    filterEnabled: false,
    minDiscountPercent: 0,
    saleCount: 0,
    fullyLoaded: false,
    isLoading: false,
  };

  function scanItems() {
    const items = document.querySelectorAll('#g-items li[data-id]');
    let saleCount = 0;
    items.forEach((item) => {
      try {
        const { isSale, discountPercent } = detectSale(item);
        item.dataset.wspSale = isSale ? '1' : '0';
        item.dataset.wspDiscount = String(discountPercent);
        if (isSale) saleCount++;
      } catch (e) {
        console.warn('[WSP] detectSale failed for item', item, e);
      }
    });
    STATE.saleCount = saleCount;
    return saleCount;
  }

  function applyFilter() {
    const items = document.querySelectorAll('#g-items li[data-id]');
    items.forEach((item) => {
      const isSale = item.dataset.wspSale === '1';
      const discount = parseInt(item.dataset.wspDiscount || '0', 10);
      let hidden = false;
      if (STATE.filterEnabled) {
        if (!isSale) {
          hidden = true;
        } else if (STATE.minDiscountPercent > 0 && discount < STATE.minDiscountPercent) {
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
      <button id="wsp-toggle-btn" class="wsp-btn" type="button">
        <span class="wsp-btn-label">セールのみ表示</span>
        (<span id="wsp-count">0</span>件)
      </button>
      <span id="wsp-status" class="wsp-status"></span>
    `;
    target.appendChild(container);

    document.getElementById('wsp-toggle-btn').addEventListener('click', onToggleClick);
    return true;
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
    applyFilter();
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
    return null;
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
    if (STATE.isLoading) {
      label.textContent = '読み込み中...';
    } else if (STATE.filterEnabled) {
      label.textContent = '全件表示に戻す';
    } else {
      label.textContent = 'セールのみ表示';
    }
    document.getElementById('wsp-count').textContent = STATE.saleCount;

    const status = document.getElementById('wsp-status');
    if (!status) return;
    if (STATE.isLoading) {
      return;
    } else if (STATE.filterEnabled && STATE.saleCount === 0) {
      status.textContent = 'セール中の商品はありません';
    } else if (STATE.filterEnabled && STATE.minDiscountPercent > 0) {
      status.textContent = `${STATE.minDiscountPercent}% 以上の割引で絞り込み中`;
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
      applyFilter();
      updateUI();
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
