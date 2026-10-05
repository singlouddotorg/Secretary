// Compile used to wipe the current project to freshState() before the replacement file
// had even been read, let alone validated - an unreadable or malformed replacement meant
// the real project was already gone with no way back. This is the single most serious
// bug found across every review of this suite; this test exists so it can never
// regress silently.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadStage, importIntoCompile, wait, fixtureCsv, closeAllWindows } = require('./helpers');

const HEADER = 'Schema Version,Order of entry,Record Type,Session Label,Session ID,Metadata Field,Metadata Value,Event,Date,Location,Chair,Vice-Chair,Secretary,Treasurer,Arranger(s),Chaplain,Memorial Lesson Leader,Book,Edition Code,Leader(s),Canonical Leader(s),Page,Song,Tag,Notes,Marker,Timestamp ISO,Time entered'.split(',');

function row(fields) {
  const r = new Array(HEADER.length).fill('');
  for (const [k, v] of Object.entries(fields)) {
    const idx = HEADER.indexOf(k);
    if (idx === -1) throw new Error(`Unknown column: ${k}`);
    r[idx] = v;
  }
  return r.join(',');
}

async function loadCompileWithProject() {
  const dom = await loadStage('compile');
  const doc = dom.window.document;
  const goodCsv = fixtureCsv('simple', 'Test Singing').text;
  importIntoCompile(dom.window, goodCsv, 'good.csv', 'text/csv');
  await wait(800);
  return { dom, doc };
}

after(closeAllWindows);

describe('Compile: transactional import (no data loss on a failed replacement)', () => {
  test('a malformed (empty) replacement file rolls back to the original project', async () => {
    const { dom, doc } = await loadCompileWithProject();
    const originalName = doc.getElementById('m_name').value;
    assert.ok(originalName, 'Expected a real project to be loaded first');

    importIntoCompile(dom.window, '', 'empty.csv', 'text/csv');
    await wait(800);

    assert.equal(doc.getElementById('m_name').value, originalName, 'Original project name should survive a failed replacement');
    assert.match(doc.getElementById('importStatus').textContent, /restored/i);
  });

  test('a file with no recognizable columns rolls back to the original project', async () => {
    const { dom, doc } = await loadCompileWithProject();
    const originalName = doc.getElementById('m_name').value;

    importIntoCompile(dom.window, 'foo,bar,baz\n1,2,3', 'garbage.csv', 'text/csv');
    await wait(800);

    assert.equal(doc.getElementById('m_name').value, originalName);
    assert.match(doc.getElementById('importStatus').textContent, /restored/i);
  });

  test('duplicate session-boundary IDs in the replacement roll back to the original project', async () => {
    const { dom, doc } = await loadCompileWithProject();
    const originalName = doc.getElementById('m_name').value;

    const dupCsv = [
      HEADER.join(','),
      row({ 'Schema Version': '4', 'Order of entry': '1', 'Record Type': 'session', 'Session ID': 'dup1', Event: 'Test' }),
      row({ 'Schema Version': '4', 'Order of entry': '2', 'Record Type': 'song', 'Session ID': 'dup1', Book: 'SHM1991', 'Leader(s)': 'A', Page: '1' }),
      row({ 'Schema Version': '4', 'Order of entry': '3', 'Record Type': 'session', 'Session ID': 'dup1' }),
    ].join('\n');
    importIntoCompile(dom.window, dupCsv, 'dup.csv', 'text/csv');
    await wait(800);

    assert.equal(doc.getElementById('m_name').value, originalName);
    assert.match(doc.getElementById('importStatus').textContent, /restored/i);
  });

  test('cancelling the replacement confirm leaves the project completely untouched', async () => {
    const dom = await loadStage('compile', { confirm: () => true });
    const doc = dom.window.document;
    const goodCsv = fixtureCsv('simple', 'Test Singing').text;
    importIntoCompile(dom.window, goodCsv, 'good.csv', 'text/csv');
    await wait(800);
    const originalName = doc.getElementById('m_name').value;

    dom.window.confirm = () => false; // user clicks Cancel
    const replacementCsv = fixtureCsv('multi', 'Replacement Convention').text;
    importIntoCompile(dom.window, replacementCsv, 'x.csv', 'text/csv');
    await wait(500);

    assert.equal(doc.getElementById('m_name').value, originalName);
  });

  test('a genuinely valid replacement still succeeds normally', async () => {
    const { dom, doc } = await loadCompileWithProject();
    const replacementCsv = fixtureCsv('multi', 'Replacement Convention').text;
    importIntoCompile(dom.window, replacementCsv, 'replacement.csv', 'text/csv');
    await wait(800);
    assert.match(doc.getElementById('m_name').value, /Replacement Convention/);
  });
});
