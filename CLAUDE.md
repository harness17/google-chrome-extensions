# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このフォルダの位置づけ

`GoogleChrome/` は **複数の Chrome 拡張プロジェクトを並列配置するコンテナディレクトリ**。各拡張は独立したサブフォルダ（`amazon-wishlist-sale-picker/` など）に配置し、それぞれが独立した Manifest V3 拡張として動く。

## サブディレクトリ

- [amazon-wishlist-sale-picker/](amazon-wishlist-sale-picker/CLAUDE.md) — Amazon.co.jp ウィッシュリストからセール商品を抽出する拡張

新しい拡張を追加する場合は `/new-chrome-extension <name>` skill で雛形をスキャフォールドできる。

## 共通の作業フロー

### 拡張をブラウザに読み込む

1. `chrome://extensions/` を開く
2. 右上「デベロッパー モード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」→ 拡張のサブフォルダ（`amazon-wishlist-sale-picker/` など）を選択
4. **コード変更後は同画面の 🔄 ボタンで再読み込みが必要**（自動反映ではない）

### Amazon・X など要ログインサイトの DOM 確認

agent-browser は未認証なので、ログイン必須ページの DOM は取得できない。サンプルが必要なときはユーザーに DevTools (F12) → Console で次を実行してもらう:

```js
copy(document.querySelector('#g-items li[data-id]').outerHTML);
```

取得した HTML を `<extension>/fixtures/<case>.html` に保存し、`verify-detect.mjs` のテストケースに追加する運用にする。

### アイコン PNG の生成

PIL や ImageMagick は使わず、Windows の PowerShell + System.Drawing で生成する:

```powershell
Add-Type -AssemblyName System.Drawing
foreach ($size in 16, 48, 128) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    # ...
    $bmp.Save("icons\icon$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
}
```

## DOM スクレイピング系拡張の検証戦略

外部サイトの DOM をスクレイピングする拡張は、対象サイトの DOM 変更で壊れやすい。各拡張に以下を用意する:

- `fixtures/<case>.html` — 実 DOM のスニペット（ユーザーから貰った HTML をそのまま保存）
- `verify-detect.mjs` — jsdom で検出関数を単体検証するスクリプト
- 新パターンに遭遇したら fixtures に追加するだけで、過去ケースの回帰も同時に検証できる

詳細は各拡張の CLAUDE.md を参照。

## Git

このコンテナディレクトリは単一リポジトリで管理する。store package、スクリーンショット、ローカル設定、ユーザー固有素材を stage する前に必ず確認する。

## 共同開発ハーネス（Codex × Claude Code）

このリポジトリは Codex と Claude Code が共同で開発する。汎用ハーネス本体と GoogleChromeExtensions 固有 profile は以下を読む。

@.claude/rules/cross-agent-harness.md
@.claude/rules/project-collaboration-profile.md
@.claude/rules/handoff-protocol.md

**Claude Code が作業を開始するときの流れ：**

1. ユーザーの依頼を聞いたら、汎用ハーネスと GoogleChromeExtensions profile の担当境界で Codex に振るか自分で握るか判断する。
2. Codex に振るなら `/codex-handoff` スキルで依頼セクションを `CLAUDE_CODE_HANDOFF.md` に追記する。
3. 自分で実装する場合は通常のフローで進め、必要に応じて Codex にレビューを依頼する。
4. Codex の作業完了後は `/cross-review` スキルでレビューする。
5. Merge / publish 判断はユーザー指示を待つ。

**最新の引き継ぎ：** `CLAUDE_CODE_HANDOFF.md` を参照する。
