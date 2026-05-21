# GoogleChromeExtensions 共同開発ハンドオフ

最終更新: 2026-05-21
対象リポジトリ: `H:/ClaudeCode/GoogleChrome`
status: active

このファイルは Codex と Claude Code の相互ハンドオフ log。書式・更新タイミングは `.claude/rules/handoff-protocol.md`、汎用ハーネスは `.claude/rules/cross-agent-harness.md`、プロジェクト固有 profile は `.claude/rules/project-collaboration-profile.md` を参照。

---

## 2026-05-21 追記（YouTube Playlist Date Sorter パネル・バッジ安定性修正 — Claude Code 作成）

- 対象: `chore/cross-agent-harness-profile` ブランチ、`youtube-playlist-date-sorter/` 配下
- 作成者: Claude Code（依頼）→ Codex（実装）
- 主題: パネル初期表示不安定とバッジ点滅の根本対処
- 詳細プラン: [youtube-playlist-date-sorter/docs/plans/2026-05-21-fix-panel-and-badge-stability.md](youtube-playlist-date-sorter/docs/plans/2026-05-21-fix-panel-and-badge-stability.md) を**必ず先に読む**

### 目的

YouTube Playlist Date Sorter v0.1.0 で次の 3 つの挙動を解消する。

1. `youtube.com/playlist?list=...` を初回ロードしてもパネルが出ず、リロードしないと表示されない。
2. `/watch?v=...&list=...` 遷移時にサイドのプレイリスト行にバッジが出ないことがある。
3. `/watch` ページで並び替え後、バッジが表示・非表示を繰り返してチラつく（最重要）。

### 背景

起点コミット: `9d83082 fix: hide visual order debug status`

`content/content.js` の `decorateRows()` が冒頭で常に `clearDecorations()` を呼び全バッジを remove → 再生成しているため、MutationObserver と 1.5 秒 setInterval が再発火するたびにバッジ DOM が破棄・再生成され点滅する。詳細はプラン本文の「現状コードの原因仮説」を参照。

### 完成条件（スプリントコントラクト）

- 正常系:
  - `youtube.com/playlist?list=PL...` を初回ロード時、リロードなしで右下にパネルが出る。
  - パネルから「並び替え」を実行後、5 秒以上バッジ DOM が remove / append されない（点滅しない）。
- 異常系:
  - YouTube が DOM 再描画でプレイリスト行を入れ替えても、バッジが一瞬消えて戻る現象が起きない。
  - `playlistId` が変わったときはバッジが確実にクリアされる。
- 副作用:
  - `node ./verify-date-sorter.mjs` が引き続き pass。
  - 言語切替（popup から英語）と自動再生 (`auto`) フローが壊れない。
- 認可: なし（ローカル拡張）。

### 触ってよい範囲

- `youtube-playlist-date-sorter/content/content.js`
  - パネル生成タイミング（`ensurePanel`, `onNavigationMaybeChanged`）
  - `applyVisualOrder` / `decorateRows` / `clearDecorations` の差分更新化
  - MutationObserver の発火抑制（`attributeFilter`, `ytpds-` 系変更の無視）
  - `setInterval` の早期 return 強化
  - 必要なら `pruneOrphanBadges()` ヘルパー追加

### 触ってはいけない範囲

- `youtube-playlist-date-sorter/shared/date-sorter.js`（並び替えロジック）
- `youtube-playlist-date-sorter/manifest.json`（権限）
- i18n 文言（`shared/i18n.js` 相当の messages）
- 他拡張（`amazon-wishlist-sale-picker/` など）
- 未コミットのユーザー変更（既存 M ファイル全般）
- store package zip / screenshot
- 新機能追加

### 修正方針（プランの「修正方針」セクション該当部分を抜粋）

1. **バッジ差分更新化（最重要）**
   - `decorateRows` 冒頭の `clearDecorations()` を削除し、行ごとに「正しいバッジが既にあるならそのまま」「ない/ズレている行だけ更新」へ変更。
   - 孤児バッジ削除用 `pruneOrphanBadges()` を追加。
   - `clearDecorations()` は playlistId 変更時または並び替え結果破棄時のみ呼ぶ。
