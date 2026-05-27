# Amazon Wishlist Sale Picker

Amazon.co.jp の欲しいものリストを開くと、**「セールのみ表示」ボタン**が追加されます。ボタンを押すと全件をスキャンしてセール中の商品だけに絞り込みます。

## 機能

- **セール判定** — タイムセールバッジ・打ち消し価格・価格下落通知・日英キーワードの 4 系統で判定
- **割引率フィルター** — ポップアップのスライダーで「○% 以上の割引のみ表示」に絞り込み
- **全件自動読み込み** — ボタン押下時に lazy load を自動スクロールで全件展開（オーバーレイで進捗表示）
- **全リスト横断スキャン** — サイドバーの複数ウィッシュリストを順に開き、結果ページにセール商品を集約
- **日英 UI 切替** — popup と結果ページの表示言語を日本語 / English で切り替え
- **ローカル完結** — 外部サーバーへの通信なし、`storage` 権限のみ使用

## 対応 URL

- `https://www.amazon.co.jp/hz/wishlist/ls/*`
- `https://www.amazon.co.jp/hz/wishlist/genericItemsPage/*`
- `https://www.amazon.co.jp/gp/registry/wishlist/*`

amazon.com など海外 Amazon は対象外です。Amazon.co.jp を英語表示にした場合の英語セール文言は検出対象に含めています。

## インストール

Chrome ウェブストアには未公開です。手動でインストールしてください。

1. このリポジトリを clone またはダウンロード
   ```bash
   git clone https://github.com/harness17/google-chrome-extensions.git
   ```
2. `chrome://extensions/` を開く
3. 右上「デベロッパーモード」をオン
4. 「パッケージ化されていない拡張機能を読み込む」→ `amazon-wishlist-sale-picker/` を選択

## 開発

### 回帰テスト

`detectSale()` の単体検証を実行します（jsdom が必要）:

```bash
cd amazon-wishlist-sale-picker
npm install --no-save jsdom
node verify-detect.mjs
```

```
✓ B0DQWP6LX1 (タイムセール 15%OFF)
✓ B07TKLB1ML (通常価格)
✓ B00ICCU4U4 (価格下落 30%)
✓ B0TESTSALE (amazon.com limited time deal 20% off)
✓ B0TESTDROP (amazon.com price dropped 30%)
✓ B0TESTHIDDEN (amazon.com aria-label 20% off)
```

### ファイル構成

```
amazon-wishlist-sale-picker/
├── manifest.json          Manifest V3
├── background.js           横断スキャンの状態管理と結果ページ起動
├── shared/
│   ├── detect.js          detectSale() の唯一の実装（ブラウザ + Node 両対応 UMD）
│   └── i18n.js            popup / content / results 共通の日英表示辞書
├── content/
│   ├── content.js         ウィッシュリストページに注入されるメインスクリプト
│   └── content.css        スタイル（非表示クラス・オーバーレイ）
├── popup/
│   ├── popup.html/js/css  割引率フィルターの設定 UI
├── results/
│   ├── results.html/js/css 横断スキャン結果ページ
├── icons/                 16 / 48 / 128px アイコン（プレースホルダー）
├── fixtures/              jsdom テスト用の実 DOM スニペット
│   ├── HOW_TO_CAPTURE.md  新パターン追加手順
│   ├── sale-item.html
│   ├── normal-item.html
│   ├── price-drop-item.html
│   └── amazon-com-*.html   Amazon.co.jp 英語表示相当の文言検証 fixture
└── verify-detect.mjs      回帰検証スクリプト
```

### 新しい DOM パターンが見つかったとき

1. DevTools で対象の `li[data-id]` 要素を「Copy outerHTML」
2. `fixtures/<ASIN>.html` として保存
3. `verify-detect.mjs` にテストケースを追加
4. `node verify-detect.mjs` で全件 PASS を確認
5. 必要なら `shared/detect.js` の検出ロジックを修正

詳細: [fixtures/HOW_TO_CAPTURE.md](fixtures/HOW_TO_CAPTURE.md)

## ロードマップ

今後の開発計画は [ROADMAP.md](ROADMAP.md) を参照してください。

## ライセンス

MIT
