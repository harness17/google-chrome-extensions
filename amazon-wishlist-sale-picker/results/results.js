/**
 * results.js — 横断セール確認の集約結果ページ
 *
 * background のスキャン状態を取得して描画し、
 * crossScanUpdated 通知のたびに再取得・再描画する。
 */

const { LANGUAGE_KEY, createTranslator, getLanguage } = window.__WSP_I18N__;

let currentLanguage = 'ja';
let t = createTranslator(currentLanguage);
let currentState = null;

function getStatusLabel(status) {
  const labels = {
    pending: t('statusPending'),
    scanning: t('statusScanning'),
    ok: t('statusOk'),
    error: t('statusError'),
  };
  return labels[status] || status;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatPrice(item) {
  const symbol = item.currency || '¥';
  return `${symbol}${item.price.toLocaleString()}`;
}

function renderItem(item) {
  const card = el('a', 'item-card');
  card.href = item.url || '#';
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  if (item.image) {
    const img = el('img', 'item-image');
    img.src = item.image;
    img.alt = '';
    card.appendChild(img);
  }

  card.appendChild(el('div', 'item-title', item.title || t('unknownItemTitle')));

  const meta = el('div', 'item-meta');
  if (item.discount > 0) {
    meta.appendChild(el('span', 'item-discount', `${item.discount}% OFF`));
  }
  if (item.price != null) {
    meta.appendChild(el('span', 'item-price', formatPrice(item)));
  }
  card.appendChild(meta);
  return card;
}

function renderList(list) {
  const section = el('section', 'list-section');

  const header = el('div', 'list-header');
  header.appendChild(el('span', 'list-name', list.name));
  const status = el('span', `list-status status-${list.status}`);
  if (list.status === 'ok') {
    status.textContent = t('listSaleCount', { count: list.items.length });
  } else {
    status.textContent = getStatusLabel(list.status);
  }
  header.appendChild(status);
  section.appendChild(header);

  if (list.status === 'error') {
    section.appendChild(
      el('div', 'error-msg', t('scanFailed', { error: list.error || t('unknownError') }))
    );
  } else if (list.status === 'ok' && list.items.length === 0) {
    section.appendChild(el('div', 'empty-msg', t('noSaleItems')));
  } else if (list.status === 'ok') {
    const grid = el('div', 'item-grid');
    list.items
      .slice()
      .sort((a, b) => b.discount - a.discount)
      .forEach((item) => grid.appendChild(renderItem(item)));
    section.appendChild(grid);
  }
  return section;
}

function render(state) {
  currentState = state;
  const summary = document.getElementById('summary');
  const container = document.getElementById('lists');
  container.textContent = '';

  if (!state || !state.lists || state.lists.length === 0) {
    summary.textContent = t('noLists');
    return;
  }

  const totalSale = state.lists
    .filter((l) => l.status === 'ok')
    .reduce((sum, l) => sum + l.items.length, 0);
  const doneCount = state.lists.filter((l) => l.status === 'ok' || l.status === 'error').length;

  if (state.status === 'running') {
    summary.textContent = t('scanRunningSummary', {
      done: doneCount,
      total: state.lists.length,
      sale: totalSale,
    });
  } else {
    const errorCount = state.lists.filter((l) => l.status === 'error').length;
    summary.textContent =
      t('scanCompleteSummary', { total: state.lists.length, sale: totalSale }) +
      (errorCount > 0 ? t('scanErrorSuffix', { count: errorCount }) : '');
  }

  state.lists.forEach((list) => container.appendChild(renderList(list)));
}

async function load() {
  try {
    const state = await chrome.runtime.sendMessage({ type: 'getCrossScanState' });
    render(state);
  } catch (e) {
    document.getElementById('summary').textContent = t('stateLoadError');
  }
}

function applyStaticText() {
  document.documentElement.lang = currentLanguage;
  document.title = t('resultsPageTitle');
  document.getElementById('page-title').textContent = t('resultsTitle');
  if (!currentState) {
    document.getElementById('summary').textContent = t('preparingScan');
  }
}

async function applyLanguage(language) {
  currentLanguage = language;
  t = createTranslator(currentLanguage);
  applyStaticText();
  if (currentState) render(currentState);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'crossScanUpdated') load();
});

document.addEventListener('DOMContentLoaded', async () => {
  await applyLanguage(await getLanguage());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[LANGUAGE_KEY]) {
      applyLanguage(changes[LANGUAGE_KEY].newValue);
    }
  });
  load();
});
