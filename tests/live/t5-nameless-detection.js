// Simple Minutes round trip: a record with no leader names anywhere compiles as no-names
// minutes unaided, WITHOUT ever overruling a decision a person or a file already made.
const L = require('./lib');
const path = require('path');
const fs = require('fs');

const HEADER = 'Schema Version,Order of entry,Record Type,Session Label,Session ID,Metadata Field,Metadata Value,Event,Date,Location,Chair,Vice-Chair,Secretary,Treasurer,Arranger(s),Chaplain(s),Memorial Lesson Leader,Book,Edition Code,Leader(s),Canonical Leader(s),Page,Song,Tag,Notes,Marker,Timestamp ISO,Time entered,Series Code,Event ID,Previous Event ID,Status';

// Builds a record in the shape Simple Minutes emits: Leader(s) blank on every row.
function build(songs, opts){
  opts = opts || {};
  let order = 0;
  const line = (type, o) => {
    order++;
    const c = new Array(32).fill('');
    c[0] = '5'; c[1] = String(order); c[2] = type; c[4] = 'sess-nn';
    if (type !== 'metadata'){
      c[7] = opts.event || 'Nameless Singing'; c[8] = '2026-09-01'; c[9] = 'Union Hall';
    }
    if (o.field){ c[5] = o.field; c[6] = o.value; }
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
  (opts.meta || []).forEach(m => rows.push(line('metadata', m)));
  return rows.join('\r\n') + '\r\n';
}

const NAMELESS = build([
  { book: 'SHM2025', page: '45t', song: 'New Britain' },
  { book: 'SHM2025', page: '59',  song: 'Holy Manna' },
  { book: 'SHM2025', page: '99',  song: 'Evening Shade' }
]);

// one name among many: a mixed record, not a nameless one
const MIXED = build([
  { book: 'SHM2025', page: '45t', song: 'New Britain', leader: 'Alice Chair' },
  { book: 'SHM2025', page: '59',  song: 'Holy Manna' },
  { book: 'SHM2025', page: '99',  song: 'Evening Shade' }
], { event: 'Mixed Singing' });

// Names ONLY in the Canonical Leader(s) column, with Leader(s) blank.
//
// This block used to assert the opposite of what it asserts now, and the note here used to
// defend it: the importer discarded a canonical value with no raw name to correct, so the
// record reached the compiler genuinely nameless, and calling it nameless was "honest."
// The v156 review disagreed, correctly. Honest about WHAT the compiler could see, maybe -
// but the reason it could see nothing was a silent import bug deleting a non-blank Master
// CSV field, and once automatic detection existed that deletion had started deciding
// whether a singing's leaders got published at all. The field is preserved now and stands
// as the row's name; t8 covers the round trip and the prose in full.
const CANONICAL_ONLY = build([
  { book: 'SHM2025', page: '45t', song: 'New Britain', canonical: 'Alice Chair' },
  { book: 'SHM2025', page: '59',  song: 'Holy Manna',  canonical: 'Bob Singer' }
], { event: 'Canonical Only' });

// a nameless record whose file explicitly says no-names is OFF
const NAMELESS_OPTED_OUT = build([
  { book: 'SHM2025', page: '45t', song: 'New Britain' },
  { book: 'SHM2025', page: '59',  song: 'Holy Manna' }
], { event: 'Opted Out', meta: [{ field: 'meta.mmNoNames', value: 'false' }] });

async function importCSV(page, text, name){
  await page.click('#stageBtn-setup');
  await page.waitForTimeout(500);
  await page.evaluate(({ text, name }) => {
    const file = new File([text], name, { type: 'text/csv' });
    const i = document.getElementById('importFileInput');
    Object.defineProperty(i, 'files', { value: [file], configurable: true });
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }, { text, name });
  await page.waitForTimeout(1700);
}
async function exportPanel(page){
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1600);
}
const noNames = page => page.evaluate(() => document.getElementById('m_mmNoNames').checked);
const previewText = page => page.evaluate(() => document.getElementById('previewText').textContent);
async function fresh(page){ await page.evaluate(() => localStorage.clear()).catch(()=>{}); await L.open(page); }