2. **MutationObserver 抑制**
   - `ytpds-date-badge` 自体の追加・`data-ytpds-sorted` / `data-ytpds-sort-index` 属性変更・`ytpds-current-video` クラスのみのトグルは無視する。
   - `attributeFilter` で監視対象属性を絞る、または applyVisualOrder 後に observer を一時停止→次フレームで再開。
   - setInterval から `applyVisualOrder` を呼ぶ前に DOM 順序と `state.sortedItems` の軽量一致チェックを入れる。
3. **パネル安定化**
   - `ensurePanel()` を `restoreSettings()` / `restoreSortState()` 完了後・readystatechange 後にも呼ぶ。
   - `document.documentElement` を監視する別 observer を入れて、`state.panel` が外れたら即再生成。
   - `isSupportedPlaylistPage()` で false でも 1 秒は panel を残す猶予を入れるなど、判定の brittle さを減らす。
4. **watch ページ初回挙動**
   - `restoreSortState()` で `badgesEnabled=false` のまま維持する現状設計は変えない。並び替えボタン押下後の消失は方針 1〜2 の副作用で解消されるはず。

### verify コマンド

```powershell
Push-Location .\youtube-playlist-date-sorter
node .\verify-date-sorter.mjs
Pop-Location
```

実動確認は Claude Code 側でユーザー手元で行う（agent-browser は YouTube 非ログイン環境で限界あり）。Codex は verify スクリプトの pass と修正方針の自己レビューまで担当。

### 既知リスク

- MutationObserver の `attributeFilter` を厳しくしすぎると、YouTube 側の DOM 再構築（行の入れ替え）に追従できなくなる。`childList` 監視は残す前提で属性監視のみ絞る。
- パネル再生成 observer が無限ループしないよう、自前で追加した `state.panel` の childList 変更は無視する。
- `applyingVisualOrder` フラグの解除タイミングと observer の次イベントの間に race condition が残っていないか確認すること。

### レビュー観点

- 差分更新後、バッジ DOM の identity が連続呼び出しでも保持されているか（`getElementsByClassName('ytpds-date-badge')[0]` が同一参照のまま）
- `clearDecorations()` を呼ぶ箇所が「playlistId 変化時」「結果破棄時」だけに絞られているか
- MutationObserver のフィルタが自己トリガを完全に排除しているか
- パネル再生成 observer が performance を圧迫しないか
- `verify-date-sorter.mjs` pass
- 既存の言語切替・自動再生 (`auto`) フロー回帰がないか
- 既存未コミット変更（M ファイル全般、特に amazon-wishlist-sale-picker/）に触れていないこと

### 次アクション

1. Codex はプラン本文を最後まで読み、修正方針 1〜4 のチェックボックスに沿って `content/content.js` を改修する。
2. `node ./verify-date-sorter.mjs` を実行し、pass を確認する。
3. 本ハンドオフに「Codex 実装完了」セクションを追記し、変更ファイル一覧・verify 結果・残リスクを記録する。
4. Claude Code が `/cross-review` でレビューし、ユーザーが実動確認する。

### Codex 実装完了（2026-05-21）

- 変更ファイル一覧:
  - `youtube-playlist-date-sorter/content/content.js`
  - `CLAUDE_CODE_HANDOFF.md`
- 実装内容:
  - `decorateRows()` を差分更新化し、正しい行・正しいテキストの既存バッジ DOM を保持するよう変更。
  - `pruneOrphanBadges()` を追加し、対応行のない `ytpds-date-badge` のみ削除。
  - `applyVisualOrder()` の native order 検出分岐で、ユーザーが並び替え後の `badgesEnabled=true` 状態なら再適用できるよう調整。
  - MutationObserver に `ytpds-` 系の自己変更フィルタと `attributeFilter` を追加。
  - 1.5 秒 interval は DOM 順序が既に `state.sortedItems` と一致する場合 `applyVisualOrder()` を呼ばないよう変更。
  - `ensurePanel()` を playlist/watch 準対象ルートで維持し、`document.documentElement` の childList 監視・DOMContentLoaded/readystatechange・restore 完了後に再生成できるよう補強。
- verify 結果:
  - ✅ `cd youtube-playlist-date-sorter && node ./verify-date-sorter.mjs` → `date sorter verification passed`
  - ✅ `node --check ./youtube-playlist-date-sorter/content/content.js`
