# Project Collaboration Profile（GoogleChromeExtensions）

`cross-agent-harness.md` を GoogleChromeExtensions に適用するためのプロジェクト固有設定。

## プロジェクト

- 名前: GoogleChromeExtensions
- 種別: Manifest V3 Chrome 拡張を複数並列配置するコンテナリポジトリ
- 主な検証対象: 各拡張サブフォルダの `manifest.json`、content script、background service worker、popup、fixtures、検証スクリプト
- 注意領域: host permissions、content script の DOM 依存、Chrome Web Store 提出物、ログイン必須サイトの検証、store package / screenshot

## 担当境界

| 条件 | 振り先 |
|------|--------|
| 単一拡張内の content / popup / background の限定修正 | Codex |
| Manifest 権限、host permissions、Chrome Web Store 公開判断 | Claude Code + user |
| 対象サイト DOM 変更への追従と fixture 追加 | Codex（Claude Code がレビュー） |
| ログイン必須ページの DOM 採取や実ブラウザ確認 | user が素材提供、実装者が fixture 化 |
| 新しい拡張の追加やディレクトリ構成判断 | Claude Code |
| release package / screenshot / store listing 判断 | user |

## Verify コマンド

通常のセルフ verify:

```powershell
Push-Location .\amazon-wishlist-sale-picker
node .\verify-detect.mjs
Pop-Location
```

拡張ごとに追加の検証スクリプトがある場合は、その拡張の `CLAUDE.md` を優先する。

実動確認が必要な場合:

```text
chrome://extensions/ で対象拡張を「パッケージ化されていない拡張機能」として読み込み、変更後に再読み込みする。
```

ログイン必須ページの DOM は agent-browser で取得できないことがあるため、ユーザー提供の DevTools console 出力を fixture に保存して検証する。

## レビュー観点

### 動作

- 対象拡張の主要導線が動くか
- fixtures に対する検出結果が期待通りか
- DOM 変更に対して検出ロジックが過度に brittle になっていないか

### 契約

- `manifest.json` の permissions / host_permissions / content_scripts が実装と一致しているか
- background、content、popup の message contract が一致しているか
- shared module を変更した場合、content script と Node 検証の両方で読める形式を保っているか

### テスト

- `verify-detect.mjs` または拡張固有の検証スクリプトが pass するか
- 新しい DOM パターンに対応したら fixture を追加しているか
- 過去 fixture の回帰を壊していないか

### セキュリティ・運用

- host permissions を必要最小限にしているか
- login cookie、個人アカウント情報、実購入情報、private wishlist URL をコミットしていないか
- store package や screenshot に不要な個人情報が入っていないか
- content script がページ DOM を破壊したり、外部送信したりしていないか

### スタイル

- 素の JavaScript / Manifest V3 の既存構成に揃っているか
- unrelated cleanup や依頼外ファイル変更が混ざっていないか
- `git add -A` / `git add .` を使わず、変更ファイルを個別指定しているか

## GoogleChromeExtensions 固有の重大指摘

以下は原則として merge / publish ブロッカーにする。

- permissions / host_permissions の過剰化
- login cookie、個人情報、private wishlist URL、実購入情報の混入
- Chrome Web Store 提出物に不要ファイルや個人情報が混ざる
- message contract 変更で background / content / popup の片側だけが更新されている
- fixture 回帰検証が失敗している
- manifest version / content script match が対象サイトと一致していない
