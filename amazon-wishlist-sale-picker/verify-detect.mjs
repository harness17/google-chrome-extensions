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
    `  result: isSale=${r.isSale}, discount=${r.discountPercent}%, current=¥${r.currentPrice}, original=¥${r.originalPrice}`
  );
  console.log(`  expect: isSale=${c.expectSale}, discount=${c.expectDiscount}%`);
  if (!ok) allOk = false;
}

process.exit(allOk ? 0 : 1);
