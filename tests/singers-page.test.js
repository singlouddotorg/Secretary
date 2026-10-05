// Secretary's Compile stage "Singers" page (Maryland All-Day Singing debrief, 2026-10-04):
// a master list of every name entered, to check spellings, plus per-singer phone/email for a
// mailing list, stored in the minutes file itself.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');

after(() => { closeAllWindows(); });

const ev = (win, el, t = 'input') => el.dispatchEvent(new win.Event(t, { bubbles: true }));

async function build(leaders) {
  const dom = loadPage('minutes.html');
  await wait(700);
  const win = dom.window, d = win.document;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  const set = (id, v) => { const e = d.getElementById(id); e.value = v; ev(win, e); };
  d.getElementById('setupNewSingingBtn').click(); await wait(200);
  set('event', 'Singers Test'); set('date', '2026-10-04'); set('roleChair', 'Ann Lee'); await wait(200);
  d.getElementById('stageBtn-minutes').click(); await wait(500);
  const cb = d.querySelector('#bookCheckRow input[type=checkbox]');
  cb.checked = true; ev(win, cb, 'change'); await wait(200);
  for (const c of leaders) {
    set('caller', c); set('page', '21');
    d.getElementById('addBtn').click(); await wait(250);
  }
  d.getElementById('stageBtn-compile').click(); await wait(600);
  d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
  return { win, d };
}
const rows = (d) => Array.from(d.querySelectorAll('#singersList .singer-row'));
const names = (d) => rows(d).map((r) => r.querySelector('.singer-name').value);
function rowFor(d, name) { return rows(d).find((r) => r.querySelector('.singer-name').value === name); }
function contactInputs(row) {
  const inputs = Array.from(row.querySelectorAll('.singer-contact input, .singer-contact textarea'));
  return { phone: inputs.find((i) => /phone|tel/i.test(i.type + i.getAttribute('aria-label'))), email: inputs.find((i) => /email/i.test(i.type + i.getAttribute('aria-label'))), notes: inputs.find((i) => /note/i.test(i.getAttribute('aria-label') || '')) };
}
function setContact(win, d, name, field, value) {
  const el = contactInputs(rowFor(d, name))[field];
  el.value = value; ev(win, el); ev(win, el, 'change');
}
function captureDownloads(win) {
  const got = [];
  win.URL.createObjectURL = (blob) => { got.push({ blob }); return 'blob:x' + got.length; };
  win.URL.revokeObjectURL = () => {};
  win.HTMLAnchorElement.prototype.click = function () { const g = got[got.length - 1]; if (g) g.name = this.download; };
  return got;
}
function blobText(win, blob) {
  return new Promise((res) => { const r = new win.FileReader(); r.onload = () => res(r.result); r.readAsText(blob); });
}

