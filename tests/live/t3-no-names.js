// v152 review Findings 3, 4, 5: mmNoNames must round-trip through the Master CSV, must
// suppress Memorial and Closing song leaders, and must not override the song-count toggle.
//
// The singing is built as a Master CSV and imported through Setup rather than clicked into
// Capture: Closing is a real tag that imported and older records carry, but Capture's own
// chips don't offer it, and importing is exactly how such a record reaches Compile in real
// use. Everything downstream of the import is driven through the actual UI.
const L = require('./lib');

const HEADER = 'Schema Version,Order of entry,Record Type,Session Label,Session ID,Metadata Field,Metadata Value,Event,Date,Location,Chair,Vice-Chair,Secretary,Treasurer,Arranger(s),Chaplain(s),Memorial Lesson Leader,Book,Edition Code,Leader(s),Canonical Leader(s),Page,Song,Tag,Notes,Marker,Timestamp ISO,Time entered,Series Code,Event ID,Previous Event ID,Status';

const EVENT = 'No Names Test', DATE = '2026-08-15', LOC = 'Union Hall';
// STALE_MEM is an old-style "Memorial Lesson Leader" column value, the kind an older file
// might carry from before that field was derived rather than typed (Kevin's own call,
// 2026-09-17). It must never appear anywhere in the output - the real leader is derived
// fresh from the Memorial-tagged rows' own Leader(s) values (Alice Singer / Dan Singer
// below), same as every other CSV import.
const CHAIR = 'Alice Chair', STALE_MEM = 'Mary Memorial (stale)', SID = 'sess0001';

let order = 0;
function row(type, opts){
  order++;
  const c = new Array(32).fill('');
  c[0] = '5'; c[1] = String(order); c[2] = type; c[4] = SID;
  c[7] = EVENT; c[8] = DATE; c[9] = LOC; c[10] = CHAIR; c[16] = STALE_MEM;
  if (opts.book){ c[17] = opts.book; c[18] = opts.book; }
  if (opts.leader) c[19] = opts.leader;
  if (opts.page) c[21] = opts.page;
  if (opts.song) c[22] = opts.song;
  if (opts.tag) c[23] = opts.tag;
  c[26] = '2026-08-15T14:0' + (order % 10) + ':00.000Z';
  c[27] = '10:0' + (order % 10) + ' AM';
  return c.map(v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',');
}

const CSV = [
  HEADER,
  row('session', {}),
  row('song', { book: 'SHM2025', leader: 'Alice Chair', page: '45t', song: 'New Britain' }),
  row('song', { book: 'SHM2025', leader: 'Bob Singer',  page: '59',  song: 'Holy Manna' }),
  row('song', { book: 'SHM2025', leader: 'Alice Singer', page: '99', song: 'Memorial Song', tag: 'Memorial (Sick)' }),
  row('song', { book: 'SHM2025', leader: 'Dan Singer',  page: '146', song: 'Deceased Song', tag: 'Memorial (Deceased)' }),
  row('song', { book: 'SHM2025', leader: 'Cora Closer', page: '62',  song: 'Parting Hand', tag: 'Closing' })
].join('\n') + '\n';

