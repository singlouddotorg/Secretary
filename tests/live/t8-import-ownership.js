// One authoritative Singing Record: any route that opens a file opens it for the whole
// suite, and no stage can hold a record the others don't know about (v156 review, finding
// 1). Also covers canonical-only leader preservation (finding 2), since that is the other
// thing a Master CSV round-trip must not lose.
const L = require('./lib');
const fs = require('fs');
const path = require('path');

const SAMPLES = path.resolve(__dirname, 'fixtures');
const HEADER = 'Schema Version,Order of entry,Record Type,Session Label,Session ID,Metadata Field,Metadata Value,Event,Date,Location,Chair,Vice-Chair,Secretary,Treasurer,Arranger(s),Chaplain(s),Memorial Lesson Leader,Book,Edition Code,Leader(s),Canonical Leader(s),Page,Song,Tag,Notes,Marker,Timestamp ISO,Time entered,Series Code,Event ID,Previous Event ID,Status';

function record(event, songs){
  let order = 0;
  const line = (type, o) => {
    order++;
    const c = new Array(32).fill('');
    c[0] = '5'; c[1] = String(order); c[2] = type; c[4] = 'sess-io';
    c[7] = event; c[8] = '2026-09-01'; c[9] = 'Union Hall';
    if (o.book){ c[17] = o.book; c[18] = o.book; }
    if (o.leader) c[19] = o.leader;
    if (o.canonical) c[20] = o.canonical;
    if (o.page) c[21] = o.page;
    if (o.song) c[22] = o.song;
    c[26] = '2026-09-01T14:00:00.000Z'; c[27] = '10:00 AM';
    return c.map(v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',');
  };
  const rows = [HEADER, line('session', {})];
  songs.forEach(s => rows.push(line('song', s)));
  return rows.join('\r\n') + '\r\n';
}

const CANONICAL_ONLY = record('Canon Test', [
  { book: 'SHM2025', page: '26',  song: 'Samaria',     canonical: 'Alice Canon' },
  { book: 'SHM2025', page: '45t', song: 'New Britain', canonical: 'Bob Canon' }
]);
const RAW_AND_CANONICAL = record('Correction Test', [
  { book: 'SHM2025', page: '26', song: 'Samaria', leader: 'alice canon', canonical: 'Alice Canon' }
]);
const TRULY_BLANK = record('Blank Test', [
  { book: 'SHM2025', page: '26',  song: 'Samaria' },
  { book: 'SHM2025', page: '45t', song: 'New Britain' }
]);

async function setupImport(page, text, name){
  await page.click('#stageBtn-setup');
  await page.waitForTimeout(500);
  await page.evaluate(({ text, name }) => {
    const file = new File([text], name, { type: 'text/csv' });
    const i = document.getElementById('importFileInput');
    Object.defineProperty(i, 'files', { value: [file], configurable: true });
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }, { text, name });
  await page.waitForTimeout(1800);
}
const recordKey = page => page.evaluate(() => window.__ezMinutesGetActiveRecordKey());
const noNames = page => page.evaluate(() => document.getElementById('m_mmNoNames').checked);
async function fresh(page){ await page.evaluate(() => localStorage.clear()).catch(()=>{}); await L.open(page); }

