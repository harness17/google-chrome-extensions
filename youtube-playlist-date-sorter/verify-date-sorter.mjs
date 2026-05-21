import assert from 'assert/strict';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sorter = require('./shared/date-sorter.js');
const i18n = require('./shared/i18n.js');

const html = readFileSync('fixtures/watch-page.html', 'utf8');
assert.equal(sorter.extractPublishDateFromHtml(html), '2024-03-05');
assert.equal(
  sorter.extractPublishDateFromHtml('window["ytInitialPlayerResponse"]="{\\u0022microformat\\u0022:{\\u0022playerMicroformatRenderer\\u0022:{\\u0022publishDate\\u0022:\\u00222023-07-09\\u0022}}}"'),
  '2023-07-09'
);
assert.equal(
  sorter.extractPublishDateFromHtml('{"dateText":{"simpleText":"2022年4月3日"}}'),
  '2022-04-03'
);
assert.equal(
  sorter.extractPublishDateFromHtml('{"publishDateText":{"simpleText":"2021/6/12"}}'),
  '2021-06-12'
);

const fakeTitle = {
  textContent: ' First Stream ',
  getAttribute(name) {
    return name === 'title' ? 'First Stream' : null;
  },
};
const fakeRow = {
  querySelector(selector) {
    return selector === '#video-title' ? fakeTitle : null;
  },
};
const fakeAnchor = {
  href: 'https://www.youtube.com/watch?v=first&list=PLtest&index=1',
  textContent: 'fallback',
  closest() {
    return fakeRow;
  },
  getAttribute(name) {
    return name === 'href' ? this.href : null;
  },
};
const fakeDocument = {
  querySelectorAll() {
    return [fakeAnchor, fakeAnchor];
  },
};
assert.deepEqual(sorter.extractPlaylistItemsFromDocument(fakeDocument), [
  { videoId: 'first', title: 'First Stream', originalIndex: 0 },
]);

const items = [
  { videoId: 'newer', title: 'newer', originalIndex: 0 },
  { videoId: 'older', title: 'older', originalIndex: 1 },
  { videoId: 'unknown', title: 'unknown', originalIndex: 2 },
];
const dates = {
  newer: '2024-03-05',
  older: '2021-01-10',
};

const asc = sorter.sortItemsByPublishDate(items, dates, 'asc');
assert.deepEqual(
  asc.map((item) => item.videoId),
  ['older', 'newer', 'unknown']
);
assert.equal(sorter.findNextVideoId(asc, 'older'), 'newer');
assert.equal(
  sorter.buildWatchUrl('abc123', 'PLtest'),
  'https://www.youtube.com/watch?v=abc123&list=PLtest'
);

const desc = sorter.sortItemsByPublishDate(items, dates, 'desc');
assert.deepEqual(
  desc.map((item) => item.videoId),
  ['newer', 'older', 'unknown']
);

assert.equal(i18n.normalizeLanguage('en'), 'en');
assert.equal(i18n.normalizeLanguage('fr'), 'ja');
assert.equal(i18n.translate('en', 'sort'), 'Sort');
assert.equal(i18n.translate('en', 'minimize'), 'Minimize');
assert.equal(i18n.translate('ja', 'expand'), '展開');
assert.equal(i18n.translate('ja', 'badge', 2, '2024-03-05'), '投稿日順 #2 2024-03-05');

console.log('date sorter verification passed');
