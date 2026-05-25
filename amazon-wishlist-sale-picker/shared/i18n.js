(function (root) {
  const LANGUAGE_KEY = 'wsp_language';
  const DEFAULT_LANGUAGE = 'ja';
  const SUPPORTED_LANGUAGES = ['ja', 'en'];

  const MESSAGES = {
    ja: {
      languageLabel: '言語',
      languageJa: '日本語',
      languageEn: 'English',
      saleItemCount: 'セール商品数',
      maxDiscount: '最高割引率',
      itemUnit: '件',
      popupHint: 'ウィッシュリストページで設定値とソート方法を変更できます。',
      crossScanButton: '全リスト横断スキャン',
      crossScanLoadingLists: 'リスト取得中...',
      crossScanScanning: 'スキャン中...',
      crossScanListError: 'リストを取得できませんでした。ページを再読み込みしてください。',
      crossScanStarted:
        '{count} 件のリストをスキャン中。スキャン用ウィンドウが開きます（完了まで触らずにお待ちください）。結果は結果ページに表示されます。',
      crossScanAlreadyRunning: '既に横断スキャンが実行中です。',
      crossScanStartError: 'スキャンを開始できませんでした。',
      crossScanRunningHint: '横断スキャンを実行中です。結果ページを確認してください。',
      crossScanReadyHint: 'サイドバーの全リストを横断してセール商品を集約します。',
      crossScanOpenWishlistHint: 'ウィッシュリストページを開いてから実行してください。',
      showSaleOnly: 'セールのみ表示',
      itemCountSuffix: '件',
      minDiscount: '最低割引率:',
      maxPrice: '最高価格:',
      noLimitPlaceholder: '0=制限なし',
      sort: 'ソート:',
      sortDiscountDesc: '割引率: 高い順',
      sortDiscountAsc: '割引率: 低い順',
      sortPriceAsc: '価格: 安い順',
      sortPriceDesc: '価格: 高い順',
      overlayTitle: '全件読み込み中',
      overlaySubtitle: 'セール判定のため、ウィッシュリストを末尾までスキャンしています',
      overlayProgressWithTotal: '{count} / {total} 件 読み込み済み',
      overlayProgress: '{count}件 読み込み済み',
      loading: '読み込み中...',
      showAllItems: '全件表示に戻す',
      noSaleItems: 'セール中の商品はありません',
      filterMinDiscount: '{value}% 以上',
      filterMaxPrice: '¥{value} 以下',
      filtering: '{filters} で絞り込み中',
      currentList: 'このリスト',
      unknownItemTitle: '(商品名不明)',
      productListNotFound: '商品リストが見つかりませんでした',
      resultsTitle: '横断セール確認',
      resultsPageTitle: '横断セール確認 - 結果',
      preparingScan: 'スキャンを準備しています...',
      statusPending: '待機中',
      statusScanning: 'スキャン中...',
      statusOk: '完了',
      statusError: 'エラー',
      listSaleCount: '{count} 件のセール',
      scanFailed: 'スキャンに失敗しました: {error}',
      unknownError: '不明なエラー',
      noLists: 'スキャン対象のリストがありません。',
      scanRunningSummary:
        'スキャン中... ({done} / {total} リスト完了 / セール {sale} 件)',
      scanCompleteSummary:
        'スキャン完了。{total} リスト中 {sale} 件のセール商品が見つかりました。',
      scanErrorSuffix: ' ({count} リストでエラー)',
      stateLoadError: '状態を取得できませんでした。',
    },
    en: {
      languageLabel: 'Language',
      languageJa: 'Japanese',
      languageEn: 'English',
      saleItemCount: 'Sale items',
      maxDiscount: 'Best discount',
      itemUnit: 'items',
      popupHint: 'Change filters and sort order on the wishlist page.',
      crossScanButton: 'Scan all lists',
      crossScanLoadingLists: 'Loading lists...',
      crossScanScanning: 'Scanning...',
      crossScanListError: 'Could not load lists. Reload the page and try again.',
      crossScanStarted:
        'Scanning {count} lists. A scan window will open. Leave it untouched until the scan finishes. Results appear on the results page.',
      crossScanAlreadyRunning: 'A cross-list scan is already running.',
      crossScanStartError: 'Could not start the scan.',
      crossScanRunningHint: 'A cross-list scan is running. Check the results page.',
      crossScanReadyHint: 'Scan all lists in the sidebar and collect sale items.',
      crossScanOpenWishlistHint: 'Open a wishlist page before running this.',
      showSaleOnly: 'Show sale items',
      itemCountSuffix: 'items',
      minDiscount: 'Min discount:',
      maxPrice: 'Max price:',
      noLimitPlaceholder: '0=no limit',
      sort: 'Sort:',
      sortDiscountDesc: 'Discount: high to low',
      sortDiscountAsc: 'Discount: low to high',
      sortPriceAsc: 'Price: low to high',
      sortPriceDesc: 'Price: high to low',
      overlayTitle: 'Loading all items',
      overlaySubtitle: 'Scanning to the end of the wishlist to detect sale items',
      overlayProgressWithTotal: '{count} / {total} items loaded',
      overlayProgress: '{count} items loaded',
      loading: 'Loading...',
      showAllItems: 'Show all items',
      noSaleItems: 'No sale items found',
      filterMinDiscount: '{value}% or more',
      filterMaxPrice: 'Up to ¥{value}',
      filtering: 'Filtering by {filters}',
      currentList: 'This list',
      unknownItemTitle: '(Unknown item)',
      productListNotFound: 'Product list was not found',
      resultsTitle: 'Cross-list sale scan',
      resultsPageTitle: 'Cross-list sale scan - Results',
      preparingScan: 'Preparing scan...',
      statusPending: 'Pending',
      statusScanning: 'Scanning...',
      statusOk: 'Done',
      statusError: 'Error',
      listSaleCount: '{count} sale items',
      scanFailed: 'Scan failed: {error}',
      unknownError: 'Unknown error',
      noLists: 'No lists to scan.',
      scanRunningSummary:
        'Scanning... ({done} / {total} lists done / {sale} sale items)',
      scanCompleteSummary:
        'Scan complete. Found {sale} sale items across {total} lists.',
      scanErrorSuffix: ' ({count} lists had errors)',
      stateLoadError: 'Could not load scan state.',
    },
  };

  function normalizeLanguage(language) {
    return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  }

  function format(message, values) {
    if (!values) return message;
    return message.replace(/\{(\w+)\}/g, (_, key) =>
      Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : `{${key}}`
    );
  }

  function createTranslator(language) {
    const normalized = normalizeLanguage(language);
    const messages = MESSAGES[normalized] || MESSAGES[DEFAULT_LANGUAGE];
    return function t(key, values) {
      return format(messages[key] || MESSAGES[DEFAULT_LANGUAGE][key] || key, values);
    };
  }

  async function getLanguage() {
    try {
      const data = await chrome.storage.local.get(LANGUAGE_KEY);
      return normalizeLanguage(data[LANGUAGE_KEY]);
    } catch (e) {
      return DEFAULT_LANGUAGE;
    }
  }

  async function setLanguage(language) {
    const normalized = normalizeLanguage(language);
    await chrome.storage.local.set({ [LANGUAGE_KEY]: normalized });
    return normalized;
  }

  const api = {
    LANGUAGE_KEY,
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    MESSAGES,
    normalizeLanguage,
    createTranslator,
    getLanguage,
    setLanguage,
  };

  root.__WSP_I18N__ = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
