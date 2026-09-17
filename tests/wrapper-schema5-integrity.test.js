// Regression coverage for a real cluster of Schema-5, multi-session bugs found in an
// external release-readiness review (R57-01, R57-02, R57-06, R57-07) - added here because
// none of the bundled sample CSVs are Schema 5, and none of the existing tests exercised a
// singing with more than one session at all. Every assertion below traces back to a bug
// that was confirmed live before being fixed, not a hypothetical concern.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { loadPage, suitePath, wait, closeAllWindows, suiteAppPath } = require('./helpers');

after(() => { closeAllWindows(); });

// Builds a real, complete two-session singing through the actual UI - Setup, Capture Day 1,
// Start New Session, Capture Day 2 - exactly the sequence a real secretary would follow for
// a two-day convention. Returns the dom and both session leader names for the caller to
// make its own assertions against.
async function buildTwoSessionSinging(dom, seriesCode) {
  const win = dom.window;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  const doc = win.document;

  doc.getElementById('setupNewSingingBtn').click();
  await wait(200);
  doc.getElementById('event').value = 'Wrapper Schema-5 Test Singing';
  doc.getElementById('event').dispatchEvent(new win.Event('input', { bubbles: true }));
  doc.getElementById('date').value = '2026-08-08';
  doc.getElementById('date').dispatchEvent(new win.Event('input', { bubbles: true }));
  doc.getElementById('location').value = 'Session 1 Venue';
  doc.getElementById('location').dispatchEvent(new win.Event('input', { bubbles: true }));
  if (seriesCode) {
    doc.getElementById('seriesCode').value = seriesCode;
    doc.getElementById('seriesCode').dispatchEvent(new win.Event('input', { bubbles: true }));
  }
  await wait(200);

  doc.getElementById('stageBtn-minutes').click();
  await wait(500);
  const cb = doc.querySelector('#bookCheckRow input[type=checkbox]');
  cb.checked = true;
  cb.dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(200);
  doc.getElementById('caller').value = 'Session1 Leader';
  doc.getElementById('page').value = '21';
  doc.getElementById('addBtn').click();
  await wait(300);

  doc.getElementById('startSessionBtn').click();
  await wait(200);
  doc.getElementById('newSessionDate').value = '2026-08-09';
  doc.getElementById('newSessionLocation').value = 'Session 2 Venue';
  doc.getElementById('newDayConfirmBtn').click();
  await wait(300);
  doc.getElementById('caller').value = 'Session2 Leader';
  doc.getElementById('page').value = '48';
  doc.getElementById('addBtn').click();
  await wait(300);

  return { win, doc };
}

