# AGENTS.md

This file provides guidance to Codex when working in this repository.

## プロジェクト概要

`GoogleChrome/` は Manifest V3 Chrome 拡張を複数並列配置するコンテナリポジトリです。各拡張は独立したサブフォルダで管理します。

現在の主な拡張:

- `amazon-wishlist-sale-picker/` — Amazon.co.jp ウィッシュリストからセール商品を抽出する拡張
- `youtube-playlist-date-sorter/` — YouTube プレイリスト再生を動画投稿日順に並び替えて移動する拡張

## 作業ルール

- 各拡張の詳細ルールは `<extension>/CLAUDE.md` を読む。
- host permissions、store package、公開判断はユーザー確認を挟む。
- ログイン必須サイトの DOM はユーザー提供の DevTools 出力を fixture に保存して検証する。
- 個人情報、private URL、cookie、実購入情報をコミットしない。

## Verify

通常のセルフ verify:

```powershell
Push-Location .\amazon-wishlist-sale-picker
node .\verify-detect.mjs
Pop-Location
```

拡張ごとに追加検証がある場合は、その拡張の `CLAUDE.md` を優先する。

## 共同開発ハーネス（Codex × Claude Code）

Codex は作業開始時に `CLAUDE_CODE_HANDOFF.md` の最新セクションを読み、`.agents/skills/implement-task/SKILL.md` と `.claude/rules/project-collaboration-profile.md` に従って作業する。

Claude Code から Codex へ振る場合は `CLAUDE_CODE_HANDOFF.md` に目的、完成条件、触ってよい範囲、verify コマンド、レビュー観点を追記する。反対側レビューは `.claude/skills/cross-review/SKILL.md` と `.claude/rules/handoff-protocol.md` に従う。

merge / publish 前はセルフ verify、相互レビュー、重大指摘なし、ユーザーの明示指示の 4 条件を揃える。
