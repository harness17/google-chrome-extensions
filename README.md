# Google Chrome Extensions

Chrome 拡張のコレクションです。すべて **Manifest V3 / 素の JavaScript** で実装。

## 拡張一覧

| 拡張 | 対象サイト | 概要 |
|------|-----------|------|
| [amazon-wishlist-sale-picker](amazon-wishlist-sale-picker/) | Amazon.co.jp | 欲しいものリストからセール中の商品だけを抽出 |

---

## 共通の開発フロー

### ブラウザに読み込む

1. `chrome://extensions/` を開く
2. 右上「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」→ 各拡張のフォルダを選択
4. コード変更後は 🔄 ボタンで再読み込み（自動反映なし）

### 新しい拡張を追加する

Claude Code で以下を実行すると雛形が生成されます:

```
/new-chrome-extension <name>
```

---

## ライセンス

MIT