- 残リスク:
  - YouTube 実 DOM での 5 秒以上のバッジ identity 維持、初回 `/playlist?list=...` パネル表示、popup 言語切替後のバッジ文言反映は Codex 側では未実動確認。Claude Code / ユーザー手元で確認が必要。
  - `ensurePanel()` は `/watch` または `/playlist` ルートなら playlistId 未確定の短時間でも panel を残すため、playlistId なしの通常 watch ページで一時表示される可能性がある。

### Claude Code レビュー結果（2026-05-21） — 修正依頼1件

ユーザー確認の結果、当初の「重大指摘 1〜3（collapse / popup.js / i18n）」はすべて **別タスクのパネル最小化機能（commit `d79c568 feat: add playlist sorter panel minimize`）と判明し、現在はコミット済みのため対象外**。

判定: 残るスコープ内指摘は **重大指摘 4 のみ**。Codex に再作業を依頼する。

#### 重大指摘 4（要修正）: `ensurePanel()` ガード変更で意図しないページにパネル表示

```js
-    if (!isSupportedPlaylistPage()) {
+    if ((!isSupportedPlaylistPage() && !isPlaylistRoute()) || !state.pageUiVisible) {
```

`isPlaylistRoute()` は `pathname === '/watch' || '/playlist'` のみチェックし `playlistId` を問わない。結果として `list=` パラメータなしの通常の `/watch?v=...` ページでもパネルが表示される。プランは「`isSupportedPlaylistPage()` で false でも **1 秒は panel を残す猶予**」と書いており、恒久表示は意図ではない。Codex 自身も上記「残リスク」で認識している。

#### 良好な点（保持する実装）

- `decorateRows()` の差分更新化 + `pruneOrphanBadges()` → 計画方針 1
- MutationObserver の自己トリガフィルタ + `attributeFilter` → 計画方針 2
- `hasDesiredDomOrder()` で 1.5 秒 interval の早期 return → 計画方針 2
- `ensurePanelObserver` で `state.panel` 消失検知 → 計画方針 3

#### 次アクション（Codex への修正依頼）

対象コミット: `d79c568 feat: add playlist sorter panel minimize`（minimize 機能と Codex のバッジ安定化が一緒にコミットされている）

1. `youtube-playlist-date-sorter/content/content.js` の `ensurePanel()` ガードを修正:
   - 現状: `if (!isSupportedPlaylistPage() && !isPlaylistRoute()) { ... remove ... }`
   - 目標: `isSupportedPlaylistPage()` を基準にしつつ、SPA 遷移中の一瞬の false で panel が消えないよう **「false 状態が 1 秒継続したときだけ remove」** の猶予を入れる。
   - 実装案: `state.panel` が存在する状態で `isSupportedPlaylistPage()` が false を返したら、即 remove せず `setTimeout(() => { if (!isSupportedPlaylistPage()) { panel.remove(); state.panel = null; } }, 1000)` を仕掛ける。再度 true に戻ったら timeout をキャンセル。
2. `ensurePanelObserver()` 内の `if (!isPlaylistRoute()) return;` も同様に `isSupportedPlaylistPage()` 基準へ変更（list= なしの /watch でパネル再生成しない）。
3. `isPlaylistRoute()` ヘルパーが他の用途で必要なければ削除してよい。
4. minimize 機能（panelCollapsed 系）と本筋のバッジ差分更新ロジックは一切触らないこと。
5. `cd youtube-playlist-date-sorter && node ./verify-date-sorter.mjs` を実行し pass を確認。
6. `node --check ./youtube-playlist-date-sorter/content/content.js` で構文確認。
7. 新しいコミットを作る（amend 禁止 — d79c568 は既存履歴）。コミットメッセージ例: `fix: restrict playlist sorter panel to pages with list param`
8. handoff のレビュー結果セクションに対応状況を追記。

#### 触ってはいけない範囲（再掲）

- minimize 機能関連（panelCollapsed / ytpds-collapse / shared/i18n.js の minimize/expand / popup.js / content.css の collapse 系）
- 並び替えロジック（shared/date-sorter.js）
- manifest 権限
- 既存の未コミット変更（特に amazon-wishlist-sale-picker/ 配下）

