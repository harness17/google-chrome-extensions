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
  btn.textContent = 'リスト取得中…';

  const res = await chrome.tabs
    .sendMessage(tab.id, { type: 'enumerateLists' })
    .catch(() => null);
  if (!res || !res.lists || res.lists.length === 0) {
    hint.textContent = 'リストを取得できませんでした。ページを再読み込みしてください。';
    btn.textContent = '全リスト横断スキャン';
    btn.disabled = false;
    return;
  }

  const start = await chrome.runtime
    .sendMessage({ type: 'startCrossScan', lists: res.lists })
    .catch(() => null);
  if (start && start.ok) {
    btn.textContent = 'スキャン中…';
    hint.textContent =
      `${res.lists.length} 件のリストをスキャン中。スキャン用ウィンドウが開きます` +
      '（完了まで触らずにお待ちください）。結果は結果ページに表示されます。';
  } else if (start && start.reason === 'running') {
    hint.textContent = '既に横断スキャンが実行中です。';
    btn.textContent = 'スキャン中…';
  } else {
    hint.textContent = 'スキャンを開始できませんでした。';
    btn.textContent = '全リスト横断スキャン';
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
    btn.textContent = 'スキャン中…';
    hint.textContent = '横断スキャンを実行中です。結果ページを確認してください。';
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
    hint.textContent = 'サイドバーの全リストを横断してセール商品を集約します。';
    btn.addEventListener('click', () => runCrossScan(tab, btn, hint));
  } else {
    btn.disabled = true;
    hint.textContent = 'ウィッシュリストページを開いてから実行してください。';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  initCrossScan();
  // content script からの統計更新通知をリッスン
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'statsUpdated') {
      updateStats();
    }
  });
});
