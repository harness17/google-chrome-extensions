# codex-handoff

Claude Code から Codex へ実装や調査を渡すためのスキル。

## 使う場面

- 仕様が明確で、Codex に実装・修正・検証を依頼したい。
- Claude Code が設計やレビューを担当し、Codex が限定範囲を実装する。

## 手順

1. `git status --short --branch` を確認する。
2. `.claude/rules/project-collaboration-profile.md` で担当境界と verify コマンドを確認する。
3. `CLAUDE_CODE_HANDOFF.md` の先頭に新しい追記を作る。
4. 完成条件、触ってよい範囲、触ってはいけない範囲、レビュー観点を明記する。

## 出力

Codex がそのまま読めるように、次を含める。

- 目的
- 背景
- 完成条件
- 対象ファイル
- 禁止範囲
- verify コマンド
- 既知リスク
- 次アクション