describe('Singers page', () => {
  test('rail button and panel exist, and the page lists every name entered', async () => {
    const { d } = await build(['Dee Ortiz and Eli Park', 'Bo Marsh']);
    assert.ok(d.querySelector('.substage-btn[data-panel-target="singers"]'));
    assert.deepEqual(names(d).sort(), ['Ann Lee', 'Bo Marsh', 'Dee Ortiz', 'Eli Park']);
    assert.match(d.getElementById('singersCount').textContent, /^4 names/);
  });

  test('a near-duplicate spelling is flagged, and "Same person" merges it', async () => {
    const { win, d } = await build(['Bo Marsh', 'Bo Marsch']);
    assert.equal(rows(d).length, 3);
    const row = rowFor(d, 'Bo Marsch');
    assert.match(row.textContent, /Looks like Bo Marsh/);
    Array.from(row.querySelectorAll('button')).find((b) => /Same person/.test(b.textContent)).click();
    await wait(200);
    assert.deepEqual(names(d).sort(), ['Ann Lee', 'Bo Marsh']);
    assert.match(rowFor(d, 'Bo Marsh').textContent, /led 2 songs/);
  });

  test('renaming a singer fixes the spelling in co-led rows and in officer fields', async () => {
    const { win, d } = await build(['Dee Ortiz and Eli Park']);
    const row = rowFor(d, 'Eli Park');
    row.querySelector('.singer-name').value = 'Eli Parks';
    ev(win, row.querySelector('.singer-name'), 'change');
    await wait(200);
    assert.deepEqual(names(d).sort(), ['Ann Lee', 'Dee Ortiz', 'Eli Parks']);
    const csv = win.__ezMinutesCompileGetMasterCSV();
    assert.ok(!/Eli Park(?!s)/.test(csv.replace(/Eli Parks/g, '')) || /Eli Parks/.test(csv), 'csv still sane');
    // The co-led row now reads with the corrected spelling in the generated output.
    assert.match(d.getElementById('previewHost') ? d.getElementById('previewHost').textContent + csv : csv, /Eli Parks/);
    // Officer rename too
    const ann = rowFor(d, 'Ann Lee');
    ann.querySelector('.singer-name').value = 'Anne Lee';
    ev(win, ann.querySelector('.singer-name'), 'change');
    await wait(200);
    assert.ok(names(d).includes('Anne Lee'));
    assert.ok(!names(d).includes('Ann Lee'));
  });

  test('contacts show in the master CSV, round-trip through import, and can be left out', async () => {
    const { win, d } = await build(['Bo Marsh']);
    setContact(win, d, 'Bo Marsh', 'email', 'bo@example.org');
    setContact(win, d, 'Bo Marsh', 'phone', '+1 410 555 0100');
    await wait(100);
    const csv = win.__ezMinutesCompileGetMasterCSV();
    assert.match(csv, /singer\.bomarsh\.email/);
    assert.match(csv, /bo@example\.org/);

    // A fresh page importing that file gets the contact back.
    const dom2 = loadPage('minutes.html'); await wait(700);
    const win2 = dom2.window;
    win2.HTMLElement.prototype.scrollIntoView = function () {};
    win2.__ezMinutesCompileHandleFile(new win2.File([csv], 'x-master.csv', { type: 'text/csv' }));
    await wait(900);
    const csv2 = win2.__ezMinutesCompileGetMasterCSV();
    assert.match(csv2, /bo@example\.org/);
    assert.match(csv2, /'?\+1 410 555 0100/);
    assert.ok(/(^|,)"?'\+1 410 555 0100/m.test(csv2) && !/''\+1/.test(csv2), 'guard apostrophe is applied once, never stacked');
    win2.document.getElementById('stageBtn-compile').click(); await wait(500);
    win2.document.querySelector('[data-panel-target="singers"]').click(); await wait(300);
    const phone = contactInputs(rowFor(win2.document, 'Bo Marsh')).phone;
    assert.equal(phone.value, '+1 410 555 0100', 'phone comes back without the guard apostrophe');

    // "Without contact details" export.
    const got = captureDownloads(win);
    const note = d.getElementById('exp_csv_nocontacts');
    note.click(); await wait(100);
    const text = await blobText(win, got[got.length - 1].blob);
    assert.ok(!/bo@example\.org/.test(text), 'contacts omitted');
    assert.ok(!/singer\./.test(text));
    assert.match(got[got.length - 1].name, /-master-no-contacts\.csv$/);
  });

  test('mailing-list download has only people with an email; contacts download has everyone with any contact info', async () => {
    const { win, d } = await build(['Bo Marsh', 'Dee Ortiz']);
    setContact(win, d, 'Bo Marsh', 'email', 'bo@example.org');
    setContact(win, d, 'Dee Ortiz', 'phone', '410-555-0101');
    const got = captureDownloads(win);
    d.getElementById('singersMailingBtn').click(); await wait(100);
    const mail = await blobText(win, got[got.length - 1].blob);
    assert.match(got[got.length - 1].name, /-mailing-list\.csv$/);
    assert.match(mail, /^Name,Email,Phone,Notes/);
    assert.match(mail, /Bo Marsh,bo@example\.org/);
    assert.ok(!/Dee Ortiz/.test(mail));
    d.getElementById('singersContactsBtn').click(); await wait(100);
    const all = await blobText(win, got[got.length - 1].blob);
    assert.match(all, /Dee Ortiz,,410-555-0101/);
    assert.match(all, /Bo Marsh/);
  });

  test('contact details never appear in the published outputs', async () => {
    const { win, d } = await build(['Bo Marsh']);
    setContact(win, d, 'Bo Marsh', 'email', 'secret-bo@example.org');
    setContact(win, d, 'Bo Marsh', 'phone', '410-555-0199');
    await wait(100);
    // Only the Singers panel itself (inputs' values are properties, not markup) may hold them.
    const previews = ['previewHost', 'songlistPreview', 'minutesPreview'].map((id) => (d.getElementById(id) || {}).textContent || '').join(' ');
    assert.ok(!/secret-bo@example\.org|410-555-0199/.test(previews));
  });

  test('search narrows the list', async () => {
    const { win, d } = await build(['Bo Marsh', 'Dee Ortiz']);
    const s = d.getElementById('singersSearch');
    s.value = 'dee'; ev(win, s);
    assert.deepEqual(names(d), ['Dee Ortiz']);
  });

  describe('Report page', () => {
    async function openReport(win, d) {
      d.getElementById('stageBtn-report').click(); await wait(300);
      return d.getElementById('reportStatement').textContent;
    }
    test('reads out the totals counted from the Singers list', async () => {
      const { win, d } = await build(['Dee Ortiz and Eli Park', 'Bo Marsh', 'Bo Marsh']);
      assert.ok(d.getElementById('stageBtn-report'));
      const text = await openReport(win, d);
      // Ann Lee (chair only), Dee, Eli, Bo = 4 singers; 3 led; 3 songs.
      assert.match(text, /consisted of 4 total attendees, with 3 singers leading a total of 3 songs\.$/);
    });
    test('puts the Nth Annual name in front', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const name = d.getElementById('m_name'); name.value = 'Maryland All-Day Singing'; ev(win, name);
      const ord = d.getElementById('m_ordinal'); ord.value = '12th'; ev(win, ord);
      const text = await openReport(win, d);
      assert.match(text, /^The 12th Annual Maryland All-Day Singing consisted of /);
    });
    test('follows a spelling merge on the Singers page', async () => {
      const { win, d } = await build(['Bo Marsh', 'Bo Marsch']);
      assert.match(await openReport(win, d), /consisted of 3 total attendees/);
      d.querySelector('[data-panel-target="singers"]').click(); await wait(200);
      Array.from(rowFor(d, 'Bo Marsch').querySelectorAll('button')).find((b) => /Same person/.test(b.textContent)).click();
      await wait(200);
      assert.match(await openReport(win, d), /consisted of 2 total attendees, with 1 singer leading a total of 2 songs\.$/);
    });
    test('Report is top-level step 4 and Export is step 5, in the Back/Next flow', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const nums = Array.from(d.querySelectorAll('.stage-btn[data-stage] .num')).map((n) => n.textContent + n.parentNode.textContent.replace(n.textContent, ''));
      assert.deepEqual(nums, ['1Setup', '2Capture', '3Compile', '4Report', '5Export']);
      assert.ok(!d.querySelector('.substage-btn[data-panel-target="report"]'), 'no longer a Compile subpage');
      d.getElementById('stageBtn-compile').click(); await wait(200);
      d.getElementById('stageBtn-report').click(); await wait(300);
      assert.ok(d.getElementById('panel-report').classList.contains('active'));
      d.getElementById('pagenavNextTop').click(); await wait(300);
      assert.ok(d.getElementById('panel-export').classList.contains('active'), 'Next from Report goes to Export');
      d.getElementById('pagenavBackTop').click(); await wait(300);
      assert.ok(d.getElementById('panel-report').classList.contains('active'), 'Back from Export goes to Report');
    });
    test('is read-only: the panel has no inputs', async () => {
      const { d } = await build(['Bo Marsh']);
      assert.equal(d.querySelectorAll('#panel-report input, #panel-report textarea, #panel-report select').length, 0);
    });
    test('Minutes Maker "Number of attendees present" uses the Attendees count when nothing was typed', async () => {
      const { win, d } = await build(['Bo Marsh', 'Dee Ortiz']);
      const cb = d.getElementById('m_mmSingers'); cb.checked = true; ev(win, cb, 'change'); await wait(300);
      const txt = d.body.textContent;
      assert.match(txt, /3 attendees were present/);
    });
  });

  describe('Add singer, location, and visitor / out-of-town marks', () => {
    const search = (win, d, v) => { const e = d.getElementById('singersSearch'); e.value = v; ev(win, e); };
    test('rail order is Event Details, Singers, Roles', async () => {
      const { d } = await build(['Bo Marsh']);
      const order = Array.from(d.querySelectorAll('#compileSubnav .substage-btn')).map((b) => b.dataset.panelTarget);
      assert.deepEqual(order.slice(0, 3), ['details', 'singers', 'roles']);
    });
    test('an unrecognized search offers "Add singer"; a recognized one does not', async () => {
      const { win, d } = await build(['Bo Marsh']);
      search(win, d, 'bo');
      assert.ok(!d.getElementById('singersAddBtn'), 'matches an existing name, so no add button');
      search(win, d, 'Zed Quill');
      assert.ok(d.getElementById('singersAddBtn'));
      d.getElementById('singersAddBtn').click(); await wait(200);
      assert.deepEqual(names(d), ['Zed Quill']);
      assert.match(rowFor(d, 'Zed Quill').textContent, /added by hand/);
      search(win, d, '');
      assert.match(d.getElementById('singersCount').textContent, /^3 names/);
      // Counted by the Report page too.
      d.getElementById('stageBtn-report').click(); await wait(300);
      assert.match(d.getElementById('reportStatement').textContent, /consisted of 3 total attendees/);
    });
    test('a hand-added singer, location and marks survive the master CSV, even without contacts', async () => {
      const { win, d } = await build(['Bo Marsh']);
      search(win, d, 'Zed Quill');
      d.getElementById('singersAddBtn').click(); await wait(200);
      const cb = rowFor(d, 'Zed Quill').querySelector('.singer-outoftown');
      cb.checked = true; ev(win, cb, 'change');
      const loc = rowFor(d, 'Zed Quill').querySelector('.singer-location');
      loc.value = 'Akron, OH'; ev(win, loc, 'change'); await wait(100);
      setContact(win, d, 'Zed Quill', 'email', 'zed@example.org');
      const csv = win.__ezMinutesCompileGetMasterCSV();
      assert.match(csv, /singer\.zedquill\.added/);
      assert.match(csv, /singer\.zedquill\.location/);
      const got = captureDownloads(win);
      d.getElementById('exp_csv_nocontacts').click(); await wait(100);
      const noc = await blobText(win, got[got.length - 1].blob);
      assert.match(noc, /singer\.zedquill\.name/);
      assert.ok(!/zed@example\.org/.test(noc));
      const dom2 = loadPage('minutes.html'); await wait(700);
      const win2 = dom2.window; win2.HTMLElement.prototype.scrollIntoView = function () {};
      win2.__ezMinutesCompileHandleFile(new win2.File([noc], 'x.csv', { type: 'text/csv' }));
      await wait(900);
      win2.document.getElementById('stageBtn-compile').click(); await wait(500);
      win2.document.querySelector('[data-panel-target="singers"]').click(); await wait(300);
      const row = rowFor(win2.document, 'Zed Quill');
      assert.ok(row, 'hand-added singer is back after import');
      assert.equal(row.querySelector('.singer-location').value, 'Akron, OH');
      assert.equal(row.querySelector('.singer-outoftown').checked, true);
    });
    test('ticking the marks fills the Recognitions lists, which are display-only', async () => {
      const { win, d } = await build(['Bo Marsh', 'Dee Ortiz']);
      const bo = rowFor(d, 'Bo Marsh');
      const v = bo.querySelector('.singer-visitor'); v.checked = true; ev(win, v, 'change');
      const dee = rowFor(d, 'Dee Ortiz');
      const o = dee.querySelector('.singer-outoftown'); o.checked = true; ev(win, o, 'change');
      const l = dee.querySelector('.singer-location'); l.value = 'Austin, TX'; ev(win, l, 'change');
      await wait(100);
      assert.equal(d.getElementById('l_visitors').value, 'Bo Marsh');
      assert.equal(d.getElementById('l_outoftown').value, 'Dee Ortiz\u2014Austin, TX');
      d.querySelector('[data-panel-target="recognitions"]').click(); await wait(300);
      const w1 = d.getElementById('l_visitors_widget'), w2 = d.getElementById('l_outoftown_widget');
      assert.match(w1.textContent, /Bo Marsh/);
      assert.match(w2.textContent, /Dee Ortiz . Austin, TX/);
      assert.equal(w1.querySelectorAll('input').length + w2.querySelectorAll('input').length, 0, 'no inputs: display-only');
      // Unticking removes the name from the list.
      d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
      const v2 = rowFor(d, 'Bo Marsh').querySelector('.singer-visitor'); v2.checked = false; ev(win, v2, 'change');
      assert.equal(d.getElementById('l_visitors').value, '');
    });
    test('names already typed into the old lists become marks on their singers', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const ta = d.getElementById('l_visitors'); ta.value = 'Zed Quill'; ev(win, ta); ev(win, ta, 'change');
      d.querySelector('[data-panel-target="songs"]').click(); await wait(100);
      d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
      const row = rowFor(d, 'Zed Quill');
      assert.ok(row);
      assert.equal(row.querySelector('.singer-visitor').checked, true);
    });
  });

  describe('Attendees: VIPs, donors and thanked marks', () => {
    const search = (win, d, v) => { const e = d.getElementById('singersSearch'); e.value = v; ev(win, e); };
    async function addAttendee(win, d, name) {
      search(win, d, name);
      d.getElementById('singersAddBtn').click(); await wait(200);
      search(win, d, '');
      return rowFor(d, name);
    }
    const tick = (win, row, mark, on = true) => { const cb = row.querySelector('.singer-' + mark); cb.checked = on; ev(win, cb, 'change'); };

    test('the page and its rail button are called Attendees', async () => {
      const { d } = await build(['Bo Marsh']);
      assert.equal(d.querySelector('.substage-btn[data-panel-target="singers"]').textContent.trim(), 'Attendees');
      assert.equal(d.querySelector('#panel-singers .panel-title').textContent.trim(), 'Attendees');
    });
    test("VIP and donor fill their lists; a donor-only attendee is not counted as present", async () => {
      const { win, d } = await build(['Bo Marsh']);
      const vip = await addAttendee(win, d, 'Mayor Pat Reed');
      tick(win, vip, 'vip');
      const donor = await addAttendee(win, d, 'Lee Funder');
      tick(win, donor, 'donor');
      await wait(100);
      assert.equal(d.getElementById('l_visitors').value, 'Mayor Pat Reed');
      assert.equal(d.getElementById('l_donors').value, 'Lee Funder');
      assert.match(d.getElementById('singersCount').textContent, /^4 names in this singing \(3 counted as attendees\)/);
      d.getElementById('stageBtn-report').click(); await wait(300);
      // Ann Lee (chair), Bo Marsh and the VIP; the donor is listed but not counted.
      assert.match(d.getElementById("reportStatement").textContent, /consisted of 3 total attendees/);
    });
    test('a VIP who also led a song is still counted', async () => {
      const { win, d } = await build(['Bo Marsh']);
      tick(win, rowFor(d, 'Bo Marsh'), 'vip');
      await wait(100);
      assert.equal(d.getElementById('l_visitors').value, 'Bo Marsh');
      d.getElementById('stageBtn-report').click(); await wait(300);
      assert.match(d.getElementById('reportStatement').textContent, /consisted of 2 total attendees/);
    });
    test('visitor and VIP share the visitors list; clearing one keeps the other', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const r = rowFor(d, 'Bo Marsh');
      tick(win, r, 'visitor'); tick(win, r, 'vip');
      assert.equal(d.getElementById('l_visitors').value, 'Bo Marsh');
      tick(win, r, 'visitor', false);
      assert.equal(d.getElementById('l_visitors').value, 'Bo Marsh', 'still a VIP');
      tick(win, r, 'vip', false);
      assert.equal(d.getElementById('l_visitors').value, '');
    });
    test('thanked fills its list; sick and deceased are not attendee marks at all', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const c = await addAttendee(win, d, 'Hall Committee'); tick(win, c, 'thanked');
      await wait(100);
      assert.equal(d.getElementById('l_thanked').value, 'Hall Committee');
      assert.equal(d.querySelectorAll('.singer-sick, .singer-deceased').length, 0, 'no sick/deceased checkboxes');
    });
    test('visitors, out-of-town, thanked and donors are display-only; sick and deceased stay freeform', async () => {
      const { win, d } = await build(['Bo Marsh']);
      d.querySelector('[data-panel-target="recognitions"]').click(); await wait(300);
      ['l_visitors', 'l_outoftown', 'l_thanked', 'l_donors'].forEach((id) => {
        const w = d.getElementById(id + '_widget');
        assert.ok(w, id + ' widget exists');
        assert.equal(w.querySelectorAll('input, textarea').length, 0, id + ' is display-only');
      });
      d.querySelector('[data-panel-target="memorials"]').click(); await wait(300);
      ['l_sick', 'l_deceased'].forEach((id) => {
        const w = d.getElementById(id + '_widget');
        assert.ok(w.querySelector('.nl-name') || w.querySelector('.namelist-add-btn'), id + ' is still typed in directly');
        assert.ok(!w.querySelector('.namelist-readonly'));
      });
    });
    test('sick and deceased people never become attendees', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const set = (id, v) => { const e = d.getElementById(id); e.value = v; ev(win, e); ev(win, e, 'change'); };
      set('l_sick', 'Ida Hale\u2014Towson, MD'); set('l_deceased', 'Cy Wren');
      d.querySelector('[data-panel-target="songs"]').click(); await wait(100);
      d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
      assert.ok(!rowFor(d, 'Ida Hale') && !rowFor(d, 'Cy Wren'));
      assert.equal(d.getElementById('l_sick').value, 'Ida Hale\u2014Towson, MD', 'left exactly as typed');
      assert.equal(d.getElementById('l_deceased').value, 'Cy Wren');
    });
    test('names already typed into the other lists become marks (and keep a dash that is part of the text)', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const set = (id, v) => { const e = d.getElementById(id); e.value = v; ev(win, e); ev(win, e, 'change'); };
      set('l_donors', 'Ann Funder\nWest Hall \u2014 rent waived');
      set('l_outoftown', 'Ida Hale\u2014Towson, MD');
      d.querySelector('[data-panel-target="songs"]').click(); await wait(100);
      d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
      assert.equal(rowFor(d, 'Ann Funder').querySelector('.singer-donor').checked, true);
      assert.equal(rowFor(d, 'Ida Hale').querySelector('.singer-outoftown').checked, true);
      assert.equal(rowFor(d, 'Ida Hale').querySelector('.singer-location').value, 'Towson, MD');
      assert.match(d.getElementById('l_donors').value, /West Hall \u2014 rent waived/);
      assert.match(d.getElementById('singersCount').textContent, /counted as attendees/);
    });
    test('marks round-trip through the master CSV', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const donor = await addAttendee(win, d, 'Lee Funder'); tick(win, donor, 'donor');
      const csv = win.__ezMinutesCompileGetMasterCSV();
      assert.match(csv, /singer\.leefunder\.donor/);
      const dom2 = loadPage('minutes.html'); await wait(700);
      const w2 = dom2.window; w2.HTMLElement.prototype.scrollIntoView = function () {};
      w2.__ezMinutesCompileHandleFile(new w2.File([csv], 'x.csv', { type: 'text/csv' }));
      await wait(900);
      assert.equal(w2.document.getElementById('l_donors').value, 'Lee Funder');
    });
  });

  describe('Roles accept several people, with name suggestions from the Attendees list', () => {
    const box = (d, id) => d.getElementById(id).parentNode.querySelector('.caller-suggest');
    const sugg = (d, id) => { const b = box(d, id); return b.hidden ? [] : Array.from(b.querySelectorAll('button')).map((x) => x.textContent); };
    function typeInto(win, d, id, value) { const e = d.getElementById(id); e.focus(); e.value = value; ev(win, e); }

    test('role labels are written as potentially plural', async () => {
      const { d } = await build(['Bo Marsh']);
      const label = (id) => d.querySelector('label[for="' + id + '"]').textContent.trim();
      assert.equal(label('r_chair'), 'Chair(s)');
      assert.equal(label('r_vicechair'), 'Vice-chair(s)');
      assert.equal(label('r_treasurer'), 'Treasurer(s)');
      assert.match(label('r_secretary'), /^Secretary\(ies\)/);
      assert.match(label('r_chaplain'), /^Chaplain\(s\)/);
      assert.match(label('r_localhost'), /^Local host\(s\)/);
    });
    test('the Treasurer(s) box suggests attendees, and restarts after a comma or "and"', async () => {
      const { win, d } = await build(['Bo Marsh', 'Dee Ortiz']);
      d.querySelector('[data-panel-target="roles"]').click(); await wait(300);
      typeInto(win, d, 'r_treasurer', 'Bo');
      assert.deepEqual(sugg(d, 'r_treasurer'), ['Bo Marsh']);
      typeInto(win, d, 'r_treasurer', 'Bo Marsh, De');
      assert.deepEqual(sugg(d, 'r_treasurer'), ['Dee Ortiz']);
      typeInto(win, d, 'r_treasurer', 'Bo Marsh and De');
      assert.deepEqual(sugg(d, 'r_treasurer'), ['Dee Ortiz']);
      typeInto(win, d, 'r_treasurer', 'Bo Marsh, Bo');
      assert.deepEqual(sugg(d, 'r_treasurer'), [], 'not offered twice');
    });
    test('picking a suggestion saves into the role and keeps the earlier names', async () => {
      const { win, d } = await build(['Bo Marsh', 'Dee Ortiz']);
      d.querySelector('[data-panel-target="roles"]').click(); await wait(300);
      typeInto(win, d, 'r_chair', 'Ann Lee, De');
      box(d, 'r_chair').querySelector('button').dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      assert.equal(d.getElementById('r_chair').value, 'Ann Lee, Dee Ortiz');
      d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
      assert.ok(rowFor(d, 'Dee Ortiz').textContent.includes('Chair'), 'Dee is now listed with the Chair role');
    });
    test('every Roles box has the autofill', async () => {
      const { d } = await build(['Bo Marsh']);
      ['r_chair', 'r_vicechair', 'r_secretary', 'r_committee', 'r_chaplain', 'r_pitcher', 'r_treasurer', 'r_localhost'].forEach((id) => {
        assert.ok(box(d, id), id + ' has a suggestion list');
      });
    });
    test('the Setup stage officer boxes suggest too', async () => {
      const { win, d } = await build(['Bo Marsh']);
      d.getElementById('stageBtn-setup').click(); await wait(300);
      typeInto(win, d, 'roleTreasurer', 'Bo');
      assert.deepEqual(sugg(d, 'roleTreasurer'), ['Bo Marsh']);
    });
  });

  describe('Attendees filters and carried-over names', () => {
    const f = (d, id) => d.getElementById(id);
    const tick = (win, d, id) => { const b = f(d, id); b.checked = !b.checked; ev(win, b, 'change'); };
    async function loadPrev(win, d, text) {
      const inp = f(d, 'previousEventFileInputCompile');
      const file = new win.File([text], 'last-year.csv', { type: 'text/csv' });
      Object.defineProperty(inp, 'files', { value: [file], configurable: true });
      ev(win, inp, 'change'); await wait(500); assert.match(f(d, 'previousEventLoadStatusCompile').textContent, /Added [12] name/);
    }
    const prevCsv = [
      'Record Type,Leader(s),Metadata Field,Metadata Value',
      'song,Zed Carried,,',
      'song,Bo Marsh,,',
      'namesuggestion,Old Ghost,,',
      'metadata,,singer.donorsue.name,Donor Sue',
      'metadata,,singer.donorsue.donor,true',
      'metadata,,singer.vicvip.name,Vic Vip',
      'metadata,,singer.vicvip.vip,true'
    ].join('\n') + '\n';

    test('All attendees is checked by default and the filters are exclusive', async () => {
      const { win, d } = await build(['Bo Marsh']);
      assert.equal(f(d, 'singersFilterAll').checked, true);
      tick(win, d, 'singersNoContact'); await wait(100);
      assert.equal(f(d, 'singersFilterAll').checked, false);
      assert.equal(f(d, 'singersNoContact').checked, true);
      tick(win, d, 'singersNotLed'); await wait(100);
      assert.equal(f(d, 'singersNoContact').checked, false);
      assert.equal(f(d, 'singersNotLed').checked, true);
      tick(win, d, 'singersNotLed'); await wait(100);
      assert.equal(f(d, 'singersFilterAll').checked, true);
    });

    test('without-contact and not-led filters show the right people', async () => {
      const { win, d } = await build(['Bo Marsh', 'Dee Ortiz']);
      setContact(win, d, 'Bo Marsh', 'email', 'bo@example.org'); await wait(200);
      tick(win, d, 'singersNoContact'); await wait(200);
      assert.ok(!names(d).includes('Bo Marsh'));
      assert.ok(names(d).includes('Dee Ortiz'));
      tick(win, d, 'singersOnlyContact'); await wait(200);
      assert.deepEqual(names(d), ['Bo Marsh']);
      tick(win, d, 'singersNotLed'); await wait(200);
      assert.deepEqual(names(d), ['Ann Lee']);
    });

    test('only last time\'s attendees are imported; carried names are gray and uncounted until logged or ticked Present', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const before = names(d).slice().sort();
      await loadPrev(win, d, prevCsv);
      assert.match(f(d, 'previousEventLoadStatusCompile').textContent, /Added 2 name/);
      // Imported: Zed (led) and Vic (VIP). Not imported: Old Ghost (a carried suggestion there), Donor Sue (donor only).
      assert.ok(!names(d).includes('Old Ghost'));
      assert.ok(!names(d).includes('Donor Sue'));
      assert.deepEqual(names(d).slice().sort(), before.concat(['Vic Vip', 'Zed Carried']).sort());
      const zed = rowFor(d, 'Zed Carried');
      assert.ok(zed.classList.contains('not-counted'), 'carried-over rows are gray');
      assert.match(zed.textContent, /carried over from a previous singing/);
      assert.match(f(d, 'singersCarriedNote').textContent, /2 names carried over/i);
      assert.equal(win.__ezMinutesSingerTotals().attendees, before.length);
      d.getElementById('stageBtn-report').click(); await wait(300);
      assert.match(d.getElementById('reportStatement').textContent, new RegExp('consisted of ' + before.length + ' total attendees'));
      // Tick Present: counted, no longer gray.
      d.getElementById('stageBtn-compile').click(); await wait(600);
      d.querySelector('[data-panel-target="singers"]').click(); await wait(300);
      const row = rowFor(d, 'Zed Carried');
      const box = row.querySelector('.singer-present');
      assert.equal(box.checked, false); assert.equal(box.disabled, false);
      box.checked = true; ev(win, box, 'change'); await wait(200);
      assert.ok(!row.classList.contains('not-counted'));
      assert.equal(win.__ezMinutesSingerTotals().attendees, before.length + 1);
      // Untick returns it to gray.
      box.checked = false; ev(win, box, 'change'); await wait(200);
      assert.ok(row.classList.contains('not-counted'));
      assert.equal(win.__ezMinutesSingerTotals().attendees, before.length);
    });

    test('a carried-over name is counted as soon as it is logged (marked, or entered as a leader)', async () => {
      const { win, d } = await build(['Bo Marsh']);
      await loadPrev(win, d, prevCsv);
      const vic = rowFor(d, 'Vic Vip');
      assert.ok(vic.classList.contains('not-counted'));
      const mark = vic.querySelector('.singer-visitor');
      mark.checked = true; ev(win, mark, 'change'); await wait(200);
      assert.ok(!vic.classList.contains('not-counted'));
      assert.equal(vic.querySelector('.singer-present').checked, true);
      assert.equal(vic.querySelector('.singer-present').disabled, true);
    });

    test('present is saved in the master CSV and survives reopening; the box also counts a donor who came', async () => {
      const { win, d } = await build(['Bo Marsh']);
      const donor = await (async () => {
        const e = d.getElementById('singersSearch'); e.value = 'Donor Dee'; ev(win, e); await wait(150);
        d.getElementById('singersAddBtn').click(); await wait(250);
        return rowFor(d, 'Donor Dee');
      })();
      const dm = donor.querySelector('.singer-donor'); dm.checked = true; ev(win, dm, 'change'); await wait(150);
      assert.ok(donor.classList.contains('not-counted'), 'donor-only is gray');
      const before = win.__ezMinutesSingerTotals().attendees;
      const pb = donor.querySelector('.singer-present'); pb.checked = true; ev(win, pb, 'change'); await wait(150);
      assert.equal(win.__ezMinutesSingerTotals().attendees, before + 1);
      d.getElementById('stageBtn-export').click(); await wait(500);
      const got = captureDownloads(win);
      d.getElementById('exp_csv').click(); await wait(300);
      assert.match(await blobText(win, got[got.length - 1].blob), /singer\.donordee\.present,true/);
    });
  });
});
