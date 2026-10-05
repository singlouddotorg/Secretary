// Reported 2026-10-04 (Maryland All-Day Singing master CSV): opening a Singing Record through
// Setup wiped every role in Compile. pushSetupFieldsIntoRows() copies Setup's officer boxes over
// the first session's Chair/Vice-Chair/Secretary/Treasurer/Arranger(s)/Chaplain(s) columns, and
// at open time those boxes were empty, so the file's own officers were overwritten with blanks.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');

after(() => { closeAllWindows(); });

const HEADER = ['Schema Version','Order of entry','Record Type','Session Label','Session ID','Metadata Field','Metadata Value','Event','Date','Location','Chair','Vice-Chair','Secretary','Treasurer','Arranger(s)','Chaplain(s)','Memorial Lesson Leader','Book','Edition Code','Leader(s)','Canonical Leader(s)','Page','Song','Tag','Notes','Marker','Timestamp ISO','Time entered','Series Code','Event ID','Previous Event ID','Status'];
function csvFor(officers) {
  const base = { 'Schema Version': '5', 'Session ID': 'abc12345', Event: 'Officer Test Singing', Date: '2026-10-03', Location: 'Hall', 'Series Code': 'xx1', 'Event ID': 'xx1-2026-10-03' };
  const rec = (n, type, extra) => HEADER.map((h) => {
    const v = Object.assign({}, base, officers, extra, { 'Order of entry': String(n), 'Record Type': type, 'Timestamp ISO': '2026-10-03T14:0' + n + ':00.000Z' })[h];
    return v === undefined ? '' : /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',');
  return [HEADER.join(','), rec(1, 'session', {}), rec(2, 'song', { Book: 'ShH2012', 'Edition Code': 'ShH2012', 'Leader(s)': 'Thomas Ward', Page: '13b', Song: 'Bethel' })].join('\r\n') + '\r\n';
}
const OFFICERS = { Chair: 'Lindsey Falbo', 'Vice-Chair': 'Nora Miller', Secretary: 'David Shulman, Adele Anderson', Treasurer: 'Jim Glaser', 'Arranger(s)': 'John delRe, Kelly Macklin', 'Chaplain(s)': 'Taylor Ramage' };
const IDS = { r_chair: 'Lindsey Falbo', r_vicechair: 'Nora Miller', r_secretary: 'David Shulman, Adele Anderson', r_treasurer: 'Jim Glaser', r_committee: 'John delRe, Kelly Macklin', r_chaplain: 'Taylor Ramage' };

async function openThroughSetup(csv) {
  const dom = loadPage('minutes.html');
  await wait(700);
  const win = dom.window, d = win.document;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  await openFile(win, d, csv);
  return { win, d };
}
async function openFile(win, d, csv) {
  const inp = d.getElementById('importFileInput');
  Object.defineProperty(inp, 'files', { value: [new win.File([csv], 'm.csv', { type: 'text/csv' })], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(1200);
}
async function rolesOnCompile(d) {
  d.getElementById('stageBtn-compile').click(); await wait(800);
  d.querySelector('[data-panel-target="roles"]').click(); await wait(300);
  const got = {};
  Object.keys(IDS).forEach((id) => { got[id] = d.getElementById(id).value; });
  return got;
}
const ev = (win, el) => el.dispatchEvent(new win.Event('input', { bubbles: true }));

describe('Opening a file through Setup keeps its officers', () => {
  test('every role from the file reaches Compile\'s Roles page', async () => {
    const { d } = await openThroughSetup(csvFor(OFFICERS));
    assert.deepEqual(await rolesOnCompile(d), IDS);
  });

  test('Setup\'s officer boxes show the file\'s officers right after opening', async () => {
    const { d } = await openThroughSetup(csvFor(OFFICERS));
    assert.equal(d.getElementById('roleChair').value, 'Lindsey Falbo');
    assert.equal(d.getElementById('roleChaplain').value, 'Taylor Ramage');
  });

  test('editing the event name, date or location in Setup afterwards does not blank the roles', async () => {
    const { win, d } = await openThroughSetup(csvFor(OFFICERS));
    const ev1 = d.getElementById('event'); ev1.value = 'Renamed Singing'; ev(win, ev1);
    const loc = d.getElementById('location'); loc.value = 'Another Hall'; ev(win, loc);
    assert.deepEqual(await rolesOnCompile(d), IDS);
  });

  test('a role edited in Compile survives a later edit in Setup', async () => {
    const { win, d } = await openThroughSetup(csvFor(OFFICERS));
    await rolesOnCompile(d);
    const t = d.getElementById('r_treasurer'); t.value = 'Dee Ortiz'; ev(win, t); t.dispatchEvent(new win.Event('change', { bubbles: true }));
    d.getElementById('stageBtn-setup').click(); await wait(500);
    const loc = d.getElementById('location'); loc.value = 'Yet Another Hall'; ev(win, loc);
    const got = await rolesOnCompile(d);
    assert.equal(got.r_treasurer, 'Dee Ortiz');
    assert.equal(got.r_chair, 'Lindsey Falbo');
  });

  test('a file with no officers does not inherit the previous singing\'s', async () => {
    const { win, d } = await openThroughSetup(csvFor(OFFICERS));
    await openFile(win, d, csvFor({}));
    const got = await rolesOnCompile(d);
    Object.keys(IDS).forEach((id) => assert.equal(got[id], '', id));
  });
});
