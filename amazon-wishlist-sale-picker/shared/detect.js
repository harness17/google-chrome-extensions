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
    /タイムセール|プライム会員価格|プライム限定価格|プライムデー|セール対象|過去価格[:：]|%\s*OFF|％\s*OFF/i;

  function parsePrice(text) {
    if (!text) return null;
    const m = text.replace(/[,\s]/g, '').match(/[¥￥]?([0-9]+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  /**
   * @param {Element} item - li[data-id] 要素
   * @returns {{ isSale: boolean, discountPercent: number, originalPrice: number|null, currentPrice: number|null }}
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
    const currentPrice = parsePrice(currentEl?.textContent);

    let discountFromBadge = 0;
    if (dealBadgeLabel) {
      const m = dealBadgeLabel.textContent.match(/(\d+)\s*[%％]/);
      if (m) discountFromBadge = parseInt(m[1], 10);
    }

    let discountFromPriceDrop = 0;
    if (priceDrop) {
      const m = priceDrop.textContent.match(/(\d+)\s*[%％]/);
      if (m) discountFromPriceDrop = parseInt(m[1], 10);
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
    let discountPercent = Math.max(discountFromBadge, discountFromCalc, discountFromPriceDrop);

    if (!isSale) {
      const itemText = (item.textContent || '').slice(0, 2000);
      if (SALE_KEYWORDS.test(itemText)) {
        isSale = true;
      }
    }

    return { isSale, discountPercent, originalPrice, currentPrice };
  }

  const api = { SALE_KEYWORDS, parsePrice, detectSale };

  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js / CommonJS (verify-detect.mjs の createRequire 経由)
    module.exports = api;
  } else {
    // ブラウザ content script
    root.__WSP__ = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
