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

document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  // content script からの統計更新通知をリッスン
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'statsUpdated') {
      updateStats();
    }
  });
});