describe('Schema-5 multi-session integrity', () => {
  test('a Setup edit to a whole-singing field never touches a later session\u2019s own date/location (R57-01)', async () => {
    const dom = loadPage('minutes.html');
    await wait(700);
    const { win, doc } = await buildTwoSessionSinging(dom);

    const before = win.eval("window.__ezMinutesCaptureGetCSV()");
    const session2Before = before.split('\n').find((l) => l.includes('Session2'));
    assert.match(session2Before, /2026-08-09/, 'Session 2 should start with its own real date');
    assert.match(session2Before, /Session 2 Venue/, 'Session 2 should start with its own real location');

    doc.getElementById('stageBtn-setup').click();
    await wait(300);
    doc.getElementById('seriesCode').value = 'REGRESSIONTEST';
    doc.getElementById('seriesCode').dispatchEvent(new win.Event('input', { bubbles: true }));
    await wait(300);

    doc.getElementById('stageBtn-minutes').click();
    await wait(600);
    const after = win.eval("window.__ezMinutesCaptureGetCSV()");
    const session1After = after.split('\n').find((l) => l.includes('Session1'));
    const session2After = after.split('\n').find((l) => l.includes('Session2'));

    assert.match(session1After, /2026-08-08/, 'Session 1 keeps its own date');
    assert.match(session1After, /Place A|Session 1 Venue/, 'Session 1 keeps its own location');
    assert.match(session2After, /2026-08-09/, 'Session 2 must still have ITS OWN date after an unrelated Setup edit');
    assert.match(session2After, /Session 2 Venue/, 'Session 2 must still have ITS OWN location after an unrelated Setup edit');
    assert.ok(session1After.includes('REGRESSIONTEST') && session2After.includes('REGRESSIONTEST'),
      'Series Code is a genuine whole-singing fact and SHOULD propagate to every row');
  });

  test('Event ID stays the same occurrence-identity value through Capture Day 1, Day 2, and Compile (R57-02)', async () => {
    const dom = loadPage('minutes.html');
    await wait(700);
    const { win, doc } = await buildTwoSessionSinging(dom, 'STABLETEST');

    const captureCsv = win.eval("window.__ezMinutesCaptureGetCSV()");
    const captureEventId = captureCsv.split('\n').find((l) => l.includes('Session1')).split(',').slice(-3, -2)[0];
    assert.equal(captureEventId, 'STABLETEST-2026-08-08', 'Event ID must use the FIRST session\u2019s date, not whichever day is currently active');

    doc.getElementById('stageBtn-compile').click();
    await wait(700);
    const compileEventId = doc.getElementById('m_eventid').value;
    assert.equal(compileEventId, 'STABLETEST-2026-08-08', 'Compile must derive the identical Event ID Capture did');

    doc.getElementById('stageBtn-minutes').click();
    await wait(700);
    const roundTripCsv = win.eval("window.__ezMinutesCaptureGetCSV()");
    const roundTripEventId = roundTripCsv.split('\n').find((l) => l.includes('Session1')).split(',').slice(-3, -2)[0];
    assert.equal(roundTripEventId, 'STABLETEST-2026-08-08', 'Event ID must survive a full Capture -> Compile -> Capture round trip unchanged');
  });

  test('the automatic Setup -> Compile handoff lands on Event Details with real data, not the Import screen (R57-06)', async () => {
    const dom = loadPage('minutes.html');
    await wait(700);
    const { doc } = await buildTwoSessionSinging(dom, 'HANDOFFTEST');

    doc.getElementById('stageBtn-compile').click();
    await wait(700);
    const activePanel = doc.querySelector('#compileHost .panel.active');
    assert.equal(activePanel && activePanel.dataset.panel, 'details', 'First landing after an automatic handoff must be Event Details');
    assert.equal(doc.getElementById('m_name').value, 'Wrapper Schema-5 Test Singing', 'Real imported data must be visible immediately');
  });

  test('a real exported file\u2019s meta.suiteVersion matches the wrapper\u2019s own displayed version, not a stale embedded copy (R57-07)', async () => {
    const dom = loadPage('minutes.html');
    await wait(700);
    const { win, doc } = await buildTwoSessionSinging(dom);

    const wrapperVersion = win.eval('window.__ezMinutesWrapperVersion');
    assert.ok(wrapperVersion && /^1\.0\.0-beta\.\d+$/.test(wrapperVersion), 'Wrapper should expose its own real version as a global');

    let capturedText = null;
    win.URL.createObjectURL = function () { return 'blob:test'; };
    win.URL.revokeObjectURL = function () {};
    const OrigBlob = win.Blob;
    win.Blob = function (parts, opts) { capturedText = parts[0]; return new OrigBlob(parts, opts); };
    win.HTMLAnchorElement.prototype.click = function () {};

    doc.getElementById('stageBtn-export').click();
    await wait(400);
    doc.getElementById('exp_csv').click();
    await wait(300);

    const metaLine = capturedText.split('\n').find((l) => l.includes('suiteVersion'));
    assert.ok(metaLine, 'Exported CSV should carry a meta.suiteVersion row');
    assert.ok(metaLine.includes(wrapperVersion), 'Exported suiteVersion must match the wrapper\u2019s real, current version, not a frozen embedded copy');
  });
});