async function preview(page){
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1000);
  return page.evaluate(() => {
    const el = document.getElementById('previewText');
    return el ? el.textContent : '(no previewText element)';
  });
}
async function importCSV(page, text, name){
  await page.click('#stageBtn-setup');
  await page.waitForTimeout(500);
  await page.evaluate(({ text, name }) => {
    const file = new File([text], name, { type: 'text/csv' });
    const input = document.getElementById('importFileInput');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { text, name });
  await page.waitForTimeout(1600);
}
function noNamesChecked(page){
  return page.evaluate(() => {
    const el = document.getElementById('m_mmNoNames');
    return el ? el.checked : null;
  });
}
async function setCheckbox(page, id, want){
  await page.click('#stageBtn-export');
  await page.waitForTimeout(700);
  await page.evaluate(({ id, want }) => {
    const el = document.getElementById(id);
    if (el && el.checked !== want) el.click();
  }, { id, want });
  await page.waitForTimeout(700);
}

(async () => {
  const { browser, page } = await L.launch();
  await L.open(page);
  await importCSV(page, CSV, 'no-names-test-master.csv');

  // Recognitions/Memorials, so the Memorial lesson has real sick/deceased lists to read
  await page.click('#stageBtn-compile');
  await page.waitForTimeout(800);

  // sanity: the record really did load, tags intact (Compile owns the Master CSV, so this
  // has to be asked after entering Compile, not before)
  const loaded = L.asObjects(await L.masterCSV(page));
  const songs = loaded.filter(r => r['Record Type'] === 'song');
  L.check('all 5 songs imported', songs.length === 5, songs.length + ' songs');
  L.check('Closing tag survived the import', songs.some(r => r['Tag'] === 'Closing'),
    songs.map(r => r['Tag'] || '-').join(','));

  await page.click('.substage-btn[data-panel-target="memorials"]');
  await page.waitForTimeout(500);
  await page.fill('#l_sick', 'John Doe');
  await page.fill('#l_deceased', 'Jane Roe');
  await page.waitForTimeout(400);

  // Memorial Lesson Leader is no longer a typed Officer field (Kevin's own call,
  // 2026-09-17) - it's derived from the Leader(s) values already on the Memorial-tagged
  // rows (Alice Singer / Dan Singer), so there's nothing to fill in here.

  // ---------- baseline with names ON ----------
  await setCheckbox(page, 'm_mmNoNames', false);
  const named = await preview(page);
  L.check('baseline: Memorial sick song leader printed (Alice Singer)', /Alice Singer/.test(named),
    (named.match(/[^.]*Alice Singer[^.]*\./) || ['(not found)'])[0]);
  L.check('baseline: Memorial deceased song leader printed (Dan Singer)', /Dan Singer/.test(named),
    (named.match(/[^.]*Dan Singer[^.]*\./) || ['(not found)'])[0]);
  L.check('baseline: closing song leader printed (Cora Closer)', /Cora Closer/.test(named),
    (named.match(/[^.]*closing song[^.]*\./i) || ['(not found)'])[0]);
  L.check('baseline: Memorial Lesson Leader derived from tagged rows (Alice Singer, Dan Singer)',
    /The memorial lesson was conducted by Alice Singer, Dan Singer\./.test(named),
    (named.match(/The memorial lesson was conducted[^.]*\./) || ['(not found)'])[0]);
  L.check('baseline: stale imported Memorial Lesson Leader column value never appears',
    !named.includes(STALE_MEM));

  // ---------- Finding 4: no-names ON ----------
  await setCheckbox(page, 'm_mmNoNames', true);
  const p = await preview(page);

  L.check('no-names: opening/ordinary leaders absent', !/Bob Singer/.test(p) && !/leading/.test(p),
    (p.match(/[^.]*called to order[^.]*\./) || ['(not found)'])[0]);
  L.check('no-names: Memorial SICK song leader absent (Alice Singer)', !/Alice Singer/.test(p),
    (p.match(/[^.]*sick and shut-ins[\s\S]*?\.[^.]*\./i) || ['(sick clause not found)'])[0]);
  L.check('no-names: Memorial DECEASED song leader absent (Dan Singer)', !/Dan Singer/.test(p),
    (p.match(/[^.]*in their memory\./i) || ['(deceased clause not found)'])[0]);
  L.check('no-names: CLOSING song leader absent (Cora Closer)', !/Cora Closer/.test(p),
    (p.match(/[^.]*closing song[^.]*\./i) || ['(closing clause not found)'])[0]);
  // Kevin's own call, 2026-09-17: once the Memorial Lesson Leader stopped being a
  // separate typed Officer field, there was no longer a reason to exempt it from the
  // same no-names suppression every other per-song leader gets - it's now suppressed
  // right along with them, printing the same generic sentence as when nothing's tagged.
  L.check('no-names: Memorial Lesson Leader is ALSO suppressed now (no longer exempt)',
    /The memorial lesson was conducted\./.test(p) && !/conducted by/.test(p),
    (p.match(/The memorial lesson was conducted[^.]*\./) || ['(not found)'])[0]);
  L.check('no-names: memorial songs read as prose about what was sung',
    /was sung for the sick and shut-ins\./.test(p) && /was sung in their memory\./.test(p),
    (p.match(/[^.]*was sung[^.]*\.[\s\S]{0,120}/) || ['(not found)'])[0]);
  L.check('no-names: closing reads as prose about what was sung',
    /was sung as the closing song\./.test(p),
    (p.match(/[^.]*closing song\./) || ['(not found)'])[0]);
  L.check('no-names: no bare "The leader led" anywhere', !/\bThe leader led\b/.test(p));

  // ---------- Finding 5: song-count toggle ----------
  await setCheckbox(page, 'm_mmSongs', false);
  const pNoCount = await preview(page);
  L.check('no-names + Number of songs OFF: no song count printed',
    !/\d+ songs? (was|were) sung/.test(pNoCount),
    (pNoCount.match(/[^.]*(was|were) sung\./g) || ['(none)']).join(' | '));

  await setCheckbox(page, 'm_mmSongs', true);
  const pWithCount = await preview(page);
  L.check('no-names + Number of songs ON: song count IS printed',
    /\d+ songs? (was|were) sung/.test(pWithCount),
    (pWithCount.match(/\d+ songs? (was|were) sung\./) || ['(not found)'])[0]);

  // ---------- Finding 3: Master CSV round-trip ----------
  const master = await L.masterCSV(page);
  const metaLine = (master.split('\n').find(l => /meta\.mmNoNames/.test(l)) || '');
  L.check('Master CSV carries meta.mmNoNames,true', /meta\.mmNoNames,true/.test(metaLine), metaLine.slice(0, 90) || '(row absent)');

  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(1400);
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1600);
  L.check('Compile -> Capture -> Compile KEEPS no-names checked', (await noNamesChecked(page)) === true);
  const afterNav = await preview(page);
  L.check('Compile -> Capture -> Compile keeps the preview name-free',
    !/Bob Singer|Alice Singer|Dan Singer|Cora Closer/.test(afterNav),
    (afterNav.match(/[^.]*called to order[^.]*\./) || ['(not found)'])[0]);

  await page.click('#stageBtn-setup');
  await page.waitForTimeout(800);
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(1200);
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1600);
  L.check('Compile -> Capture -> Setup -> Compile KEEPS no-names', (await noNamesChecked(page)) === true);

  // fresh browser state, reopening the exported Master CSV
  const exported = await L.masterCSV(page);
  await page.evaluate(() => localStorage.clear());
  await L.open(page);
  await importCSV(page, exported, 'reopened-master.csv');
  await page.click('#stageBtn-export');
  await page.waitForTimeout(1800);
  L.check('fresh-browser reopen restores no-names', (await noNamesChecked(page)) === true);
  const reopened = await preview(page);
  L.check('fresh-browser reopen keeps the preview name-free',
    !/Bob Singer|Alice Singer|Dan Singer|Cora Closer/.test(reopened),
    (reopened.match(/[^.]*called to order[^.]*\./) || ['(not found)'])[0]);
  L.check('fresh-browser reopen keeps memorial song prose name-free',
    /was sung for the sick and shut-ins\./.test(reopened) || !/led "Memorial Song"/.test(reopened),
    (reopened.match(/[^.]*sick and shut-ins[^.]*\.[^.]*\./) || ['(not found)'])[0]);

  // ---------- no-names with an UNTAGGED memorial run (no Memorial (Sick)/(Deceased)
  // split, just plain "Memorial") ----------
  // There's no separate officer field left to leave blank any more - this now just
  // confirms suppression holds for the plain "Memorial" tag family too, not only the two
  // split tags exercised above.
  const CSV_PLAIN_TAG = CSV.replace('Memorial (Sick)', 'Memorial').replace('Memorial (Deceased)', 'Memorial');
  await page.evaluate(() => localStorage.clear());
  await L.open(page);
  await importCSV(page, CSV_PLAIN_TAG, 'plain-memorial-tag-master.csv');
  await page.click('#stageBtn-compile');
  await page.waitForTimeout(800);
  await page.click('.substage-btn[data-panel-target="memorials"]');
  await page.waitForTimeout(400);
  await page.fill('#l_sick', 'John Doe');
  await page.waitForTimeout(300);
  await setCheckbox(page, 'm_mmNoNames', true);
  const plainTagNoNames = await preview(page);
  L.check('no-names with plain "Memorial" tag: leader still suppressed',
    !/Alice Singer/.test(plainTagNoNames) && !/conducted by/.test(plainTagNoNames),
    (plainTagNoNames.match(/The memorial lesson was conducted[^.]*\.[^.]*\./) || ['(not found)'])[0]);

  L.check('no page errors', page._errors.length === 0, page._errors.slice(0, 3).join(' | '));

  if (process.env.SHOW_PREVIEW) console.log('\n===== no-names preview =====\n' + p + '\n===== named preview =====\n' + named);
  await browser.close();
  process.exit(L.summary());
})();
