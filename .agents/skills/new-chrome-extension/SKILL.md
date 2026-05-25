---
name: new-chrome-extension
description: 新しい Chrome 拡張プロジェクトを GoogleChrome/ 配下にスキャフォールドする。Manifest V3 + content script + popup + icons + fixtures の雛形を一括生成。新規 Chrome 拡張を始めるとき、または既存の amazon-wishlist-sale-picker と同じ構造の別拡張を作るときに使う。
disable-model-invocation: true
---

# new-chrome-extension

`/new-chrome-extension <name>` で `H:/Codex/GoogleChrome/<name>/` に Chrome 拡張の雛形を一括生成する。

## 引数

- `$ARGUMENTS` = 拡張のフォルダ名（kebab-case 推奨、例: `amazon-deals-tracker`）

引数が空の場合はユーザーに名前を確認してから進める。

## 実行手順

### 1. 既存ディレクトリ確認

`H:/Codex/GoogleChrome/$ARGUMENTS/` が既に存在する場合は **上書きせず中断**して、ユーザーに別名を提案する。

### 2. ユーザーから基本情報をヒアリング

`AskUserQuestion` で以下を聞く:

- **対象ドメイン**: 例 `https://www.amazon.co.jp/*`、`https://x.com/*`
- **拡張の目的**: manifest の `description` に入る 1 行説明
- **content script を使うか**: ウェブページの DOM を操作するなら yes
- **popup を使うか**: 拡張アイコンクリック時のポップアップ UI が必要なら yes

### 3. ディレクトリと雛形を生成

ヒアリング結果に応じて以下を作成:

```
<name>/
├── manifest.json          (Manifest V3、permissions は最小限の "storage" のみ)
├── content/               (content script を使う場合のみ)
│   ├── content.js         (IIFE で囲んだ最小限のテンプレート)
│   └── content.css
├── popup/                 (popup を使う場合のみ)
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── fixtures/              (DOM スクレイピング系の場合)
└── AGENTS.md              (この拡張固有の作業メモ)
```

### 4. アイコン PNG を生成

PowerShell + System.Drawing で 16/48/128px のプレースホルダを作成。色やマークは拡張の用途に合わせて変えてもよい（デフォルトはオレンジ背景に白文字）。

```powershell
Add-Type -AssemblyName System.Drawing
foreach ($size in 16, 48, 128) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.FillRectangle(
        [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 164, 28)),
        0, 0, $size, $size
    )
    # ... 中央に文字描画 ...
    $bmp.Save("H:\Codex\GoogleChrome\<name>\icons\icon$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
```

### 5. DOM スクレイピング系の場合は検証スクリプトも生成

DOM をスクレイピングする拡張なら、`amazon-wishlist-sale-picker/verify-detect.mjs` を参考に jsdom + fixtures 検証スクリプトの雛形を `verify-detect.mjs` として配置する。

`npm install --no-save jsdom` を案内する（`package.json` は作らない方針）。

### 6. ルート AGENTS.md のサブディレクトリ一覧を更新

`H:/Codex/GoogleChrome/AGENTS.md` の「サブディレクトリ」セクションに新拡張へのリンクを追加する。

### 7. ユーザーに動作確認手順を伝える

```
1. chrome://extensions/ を開く
2. デベロッパーモードをオン
3. 「パッケージ化されていない拡張機能を読み込む」→ H:\Codex\GoogleChrome\<name>\ を選択
4. 対象ページで動作確認
```

## 注意点

- Manifest V3 必須（V2 は段階廃止）
- `permissions` は最小限から始める。後から追加する方が安全
- `host_permissions` は本当に必要なときだけ。content script の `matches` で済むことが多い
- アイコンはあくまでプレースホルダ。本番公開時は差し替え必須