#### Codex 対応状況（2026-05-21）

- 対応内容:
  - `ensurePanel()` の表示条件を `isSupportedPlaylistPage()` 基準へ戻し、非対応状態が 1 秒継続した場合だけ既存パネルを削除する猶予タイマーを追加。
  - `ensurePanelObserver()` も `isSupportedPlaylistPage()` 基準へ変更し、`list=` なしの通常 `/watch?v=...` ではパネル再生成しないよう修正。
  - 未使用になった `isPlaylistRoute()` を削除。
- スコープ確認:
  - `panelCollapsed` / `ytpds-collapse` / popup / i18n / CSS の minimize 関連は未変更。
  - バッジ差分更新ロジック、並び替えロジック、manifest 権限は未変更。
- verify:
  - ✅ `cd youtube-playlist-date-sorter && node ./verify-date-sorter.mjs` → `date sorter verification passed`
  - ✅ `node --check ./youtube-playlist-date-sorter/content/content.js`
- 残リスク:
  - YouTube 実 DOM での SPA 遷移中 1 秒猶予と、`list=` なし `/watch` での非表示はユーザー実機確認が必要。

#### Codex 対応状況（バッジ表示バグ修正）（2026-05-21）

- 方針:
  - フォールバック降格ではなく、`/watch?v=...&list=...` の並び替えボタン押下後にサイドプレイリストへバッジを表示するフル対応。
- 対応内容:
  - `/watch` サイドバー行では `#video-title` への挿入を避け、`#meta` / `.metadata-wrapper` / `.metadata-info` / `#byline` 系の可視メタ領域へバッジを追加。
  - メタ領域が見つからない `ytd-playlist-panel-video-renderer` / wrapper 行では `ytpds-badge-overlay` を付け、行直下に絶対配置でバッジを表示。
  - fixture `watch-page.html` にサイドプレイリスト行の最小構造を追加し、verify で watch panel fixture と CSS fallback の存在を確認。
- 変更ファイル:
  - `youtube-playlist-date-sorter/content/content.js`
  - `youtube-playlist-date-sorter/content/content.css`
  - `youtube-playlist-date-sorter/fixtures/watch-page.html`
  - `youtube-playlist-date-sorter/verify-date-sorter.mjs`
  - `CLAUDE_CODE_HANDOFF.md`
- verify:
  - ✅ `cd youtube-playlist-date-sorter && node ./verify-date-sorter.mjs` → `date sorter verification passed`
  - ✅ `cd youtube-playlist-date-sorter && node --check ./content/content.js`
- 残リスク:
  - YouTube 実 DOM で `.metadata-wrapper` などの実在パターンと overlay fallback の視認性は、拡張を読み込んだユーザー実機で最終確認が必要。

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

---

## 2026-05-20 23:35 追記（YouTube Playlist Date Sorter MVP — Codex 作成）

- 対象: `youtube-playlist-date-sorter/`
- 作成者: Codex
- 主題: YouTube プレイリスト再生を動画投稿日順に移動する DOM 方式 MVP
- 変更ファイル:
  - `AGENTS.md`
  - `CLAUDE_CODE_HANDOFF.md`
  - `youtube-playlist-date-sorter/manifest.json`
  - `youtube-playlist-date-sorter/shared/date-sorter.js`
  - `youtube-playlist-date-sorter/content/content.js`
  - `youtube-playlist-date-sorter/content/content.css`
  - `youtube-playlist-date-sorter/verify-date-sorter.mjs`
  - `youtube-playlist-date-sorter/fixtures/watch-page.html`
  - `youtube-playlist-date-sorter/AGENTS.md`
  - `youtube-playlist-date-sorter/README.md`
  - `youtube-playlist-date-sorter/icons/icon16.png`
  - `youtube-playlist-date-sorter/icons/icon48.png`
  - `youtube-playlist-date-sorter/icons/icon128.png`
- 実装概要:
  - YouTube `watch` + `list` ページに右下パネルを注入。
  - 表示中プレイリスト DOM から動画 ID を収集し、各動画ページ HTML の `publishDate` / `datePublished` を取得。
  - 古い投稿日順 / 新しい投稿日順でソートし、拡張側が次動画 URL へ遷移。
  - 自動 ON 時は `video ended` で投稿日順の次動画へ移動。