describe('Setup date canonicalization (v61 review #1)', () => {
  test('Setup\u2019s date field is a native type="date" input, which itself rejects non-ISO strings', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window; win.HTMLElement.prototype.scrollIntoView = function () {};
    await wait(700);
    const doc = win.document;
    doc.getElementById('setupNewSingingBtn').click();
    await wait(150);
    const el = doc.getElementById('date');
    assert.equal(el.type, 'date', 'date should be a native date input, not free text');

    const cases = ['2026-08-08', '8/8/2026', '08/08/2026', 'August 8, 2026', '', '2026-99-99'];
    const expected = ['2026-08-08', '', '', '', '', ''];
    cases.forEach((input, i) => {
      el.value = input;
      assert.equal(el.value, expected[i], `Native date input handling for "${input}"`);
    });
  });

  test('an imported file with an already-malformed date is canonicalized in the actual row data, not just the summary display', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window; win.confirm = () => true; win.HTMLElement.prototype.scrollIntoView = function () {};
    await wait(700);
    const doc = win.document;

    const header = 'Schema Version,Order of entry,Record Type,Session Label,Session ID,Metadata Field,Metadata Value,Event,Date,Location,Chair,Vice-Chair,Secretary,Treasurer,Arranger(s),Chaplain(s),Memorial Lesson Leader,Book,Edition Code,Leader(s),Canonical Leader(s),Page,Song,Tag,Notes,Marker,Timestamp ISO,Time entered,Series Code,Event ID,Previous Event ID,Status';
    const row = '5,1,session,,sess1,,,Malformed Date Test,8/8/2026,Test Place,,,,,,,,,,,,,,,,,2026-08-08T10:00:00.000Z,10:00 AM,MALFORMED,,,';
    const csv = header + '\n' + row + '\n';
    const fi = doc.getElementById('importFileInput');
    Object.defineProperty(fi, 'files', { value: [new win.File([csv], 'malformed.csv', { type: 'text/csv' })], configurable: true });
    fi.dispatchEvent(new win.Event('change'));
    await wait(400);

    assert.equal(doc.getElementById('date').value, '2026-08-08', 'Setup\u2019s own summary display should show the canonicalized date');

    doc.getElementById('stageBtn-minutes').click();
    await wait(500);
    const captureCsv = win.eval("window.__ezMinutesCaptureGetCSV()");
    assert.ok(!captureCsv.includes('8/8/2026'), 'The raw malformed date must not survive into the actual row data Capture reads');
    const captureEventId = captureCsv.split('\n').find((l) => l.includes('MALFORMED')).split(',').slice(-3, -2)[0];
    assert.equal(captureEventId, 'MALFORMED-2026-08-08');

    doc.getElementById('stageBtn-compile').click();
    await wait(700);
    assert.equal(doc.getElementById('m_eventid').value, 'MALFORMED-2026-08-08', 'Compile must derive the identical, already-canonicalized Event ID');

    doc.getElementById('stageBtn-minutes').click();
    await wait(700);
    const roundTripCsv = win.eval("window.__ezMinutesCaptureGetCSV()");
    const roundTripEventId = roundTripCsv.split('\n').find((l) => l.includes('MALFORMED')).split(',').slice(-3, -2)[0];
    assert.equal(roundTripEventId, 'MALFORMED-2026-08-08', 'Event ID must stay identical through the full Setup -> Capture -> Compile -> Capture round trip even starting from a malformed source file');
  });
});

