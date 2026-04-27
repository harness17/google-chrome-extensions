# フィクスチャ HTML の取得手順

`fixtures/*.html` は Amazon ウィッシュリストの実 DOM スニペットです。
`detectSale()` の回帰検証 (`node verify-detect.mjs`) に使います。

---

## 手順

1. **Chrome で欲しいものリストを開く**  
   `https://www.amazon.co.jp/hz/wishlist/ls/<あなたのリストID>`

2. **DevTools を開く**  
   `F12` → Elements タブ

3. **対象の商品 `<li>` 要素を特定する**  
   - セール中の商品なら `.wl-deal-rich-badge` を持つ `li[data-id]`
   - 価格下落商品なら `.itemPriceDrop` を持つ `li[data-id]`
   - 通常価格の商品なら上記が無い `li[data-id]`

4. **`<li>` 要素を右クリック → 「Copy → Copy outerHTML」**

5. **ファイルに保存**  
   `fixtures/<ASIN>-<説明>.html`  
   例: `fixtures/B0DQWP6LX1-timesale.html`

6. **verify-detect.mjs にテストケースを追加する**

```js
{
  name: 'B0XXXXXXXX (パターンの説明)',
  file: 'fixtures/B0XXXXXXXX-description.html',
  expectSale: true,      // または false
  expectDiscount: 15,    // 期待する割引率 (不明なら 0)
},
```

7. **回帰検証を実行する**

```bash
node verify-detect.mjs
```

---

## 既存フィクスチャ一覧

| ファイル | ASIN | 内容 | detectSale の期待値 |
|---------|------|------|-------------------|
| `sale-item.html` | B0DQWP6LX1 | タイムセール 15%OFF バッジ付き | `isSale=true, discount=15%` |
| `normal-item.html` | B07TKLB1ML | 通常価格（セールなし） | `isSale=false, discount=0%` |
| `price-drop-item.html` | B00ICCU4U4 | 価格下落通知 30% | `isSale=true, discount=30%` |

---

## 注意事項

- HTML は **取得時点のスナップショット** です。Amazon が DOM 構造を変更したら古くなります。
- 個人情報（住所・注文履歴など）が含まれないよう、`li[data-id]` 要素のみをコピーしてください。
- `node_modules/` はコミットしません。`npm install --no-save jsdom` で都度インストールしてください。
