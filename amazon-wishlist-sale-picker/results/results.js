/**
 * results.js — 横断セール確認の集約結果ページ
 *
 * background のスキャン状態を取得して描画し、
 * crossScanUpdated 通知のたびに再取得・再描画する。
 */

const STATUS_LABEL = {
  pending: '待機中',
  scanning: 'スキャン中…',
  ok: '完了',
  error: 'エラー',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
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

  card.appendChild(el('div', 'item-title', item.title || '(商品名不明)'));

  const meta = el('div', 'item-meta');
  if (item.discount > 0) {
    meta.appendChild(el('span', 'item-discount', `${item.discount}% OFF`));
  }
  if (item.price != null) {
    meta.appendChild(el('span', 'item-price', `¥${item.price.toLocaleString()}`));
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
    status.textContent = `${list.items.length} 件のセール`;
  } else {
    status.textContent = STATUS_LABEL[list.status] || list.status;
  }
  header.appendChild(status);
  section.appendChild(header);

  if (list.status === 'error') {
    section.appendChild(el('div', 'error-msg', `スキャンに失敗しました: ${list.error || '不明なエラー'}`));
  } else if (list.status === 'ok' && list.items.length === 0) {
    section.appendChild(el('div', 'empty-msg', 'セール中の商品はありません'));
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
  const summary = document.getElementById('summary');
  const container = document.getElementById('lists');
  container.textContent = '';

  if (!state || !state.lists || state.lists.length === 0) {
    summary.textContent = 'スキャン対象のリストがありません。';
    return;
  }

  const totalSale = state.lists
    .filter((l) => l.status === 'ok')
    .reduce((sum, l) => sum + l.items.length, 0);
  const doneCount = state.lists.filter((l) => l.status === 'ok' || l.status === 'error').length;

  if (state.status === 'running') {
    summary.textContent = `スキャン中… (${doneCount} / ${state.lists.length} リスト完了 / セール ${totalSale} 件)`;
  } else {
    const errorCount = state.lists.filter((l) => l.status === 'error').length;
    summary.textContent =
      `スキャン完了。${state.lists.length} リスト中 ${totalSale} 件のセール商品が見つかりました。` +
      (errorCount > 0 ? ` (${errorCount} リストでエラー)` : '');
  }

  state.lists.forEach((list) => container.appendChild(renderList(list)));
}

async function load() {
  try {
    const state = await chrome.runtime.sendMessage({ type: 'getCrossScanState' });
    render(state);
  } catch (e) {
    document.getElementById('summary').textContent = '状態を取得できませんでした。';
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'crossScanUpdated') load();
});

document.addEventListener('DOMContentLoaded', load);
