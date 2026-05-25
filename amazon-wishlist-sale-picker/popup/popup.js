const { LANGUAGE_KEY, createTranslator, getLanguage, setLanguage } = window.__WSP_I18N__;

let currentLanguage = 'ja';
let t = createTranslator(currentLanguage);
let currentCrossScanState = 'unknown';

function applyStaticText() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.getElementById('language-label').textContent = t('languageLabel');
  const languageSelect = document.getElementById('language-select');
  languageSelect.value = currentLanguage;
  languageSelect.querySelector('option[value="ja"]').textContent = t('languageJa');
  languageSelect.querySelector('option[value="en"]').textContent = t('languageEn');
}

function applyCrossScanText() {
  const btn = document.getElementById('cross-scan-btn');
  const hint = document.getElementById('cross-hint');
  if (!btn || !hint) return;

  switch (currentCrossScanState) {
    case 'loadingLists':
      btn.textContent = t('crossScanLoadingLists');
      break;
    case 'scanning':
      btn.textContent = t('crossScanScanning');
      hint.textContent = t('crossScanRunningHint');
      break;
    case 'ready':
      btn.textContent = t('crossScanButton');
      hint.textContent = t('crossScanReadyHint');
      break;
    case 'notWishlist':
      btn.textContent = t('crossScanButton');
      hint.textContent = t('crossScanOpenWishlistHint');
      break;
    default:
      btn.textContent = t('crossScanButton');
      break;
  }
}

async function applyLanguage(language) {
  currentLanguage = language;
  t = createTranslator(currentLanguage);
  applyStaticText();
  applyCrossScanText();
}

async function updateStats() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'getStats' }).catch(() => null);
    if (!response) {
      document.getElementById('sale-count').textContent = '—';
      document.getElementById('max-discount').textContent = '—';
      return;
    }

    document.getElementById('sale-count').textContent = response.saleCount || 0;
    if (response.maxDiscount > 0) {
      document.getElementById('max-discount').textContent = response.maxDiscount;
    } else {
      document.getElementById('max-discount').textContent = '—';
    }
  } catch (e) {
    console.warn('[WSP popup] failed to get stats', e);
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function runCrossScan(tab, btn, hint) {
  btn.disabled = true;
  currentCrossScanState = 'loadingLists';
  btn.textContent = t('crossScanLoadingLists');

  const res = await chrome.tabs
    .sendMessage(tab.id, { type: 'enumerateLists' })
    .catch(() => null);
  if (!res || !res.lists || res.lists.length === 0) {
    hint.textContent = t('crossScanListError');
    btn.textContent = t('crossScanButton');
    currentCrossScanState = 'ready';
    btn.disabled = false;
    return;
  }

  const start = await chrome.runtime
    .sendMessage({ type: 'startCrossScan', lists: res.lists })
    .catch(() => null);
  if (start && start.ok) {
    currentCrossScanState = 'scanning';
    btn.textContent = t('crossScanScanning');
    hint.textContent = t('crossScanStarted', { count: res.lists.length });
  } else if (start && start.reason === 'running') {
    currentCrossScanState = 'scanning';
    hint.textContent = t('crossScanAlreadyRunning');
    btn.textContent = t('crossScanScanning');
  } else {
    hint.textContent = t('crossScanStartError');
    btn.textContent = t('crossScanButton');
    currentCrossScanState = 'ready';
    btn.disabled = false;
  }
}

async function initCrossScan() {
  const btn = document.getElementById('cross-scan-btn');
  const hint = document.getElementById('cross-hint');

  const state = await chrome.runtime
    .sendMessage({ type: 'getCrossScanState' })
    .catch(() => null);
  if (state && state.status === 'running') {
    btn.disabled = true;
    currentCrossScanState = 'scanning';
    btn.textContent = t('crossScanScanning');
    hint.textContent = t('crossScanRunningHint');
    return;
  }

  const tab = await getActiveTab();
  let onWishlist = false;
  if (tab?.id) {
    const ping = await chrome.tabs
      .sendMessage(tab.id, { type: 'wspPing' })
      .catch(() => null);
    onWishlist = !!(ping && ping.ok);
  }

  if (onWishlist) {
    btn.disabled = false;
    currentCrossScanState = 'ready';
    hint.textContent = t('crossScanReadyHint');
    btn.textContent = t('crossScanButton');
    btn.addEventListener('click', () => runCrossScan(tab, btn, hint));
  } else {
    btn.disabled = true;
    currentCrossScanState = 'notWishlist';
    hint.textContent = t('crossScanOpenWishlistHint');
    btn.textContent = t('crossScanButton');
  }
}

async function initLanguage() {
  await applyLanguage(await getLanguage());
  document.getElementById('language-select').addEventListener('change', async (event) => {
    await setLanguage(event.target.value);
    await applyLanguage(event.target.value);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[LANGUAGE_KEY]) {
      applyLanguage(changes[LANGUAGE_KEY].newValue);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await initLanguage();
  updateStats();
  initCrossScan();
  // content script からの統計更新通知をリッスン
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'statsUpdated') {
      updateStats();
    }
  });
});
