/**
 * background.js — service worker (Manifest V3)
 *
 * 役割:
 *  1. content script からのバッジ更新リクエストで拡張アイコンに件数を表示する
 *  2. 複数ウィッシュリスト横断スキャンをオーケストレーションする
 *
 * スキャンは専用ウィンドウ（可視・フォーカス）で行う。バックグラウンドタブ
 * （document.hidden）では Amazon のスクロール遅延ロードが発火せず、初期表示分
 * しか取得できないため。
 */

const SCAN = {
  status: 'idle', // idle | running | done
  lists: [], // [{ id, name, url, status, items, debug, error }]
  resultsTabId: null,
  scanWindowId: null,
  startedAt: 0,
};

function serializeScan() {
  return { status: SCAN.status, startedAt: SCAN.startedAt, lists: SCAN.lists };
}

function broadcast() {
  chrome.runtime.sendMessage({ type: 'crossScanUpdated' }).catch(() => {
    // 結果ページが未起動などで失敗しても無視
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'setBadge') {
    if (!sender.tab) return;
    const text = msg.count > 0 ? String(msg.count) : '';
    chrome.action.setBadgeText({ text, tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#FF9900', tabId: sender.tab.id });
    return;
  }

  if (msg.type === 'startCrossScan') {
    if (SCAN.status === 'running') {
      sendResponse({ ok: false, reason: 'running' });
      return;
    }
    startCrossScan(msg.lists || []);
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'getCrossScanState') {
    sendResponse(serializeScan());
    return;
  }
});

/** スキャンを中断し、専用ウィンドウを閉じる（デッドロック防止）。 */
function abortScan() {
  if (SCAN.status !== 'running') return;
  SCAN.status = 'idle';
  const wid = SCAN.scanWindowId;
  SCAN.scanWindowId = null;
  SCAN.resultsTabId = null;
  if (wid != null) chrome.windows.remove(wid).catch(() => {});
}

// 結果ページが閉じられたらスキャンを中断する
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === SCAN.resultsTabId) abortScan();
});

// スキャン専用ウィンドウがユーザーに閉じられたらスキャンを中断する
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === SCAN.scanWindowId) abortScan();
});

async function startCrossScan(lists) {
  SCAN.status = 'running';
  SCAN.startedAt = Date.now();
  SCAN.scanWindowId = null;
  SCAN.lists = lists.map((l) => ({
    id: l.id,
    name: l.name,
    url: l.url,
    status: 'pending', // pending | scanning | ok | error
    items: [],
    error: null,
  }));

  const resultsTab = await chrome.tabs.create({
    url: chrome.runtime.getURL('results/results.html'),
  });
  SCAN.resultsTabId = resultsTab.id;
  broadcast();

  let scanTabId = null;
  for (const entry of SCAN.lists) {
    if (SCAN.status !== 'running') break; // 結果ページ or スキャン窓が閉じられた
    entry.status = 'scanning';
    broadcast();
    try {
      if (SCAN.scanWindowId == null) {
        // 専用ウィンドウを作成（可視・フォーカス。これで遅延ロードが発火する）
        const win = await chrome.windows.create({
          url: entry.url,
          focused: true,
          width: 1000,
          height: 820,
        });
        SCAN.scanWindowId = win.id;
        scanTabId = win.tabs[0].id;
      } else {
        // 同じタブを次のリストへナビゲートする
        await chrome.tabs.update(scanTabId, { url: entry.url });
      }
      entry.items = await scanInTab(scanTabId);
      entry.status = 'ok';
    } catch (e) {
      entry.status = 'error';
      entry.error = String((e && e.message) || e);
    }
    broadcast();
  }

  if (SCAN.status === 'running') {
    SCAN.status = 'done';
  }
  const wid = SCAN.scanWindowId;
  SCAN.scanWindowId = null;
  SCAN.resultsTabId = null;
  if (wid != null) chrome.windows.remove(wid).catch(() => {});
  broadcast();
}

/** 指定タブで content script にスキャンを依頼し、セール商品を返す。 */
async function scanInTab(tabId) {
  await waitForTabComplete(tabId, 90000);
  await pingContentScript(tabId, 30000);
  const res = await withTimeout(
    chrome.tabs.sendMessage(tabId, { type: 'scanList' }),
    300000,
    'スキャンがタイムアウトしました'
  );
  if (!res) throw new Error('content script から応答がありませんでした');
  if (res.error) throw new Error(res.error);
  return res.items || [];
}

/** タブ（新規ロード or ナビゲート）の読み込み完了を待つ。 */
function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      fn(v);
    };
    // ナビゲート直後の "complete"（旧ページ）を誤検知しないよう、
    // onUpdated イベントのみで判定する（get フォールバックは使わない）
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') finish(resolve);
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(
      () => finish(reject, new Error('ページ読み込みがタイムアウトしました')),
      timeoutMs
    );
  });
}

/** content script が応答可能になるまで ping をリトライする。 */
async function pingContentScript(tabId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await chrome.tabs.sendMessage(tabId, { type: 'wspPing' });
      if (r && r.ok) return;
    } catch (e) {
      // content script 未準備 — リトライ
    }
    await sleep(500);
  }
  throw new Error('content script の準備がタイムアウトしました');
}
