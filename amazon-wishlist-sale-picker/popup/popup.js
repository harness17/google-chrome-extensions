const STORAGE_KEY = 'wsp_settings';

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const s = data[STORAGE_KEY] || {};
  const v = Number(s.minDiscountPercent) || 0;
  document.getElementById('threshold').value = v;
  document.getElementById('threshold-val').textContent = v;
}

async function save(value) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { minDiscountPercent: value },
  });
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  const range = document.getElementById('threshold');
  const label = document.getElementById('threshold-val');

  range.addEventListener('input', (e) => {
    label.textContent = e.target.value;
  });
  range.addEventListener('change', (e) => {
    save(parseInt(e.target.value, 10));
  });
});
