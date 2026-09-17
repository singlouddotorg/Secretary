const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + require('./paths').minutesApp();

async function launch(){
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page._errors = errors;
  return { browser, page };
}

async function open(page){
  if (!page._dialogHandler){
    page._dialogPrompts = [];
    page.on('dialog', async d => {
      page._dialogPrompts.push({ type: d.type(), message: d.message() });
      const answer = page._nextPromptAnswer;
      page._nextPromptAnswer = null;
      if (d.type() === 'prompt') await d.accept(answer == null ? '' : answer);
      else await d.accept();
    });
    page._dialogHandler = true;
  }
  await page.goto(APP);
  await page.waitForTimeout(700);
}

// Setup stage: fill event/date/location/chair, then go to Capture
async function setupSinging(page, { event, date, location, chair }){
  await page.click('#stageBtn-setup');
  await page.waitForTimeout(200);
  const visible = await page.evaluate(() => {
    const el = document.getElementById('event');
    return !!(el && el.offsetParent !== null);
  });
  if (!visible){
    await page.click('#setupNewSingingBtn');
    await page.waitForTimeout(400);
  }
  await page.fill('#event', event);
  await page.fill('#date', date);
  await page.fill('#location', location);
  if (chair !== undefined) await page.fill('#roleChair', chair).catch(()=>{});
  // Memorial lesson leader is no longer a Setup field (Kevin's own call, 2026-09-17) -
  // it's derived from whichever song(s) get tagged Memorial, so there's nothing to fill
  // in here any more.
  await page.waitForTimeout(200);
}

async function toCapture(page){
  await page.click('#stageBtn-minutes');
  await page.waitForTimeout(600);
  // dismiss welcome gate if showing
  const gateVisible = await page.evaluate(() => {
    const g = document.getElementById('welcomeGate');
    return g && g.offsetParent !== null;
  });
  return gateVisible;
}

async function logMarker(page, label){
  await page.click(`.marker-btn[data-label="${label}"]`);
  await page.waitForTimeout(300);
}

// Song Sources live in Capture; pick the first common book so page lookups work.
async function selectFirstBook(page){
  const picked = await page.evaluate(() => {
    const boxes = document.querySelectorAll('.book-check input[type=checkbox]');
    if (!boxes.length) return null;
    if (!boxes[0].checked) boxes[0].click();
    const label = boxes[0].closest('.book-check');
    return label ? label.textContent.trim() : 'picked';
  });
  await page.waitForTimeout(400);
  return picked;
}

async function logSong(page, { leader, pageNum, tag }){
  if (leader !== undefined) await page.fill('#caller', leader);
  await page.fill('#page', pageNum);
  await page.waitForTimeout(250);
  // a page with both a top and a bottom song blocks the add until one is chosen
  const ambiguous = await page.evaluate(() => {
    const el = document.getElementById('pageWarn');
    return el && el.classList.contains('show');
  });
  if (ambiguous){ await page.click('#pickTop'); await page.waitForTimeout(200); }
  if (tag) { await page.click(`.tag-chip[data-tag="${tag}"]`); await page.waitForTimeout(100); }
  await page.click('#addBtn');
  await page.waitForTimeout(350);
  // handle "add anyway" if the page isn't in the index
  const needsConfirm = await page.evaluate(() => {
    const el = document.getElementById('unknownConfirm');
    return el && el.classList.contains('show');
  });
  if (needsConfirm){ await page.click('#confirmAddAnyway'); await page.waitForTimeout(300); }
}

function csv(page){
  return page.evaluate(() => window.__ezMinutesCaptureGetCSV());
}

function masterCSV(page){
  return page.evaluate(() => window.__ezMinutesCompileGetMasterCSV());
}

function parseRows(text){
  // minimal CSV parse good enough for these assertions
  const rows = []; let cur = ['']; let i = 0; let q = false;
  while (i < text.length){
    const c = text[i];
    if (q){
      if (c === '"' && text[i+1] === '"'){ cur[cur.length-1] += '"'; i += 2; continue; }
      if (c === '"'){ q = false; i++; continue; }
      cur[cur.length-1] += c; i++; continue;
    }
    if (c === '"'){ q = true; i++; continue; }
    if (c === ','){ cur.push(''); i++; continue; }
    if (c === '\r'){ i++; continue; }
    if (c === '\n'){ rows.push(cur); cur = ['']; i++; continue; }
    cur[cur.length-1] += c; i++;
  }
  if (cur.length > 1 || cur[0] !== '') rows.push(cur);
  return rows;
}

function asObjects(text){
  const rows = parseRows(text);
  const header = rows[0];
  return rows.slice(1).map(r => {
    const o = {};
    header.forEach((h, i) => o[h] = r[i] === undefined ? '' : r[i]);
    return o;
  });
}

const results = [];
function check(name, ok, detail){
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '\n        ' + String(detail).replace(/\n/g, '\n        ') : ''));
}
function summary(){
  const failed = results.filter(r => !r.ok);
  console.log('\n' + results.length + ' checks, ' + failed.length + ' failed');
  return failed.length;
}

module.exports = { launch, open, setupSinging, toCapture, selectFirstBook, logMarker, logSong, csv, masterCSV, asObjects, parseRows, check, summary, APP };
