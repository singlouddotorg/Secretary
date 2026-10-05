// Reported 2026-10-04 (Maryland All-Day Singing master CSV, SHMHA output):
//  1. ANNOUNCEMENTS markers printed "Announcements were made." with no name, though the CSV
//     records who made them.
//  2. A PRAYER marker right after the opening song repeated the opening prayer the opening
//     paragraph had already credited to the chaplain.
//  3. The opener's "Opener" note printed as "(Opener)" right after "called to order by ...".
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');

after(() => { closeAllWindows(); });

const HEADER = ['Schema Version','Order of entry','Record Type','Session Label','Session ID','Metadata Field','Metadata Value','Event','Date','Location','Chair','Vice-Chair','Secretary','Treasurer','Arranger(s)','Chaplain(s)','Memorial Lesson Leader','Book','Edition Code','Leader(s)','Canonical Leader(s)','Page','Song','Tag','Notes','Marker','Timestamp ISO','Time entered','Series Code','Event ID','Previous Event ID','Status'];
const q = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
function csv(items, outputType) {
  const base = { 'Schema Version': '5', 'Session ID': 'abc12345', Event: 'Marker Test Singing', Date: '2026-10-03', Location: 'Hall', Chair: 'Lindsey Falbo', Treasurer: 'Jim Glaser', 'Chaplain(s)': 'Taylor Ramage', 'Series Code': 'xx1', 'Event ID': 'xx1-2026-10-03' };
  const out = [HEADER.join(',')];
  out.push(HEADER.map((h) => q(Object.assign({}, base, { 'Order of entry': '1', 'Record Type': 'session' })[h] || '')).join(','));
  items.forEach((it, i) => {
    const row = Object.assign({}, base, it, { 'Order of entry': String(i + 2), 'Timestamp ISO': '2026-10-03T14:' + String(10 + i) + ':00.000Z' });
    out.push(HEADER.map((h) => q(row[h] || '')).join(','));
  });
  const meta = (n, f, v) => HEADER.map((h) => (h === 'Schema Version' ? '5' : h === 'Order of entry' ? String(n) : h === 'Record Type' ? 'metadata' : h === 'Metadata Field' ? f : h === 'Metadata Value' ? v : '')).join(',');
  out.push(meta(50, 'meta.outputType', outputType || 'shmha'));
  return out.join('\r\n') + '\r\n';
}
const SONG = (leader, page, extra) => Object.assign({ 'Record Type': 'song', Book: 'ShH2012', 'Edition Code': 'ShH2012', 'Leader(s)': leader, Page: page }, extra || {});
const MARK = (type, leader, extra) => Object.assign({ 'Record Type': 'marker', Marker: type, 'Leader(s)': leader || '' }, extra || {});

async function minutes(text) {
  const dom = loadPage('minutes.html');
  await wait(700);
  const win = dom.window, d = win.document;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  const inp = d.getElementById('importFileInput');
  Object.defineProperty(inp, 'files', { value: [new win.File([text], 'm.csv', { type: 'text/csv' })], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(1200);
  d.getElementById('stageBtn-export').click(); await wait(800);
  return d.getElementById('previewText').textContent;
}
const count = (s, re) => (s.match(re) || []).length;

describe('Marker and opening narrative', () => {
  test('announcements name who made them and the role they hold', async () => {
    const t = await minutes(csv([SONG('Thomas Ward', '13b'), SONG('Ann Lee', '5'), MARK('ANNOUNCEMENTS', 'Lindsey Falbo'), MARK('ANNOUNCEMENTS', 'Jim Glaser')]));
    assert.match(t, /The Chair, Lindsey Falbo, made an announcement\./);
    assert.match(t, /The Treasurer, Jim Glaser, made an announcement\./);
    assert.doesNotMatch(t, /Announcements were made\./);
  });
  test('someone with no office is named without a title', async () => {
    const t = await minutes(csv([SONG('Thomas Ward', '13b'), MARK('ANNOUNCEMENTS', 'Pat Reed')]));
    assert.match(t, /Pat Reed made an announcement\./);
    assert.doesNotMatch(t, /The , Pat Reed/);
  });
  test('the stock "Announcements were made." stored on an in-app marker does not hide the name', async () => {
    const t = await minutes(csv([SONG('Thomas Ward', '13b'), MARK('ANNOUNCEMENTS', 'Jim Glaser', { Notes: '' })]));
    assert.match(t, /The Treasurer, Jim Glaser/);
  });
  test('an announcement with no name keeps the plain sentence', async () => {
    const t = await minutes(csv([SONG('Thomas Ward', '13b'), MARK('ANNOUNCEMENTS', '')]));
    assert.match(t, /Announcements were made\./);
  });
  test('a "Closer" note does not replace the announcement sentence', async () => {
    const t = await minutes(csv([SONG('Thomas Ward', '13b'), MARK('ANNOUNCEMENTS', 'Lindsey Falbo', { Notes: 'Closer' })]));
    assert.match(t, /The Chair, Lindsey Falbo, made an announcement\./);
  });
  test('the opening prayer by the chaplain is not repeated by the first PRAYER marker', async () => {
    const t = await minutes(csv([SONG('Thomas Ward', '13b'), MARK('PRAYER', 'Taylor Ramage'), SONG('Ann Lee', '5')]));
    assert.equal(count(t, /prayer/gi), 1, t);
    assert.match(t, /Taylor Ramage offered the opening prayer\./);
    assert.doesNotMatch(t, /led the class in prayer/);
  });
  test('a PRAYER marker by someone else, or later in the day, still prints', async () => {
    const other = await minutes(csv([SONG('Thomas Ward', '13b'), MARK('PRAYER', 'Pat Reed'), SONG('Ann Lee', '5')]));
    assert.match(other, /Pat Reed led the class in prayer\./);
    const later = await minutes(csv([SONG('Thomas Ward', '13b'), MARK('LUNCH', ''), SONG('Ann Lee', '5'), MARK('PRAYER', 'Taylor Ramage')]));
    assert.match(later, /Taylor Ramage led the class in prayer\./);
  });
  test('a bare "Opener" note is not printed after the opening song', async () => {
    const t = await minutes(csv([SONG('Thomas Ward', '13b', { Notes: 'Opener' }), SONG('Ann Lee', '5')]));
    assert.match(t, /called to order by Thomas Ward leading song on page 13b\./);
    assert.doesNotMatch(t, /\(Opener\)/);
  });
  test('Minutes Maker output gets the same fixes', async () => {
    const t = await minutes(csv([SONG('Thomas Ward', '13b', { Notes: 'Opener' }), MARK('PRAYER', 'Taylor Ramage'), SONG('Ann Lee', '5'), MARK('ANNOUNCEMENTS', 'Lindsey Falbo')], 'traditional'));
    assert.doesNotMatch(t, /\(Opener\)/);
    assert.equal(count(t, /prayer/gi), 1, t);
    assert.match(t, /The Chair, Lindsey Falbo, made an announcement\./);
  });
});
