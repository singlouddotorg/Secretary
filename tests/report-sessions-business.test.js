// Per-session Report statements + ALL; Business page driven by song-list entries; announcement numbering.
'use strict';
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');
after(() => { closeAllWindows(); });

const HEADER = ['Schema Version','Order of entry','Record Type','Session Label','Session ID','Metadata Field','Metadata Value','Event','Date','Location','Chair','Vice-Chair','Secretary','Treasurer','Arranger(s)','Chaplain(s)','Memorial Lesson Leader','Book','Edition Code','Leader(s)','Canonical Leader(s)','Page','Song','Tag','Notes','Marker','Timestamp ISO','Time entered','Series Code','Event ID','Previous Event ID','Status'];
const q = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
function csv(rowsSpec, meta) {
  const base = { 'Schema Version': '5', Event: 'Two Day Convention', Date: '2026-10-03', Location: 'Hall', Chair: 'Lindsey Falbo', Treasurer: 'Jim Glaser', 'Series Code': 'xx1', 'Event ID': 'xx1-2026-10-03' };
  const out = [HEADER.join(',')];
  rowsSpec.forEach((r, i) => {
    const o = Object.assign({}, base, { 'Order of entry': String(i + 1), 'Timestamp ISO': '2026-10-03T14:' + String(10 + i).padStart(2, '0') + ':00.000Z' }, r);
    out.push(HEADER.map((h) => q(o[h] || '')).join(','));
  });
  Object.keys(meta || {}).forEach((f, i) => out.push(HEADER.map((h) => (h === 'Schema Version' ? '5' : h === 'Order of entry' ? String(100 + i) : h === 'Record Type' ? 'metadata' : h === 'Metadata Field' ? f : h === 'Metadata Value' ? meta[f] : '')).map(q).join(',')));
  return out.join('\r\n') + '\r\n';
}
const SH = { Book: 'ShH2012', 'Edition Code': 'ShH2012' };
const TWO = [
  { 'Record Type': 'session', 'Session ID': 's1', 'Session Label': 'Saturday' },
  Object.assign({ 'Record Type': 'song', 'Session ID': 's1', 'Leader(s)': 'Thomas Ward', Page: '13b' }, SH),
  Object.assign({ 'Record Type': 'song', 'Session ID': 's1', 'Leader(s)': 'Ann Lee', Page: '5' }, SH),
  { 'Record Type': 'session', 'Session ID': 's2', 'Session Label': 'Sunday', Date: '2026-10-04' },
  Object.assign({ 'Record Type': 'song', 'Session ID': 's2', 'Leader(s)': 'Thomas Ward', Page: '30' }, SH),
  Object.assign({ 'Record Type': 'song', 'Session ID': 's2', 'Leader(s)': 'Bob Roe', Page: '47' }, SH),
  Object.assign({ 'Record Type': 'song', 'Session ID': 's2', 'Leader(s)': 'Bob Roe', Page: '48' }, SH)
];
async function open(text) {
  const dom = loadPage('minutes.html'); await wait(700);
  const win = dom.window, d = win.document;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.confirm = () => true;
  const inp = d.getElementById('importFileInput');
  Object.defineProperty(inp, 'files', { value: [new win.File([text], 'm.csv', { type: 'text/csv' })], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(1200);
  return { win, d };
}

describe('Report statements by session', () => {
  test('two sessions: one statement each, then All sessions', async () => {
    const { d } = await open(csv(TWO, {}));
    d.getElementById('stageBtn-report').click(); await wait(400);
    const ps = Array.from(d.querySelectorAll('#reportSessions .session-statement')).map((p) => p.textContent);
    assert.equal(ps.length, 2);
    assert.match(ps[0], /Saturday, consisted of 4 total attendees, with 2 singers leading a total of 2 songs\./); // Thomas, Ann, Lindsey, Jim
    assert.match(ps[1], /Sunday, consisted of 4 total attendees, with 2 singers leading a total of 3 songs\./); // Thomas, Bob, Lindsey, Jim
    const all = d.getElementById('reportStatement').textContent;
    assert.match(all, /consisted of 5 total attendees, with 3 singers leading a total of 5 songs\./);
    assert.equal(d.getElementById('reportAllLabel').hidden, false);
  });
  test('typed raw number applies to All sessions only', async () => {
    const { d } = await open(csv(TWO, { 'meta.present': '90' }));
    d.getElementById('stageBtn-report').click(); await wait(400);
    assert.match(d.getElementById('reportStatement').textContent, /consisted of 90 total attendees/);
    assert.match(d.querySelector('#reportSessions .session-statement').textContent, /consisted of 4 total attendees/);
  });
  test('a single session shows only the one statement', async () => {
    const { d } = await open(csv(TWO.slice(0, 3), {}));
    d.getElementById('stageBtn-report').click(); await wait(400);
    assert.equal(d.querySelectorAll('#reportSessions .session-statement').length, 0);
    assert.equal(d.getElementById('reportAllLabel').hidden, true);
    assert.match(d.getElementById('reportStatement').textContent, /consisted of/);
  });
});

describe('Event Details raw-number wording', () => {
  test('says it is only for when names cannot be entered', async () => {
    const { d } = await open(csv(TWO, {}));
    assert.match(d.querySelector('label[for="m_present"]').textContent, /only if you can.t enter everyone.s name/);
    assert.match(d.getElementById('presentNote').textContent, /Use this box only when you can.t name everyone/);
  });
});

describe('Business & Announcements', () => {
  const ANN = (n, who, notes, extra) => Object.assign({ 'Record Type': 'marker', 'Session ID': 's1', Marker: 'ANNOUNCEMENTS', 'Leader(s)': who, Notes: notes || '' }, extra || {});
  async function openCompile(rows) {
    const { d } = await open(csv(rows, {}));
    d.getElementById('stageBtn-compile').click(); await wait(600);
    d.querySelector('[data-panel-target="songs"]').click(); await wait(300);
    return d;
  }
  const BASE = TWO.slice(0, 3);
  test('hidden with no business and no officer announcement; shown for officer announcement', async () => {
    let d = await openCompile(BASE.concat([ANN(1, 'Thomas Ward', 'Dinner is at 5.')]));
    assert.equal(d.querySelector('[data-panel-target="business"]').hidden, true);
    d = await openCompile(BASE.concat([ANN(1, 'Jim Glaser', 'Dues are due.')]));
    assert.equal(d.querySelector('[data-panel-target="business"]').hidden, false);
  });
  test('shown for a Business Meeting; boxes edit the entry Notes and the minutes', async () => {
    const d = await openCompile(BASE.concat([{ 'Record Type': 'marker', 'Session ID': 's1', Marker: 'BUSINESS MEETING', Notes: 'old' }]));
    const btn = d.querySelector('[data-panel-target="business"]');
    assert.equal(btn.hidden, false);
    btn.click(); await wait(300);
    const ta = d.querySelector('#businessEntries textarea');
    assert.ok(ta); assert.equal(ta.value, 'old');
    ta.value = 'The class voted to meet again next year.';
    ta.dispatchEvent(new d.defaultView.Event('input', { bubbles: true }));
    ta.dispatchEvent(new d.defaultView.Event('change', { bubbles: true }));
    await wait(200);
    d.querySelector('[data-panel-target="songs"]').click(); await wait(200);
    const notes = Array.from(d.querySelectorAll('#songBody .notes-in')).map((i) => i.value);
    assert.ok(notes.includes('The class voted to meet again next year.'));
  });
  test('repeated announcements by one officer are numbered; a single one is not', async () => {
    const d = await openCompile(BASE.concat([ANN(1, 'Jim Glaser', ''), ANN(2, 'Jim Glaser', ''), ANN(3, 'Lindsey Falbo', '')]));
    const txt = d.getElementById('songBody').textContent;
    assert.match(txt, /ANNOUNCEMENTS 1 of 2/i);
    assert.match(txt, /ANNOUNCEMENTS 2 of 2/i);
    assert.equal((txt.match(/ANNOUNCEMENTS \d of/gi) || []).length, 2);
    d.querySelector('[data-panel-target="business"]').click(); await wait(300);
    const labels = Array.from(d.querySelectorAll('#businessEntries label')).map((l) => l.textContent);
    assert.ok(labels.some((l) => /Treasurer announcement 1 of 2/.test(l)));
    assert.ok(labels.some((l) => /Treasurer announcement 2 of 2/.test(l)));
  });
  test('the minutes say "first" / "second" announcement, and print the typed Notes as written', async () => {
    const { d } = await open(csv(BASE.concat([ANN(1, 'Jim Glaser', ''), ANN(2, 'Jim Glaser', 'The hall needs volunteers.'), ANN(3, 'Lindsey Falbo', '')]), {}));
    d.getElementById('stageBtn-export').click(); await wait(800);
    const t = d.getElementById('previewText').textContent;
    assert.match(t, /The Treasurer, Jim Glaser, made the first announcement\./);
    assert.match(t, /The hall needs volunteers\./);
    assert.match(t, /The Chair, Lindsey Falbo, made an announcement\./);
  });
});
