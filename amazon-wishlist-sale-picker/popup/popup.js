const STORAGE_KEY = 'wsp_settings';

function formatPrice(value) {
  if (!value || value <= 0) return '無制限';
  return `¥${Number(value).toLocaleString('ja-JP')}`;
}

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const s = data[STORAGE_KEY] || {};

  const discount = Number(s.minDiscountPercent) || 0;
  document.getElementById('threshold').value = discount;
  document.getElementById('threshold-val').textContent = discount;

  const maxPrice = Number(s.maxPrice) || 0;
  document.getElementById('max-price').value = maxPrice;
  document.getElementById('max-price-val').textContent = formatPrice(maxPrice);
}

async function save() {
  const minDiscountPercent = parseInt(document.getElementById('threshold').value, 10);
  const maxPrice = parseInt(document.getElementById('max-price').value, 10) || 0;
  await chrome.storage.local.set({
    [STORAGE_KEY]: { minDiscountPercent, maxPrice },
  });
}

document.addEventListener('DOMContentLoaded', () => {
  load();

  const range = document.getElementById('threshold');
  const rangeVal = document.getElementById('threshold-val');
  range.addEventListener('input', (e) => {
    rangeVal.textContent = e.target.value;
  });
  range.addEventListener('change', () => save());

  const priceInput = document.getElementById('max-price');
  const priceVal = document.getElementById('max-price-val');
  priceInput.addEventListener('input', (e) => {
    priceVal.textContent = formatPrice(e.target.value);
  });
  priceInput.addEventListener('change', () => save());
});