- セルフ verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ `node --check .\shared\date-sorter.js`
  - ✅ manifest JSON parse
- 実動確認:
  - 未実施。Chrome 拡張として `chrome://extensions/` へ読み込み、対象 YouTube URL でパネル表示・取得・次へ遷移を確認する必要あり。
- 残リスク:
  - YouTube DOM 変更で項目検出が壊れる可能性。
  - DOM にロード済みのプレイリスト項目のみ対象。
  - 初期上限 120 件。長大プレイリストは読み込み方式の追加検討が必要。
- 次アクション:
  - Claude Code またはユーザーが実ブラウザで対象 URL を確認し、実DOM差分があれば fixture 化して検出ロジックを調整する。

### 2026-05-20 23:45 追記（投稿日0件取得への対応）

- ユーザー実動確認で「13件を古い投稿日順に準備済み。投稿日取得 0/13」となったため、投稿日抽出を拡張。
- 追加対応:
  - `\u0022` / `\x22` / `&quot;` でエスケープされた YouTube 初期データを正規化して検索。
  - `publishDate` / `uploadDate` / `datePublished` / `article:published_time` を対象化。
  - `dateText.simpleText` / `publishDateText.simpleText` の `YYYY/MM/DD` と `YYYY年M月D日` をISO日付へ正規化。
  - fetch URL に `hl=en&persist_hl=1` を付与。
  - UIに HTTP / 日付なし / 通信失敗の内訳を表示。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ `node --check .\shared\date-sorter.js`

### 2026-05-20 23:55 追記（実HTML確認とfetch経路修正）

- `Invoke-WebRequest` で対象動画の実HTMLを確認し、現在の `extractPublishDateFromHtml()` では `2026-03-28` を抽出できることを確認。
- 残る原因をブラウザ内 `fetch` 経路と見て対応:
  - `manifest.json` に `host_permissions: ["https://www.youtube.com/*"]` を追加。
  - content script の fetch を相対URLから `new URL('/watch', location.origin)` の絶対URL構築へ変更。
  - `cache: 'no-store'`, `bpctr`, `has_verified` を追加。
  - 失敗時に最後の videoId、HTTP status、HTML title、bytes、例外名をUIに表示。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ `node --check .\shared\date-sorter.js`
  - ✅ manifest JSON parse

### 2026-05-21 追記（見た目順の投稿日順並び替え）

- ユーザー要望により、拡張側の次動画制御に加えて右側プレイリストの見た目順も投稿日順へ並び替える対応を追加。
- 追加対応:
  - `state.sortedItems` の順で `ytd-playlist-panel-video-renderer` / `ytd-playlist-video-renderer` の DOM 行を `appendChild` で並び替え。
  - 各行へ `投稿日順 #n YYYY-MM-DD` バッジを付与。
  - 現在動画行を強調表示。
  - YouTube の再描画に備え、`MutationObserver` で表示順とバッジを再適用。
  - playlist ID が変わった場合のみソート状態をリセットし、同一playlist内の動画遷移では表示順を維持。
- 注意:
  - YouTube 本体の内部再生キューは変更しない。再生順は引き続き拡張の「次へ」「自動: ON」で制御する。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ `node --check .\shared\date-sorter.js`
  - ✅ manifest JSON parse

### 2026-05-21 追記（サムネイル点滅対策）

- ユーザー実動確認で、見た目順並び替え後にサムネイルが点滅し続ける問題が発生。
- 原因候補は `MutationObserver` と `appendChild` / バッジ更新が相互に再描画を誘発するループ。
- 対応:
  - 現在DOM順と投稿日ソート順が一致している場合は行移動をスキップ。
  - バッジテキスト、dataset、現在動画classが既に同じ場合はDOM更新しない。
  - 並び替え中フラグ解除を300ms遅延し、YouTube側の直後再描画に反応しすぎないようにした。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`

### 2026-05-21 追記（playlist一覧ページ対応と状態維持）

- ユーザー要望により、ボタン文言と playlist 一覧ページ対応を追加。
- 変更:
  - `取得` ボタンを `並び替え` に変更。
  - `次へ` ボタンを `次の動画へ` に変更。
  - `manifest.json` の content script 対象に `https://www.youtube.com/playlist*` を追加。
  - `permissions: ["storage"]` を追加し、playlist ID 単位で `sortedItems` / `dateByVideoId` / `order` を `chrome.storage.local` に保存。
  - `playlist` ページから同じ playlist の `watch` ページへ遷移した場合、保存済み順序を復元して表示DOMと次動画制御へ反映。
  - `playlist` ページで `次の動画へ` を押した場合、投稿日順の先頭動画へ遷移。
