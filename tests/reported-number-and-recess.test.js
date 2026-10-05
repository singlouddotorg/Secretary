// Typed "Number present" wins on the Report; red Secretary note; Capture recess reminder.
'use strict';
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');
after(() => { closeAllWindows(); });

const HEADER = ['Schema Version','Order of entry','Record Type','Session Label','Session ID','Metadata Field','Metadata Value','Event','Date','Location','Chair','Vice-Chair','Secretary','Treasurer','Arranger(s)','Chaplain(s)','Memorial Lesson Leader','Book','Edition Code','Leader(s)','Canonical Leader(s)','Page','Song','Tag','Notes','Marker','Timestamp ISO','Time entered','Series Code','Event ID','Previous Event ID','Status'];
const q = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
function csv(meta) {
  const base = { 'Schema Version': '5', 'Session ID': 'abc12345', Event: 'Typed Test', Date: '2026-10-03', Location: 'Hall', 'Series Code': 'xx1', 'Event ID': 'xx1-2026-10-03' };
  const out = [HEADER.join(',')];
  const row = (n, type, extra) => out.push(HEADER.map((h) => q(Object.assign({}, base, extra, { 'Order of entry': String(n), 'Record Type': type, 'Timestamp ISO': '2026-10-03T14:1' + n + ':00.000Z' })[h] || '')).join(','));
  row(1, 'session', {});
  row(2, 'song', { Book: 'ShH2012', 'Edition Code': 'ShH2012', 'Leader(s)': 'Thomas Ward', Page: '13b' });
  row(3, 'song', { Book: 'ShH2012', 'Edition Code': 'ShH2012', 'Leader(s)': 'Ann Lee', Page: '5' });
  Object.keys(meta).forEach((f, i) => out.push(HEADER.map((h) => (h === 'Schema Version' ? '5' : h === 'Order of entry' ? String(100 + i) : h === 'Record Type' ? 'metadata' : h === 'Metadata Field' ? f : h === 'Metadata Value' ? meta[f] : '')).map(q).join(',')));
  return out.join('\r\n') + '\r\n';
}
async function open(text) {
  const dom = loadPage('minutes.html');
  await wait(700);
  const win = dom.window, d = win.document;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.confirm = () => true;
  const inp = d.getElementById('importFileInput');
  Object.defineProperty(inp, 'files', { value: [new win.File([text], 'm.csv', { type: 'text/csv' })], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(1200);
  return { win, d };
}
async function report(meta) {
  const { d } = await open(csv(meta));
  d.getElementById('stageBtn-report').click(); await wait(400);
  return { st: d.getElementById('reportStatement').textContent, basis: d.getElementById('reportBasis').textContent, d };
}

describe('Report attendee total', () => {
  test('a typed number wins', async () => {
    const r = await report({ 'meta.present': '87' });
    assert.match(r.st, /consisted of 87 total attendees, with 2 singers leading a total of 2 songs/);
    assert.match(r.basis, /entered under Event Details/);
  });
  test('thousands separators and text are tolerated', async () => {
    assert.match((await report({ 'meta.present': 'about 1,200' })).st, /1200 total attendees|1,200 total attendees/);
  });
  test('blank uses the generated count', async () => {
    const r = await report({});
    assert.match(r.st, /consisted of 2 total attendees/);
    assert.doesNotMatch(r.basis, /entered under Event Details/);
  });
  test('non-numeric falls back to the generated count', async () => {
    assert.match((await report({ 'meta.present': 'many' })).st, /consisted of 2 total attendees/);
  });
  test('red note on Event Details', async () => {
    const { d } = await open(csv({}));
    const n = d.getElementById('presentNote');
    assert.ok(n);
    assert.match(n.textContent, /enter every attendee/);
  });
});

describe('Capture recess reminder', () => {
  async function cap() {
    const dom = loadPage('minutes.html'); await wait(700);
    return { win: dom.window, d: dom.window.document };
  }
  test('appears on RECESS, is dismissible, not on other markers', async () => {
    const { win, d } = await cap();
    d.querySelector('.marker-btn[data-label="LUNCH"]').click(); await wait(100);
    assert.equal(d.getElementById('recessReminder'), null);
    d.querySelector('.marker-btn[data-label="RECESS"]').click(); await wait(100);
    const box = d.getElementById('recessReminder');
    assert.ok(box);
    assert.match(box.textContent, /enter in any attendees names and information in COMPILE > ATTENDEES if they have not led/);
    d.getElementById('recessReminderOk').click();
    assert.equal(d.getElementById('recessReminder'), null);
    d.querySelector('.marker-btn[data-label="RECESS"]').click(); await wait(100);
    d.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(d.getElementById('recessReminder'), null);
  });
  test('Open Attendees navigates to Compile > Attendees', async () => {
    const { d } = await cap();
    d.querySelector('.marker-btn[data-label="RECESS"]').click(); await wait(100);
    d.getElementById('recessReminderOpen').click(); await wait(800);
    assert.equal(d.getElementById('recessReminder'), null);
    assert.equal(d.querySelector('.substage-btn[data-panel-target="singers"]').getAttribute('aria-current'), 'true');
  });
});
