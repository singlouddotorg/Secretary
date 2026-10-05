// v152 review Finding 2: sticky Singing School / Memorial mode must not cross into a
// different loaded Singing Record, but MUST survive ordinary same-record stage navigation.
const L = require('./lib');
const fs = require('fs');
const path = require('path');

function storedMode(page){
  return page.evaluate(() => {
    try { return localStorage.getItem('singingMinutesActiveMode'); } catch(e){ return 'ERR'; }
  });
}
function bannerText(page){
  return page.evaluate(() => {
    const b = document.getElementById('modeBanner');
    return (b && b.offsetParent !== null) ? b.textContent : '';
  });
}

(async () => {
  const { browser, page } = await L.launch();
  await L.open(page);

  // ---- A: mode survives ordinary same-record stage navigation ----
  await L.setupSinging(page, { event: 'Mode Test', date: '2026-08-10', location: 'Hall A', chair: 'Alice' });
  await L.toCapture(page);
  await page.click('.mode-btn[data-mode="Singing School"]');
  await page.waitForTimeout(300);
  L.check('mode banner shows after enabling Singing School', /Singing School in progress/.test(await bannerText(page)));
  const stored1 = await storedMode(page);
  L.check('stored mode now carries an owner', !!stored1 && stored1.charAt(0) === '{' && /"owner"/.test(stored1), stored1);

  await L.logSong(page, { leader: 'Alice', pageNum: '45t' });

  // Compile -> Capture round trip inside the same singing
  await page.click('#stageBtn-compile');
  await page.waitForTimeout(700);
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(900);
  L.check('same-record Compile -> Capture round trip KEEPS the mode',
    /Singing School in progress/.test(await bannerText(page)), await storedMode(page));

  // Setup -> Capture round trip inside the same singing
  await page.click('#stageBtn-setup');
  await page.waitForTimeout(500);
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(900);
  L.check('same-record Setup -> Capture round trip KEEPS the mode',
    /Singing School in progress/.test(await bannerText(page)), await storedMode(page));

  // ---- B: loading a DIFFERENT record clears the mode (the review's own repro) ----
  const sampleDir = require('path').resolve(__dirname, 'fixtures');
  const james = 'named-singing.csv';
  L.check('a fixture Singing Record is available to load', fs.existsSync(require('path').join(sampleDir, james)), james);

  await page.click('#stageBtn-setup');
  await page.waitForTimeout(400);
  // Setup's own file import input
  const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input[type=file]')).map(i => i.id));
  const setupInput = inputs.find(id => id && id !== 'csvFileInput');
  L.check('found Setup\'s own CSV file input', !!setupInput, JSON.stringify(inputs));
  await page.setInputFiles('#' + setupInput, path.join(sampleDir, james));
  await page.waitForTimeout(1200);

  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(1500);

  const eventAfter = await page.evaluate(() => document.getElementById('event').value);
  L.check('a genuinely different Singing Record is now open', !/^Mode Test$/.test(eventAfter), eventAfter);
  const banner2 = await bannerText(page);
  const stored2 = await storedMode(page);
  L.check('loading a DIFFERENT record CLEARS the mode banner', !/in progress/.test(banner2), JSON.stringify(banner2));
  L.check('loading a DIFFERENT record CLEARS stored mode', !stored2, String(stored2));

  // and the next logged song must not be tagged into the old singing's school
  await L.logSong(page, { leader: 'Test Leader', pageNum: '99' });
  const rows = L.asObjects(await L.csv(page));
  const songs = rows.filter(r => r['Record Type'] === 'song' && r['Leader(s)'] === 'Test Leader');
  L.check('song logged in the newly-loaded record is NOT tagged Singing School',
    songs.length === 1 && songs[0]['Tag'] !== 'Singing School', songs.length ? songs[0]['Tag'] : 'no row');

  // ---- C: New Singing still clears mode (v152 already fixed; must not regress) ----
  await page.evaluate(() => localStorage.clear());
  await L.open(page);
  await L.setupSinging(page, { event: 'Regress Test', date: '2026-08-12', location: 'Hall B', chair: 'Bob' });
  await L.toCapture(page);
  await page.click('.mode-btn[data-mode="Memorial"]');
  await page.waitForTimeout(300);
  L.check('Memorial mode on', /Memorial Lesson in progress/.test(await bannerText(page)));
  await page.click('#stageBtn-setup');
  await page.waitForTimeout(400);
  await page.click('#setupNewSingingBtn');
  await page.waitForTimeout(600);
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(900);
  L.check('New Singing still clears mode', !/in progress/.test(await bannerText(page)), String(await storedMode(page)));

  // ---- D: browser reload of the SAME singing keeps the mode ----
  await page.click('.mode-btn[data-mode="Singing School"]');
  await page.waitForTimeout(300);
  await L.open(page);
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(1200);
  L.check('reloading the SAME singing keeps its mode',
    /Singing School in progress/.test(await bannerText(page)), String(await storedMode(page)));

  // ---- E: legacy bare-string stored value is adopted, not discarded ----
  await page.evaluate(() => { localStorage.setItem('singingMinutesActiveMode', 'Memorial'); });
  await L.open(page);
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(1200);
  const legacyBanner = await bannerText(page);
  const legacyStored = await storedMode(page);
  L.check('legacy bare-string mode is adopted by the current record, not dropped',
    /Memorial Lesson in progress/.test(legacyBanner), legacyBanner);
  L.check('legacy value is upgraded in place to the owned form',
    !!legacyStored && legacyStored.charAt(0) === '{' && /"owner"/.test(legacyStored), String(legacyStored));

  L.check('no page errors', page._errors.length === 0, page._errors.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(L.summary());
})();
