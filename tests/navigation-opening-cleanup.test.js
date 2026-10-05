// Capture has no navigation links of its own; Opening tag; no pre-release wording; no bundled samples.
'use strict';
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { loadPage, wait, closeAllWindows, fixtureCsv } = require('./helpers');
after(() => { closeAllWindows(); });
const SUITE = path.resolve(__dirname, '..');

describe('Capture navigation', () => {
  test('no menu, start screen or links that duplicate the sidebar, Setup or Export', async () => {
    const dom = loadPage('minutes.html'); await wait(700);
    const d = dom.window.document;
    ['sessionMenu', 'welcomeGate', 'sessionStartNewBtn', 'sessionDownloadBtn', 'sessionReturnWelcomeBtn', 'newSingingBtn', 'resumeSessionBtn'].forEach((id) => assert.equal(d.getElementById(id), null, id));
    assert.doesNotMatch(d.getElementById('mainApp').textContent, /Return to welcome/);
    assert.notEqual(d.getElementById('mainApp').style.display, 'none');
  });
});

describe('Opening tag', () => {
  test('a song tagged Opening gets the call-to-order sentence even after a prayer marker', async () => {
    const t = fixtureCsv('simple').text.split('\r\n');
    const cols = t[0].split(','), tagIdx = cols.indexOf('Tag');
    const mk = (line) => { const c = line.split(','); c[cols.indexOf('Record Type')] = 'marker'; c[cols.indexOf('Marker')] = 'PRAYER'; c[cols.indexOf('Leader(s)')] = 'Pat Chair'; c[cols.indexOf('Book')] = ''; c[cols.indexOf('Page')] = ''; return c.join(','); };
    const tag = (line, v) => { const c = line.split(','); c[tagIdx] = v; return c.join(','); };
    const rows = [t[0], t[1], mk(t[2]), t[2], tag(t[3], 'Opening')].concat(t.slice(4));
    const dom = loadPage('minutes.html'); await wait(700);
    const win = dom.window, d = win.document;
    win.HTMLElement.prototype.scrollIntoView = function () {};
    const inp = d.getElementById('importFileInput');
    Object.defineProperty(inp, 'files', { value: [new win.File([rows.join('\r\n')], 'm.csv')], configurable: true });
    inp.dispatchEvent(new win.Event('change', { bubbles: true })); await wait(1200);
    d.getElementById('stageBtn-export').click(); await wait(800);
    assert.match(d.getElementById('previewText').textContent, /called to order by Bob Roe/);
    // and it is a choice in the Song List tag menu
    d.getElementById('stageBtn-compile').click(); await wait(500);
    d.querySelector('[data-panel-target="songs"]').click(); await wait(300);
    const opts = Array.from(d.querySelectorAll('#songBody select')).some((sel) => Array.from(sel.options).some((o) => o.value === 'Opening'));
    assert.ok(opts);
  });
});

describe('Release wording and bundled data', () => {
  test('no pre-release language in the app or the instructions', () => {
    ['index.html', 'instructions.html'].forEach((f) => {
      const s = fs.readFileSync(path.join(SUITE, f), 'utf8');
      assert.doesNotMatch(s, /pre-?release/i, f);
      assert.match(s, /Feedback is welcome/, f);
    });
  });
  test('no historical samples ship with the app', () => {
    assert.equal(fs.existsSync(path.join(SUITE, 'samples')), false);
    ['README.md', 'index.html', 'instructions.html'].forEach((f) => assert.doesNotMatch(fs.readFileSync(path.join(SUITE, f), 'utf8'), /samples\//, f));
  });
});
