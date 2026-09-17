// The Secretary half of a contract the two apps share: a book's Full Title must really be
// built from Title Proper + Subtitle, not just Title Proper.
//
// Both apps call buildFullTitle() in shared-utils.js, so both must agree. This used to be
// one test in tunebooks-level3.test.js that loaded both applications - fine while they
// shared a repo, impossible once they don't. Each side now asserts its own half against
// the same real library data, and the two halves together are the contract.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { loadPage, wait, closeAllWindows } = require('./helpers');

test.after(closeAllWindows);

test('Secretary-side book projection includes the real subtitle in fullTitle', async () => {
  const dom = loadPage('minutes.html');
  const win = dom.window;
  win.confirm = () => true;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  await wait(700);

  // SoH1854 is a real shipped edition whose subtitle ("New Edition, Thoroughly Revised")
  // exists only in the subtitle field - if fullTitle were titleProper alone, this text
  // could not appear at all.
  const fullTitle = win.eval("EZ_MINUTES_TUNEBOOKS.books['SoH1854'].fullTitle");
  assert.match(fullTitle, /New Edition, Thoroughly Revised/,
    'The real subtitle must actually appear in fullTitle, not just titleProper alone');
});