- 注意:
  - 保存済み順序は拡張の状態であり、YouTube アカウントやプレイリスト本体には反映しない。
  - Chrome 権限に `storage` を追加したため、拡張再読み込み時に権限更新が必要な場合がある。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ manifest JSON parse

### 2026-05-21 追記（watch画面復元と並び替え待機の修正）

- ユーザー実動確認で、playlist一覧では並び替わるが、watch画面に反映されず、watch画面の `並び替え` ボタンも反応しない問題が発生。
- 原因候補:
  - 一覧からwatchへのSPA遷移直後、playlist panel行がまだDOMに存在しない段階で復元・並び替えを試して失敗していた。
  - 同一playlist ID内の遷移では保存復元を再実行しないため、watch側DOMロード後の再適用が不足していた。
- 対応:
  - `並び替え` 押下時、最大6秒 playlist項目DOMを待ってから投稿日取得へ進む。
  - URL変更時に保存済み/メモリ上のソート状態があれば 250ms / 1000ms / 2500ms で見た目順と現在動画強調を再適用。
  - 復元状態の記録を、保存データが実際に見つかった後に行うよう修正。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ manifest JSON parse

### 2026-05-21 追記（watch画面DOM検出の拡張）

- ユーザー実動確認で、まだwatch画面の見た目順へ反映されない。
- 対応:
  - watch側の playlist panel 差分に備え、対象セレクタを `ytd-playlist-panel-video-wrapper-renderer` / `ytd-playlist-panel-renderer a[href*="/watch"]` まで拡張。
  - `/watch?` 固定をやめ、`/watch` を含むhrefを対象に変更。
  - 見た目反映時の `rows` / `matched` / `mixed parents` / `sorted` をUIステータス末尾に表示するデバッグ情報を追加。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ `node --check .\shared\date-sorter.js`

### 2026-05-21 追記（playlist画面回帰の切り戻し）

- watch画面DOM検出拡張後、ユーザー実動確認でplaylist一覧画面の並び替えが効かなくなった。
- 対応:
  - playlist画面とwatch画面の行検出セレクタを分離。
  - playlist画面は従来の `ytd-playlist-video-renderer` 系を優先。
  - watch画面のみ `ytd-playlist-panel-video-wrapper-renderer` / panel配下リンク逆引きを使う。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ `node --check .\shared\date-sorter.js`

### 2026-05-21 追記（並び替え中ローディング表示）

- ユーザー要望により、並び替え処理中のローディングUIを追加。
- 変更:
  - パネル内に進捗バーと進捗ラベルを追加。
  - `並び替え` 実行中はボタンを `並び替え中...` に変更し、`並び替え` / `次の動画へ` ボタンを無効化。
  - プレイリスト項目待機、投稿日取得、表示並び替えのフェーズを表示。
  - 投稿日取得中は完了件数を `n/total` で更新。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ manifest JSON parse

### 2026-05-21 追記（YouTube本体並び替え後のバッジ追従）

- ユーザー実動確認で、YouTube本体のプレイリスト並び替え機能を使うと、投稿日順バッジが古い行に残る問題が発生。
- 対応:
  - バッジ・現在動画class・datasetを再適用前に全行からクリアして、現在の `videoId -> row` 対応に基づいて付け直す。
  - 拡張の `並び替え` / 保存復元直後は投稿日順へDOM移動する。
  - その後のYouTube本体側の並び替え・再描画では、DOM順を強制的に戻さず、バッジだけ現在の行へ追従させる `badges` モードへ切り替える。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`

### 2026-05-21 追記（ページ再読み込み後の古いバッジ抑止）

- ユーザー実動確認で、ページ再読み込み後も保存済みプレイリストに古い投稿日順バッジが表示され、現在のYouTube表示順と合わない問題が発生。
- 対応:
  - 保存済み状態の復元時は `sortedItems` / `dateByVideoId` / `order` だけをメモリへ戻し、バッジ表示は有効化しない。
  - 復元時に既存バッジ・強調表示をクリア。
  - ユーザーが `並び替え` を押した時だけ `badgesEnabled=true` として、DOM並び替えとバッジ表示を行う。
  - playlist ID が変わった時もバッジ表示を無効化して装飾をクリア。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`

