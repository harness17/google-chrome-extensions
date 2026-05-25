# CLAUDE.md (amazon-wishlist-sale-picker)

Amazon.co.jp の欲しいものリストからセール中の商品を抽出する Chrome 拡張。Manifest V3 / 素の JS。

## 検証コマンド

```bash
node verify-detect.mjs
```

`fixtures/*.html` に対して `detectSale()` の判定が期待通りか確認する単体検証スクリプト。
**`content/content.js` の検出ロジックを変更したら必ず実行する。**

依存: `jsdom`（`npm install --no-save jsdom` で導入済み）。`package.json` は意図的に置いていない。

## 検出ロジックの Single Source of Truth

`detectSale()` の実装は **`shared/detect.js` のみ**。

- `shared/detect.js` — 唯一の実装。UMD 形式でブラウザ/Node.js 両対応
- `content/content.js` — manifest で先行読み込みされた `window.__WSP__` から取得
- `verify-detect.mjs` — `createRequire('./shared/detect.js')` で直接 import

**`shared/detect.js` を変更したら `node verify-detect.mjs` で回帰検証すること。**

## Amazon ウィッシュリスト DOM の検出キー

セール判定は次の 3 系統 + 元値計算で行う:

| シグナル | クラス / セレクタ | 取得できる情報 |
|---------|--------|---------|
| タイムセールバッジ | `.wl-deal-rich-badge` + `.wl-deal-rich-badge-label` | "15%OFF" のような割引率テキスト |
| 過去価格（打ち消し） | `.wl-deal-price.a-text-strike` または `.wl-deal-price-and-striked-price .a-text-strike` | 元値 |
| 価格下落通知 | `.itemPriceDrop` または `[id^="itemPriceDrop_"]` | "価格が30%下がりました" |
| キーワードフォールバック | `タイムセール` `過去価格:` `Limited time deal` `Was:` `%OFF` / `% off` 等 | セール判定のみ（割引率不明） |

ウィッシュリスト DOM は商品ごとに価格情報の出方が異なる（タイムセール商品にはバッジ、登録時より値下がりした商品には PriceDrop 通知）。新パターンに遭遇したら `fixtures/<asin>.html` に追加 → `verify-detect.mjs` にケース追加。

## 対応 URL マッチパターン

manifest.json の `matches`:

- `https://www.amazon.co.jp/hz/wishlist/ls/*`
- `https://www.amazon.co.jp/hz/wishlist/genericItemsPage/*`
- `https://www.amazon.co.jp/gp/registry/wishlist/*`

amazon.com など海外ドメインはスコープ外。Amazon.co.jp を英語表示にした場合の英語セール文言は検出対象に含める。商品詳細ページ (`/dp/*`) では動作しない（拡張機能の意図）。

## 全件読み込みの仕組み

ウィッシュリストは初期 25 件 + スクロールで遅延ロードされるため、「セールのみ表示」ボタン押下時に自動スクロールで全件ロードする。

- オーバーレイで画面を隠してスクロールを実行（ピクピク防止）
- `MutationObserver` で `li[data-id]` の追加を検知し、固定待ちではなく動的に次へ進む
- 連続 2 回新規追加なし、または最大 80 回スクロールで終了
- 完了後、元のスクロール位置に戻す

## 横断セール確認（複数ウィッシュリスト横断スキャン）

popup の「全リスト横断スキャン」から、ユーザーの全ウィッシュリストを順にスキャンしてセール商品を集約する。

- popup → content script `enumerateLists` でサイドバーから全リストを列挙
- popup → background `startCrossScan` でスキャン開始
- background が各リストを**バックグラウンドタブ**で順に開き、`scanList` メッセージで content script に全件読み込み + セール判定を依頼（`runHeadlessScan`）
- 結果は `results/results.html` にリスト別集約表示

メッセージ種別: `enumerateLists` / `scanList` / `wspPing`（content script）、`startCrossScan` / `getCrossScanState` / `crossScanUpdated`（background）。

バックグラウンドタブはタイマーがスロットリングされるため、`loadAllItems(_, {headless:true})` で新規アイテム待ち時間を延長している。

## 既知の制約

- アイコン PNG は仮置き（オレンジ + 白の `%`）。本番公開時は差し替え推奨
- ストア配布する場合は `host_permissions` の見直しが必要かも
