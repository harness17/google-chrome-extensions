# Google Chrome Extensions

Chrome 拡張のコレクションです。すべて **Manifest V3 / 素の JavaScript** で実装。

## 拡張一覧

| 拡張 | 対象サイト | 概要 |
|------|-----------|------|
| [amazon-wishlist-sale-picker](amazon-wishlist-sale-picker/) | Amazon.co.jp | 欲しいものリストからセール中の商品だけを抽出。日英 UI と全リスト横断スキャンに対応 |
| [youtube-playlist-date-sorter](youtube-playlist-date-sorter/) | YouTube | プレイリストの表示順を動画投稿日順に並び替え、その順序で次の動画へ移動 |

---

## 共通の開発フロー

### 検証する

拡張ごとの検証スクリプトを優先します。

```powershell
Push-Location .\amazon-wishlist-sale-picker
node .\verify-detect.mjs
Pop-Location

Push-Location .\youtube-playlist-date-sorter
node .\verify-date-sorter.mjs
Pop-Location
```

### ブラウザに読み込む

1. `chrome://extensions/` を開く
2. 右上「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」→ 各拡張のフォルダを選択
4. コード変更後は 🔄 ボタンで再読み込み（自動反映なし）

### 新しい拡張を追加する

Claude Code / Codex の新規拡張スキルで雛形を生成します:

```
/new-chrome-extension <name>
```

### 公開前の注意

Chrome Web Store 向けの zip、スクリーンショット、host permissions、公開判断はユーザー確認を挟みます。ログイン必須サイトの DOM は DevTools で取得した fixture を保存して回帰検証します。

---

## ライセンス

MIT