### 2026-05-21 追記（YouTube本体並び替え後のバッジ再同期強化）

- ユーザー実動確認で、ページ再読み込み後の古いバッジは消えたが、YouTube本体の並び替え後のバッジズレは残っていた。
- 対応:
  - 拡張の `並び替え` 直後に投稿日順DOM移動を行った後、`badges` モードへ切り替える。
  - `badges` モードではYouTube本体の表示順を強制的に戻さず、現在の `videoId -> row` 対応でバッジのみ再同期する。
  - `MutationObserver` を `attributes` 変更にも反応させる。
  - YouTubeが同一行DOMの中身だけ差し替える場合に備え、1.5秒間隔で軽くバッジ再同期する。
  - バッジ更新自体でObserverループしないよう、バッジ付け直し中も抑制フラグを立てる。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`

### 2026-05-21 追記（YouTube本体並び替え時はバッジ非表示へ変更）

- ユーザー判断により、YouTube本体の並び替え後にバッジ追従を頑張るより、バッジ非表示へ倒す方針へ変更。
- 対応:
  - 拡張の `並び替え` 後は一度バッジを表示。
  - その後、YouTube本体機能などでDOM順が保存済み投稿日順とずれた場合、`badgesEnabled=false` にして投稿日順バッジと強調表示をクリア。
  - 再び投稿日順バッジを出すには、拡張の `並び替え` を押す。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`

### 2026-05-21 追記（watch遷移時の保存済み順序復元をバッジなしで維持）

- ユーザー実動確認で、YouTube本体並び替え時のバッジ非表示対応後、playlist一覧からwatch画面へ行った時の並び替え保持が効かなくなった。
- 原因:
  - 保存復元時に `badgesEnabled=false` としたことで、watch画面DOMへの保存済み順序再適用まで止まっていた。
- 対応:
  - 復元時は `applySavedOrderWithoutBadges()` で、保存済み投稿日順へDOMだけ並び替え、バッジは表示しない。
  - watch側DOM遅延ロードに備えて 250ms / 1000ms / 2500ms でバッジなし再適用を行う。
  - バッジ表示は引き続き、ユーザーが拡張の `並び替え` を押した時だけ有効化。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`

### 2026-05-21 追記（バッジなし復元とSPAパネル表示の修正）

- ユーザー実動確認で、82件 playlist の watch 画面で `native order detected` となり、保存済み順序が反映されない問題が発生。
- 併せて、各ページから playlist へSPA遷移した時にパネルが表示されず、リロードで表示される問題が発生。
- 原因:
  - バッジなし復元も `visualMode !== 'sorted'` のネイティブ並び替え検出分岐に落ち、DOM移動を止めていた。
  - URL変更なし/遅延DOM更新時のパネル欠落再評価が不足していた。
- 対応:
  - `forceOrderWithoutBadges` を追加し、保存済み順序復元時だけバッジ非表示のままDOM順を強制適用。
  - `onNavigationMaybeChanged()` でURL変更がなくても、対応ページでパネルが欠落していれば `ensurePanel()` と復元を再実行。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`

### 2026-05-21 追記（同一playlistのplaylist→watch遷移保持）

- ユーザー実動確認で、同一 playlist ID の `/playlist` から `/watch` へ遷移した時、`native order detected` となり保存済み順序が反映されない問題が継続。
- 原因:
  - playlist ID が同じため `restoreSortState()` が `restoredPlaylistId === playlistId` で早期 return。
  - 一覧ページでの `badgesEnabled=true` / `visualMode=badges` が watch 画面へ持ち越され、watch側でネイティブ並び替え検出扱いになっていた。
