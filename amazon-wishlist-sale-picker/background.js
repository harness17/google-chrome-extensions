/**
 * background.js — service worker (Manifest V3)
 *
 * content script からのバッジ更新リクエストを受け取り、
 * 拡張アイコンにセール件数を表示する。
 */
chrome.runtime.onMessage.addListener((msg, sender) => {
  // content script からのメッセージのみ処理
  if (!sender.tab) return;

  if (msg.type === 'setBadge') {
    const text = msg.count > 0 ? String(msg.count) : '';
    chrome.action.setBadgeText({ text, tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#FF9900', tabId: sender.tab.id });
  }
});