describe('"New Singing Based on This One" works regardless of how the singing was opened (v61 review #3)', () => {
  test('is available and correctly carries Event/Location/Series Code/Previous Event ID forward after opening a singing via the individual-file picker, not just the folder workflow', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window; win.confirm = () => true; win.HTMLElement.prototype.scrollIntoView = function () {};
    await wait(700);
    const doc = win.document;

    doc.getElementById('setupNewSingingBtn').click();
    await wait(150);
    doc.getElementById('event').value = 'Chain Test Singing';
    doc.getElementById('event').dispatchEvent(new win.Event('input', { bubbles: true }));
    doc.getElementById('date').value = '2026-08-08';
    doc.getElementById('date').dispatchEvent(new win.Event('input', { bubbles: true }));
    doc.getElementById('location').value = 'Chain Test Venue';
    doc.getElementById('location').dispatchEvent(new win.Event('input', { bubbles: true }));
    doc.getElementById('seriesCode').value = 'CHAINTEST';
    doc.getElementById('seriesCode').dispatchEvent(new win.Event('input', { bubbles: true }));
    await wait(200);

    doc.getElementById('stageBtn-minutes').click();
    await wait(400);
    const cb = doc.querySelector('#bookCheckRow input[type=checkbox]');
    cb.checked = true;
    cb.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(200);
    doc.getElementById('caller').value = 'Test Leader';
    doc.getElementById('page').value = '21';
    doc.getElementById('addBtn').click();
    await wait(300);
    const exportedCsv = win.eval("window.__ezMinutesCaptureGetCSV()");
    const originalEventId = exportedCsv.split('\n').find((l) => l.includes('Test Leader')).split(',').slice(-3, -2)[0];
    assert.equal(originalEventId, 'CHAINTEST-2026-08-08');

    // A genuinely separate page load, importing the exported file through the individual
    // file picker specifically - the exact path the review found didn't offer continuation.
    const dom2 = loadPage('minutes.html');
    const win2 = dom2.window; win2.confirm = () => true; win2.HTMLElement.prototype.scrollIntoView = function () {};
    await wait(700);
    const doc2 = win2.document;
    const fi = doc2.getElementById('importFileInput');
    Object.defineProperty(fi, 'files', { value: [new win2.File([exportedCsv], 'chain-test.csv', { type: 'text/csv' })], configurable: true });
    fi.dispatchEvent(new win2.Event('change'));
    await wait(400);

    const btn = doc2.getElementById('startNextFromActiveBtn');
    assert.ok(btn, 'The continuation action must be available after an individual-file import, not only after a folder scan');
    btn.click();
    await wait(300);

    assert.equal(doc2.getElementById('event').value, 'Chain Test Singing', 'Event name should carry forward');
    assert.equal(doc2.getElementById('location').value, 'Chain Test Venue', 'Location should carry forward');
    assert.equal(doc2.getElementById('date').value, '', 'Date should start fresh, not carry forward');

    doc2.getElementById('stageBtn-minutes').click();
    await wait(500);
    const newCsv = win2.eval("window.__ezMinutesCaptureGetCSV()");
    const newRow = newCsv.split('\n').find((l) => l.split(',')[7] === 'Chain Test Singing');
    assert.ok(newRow, 'The new singing should be a real row in the shared record');
    const previousEventId = newRow.split(',').slice(-2, -1)[0];
    assert.equal(previousEventId, originalEventId, 'Previous Event ID must chain to the original singing\u2019s real Event ID');

    win.close();
    win2.close();
  });
});

describe('Secretary-side book projection uses the real publicationYear field (v81 review, finding 8)', () => {
  test('a real edition where Publication Year has been edited to genuinely differ from Edition Identifier Year is projected with its real, current value, not derived from the identifier', async () => {
    // Modifying the real, parsed object and re-serializing it is robust to legitimate
    // field-order changes in the real source file (this suite's own Save tunebook-
    // library.js always re-writes every record in its own canonical field order,
    // regardless of whatever order they happened to be in before) - a hardcoded,
    // exact-substring string replacement on the raw file text is not, and broke the
    // moment a real re-export shifted publicationYear's position within the record.
    const lib = new Function(fs.readFileSync(suitePath('tunebook-library.js'), 'utf8') + '\nreturn EZ_MINUTES_TUNEBOOK_LIBRARY;')();
    const editionId = Object.keys(lib.editions).find((eid) => lib.editions[eid].editionCode === 'ScH1855');
    assert.ok(editionId, 'Sanity check: ScH1855 must genuinely exist in the real Library');
    lib.editions[editionId].publicationYear = '1934';
    const modifiedLibText = 'const EZ_MINUTES_TUNEBOOK_LIBRARY_VERSION = "1";\nconst EZ_MINUTES_TUNEBOOK_LIBRARY = ' + JSON.stringify(lib) + ';';

    const html = fs.readFileSync(suiteAppPath('minutes.html'), 'utf8').replace(
      '<script src="tunebook-library.js"></script>',
      '<script>' + modifiedLibText + '</script>'
    );
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, url: 'file://' + suitePath('') + '/' });
    const win = dom.window; win.confirm = () => true;
    if (win.HTMLElement && win.HTMLElement.prototype) win.HTMLElement.prototype.scrollIntoView = function () {};
    await wait(700);

    const publicationYear = win.eval("EZ_MINUTES_TUNEBOOKS.books['ScH1855'].publicationYear");
    assert.equal(publicationYear, '1934',
      'The Secretary-side projection must use the real, current publicationYear field - previously it was derived purely from editionIdentifierYear/editionFirstPublicationDate, ignoring the real field entirely, invisible only because every real bundled edition happened to have both values coincide');
    win.close();
  });
});
