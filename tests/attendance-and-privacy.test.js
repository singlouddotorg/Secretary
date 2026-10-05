// 2026-10-04 review round:
//  - "Total attendees" counts people present: not donors or thanked-only people (they may not
//    have come), and not a saved contact record with no entry in this singing.
//  - Minutes Maker can cite pages as "Title" (3b) instead of "Title" on page 3b.
//  - Capture warns when the record carries attendee contact details, offers a copy without
//    them, and the contact rows survive Compile -> Capture -> Compile.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');

after(() => { closeAllWindows(); });

const HEADER = ['Schema Version','Order of entry','Record Type','Session Label','Session ID','Metadata Field','Metadata Value','Event','Date','Location','Chair','Vice-Chair','Secretary','Treasurer','Arranger(s)','Chaplain(s)','Memorial Lesson Leader','Book','Edition Code','Leader(s)','Canonical Leader(s)','Page','Song','Tag','Notes','Marker','Timestamp ISO','Time entered','Series Code','Event ID','Previous Event ID','Status'];
const q = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
function csv(songs, meta) {
  const base = { 'Schema Version': '5', 'Session ID': 'abc12345', Event: 'Review Test Singing', Date: '2026-10-03', Location: 'Hall', Chair: 'Lindsey Falbo', 'Series Code': 'xx1', 'Event ID': 'xx1-2026-10-03' };
  const out = [HEADER.join(',')];
  const row = (n, type, extra) => out.push(HEADER.map((h) => q(Object.assign({}, base, extra, { 'Order of entry': String(n), 'Record Type': type, 'Timestamp ISO': '2026-10-03T14:' + String(10 + (n % 40)) + ':00.000Z' })[h] || '')).join(','));
  row(1, 'session', {});
  songs.forEach((s, i) => row(i + 2, 'song', Object.assign({ Book: 'ShH2012', 'Edition Code': 'ShH2012' }, s)));
  Object.keys(meta || {}).forEach((f, i) => {
    out.push(HEADER.map((h) => (h === 'Schema Version' ? '5' : h === 'Order of entry' ? String(100 + i) : h === 'Record Type' ? 'metadata' : h === 'Metadata Field' ? f : h === 'Metadata Value' ? meta[f] : '')).map(q).join(','));
  });
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
function captureDownloads(win) {
  const got = [];
  win.URL.createObjectURL = (blob) => { got.push({ blob }); return 'blob:x' + got.length; };
  win.URL.revokeObjectURL = () => {};
  win.HTMLAnchorElement.prototype.click = function () { const g = got[got.length - 1]; if (g) g.name = this.download; };
  return got;
}
const blobText = (win, blob) => new Promise((res) => { const r = new win.FileReader(); r.onload = () => res(r.result); r.readAsText(blob); });

describe('Total attendees', () => {
  const META = {
    'singer.patcontact.name': 'Pat Contact', 'singer.patcontact.phone': '555-0100',
    'singer.donordan.name': 'Donor Dan', 'singer.donordan.donor': 'true',
    'singer.hallcommittee.name': 'Hall Committee', 'singer.hallcommittee.thanked': 'true',
    'singer.danadonor.name': 'Dana Donor', 'singer.danadonor.donor': 'true',
    'singer.veravip.name': 'Vera Vip', 'singer.veravip.vip': 'true'
  };
  const SONGS = [{ 'Leader(s)': 'Thomas Ward', Page: '13b' }, { 'Leader(s)': 'Ann Lee', Page: '5' }, { 'Leader(s)': 'Dana Donor', Page: '9' }];
  async function reportText() {
    const { d } = await open(csv(SONGS, META));
    d.getElementById('stageBtn-report').click(); await wait(400);
    return d.getElementById('reportStatement').textContent;
  }
  test('donors, thanked-only people and contact-only records are not counted; a donor who led is', async () => {
    // Counted: Thomas Ward, Ann Lee, Dana Donor (led), Lindsey Falbo (Chair), Vera Vip (VIP) = 5.
    assert.match(await reportText(), /consisted of 5 total attendees, with 3 singers leading a total of 3 songs\./);
  });
  test('they are still listed on the Attendees page', async () => {
    const { d } = await open(csv(SONGS, META));
    d.getElementById('stageBtn-compile').click(); await wait(600);
    d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
    const names = Array.from(d.querySelectorAll('#singersList .singer-name')).map((i) => i.value);
    ['Pat Contact', 'Donor Dan', 'Hall Committee'].forEach((n) => assert.ok(names.includes(n), n));
    assert.match(d.getElementById('singersCount').textContent, /counted as attendees/);
  });
});

describe('Citation style', () => {
  const SONGS = [{ 'Leader(s)': 'Thomas Ward', Page: '13b', Song: 'Bethel' }, { 'Leader(s)': 'Kevin Slaughter', Page: '3b', Song: 'North Carolina' }, { 'Leader(s)': 'Ann Lee', Page: '5', Song: 'Breaker' }];
  async function text(meta) {
    const { d } = await open(csv(SONGS, Object.assign({ 'meta.outputType': 'traditional', 'meta.mmSongNumber': 'true' }, meta)));
    d.getElementById('stageBtn-export').click(); await wait(700);
    return d.getElementById('previewText').textContent;
  }
  test('default is "on page N"', async () => {
    const t = await text({});
    assert.match(t, /"North Carolina" on page 3b/);
  });
  test('the checkbox switches to (N)', async () => {
    const t = await text({ 'meta.mmCiteParen': 'true' });
    assert.match(t, /"North Carolina" \(3b\)/);
    assert.doesNotMatch(t, /on page 3b/);
  });
  test('with a book code there is one set of parentheses', async () => {
    const t = await text({ 'meta.mmCiteParen': 'true', 'meta.mmAllSources': 'true' });
    assert.match(t, /"North Carolina" \(3b, [A-Za-z0-9]+\)/);
    assert.doesNotMatch(t, /\(3b\) \(/);
  });
  test('the checkbox exists, reflects the file, and round-trips to the CSV', async () => {
    const { win, d } = await open(csv(SONGS, { 'meta.outputType': 'traditional', 'meta.mmSongNumber': 'true', 'meta.mmCiteParen': 'true' }));
    d.getElementById('stageBtn-export').click(); await wait(500);
    const cb = d.getElementById('m_mmCiteParen');
    assert.ok(cb && cb.checked);
    const got = captureDownloads(win);
    d.getElementById('exp_csv').click(); await wait(300);
    assert.match(await blobText(win, got[got.length - 1].blob), /meta\.mmCiteParen,true/);
  });
});

describe('Capture and contact details', () => {
  const META = { 'singer.patcontact.name': 'Pat Contact', 'singer.patcontact.phone': '555-0100', 'singer.patcontact.email': 'pat@example.org' };
  const SONGS = [{ 'Leader(s)': 'Thomas Ward', Page: '13b' }];
  test('Capture warns, relabels Export CSV, and offers a copy without contacts', async () => {
    const { d } = await open(csv(SONGS, META));
    d.getElementById('stageBtn-minutes').click(); await wait(600);
    assert.notEqual(d.getElementById('captureContactNote').style.display, 'none');
    assert.notEqual(d.getElementById('csvNoContactsBtn').style.display, 'none');
    assert.match(d.getElementById('csvBtn').textContent, /includes contact details/);
  });
  test('no contacts, no warning', async () => {
    const { d } = await open(csv(SONGS, { 'singer.patcontact.name': 'Pat Contact' }));
    d.getElementById('stageBtn-minutes').click(); await wait(600);
    assert.equal(d.getElementById('captureContactNote').style.display, 'none');
    assert.equal(d.getElementById('csvNoContactsBtn').style.display, 'none');
    assert.equal(d.getElementById('csvBtn').textContent, 'Export CSV');
  });
  test('Export CSV keeps contacts (private backup); the redacted export drops phone, email and notes but keeps names', async () => {
    const { win, d } = await open(csv(SONGS, META));
    d.getElementById('stageBtn-minutes').click(); await wait(600);
    const got = captureDownloads(win);
    d.getElementById('csvBtn').click(); await wait(300);
    const full = await blobText(win, got[got.length - 1].blob);
    assert.match(full, /555-0100/); assert.match(full, /pat@example\.org/);
    d.getElementById('csvNoContactsBtn').click(); await wait(300);
    const red = await blobText(win, got[got.length - 1].blob);
    assert.doesNotMatch(red, /555-0100/); assert.doesNotMatch(red, /pat@example\.org/);
    assert.match(red, /singer\.patcontact\.name/);
    assert.match(got[got.length - 1].name, /no-contacts/);
  });
  test('contacts entered on Attendees survive Compile -> Capture -> Compile', async () => {
    const { win, d } = await open(csv(SONGS, {}));
    d.getElementById('stageBtn-compile').click(); await wait(600);
    d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
    const row = Array.from(d.querySelectorAll('#singersList .singer-row')).find((r) => r.querySelector('.singer-name').value === 'Thomas Ward');
    const phone = Array.from(row.querySelectorAll('.singer-contact input')).find((i) => /phone|tel/i.test(i.type + i.getAttribute('aria-label')));
    phone.value = '555-0199'; phone.dispatchEvent(new win.Event('input', { bubbles: true })); phone.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(300);
    d.getElementById('stageBtn-minutes').click(); await wait(700);
    assert.notEqual(d.getElementById('captureContactNote').style.display, 'none');
    d.getElementById('stageBtn-compile').click(); await wait(700);
    d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
    const row2 = Array.from(d.querySelectorAll('#singersList .singer-row')).find((r) => r.querySelector('.singer-name').value === 'Thomas Ward');
    const phone2 = Array.from(row2.querySelectorAll('.singer-contact input')).find((i) => /phone|tel/i.test(i.type + i.getAttribute('aria-label')));
    assert.equal(phone2.value, '555-0199');
  });
});

describe('Setup/Capture "Load last time\'s file" imports only attendees', () => {
  test('carries leaders, officers and VIPs; not donor-only, contact-only or carried-over names', async () => {
    const { win, d } = await open(csv([{ 'Leader(s)': 'Thomas Ward', Page: '13b' }], {}));
    const prev = [
      'Record Type,Leader(s),Chair,Metadata Field,Metadata Value',
      'song,Zed Carried,Pat Chair,,',
      'namesuggestion,Old Ghost,,,',
      'metadata,,,singer.donorsue.name,Donor Sue',
      'metadata,,,singer.donorsue.donor,true',
      'metadata,,,singer.patcontact.name,Pat Contact',
      'metadata,,,singer.patcontact.phone,555',
      'metadata,,,singer.vicvip.name,Vic Vip',
      'metadata,,,singer.vicvip.vip,true'
    ].join('\n') + '\n';
    const inp = d.getElementById('previousEventFileInput');
    Object.defineProperty(inp, 'files', { value: [new win.File([prev], 'last.csv', { type: 'text/csv' })], configurable: true });
    inp.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(500);
    // Zed Carried, Pat Chair, Vic Vip
    assert.match(d.getElementById('previousEventLoadStatus').textContent, /Pulled 3 names/);
  });
});