(async () => {
  const { browser, page } = await L.launch();
  await L.open(page);

  // ---- 1. a real Simple Minutes export, produced by that app itself ----
  const smPath = path.resolve(__dirname, 'fixtures', 'simple-minutes-export.csv');
  if (fs.existsSync(smPath)){
    await fresh(page);
    await importCSV(page, fs.readFileSync(smPath, 'utf8'), 'simple-minutes-export.csv');
    await exportPanel(page);
    const p = await previewText(page);
    L.check('real Simple Minutes export: no-names enabled on import', (await noNames(page)) === true);
    L.check('real Simple Minutes export: no "the leader" prose anywhere', !/the leader/i.test(p),
      (p.match(/[^.]*the leader[^.]*\./i) || ['(none)'])[0]);
    L.check('real Simple Minutes export: no "0 leaders" claim', !/\b0 leaders\b/.test(p),
      (p.match(/[^.]*(leaders led|songs? (was|were) sung)[^.]*\./) || ['(not found)'])[0]);
  } else {
    L.check('Simple Minutes fixture present', false, 'missing ' + smPath);
  }

  // ---- 2. synthetic nameless record ----
  await fresh(page);
  await importCSV(page, NAMELESS, 'nameless.csv');
  await exportPanel(page);
  L.check('nameless record: no-names enabled', (await noNames(page)) === true);
  const namelessPreview = await previewText(page);
  L.check('nameless record: reads as prose about what was sung',
    /opening with "New Britain"/.test(namelessPreview) && !/the leader/i.test(namelessPreview),
    (namelessPreview.match(/[^.]*called to order[^.]*\./) || ['(not found)'])[0]);

  // ---- 3. mixed record must NOT be flattened ----
  await fresh(page);
  await importCSV(page, MIXED, 'mixed.csv');
  await exportPanel(page);
  L.check('one name among three songs: no-names NOT enabled', (await noNames(page)) === false);
  const mixedPreview = await previewText(page);
  L.check('mixed record still names the leader it does have', /Alice Chair/.test(mixedPreview),
    (mixedPreview.match(/[^.]*Alice Chair[^.]*\./) || ['(not found)'])[0]);

  // ---- 4. names only in the Canonical column (preserved since the v156 review) ----
  await fresh(page);
  await importCSV(page, CANONICAL_ONLY, 'canonical-only.csv');
  await exportPanel(page);
  L.check('canonical-only names are real names: no automatic no-names',
    (await noNames(page)) === false);
  const canonPreview = await previewText(page);
  L.check('canonical-only record publishes those names rather than suppressing them',
    /Alice Chair/.test(canonPreview) && !/the leader/i.test(canonPreview),
    (canonPreview.match(/[^.]*called to order[^.]*\./) || ['(not found)'])[0]);

  // ---- 5. a file that explicitly opts out is not overruled ----
  await fresh(page);
  await importCSV(page, NAMELESS_OPTED_OUT, 'opted-out.csv');
  await exportPanel(page);
  L.check('nameless record with meta.mmNoNames,false: detection stays quiet', (await noNames(page)) === false);

  // ---- 6. unticking it by hand survives export AND reimport ----
  await fresh(page);
  await importCSV(page, NAMELESS, 'nameless-again.csv');
  await exportPanel(page);
  L.check('nameless record: enabled again before the untick', (await noNames(page)) === true);
  await page.evaluate(() => { const el = document.getElementById('m_mmNoNames'); if (el.checked) el.click(); });
  await page.waitForTimeout(800);
  const master = await L.masterCSV(page);
  const metaLine = master.split('\n').find(l => /meta\.mmNoNames/.test(l)) || '';
  L.check('a deliberate untick is written to the Master CSV as false',
    /meta\.mmNoNames,false/.test(metaLine), metaLine.slice(0, 90) || '(row absent)');

  await fresh(page);
  await importCSV(page, master, 'reimported.csv');
  await exportPanel(page);
  L.check('reimporting that file does NOT flip no-names back on', (await noNames(page)) === false);
  const optedOutPreview = await previewText(page);
  L.check('opted-out nameless record still avoids the "0 leaders" claim',
    !/\b0 leaders\b/.test(optedOutPreview),
    (optedOutPreview.match(/[^.]*(leaders led|songs? (was|were) sung)[^.]*\./) || ['(not found)'])[0]);

  // ---- 7. a normal, fully-named record is untouched ----
  const samples = path.resolve(__dirname, 'fixtures');
  const jr = 'named-singing.csv';
  await fresh(page);
  await importCSV(page, fs.readFileSync(path.join(samples, jr), 'utf8'), jr);
  await exportPanel(page);
  L.check('a fully-named record is left alone', (await noNames(page)) === false);
  const jrPreview = await previewText(page);
  L.check('that sample still names its leaders', /Matt Ference/.test(jrPreview),
    (jrPreview.match(/[^.]*called to order[^.]*\./) || ['(not found)'])[0]);

  L.check('no page errors', page._errors.length === 0, page._errors.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(L.summary());
})();
