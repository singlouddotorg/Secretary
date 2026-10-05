// Export > Minutes Maker: choose which roles close the minutes. "All roles" and the single
// roles exclude each other (ticking a single role unticks All; ticking All clears the singles).
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');

after(() => { closeAllWindows(); });
const ev = (win, el, t = 'input') => el.dispatchEvent(new win.Event(t, { bubbles: true }));

async function open() {
  const dom = loadPage('minutes.html');
  await wait(700);
  const win = dom.window, d = win.document;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  const set = (id, v) => { const e = d.getElementById(id); e.value = v; ev(win, e); ev(win, e, 'change'); };
  d.getElementById('setupNewSingingBtn').click(); await wait(200);
  set('event', 'Roster Test'); set('date', '2026-10-04'); await wait(200);
  d.getElementById('stageBtn-compile').click(); await wait(400);
  d.querySelector('[data-panel-target="roles"]').click(); await wait(200);
  set('r_chair', 'Ann Lee'); set('r_vicechair', 'Bo Marsh'); set('r_secretary', 'Cy Nolan');
  set('r_treasurer', 'Dee Ortiz'); set('r_committee', 'Eli Park, Fay Quinn'); set('r_chaplain', 'Gus Reed');
  set('r_pitcher', 'Hal Stone'); set('r_localhost', 'Ida Tate');
  d.getElementById('stageBtn-export').click(); await wait(400);
  return { win, d, set };
}
const cb = (d, role) => d.querySelector('#mmRolesBox .mm-role-cb[data-role="' + role + '"]');
const click = (win, el) => { el.checked = !el.checked; ev(win, el, 'change'); };
const preview = (d) => d.getElementById('previewText').textContent;

describe('Minutes Maker closing roster roles', () => {
  test('default is unchanged: Chair, Vice-chair and Secretary only', async () => {
    const { d } = await open();
    assert.equal(d.getElementById('m_mmRoleAll').checked, false);
    ['chair', 'vicechair', 'secretary'].forEach((r) => assert.equal(cb(d, r).checked, true, r));
    ['treasurer', 'committee', 'chaplain', 'pitcher', 'localhost'].forEach((r) => assert.equal(cb(d, r).checked, false, r));
    const p = preview(d);
    assert.match(p, /Chair—Ann Lee; Vice-chair—Bo Marsh; Secretary—Cy Nolan/);
    assert.ok(!/Treasurer—/.test(p));
  });

  test('ticking an individual role adds just that role to the roster', async () => {
    const { win, d } = await open();
    click(win, cb(d, 'treasurer'));
    assert.match(preview(d), /Secretary—Cy Nolan; Treasurer—Dee Ortiz/);
    click(win, cb(d, 'chair'));
    assert.ok(!/Chair—Ann Lee/.test(preview(d)), 'unticked role is gone');
  });

  test('"All roles" includes every role on the Roles page, in order', async () => {
    const { win, d } = await open();
    click(win, d.getElementById('m_mmRoleAll'));
    assert.equal(d.getElementById('m_mmRoleAll').checked, true);
    ['chair', 'vicechair', 'secretary', 'treasurer', 'committee', 'chaplain', 'pitcher', 'localhost'].forEach((r) => assert.equal(cb(d, r).checked, false, 'singles cleared: ' + r));
    assert.match(preview(d), /Chair—Ann Lee; Vice-chair—Bo Marsh; Secretary—Cy Nolan; Treasurer—Dee Ortiz; Arranging committee—Eli Park, Fay Quinn; Chaplain—Gus Reed; Keyers—Hal Stone; Local host—Ida Tate/);
  });

  test('with "All roles" ticked, ticking any single role unticks All', async () => {
    const { win, d } = await open();
    click(win, d.getElementById('m_mmRoleAll'));
    click(win, cb(d, 'chaplain'));
    assert.equal(d.getElementById('m_mmRoleAll').checked, false);
    assert.equal(cb(d, 'chaplain').checked, true);
    const p = preview(d);
    assert.match(p, /Chaplain—Gus Reed/);
    assert.ok(!/Chair—Ann Lee/.test(p), 'only the one ticked role');
  });

  test('roles with nobody entered are skipped, and an empty selection prints no roster', async () => {
    const { win, d, set } = await open();
    d.querySelector('[data-panel-target="roles"]').click(); await wait(200);
    set('r_treasurer', '');
    d.getElementById('stageBtn-export').click(); await wait(300);
    click(win, d.getElementById('m_mmRoleAll'));
    assert.ok(!/Treasurer—/.test(preview(d)));
    click(win, d.getElementById('m_mmRoleAll')); // untick All with no singles ticked
    assert.ok(!/Chair—Ann Lee/.test(preview(d)));
  });

  test('the choice round-trips through the master CSV, and the default writes nothing', async () => {
    const { win, d } = await open();
    assert.ok(!/meta\.mmRole/.test(win.__ezMinutesCompileGetMasterCSV()), 'default adds no rows');
    click(win, cb(d, 'treasurer'));
    const csv = win.__ezMinutesCompileGetMasterCSV();
    assert.match(csv, /meta\.mmRoles/);
    const dom2 = loadPage('minutes.html'); await wait(700);
    const w2 = dom2.window; w2.HTMLElement.prototype.scrollIntoView = function () {};
    w2.__ezMinutesCompileHandleFile(new w2.File([csv], 'x.csv', { type: 'text/csv' }));
    await wait(900);
    w2.document.getElementById('stageBtn-export').click(); await wait(400);
    assert.equal(w2.document.querySelector('#mmRolesBox .mm-role-cb[data-role="treasurer"]').checked, true);
    // All roles round-trips too.
    click(win, d.getElementById('m_mmRoleAll'));
    const csv3 = win.__ezMinutesCompileGetMasterCSV();
    assert.match(csv3, /meta\.mmRoleAll/);
  });
});