- 対応:
  - `lastPathname` を追加し、playlist ID が同じでも `/playlist` ↔ `/watch` のページ種別が変わったら処理する。
  - ページ種別変更時、メモリ上の `sortedItems` があれば `badgesEnabled=false` にし、バッジなしで保存済み順序を強制再適用。
  - DOM遅延に備えて 250ms / 1000ms / 2500ms で再適用。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`

### 2026-05-21 追記（日英切り替え）

- ユーザー要望により、YouTube Playlist Date Sorter のパネル表示を日本語 / English で切り替えられるようにした。
- 変更したファイル:
  - `youtube-playlist-date-sorter/content/content.js`
  - `youtube-playlist-date-sorter/content/content.css`
  - `youtube-playlist-date-sorter/README.md`
- 実装概要:
  - content script 内に日本語 / 英語の表示文言辞書を追加。
  - パネル上部に表示言語セレクトを追加。
  - 選択言語を `chrome.storage.local` の `ytpds:settings` に保存し、playlist ID 単位の並び替え保存とは分離。
  - ボタン、ステータス、進捗、保存済み状態、投稿日順バッジを選択言語で再描画。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ manifest JSON parse
- 実動確認:
  - 未実施。ログイン済み YouTube 実機で、言語切り替え、再読み込み後の言語保持、並び替え後バッジの言語反映を確認する。
- 残リスク:
  - YouTube 実DOM上でパネル幅 260px に英語文言が収まるかは実機確認が必要。
- 次アクション:
  - ユーザー実機で playlist / watch の両画面を開き、表示言語切り替えと既存の並び替え復元を確認する。

### 2026-05-21 追記（日英切り替えをpopupへ移動）

- ユーザー判断により、YouTubeページ上のメインパネルから表示言語セレクトを削除し、拡張アイコン押下時の popup で操作する形へ変更。
- 変更したファイル:
  - `youtube-playlist-date-sorter/manifest.json`
  - `youtube-playlist-date-sorter/content/content.js`
  - `youtube-playlist-date-sorter/content/content.css`
  - `youtube-playlist-date-sorter/popup/popup.html`
  - `youtube-playlist-date-sorter/popup/popup.css`
  - `youtube-playlist-date-sorter/popup/popup.js`
  - `youtube-playlist-date-sorter/README.md`
- 実装概要:
  - `action.default_popup` に `popup/popup.html` を追加。
  - popup で日本語 / English を選択し、既存の `ytpds:settings` に保存。
  - content script は `chrome.storage.onChanged` で設定変更を受け取り、ページ上パネルとバッジ文言を再描画。
  - ページ上パネルは並び順セレクト、並び替え、次の動画へ、自動ON/OFFだけに戻した。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ `node --check .\popup\popup.js`
  - ✅ `node --check .\shared\i18n.js`
  - ✅ manifest refs check
- 実動確認:
  - 未実施。Chrome拡張を再読み込みし、拡張アイコンの popup で言語変更 → YouTubeページ上パネルへ即時反映されるか確認する。

### 2026-05-21 追記（ページ上パネル最小化を追加）

- ユーザー要望により、YouTube Playlist Date Sorter の右下パネルを最小化して表示領域を減らせるようにした。
- 変更したファイル:
  - `youtube-playlist-date-sorter/content/content.js`
  - `youtube-playlist-date-sorter/popup/popup.js`
  - `youtube-playlist-date-sorter/content/content.css`
  - `youtube-playlist-date-sorter/shared/i18n.js`
  - `youtube-playlist-date-sorter/README.md`
- 実装概要:
  - ページ上パネルの右上に「最小化」/「展開」ボタンを追加。
  - 最小化中はタイトルバーだけを残し、操作本体を `hidden` にして占有領域を減らす。
  - `ytpds:settings.panelCollapsed` として保存し、再読み込み後も最小化状態を維持する。
  - popup の言語変更時に `panelCollapsed` を消さないよう、設定オブジェクトを保持する。
- verify:
  - ✅ `node .\verify-date-sorter.mjs`
  - ✅ `node --check .\content\content.js`
  - ✅ `node --check .\popup\popup.js`
  - ✅ `node --check .\shared\i18n.js`
- 実動確認:
  - 未実施。Chrome拡張を再読み込みし、YouTube playlist / watch 画面で右下パネルの「最小化」/「展開」と再読み込み後の状態保持を確認する。