(async () => {
  const { browser, page } = await L.launch();
  await L.open(page);

  // ---- 1. there is no stage-local way in any more ----
  const controls = await page.evaluate(() => ({
    captureWelcomeImport: !!document.getElementById('loadCsvBtn'),
    captureMenuImport: !!document.getElementById('sessionLoadCsvBtn'),
    compileImportPanel: !!document.getElementById('panel-import'),
    compileDropzone: !!document.getElementById('dropzone'),
    compileImportLink: !!document.querySelector('[data-panel-target="import"]')
  }));
  L.check('no stage-local import control survives anywhere in the suite',
    Object.values(controls).every(v => v === false), JSON.stringify(controls));

  // the wrapper's own sync bridges must still exist - they are how a record reaches a stage
  const bridges = await page.evaluate(() => ({
    captureLoad: typeof window.__ezMinutesCaptureLoadCSV === 'function',
    compileHandle: typeof window.__ezMinutesCompileHandleFile === 'function',
    captureGet: typeof window.__ezMinutesCaptureGetCSV === 'function',
    compileGet: typeof window.__ezMinutesCompileGetMasterCSV === 'function'
  }));
  L.check('the wrapper\'s internal stage-sync bridges are intact',
    Object.values(bridges).every(v => v === true), JSON.stringify(bridges));

  // ---- 2. Setup import opens the record in every stage ----
  const jr = 'named-singing.csv';
  await fresh(page);
  await setupImport(page, fs.readFileSync(path.join(SAMPLES, jr), 'utf8'), jr);
  const key1 = await recordKey(page);
  L.check('Setup import creates a real wrapper record', !!key1, String(key1));
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(1600);
  const capEvent = await page.evaluate(() => document.getElementById('event').value);
  L.check('Capture shows the imported singing', /James River/.test(capEvent), capEvent);
  await page.click('#stageBtn-compile');
  await page.waitForTimeout(1800);
  const compileName = await page.evaluate(() => document.getElementById('m_name').value);
  L.check('Compile shows the same singing', /James River/.test(compileName), compileName);

  // the import summary has to be somewhere a person can actually see it, now that the
  // panel it used to live on is gone
  const summary = await page.evaluate(() => {
    const row = document.getElementById('importStatusRow');
    const el = document.getElementById('importStatus');
    return { visible: !!(row && row.offsetParent !== null), text: el ? el.textContent : '' };
  });
  L.check('the import summary is visible on Event Details',
    summary.visible && /row\(s\) imported/.test(summary.text), summary.text.slice(0, 90));

  // ---- 3. one record identity across ordinary stage navigation ----
  await page.click('#stageBtn-minutes'); await page.waitForTimeout(1400);
  await page.click('#stageBtn-setup');   await page.waitForTimeout(900);
  await page.click('#stageBtn-compile'); await page.waitForTimeout(1400);
  const key2 = await recordKey(page);
  L.check('internal stage sync does not mint a new record identity', key2 === key1, key1 + ' -> ' + key2);

  // ---- 4. opening a different singing through Setup replaces it, and ends a sticky mode ----
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(1400);
  await page.click('.mode-btn[data-mode="Singing School"]');
  await page.waitForTimeout(400);
  L.check('Singing School is running before the swap',
    /Singing School in progress/.test(await page.evaluate(() => document.getElementById('modeBanner').textContent)));
  await setupImport(page, CANONICAL_ONLY, 'canon.csv');
  const key3 = await recordKey(page);
  L.check('opening a different singing replaces the record identity', !!key3 && key3 !== key1, key1 + ' -> ' + key3);
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(1600);
  const bannerAfter = await page.evaluate(() => {
    const b = document.getElementById('modeBanner');
    return (b && b.offsetParent !== null) ? b.textContent : '';
  });
  L.check('the previous singing\'s sticky mode does not follow it', !/in progress/.test(bannerAfter),
    JSON.stringify(bannerAfter));

  // ---- 5. canonical-only leader names survive and are used ----
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1800);
  L.check('a canonical-only record is NOT auto-classified as nameless', (await noNames(page)) === false);
  const preview = await page.evaluate(() => document.getElementById('previewText').textContent);
  L.check('the canonical name is published', /Alice Canon/.test(preview),
    (preview.match(/[^.]*called to order[^.]*\./) || ['(not found)'])[0]);
  L.check('both canonical names count toward the leader tally', /2 leaders led 2 songs/.test(preview),
    (preview.match(/\d+ leaders? led[^.]*\./) || ['(not found)'])[0]);

  const master = await L.masterCSV(page);
  const rows = L.asObjects(master).filter(r => r['Record Type'] === 'song');
  L.check('Canonical Leader(s) survives the round trip, in its own column',
    rows.length === 2 && rows.every(r => r['Canonical Leader(s)'].trim() && !r['Leader(s)'].trim()),
    JSON.stringify(rows.map(r => ({ leader: r['Leader(s)'], canonical: r['Canonical Leader(s)'] }))));

  // reopening what we just exported must be stable, not lossy on a second pass
  await fresh(page);
  await setupImport(page, master, 'canon-again.csv');
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1800);
  const master2 = await L.masterCSV(page);
  const rows2 = L.asObjects(master2).filter(r => r['Record Type'] === 'song');
  L.check('a second round trip still holds both canonical names',
    rows2.length === 2 && rows2.every(r => /Canon/.test(r['Canonical Leader(s)'])),
    JSON.stringify(rows2.map(r => r['Canonical Leader(s)'])));

  // ---- 6. raw + canonical correction still behaves as it always did ----
  await fresh(page);
  await setupImport(page, RAW_AND_CANONICAL, 'correction.csv');
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1800);
  const corrected = await page.evaluate(() => document.getElementById('previewText').textContent);
  L.check('a raw name with a canonical correction still publishes the correction',
    /Alice Canon/.test(corrected) && !/alice canon/.test(corrected),
    (corrected.match(/[^.]*Canon[^.]*\./) || ['(not found)'])[0]);

  // ---- 7. a genuinely blank record still gets the automatic treatment ----
  await fresh(page);
  await setupImport(page, TRULY_BLANK, 'blank.csv');
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1800);
  L.check('both columns blank still triggers automatic no-names', (await noNames(page)) === true);

  L.check('no page errors', page._errors.length === 0, page._errors.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(L.summary());
})();
