/**
 * verify-detect.mjs — detectSale() の回帰検証スクリプト
 *
 * 使い方:
 *   node verify-detect.mjs
 *
 * 依存: jsdom（npm install --no-save jsdom で導入）
 *
 * detectSale の実装は shared/detect.js にあります（唯一の実装）。
 * ロジックを変更したら必ずこのスクリプトで全ケースが通ることを確認してください。
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

// shared/detect.js は CJS 形式で module.exports を公開しているため createRequire で読む
const require = createRequire(import.meta.url);
const { detectSale } = require('./shared/detect.js');

const cases = [
  {
    name: 'B0DQWP6LX1 (タイムセール 15%OFF)',
    file: 'fixtures/sale-item.html',
    expectSale: true,
    expectDiscount: 15,
  },
  {
    name: 'B07TKLB1ML (通常価格)',
    file: 'fixtures/normal-item.html',
    expectSale: false,
    expectDiscount: 0,
  },
  {
    name: 'B00ICCU4U4 (価格下落 30%)',
    file: 'fixtures/price-drop-item.html',
    expectSale: true,
    expectDiscount: 30,
  },
  {
    name: 'B0TESTSALE (amazon.com limited time deal 20% off)',
    file: 'fixtures/amazon-com-sale-item.html',
    expectSale: true,
    expectDiscount: 20,
  },
  {
    name: 'B0TESTDROP (amazon.com price dropped 30%)',
    file: 'fixtures/amazon-com-price-drop-item.html',
    expectSale: true,
    expectDiscount: 30,
  },
  {
    name: 'B0TESTHIDDEN (amazon.com aria-label 20% off)',
    file: 'fixtures/amazon-com-hidden-discount-item.html',
    expectSale: true,
    expectDiscount: 20,
  },
  {
    name: 'B0FAKEPCT1 (商品名に 20%OFF を含む通常価格 — 誤検出しないこと)',
    file: 'fixtures/title-with-percent-item.html',
    expectSale: false,
    expectDiscount: 0,
  },
];

let allOk = true;
for (const c of cases) {
  const html = readFileSync(c.file, 'utf8');
  const dom = new JSDOM(`<!DOCTYPE html><body><li>${html}</li></body>`);
  const item = dom.window.document.querySelector('li');
  const r = detectSale(item);
  const ok = r.isSale === c.expectSale && r.discountPercent === c.expectDiscount;
  console.log(`${ok ? '✓' : '✗'} ${c.name}`);
  console.log(
    `  result: isSale=${r.isSale}, discount=${r.discountPercent}%, current=${r.currencySymbol || ''}${r.currentPrice}, original=${r.currencySymbol || ''}${r.originalPrice}`
  );
  console.log(`  expect: isSale=${c.expectSale}, discount=${c.expectDiscount}%`);
  if (!ok) allOk = false;
}

process.exit(allOk ? 0 : 1);
