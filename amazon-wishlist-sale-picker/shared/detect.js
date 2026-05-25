/**
 * shared/detect.js — detectSale() の唯一の実装（Single Source of Truth）
 *
 * ブラウザ (content script として manifest で先に読む):
 *   → window.__WSP__ に { detectSale, parsePrice, SALE_KEYWORDS } を公開
 *
 * Node.js (verify-detect.mjs):
 *   → createRequire('./shared/detect.js') で require して使う
 *
 * ⚠️ このファイルを変更したら必ず以下で回帰検証すること:
 *   node verify-detect.mjs
 */
(function (root) {
  'use strict';

  const SALE_KEYWORDS =
    /タイムセール|プライム会員価格|プライム限定価格|プライムデー|セール対象|過去価格[:：]|%\s*OFF|％\s*OFF|limited\s*time\s*deal|prime\s+(?:member\s+)?price|prime\s+exclusive|deal\b|was[:：]|list\s+price[:：]|price\s+dropped|price\s+drop|%\s*off/i;

  function parsePrice(text) {
    if (!text) return null;
    const normalized = text.replace(/[,\s]/g, '');
    const m = normalized.match(/[¥￥$£€]?([0-9]+(?:\.[0-9]{1,2})?)/);
    if (!m) return null;
    const value = parseFloat(m[1]);
    return Number.isInteger(value) ? value : value;
  }

  function parseCurrencySymbol(text) {
    if (!text) return null;
    const m = text.match(/[¥￥$£€]/);
    return m ? m[0] : null;
  }

  function collectSignalText(root) {
    const parts = [root.textContent || ''];
    root.querySelectorAll('[aria-label], [title], [data-a-strike], [data-a-color], [data-csa-c-content-id]').forEach(
      (el) => {
        ['aria-label', 'title', 'data-a-strike', 'data-a-color', 'data-csa-c-content-id'].forEach(
          (attr) => {
            const value = el.getAttribute(attr);
            if (value) parts.push(value);
          }
        );
      }
    );
    return parts.join(' ').slice(0, 4000);
  }

  function parseDiscountPercent(text) {
    if (!text) return 0;
    const m =
      text.match(/(\d+)\s*[%％]\s*(?:off|OFF)?/i) ||
      text.match(/(?:save|saving|discount|dropped)\s*(?:of\s*)?(\d+)\s*[%％]/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  /**
   * @param {Element} item - li[data-id] 要素
   * @returns {{ isSale: boolean, discountPercent: number, originalPrice: number|null, currentPrice: number|null, currencySymbol: string|null }}
   */
  function detectSale(item) {
    const dealBadge = item.querySelector('.wl-deal-rich-badge');
    const dealBadgeLabel = item.querySelector('.wl-deal-rich-badge-label');
    const dealStrikePrice = item.querySelector(
      '.wl-deal-price.a-text-strike, .wl-deal-price-and-striked-price .a-text-strike'
    );
    const priceDrop = item.querySelector('.itemPriceDrop, [id^="itemPriceDrop_"]');
    const genericStrikeOffscreen = item.querySelector('.a-text-price .a-offscreen');
    const genericStrike = item.querySelector('.a-text-strike');

    const currentEl =
      item.querySelector('[id^="itemPrice_"] .a-offscreen') ||
      item.querySelector('.a-price:not(.a-text-price):not(.wl-deal-price) .a-offscreen');

    let originalPriceText = null;
    if (dealStrikePrice) {
      originalPriceText = dealStrikePrice.textContent;
    } else if (genericStrikeOffscreen) {
      originalPriceText = genericStrikeOffscreen.textContent;
    } else if (genericStrike) {
      originalPriceText = genericStrike.textContent;
    }

    const originalPrice = parsePrice(originalPriceText);
    const currentPriceText = currentEl?.textContent;
    const currentPrice = parsePrice(currentPriceText);
    const currencySymbol = parseCurrencySymbol(currentPriceText) || parseCurrencySymbol(originalPriceText);

    let discountFromBadge = 0;
    if (dealBadgeLabel) {
      discountFromBadge = parseDiscountPercent(collectSignalText(dealBadgeLabel));
    }

    let discountFromPriceDrop = 0;
    if (priceDrop) {
      discountFromPriceDrop = parseDiscountPercent(collectSignalText(priceDrop));
    }

    let discountFromCalc = 0;
    if (originalPrice && currentPrice && originalPrice > currentPrice) {
      discountFromCalc = Math.round((1 - currentPrice / originalPrice) * 100);
    }

    let isSale = !!(
      dealBadge ||
      dealStrikePrice ||
      priceDrop ||
      (originalPrice && currentPrice && originalPrice > currentPrice)
    );
    const itemText = collectSignalText(item);
    const discountFromSignals = parseDiscountPercent(itemText);
    let discountPercent = Math.max(
      discountFromBadge,
      discountFromCalc,
      discountFromPriceDrop,
      discountFromSignals
    );

    if (!isSale) {
      if (SALE_KEYWORDS.test(itemText)) {
        isSale = true;
      }
    }

    return { isSale, discountPercent, originalPrice, currentPrice, currencySymbol };
  }

  const api = { SALE_KEYWORDS, parsePrice, parseCurrencySymbol, detectSale };

  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js / CommonJS (verify-detect.mjs の createRequire 経由)
    module.exports = api;
  } else {
    // ブラウザ content script
    root.__WSP__ = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
