---
name: codex-dev
description: 機能開発を Codex に委譲するワークフロー。設計→実装計画→Codex実行（MCPサーバ経由）→レビューを一気通貫で実行する。Codex CLI（codex mcp-server）と、プロジェクトルートの .mcp.json への codex MCP サーバ登録が必要。
---

# codex-dev

Claude Code が設計し、Codex が MCP サーバ経由で実装し、Claude Code が `/cross-review` でレビューするワークフロー。

handoff ファイルベースの非同期連携（`codex-handoff`）に対し、こちらは Claude Code が同期的に Codex を起動・完了待ちする方式。仕様が明確で 1 スプリント単位に区切れる実装委譲に使う。

## 前提：codex MCP サーバの登録

`mcp__codex__codex` / `mcp__codex__codex-reply` ツールが利用可能であることを確認する。

利用できない場合は、プロジェクトルートの `.mcp.json` に以下を追加し、ユーザーに **Claude Code の再起動**（サーバ承認プロンプトが出る）を案内する。

```json
{
  "mcpServers": {
    "codex": {
      "command": "codex",
      "args": ["mcp-server"]
    }
  }
}
```

既に `.mcp.json` が存在する場合は `mcpServers` に `codex` エントリだけを追加する（既存サーバを上書きしない）。

## 手順

### Step 1: 設計フェーズ

可能なら `Plan` サブエージェント（`subagent_type: Plan`）で実装方針を固める。Plan サブエージェントが使えない環境では、Claude Code 本体で同じ粒度の設計メモを作る。入力には依頼内容・スコープ（やる/やらない）・完成条件（正常系/認可/異常系/副作用）・既知の制約を渡す。

`.claude/rules/project-collaboration-profile.md` の担当境界を確認し、この委譲が Codex 担当範囲に収まるかを判断する。

**ここでユーザーの承認を得てから次へ進む。**

### Step 2: 実装計画の作成

承認された設計をもとに実装計画ファイルを `docs/plans/YYYY-MM-DD-<feature>.md` に作成する（ディレクトリがなければ作成）。スプリントコントラクト（完成条件）を計画ファイルに明記する。

`git log --oneline -1` で現在の最新コミットを控える（Step 4 のレビュー差分の起点）。

### Step 3: Codex への引き渡し（MCP 経由）

**3-1. ルールファイルの検出:** `AGENTS.md` があればそれを、なければ `CLAUDE.md` を、どちらもなければ「プロジェクトのコーディング規約に従って」と記述する。

**3-2. `mcp__codex__codex` ツールでタスクを実行する:**

| 引数 | 値 |
|------|----|
| `prompt` | 下記の実装指示文 |
| `cwd` | プロジェクトルートの絶対パス |
| `sandbox` | `workspace-write` |
| `approval-policy` | `never`（MCP 呼び出し中は人間が承認できないため） |

`prompt` に渡す実装指示文:

```
<RULE_FILE> のルールに従って、実装計画 <計画ファイルパス> をチェックボックス順に実装してください。
作業範囲は計画ファイルに書かれたファイル・責務に限定してください。
実装後に可能な範囲で verify を実行し、結果を報告してください。
git add / git commit / git push は実行しないでください。
ネットワーク、外部サービス、追加権限、danger-full-access が必要になった場合は作業を止め、必要な理由と未完了範囲を報告してください。
```

> **同期ブロッキング**: `mcp__codex__codex` の呼び出しは Codex がセッションを完走するまで返らない。進捗表示はない。完了すると `{threadId, content}` が返る。**`threadId` を控える**（Step 4 の修正再依頼に使う）。

**3-3. 大きなタスクの分割:** 計画が大きいと MCP ツールのタイムアウトに当たる。1 スプリント（1 機能）単位に計画を分割し、Step 3-2 を繰り返す。タイムアウトする場合は環境変数 `MCP_TOOL_TIMEOUT` を延長する。

### Step 4: 完了確認・レビュー・handoff 追記

`mcp__codex__codex` の呼び出しが返ったら以下を実行する。

1. **結果確認:** `git status --short` / `git diff --stat` / `git diff` で Step 2 の開始時点からの未コミット差分を確認する。Codex が誤って commit していた場合のみ `git log --oneline -3` / `git show --stat HEAD` も確認する。
2. **レビュー:** `/cross-review` スキルでレビューする。重大指摘は merge / publish ブロッカーとして扱う。
3. **差し戻し:** 指摘が出たら `mcp__codex__codex-reply`（`threadId` + 修正指示）で Codex に修正させ、1〜2 を再実行する。
4. **handoff 追記:** `handoff-protocol.md` に従い `CLAUDE_CODE_HANDOFF.md` へ、実装内容・verify 結果・残リスク・次アクションを追記する。
5. **コミット判断:** commit はレビュー完了後、ユーザーが明示した場合だけ行う。行う場合も `git add` は個別ファイル指定に限定し、`git add -A` は使わない。

## トラブルシューティング

- **`mcp__codex__codex` が見つからない**: `.mcp.json` 未登録、または登録後にセッション未再起動。「前提」セクション参照。
- **ツール呼び出しがタイムアウト**: 計画を 1 スプリント単位に分割。`MCP_TOOL_TIMEOUT` を延長。Codex は別プロセスで進行している可能性があるため `git log` / `git status` で成果物を確認する。
- **Codex が未コミット差分を残して終わった**: 正常。`git status` / `git diff` / verify 結果を確認し、必要なら `/cross-review` 後にユーザーへ commit 可否を確認する。
- **Codex が追加権限やネットワークを必要とした**: `approval-policy=never` では承認できないため、そこで止める。必要なコマンド、理由、リスクをユーザーに提示して次のスプリントに分ける。

## 注意事項

- Step 1 の設計フェーズをスキップしない（設計なしで実装させない）。
- `mcp__codex__codex` の呼び出しは同期ブロッキング。大きなタスクはスプリント単位に分割する。
- Codex に commit / push / destructive git 操作をさせない。commit はレビュー後にユーザーが明示した場合だけ行う。
- `git add -A` は使用しない。commit する場合も個別ファイル指定に限定する。
- `approval-policy=never` と `danger-full-access` を組み合わせない。
- 修正の再依頼は新規 `mcp__codex__codex` ではなく `mcp__codex__codex-reply`（`threadId` 指定）で同一スレッドを継続する。
- merge / publish はユーザーの明示指示なしに進めない。
- プロジェクト固有のパス・スキル名をこのスキルにハードコードしない。
