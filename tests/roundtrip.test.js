// Every bundled-style Singing Record must import cleanly into both Capture and Compile, with
// no thrown JS errors and no rows lost. Uses small synthetic fixtures (no real singing is
// shipped with the app).
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadStage, pickFile, importIntoCompile, fixtureCsv, wait, closeAllWindows } = require('./helpers');

after(closeAllWindows);

describe('Capture + Compile round-trip on synthetic Singing Records', () => {
  for (const kind of ['simple', 'multi']) {
    const fx = fixtureCsv(kind);
    const filename = 'fixture-' + kind + '.csv';
    test(`${kind} imports cleanly into Capture with zero JS errors`, async () => {
      const dom = await loadStage('minutes');
      const doc = dom.window.document;
      pickFile(dom.window, doc.getElementById('csvFileInput'), fx.text, filename, 'text/csv');
      await wait(800);
      assert.deepEqual(dom.__errors, [], `Capture threw JS error(s) loading ${filename}`);
      const logText = doc.getElementById('logCount').textContent;
      assert.match(logText, new RegExp(`\\(${fx.rowCount}\\)`), `Capture log count for ${filename}: "${logText}"`);
    });
    test(`${kind} imports cleanly into Compile with zero JS errors`, async () => {
      const dom = await loadStage('compile');
      const doc = dom.window.document;
      importIntoCompile(dom.window, fx.text, filename, 'text/csv');
      await wait(800);
      assert.deepEqual(dom.__errors, [], `Compile threw JS error(s) loading ${filename}`);
      const statusText = doc.getElementById('importStatus').textContent;
      assert.match(statusText, new RegExp(`^${fx.rowCount} row`), `Compile status: "${statusText}"`);
      assert.doesNotMatch(statusText.toLowerCase(), /error|invalid|rejected|blank|could not/, `Compile status mentions a problem: "${statusText}"`);
    });
  }
});
