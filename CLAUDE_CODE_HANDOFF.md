# GoogleChromeExtensions 共同開発ハンドオフ

最終更新: 2026-05-17
対象リポジトリ: `H:/ClaudeCode/GoogleChrome`
status: active

このファイルは Codex と Claude Code の相互ハンドオフ log。書式・更新タイミングは `.claude/rules/handoff-protocol.md`、汎用ハーネスは `.claude/rules/cross-agent-harness.md`、プロジェクト固有 profile は `.claude/rules/project-collaboration-profile.md` を参照。

---

## 2026-05-17 11:20 追記（cross-agent-harness 初期導入 — Codex 作成）

- 対象: current worktree
- 作成者: Codex
- 主題: cross-agent harness の初期導入
- 変更ファイル:
  - `.claude/rules/cross-agent-harness.md`
  - `.claude/rules/project-collaboration-profile.md`
  - `.claude/rules/handoff-protocol.md`
  - `.claude/skills/codex-handoff/SKILL.md`
  - `.claude/skills/cross-review/SKILL.md`
  - `.agents/skills/implement-task/SKILL.md`
  - `CLAUDE_CODE_HANDOFF.md`
- レビュー担当: Claude Code
- 触ってよい範囲: ハーネス文書・ルール・スキルのみ
- 触ってはいけない範囲: アプリ本体、既存未コミット変更
- セルフ verify: ✅ `node .\verify-detect.mjs`（amazon-wishlist-sale-picker 配下で実行、3 fixtures passed）
- 実動確認: N/A（ドキュメントのみ）
- レビュー観点:
  - project profile が対象プロジェクトの実態に合っているか
  - verify コマンドが正しいか
  - 重大指摘にすべきリスクが profile に入っているか

### 完成条件（スプリントコントラクト）

- Claude Code が Codex へ実装依頼を作れる。
- Codex が handoff から実装・verify・handoff 更新へ進める。
- 反対側エージェントがレビュー結果を同じ handoff に残せる。
- Merge 前にセルフ verify・相互レビュー・重大指摘なし・ユーザー指示の 4 条件を確認できる。

### 次アクション

- Claude Code が project profile と handoff の実運用性をレビューする。
