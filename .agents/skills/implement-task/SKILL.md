# implement-task

Codex が `CLAUDE_CODE_HANDOFF.md` から限定タスクを実装するためのスキル。

## 開始時

1. `CLAUDE_CODE_HANDOFF.md` の最新セクションを読む。
2. `.claude/rules/project-collaboration-profile.md` を読む。
3. `git status --short --branch` で未コミット変更を確認する。
4. 完成条件、触ってよい範囲、verify コマンドを短く宣言する。

## 実装

- 最小変更で完成条件を満たす。
- 既存パターンに合わせる。
- 依頼外のリファクタや cleanup を混ぜない。
- 相手エージェントやユーザーの変更と競合する場合は止めて確認する。

## 検証

- profile の通常 verify を実行する。
- UI やブラウザ確認が必要な場合は profile の実動確認も行う。
- 実行できない検証は理由を記録する。

## 完了時

`CLAUDE_CODE_HANDOFF.md` に次を追記する。

- 変更したファイル
- 実装概要
- verify 結果
- 実動確認結果
- 残リスク
- 次アクション
