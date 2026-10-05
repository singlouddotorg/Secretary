// Leader(s) autofill must keep working after a separator. Raised by the Secretaries at the
// Maryland All-Day Singing: when more than one person leads, typing a comma, "and", or "&"
// should restart suggestions for the next name, instead of the native <datalist> going quiet
// (it only ever matched the whole field's text).
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');

after(() => { closeAllWindows(); });

async function openCapture() {
  const dom = loadPage('minutes.html');
  await wait(700);
  const win = dom.window;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  const doc = win.document;
  doc.getElementById('setupNewSingingBtn').click();
  await wait(200);
  doc.getElementById('event').value = 'Autofill Test';
  doc.getElementById('event').dispatchEvent(new win.Event('input', { bubbles: true }));
  doc.getElementById('date').value = '2026-10-04';
  doc.getElementById('date').dispatchEvent(new win.Event('input', { bubbles: true }));
  // Officers feed the name pool, same as in real use.
  doc.getElementById('roleChair') && (doc.getElementById('roleChair').value = 'Ann Lee, Bo Marsh and Cy Nolan');
  doc.getElementById('roleChair') && doc.getElementById('roleChair').dispatchEvent(new win.Event('input', { bubbles: true }));
  await wait(200);
  doc.getElementById('stageBtn-minutes').click();
  await wait(500);
  return { win, doc };
}

function type(win, el, value) {
  el.focus();
  el.value = value;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}
function suggestions(doc) {
  const box = doc.getElementById('callerSuggest');
  return box.hidden ? [] : Array.from(box.querySelectorAll('button')).map((b) => b.textContent);
}

describe('Leader(s) autofill after a separator', () => {
  test('first name still suggests, as before', async () => {
    const { win, doc } = await openCapture();
    type(win, doc.getElementById('caller'), 'Ann');
    assert.deepEqual(suggestions(doc), ['Ann Lee']);
  });

  for (const [label, typed, expectSuggest] of [
    ['comma', 'Ann Lee, Bo', 'Bo Marsh'],
    ['comma, no space', 'Ann Lee,Bo', 'Bo Marsh'],
    ['the word "and"', 'Ann Lee and Bo', 'Bo Marsh'],
    ['ampersand', 'Ann Lee & Bo', 'Bo Marsh'],
    ['a third name', 'Ann Lee, Bo Marsh and Cy', 'Cy Nolan'],
  ]) {
    test('suggestions restart after ' + label, async () => {
      const { win, doc } = await openCapture();
      type(win, doc.getElementById('caller'), typed);
      assert.deepEqual(suggestions(doc), [expectSuggest]);
    });
  }

  test('picking a suggestion replaces only the partial name and keeps what came before', async () => {
    const { win, doc } = await openCapture();
    const caller = doc.getElementById('caller');
    type(win, caller, 'Ann Lee, Bo');
    doc.getElementById('callerSuggest').querySelector('button')
      .dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    assert.equal(caller.value, 'Ann Lee, Bo Marsh');
    assert.deepEqual(suggestions(doc), [], 'list closes after a pick');
  });

  test('a name already in the field is not offered again', async () => {
    const { win, doc } = await openCapture();
    type(win, doc.getElementById('caller'), 'Ann Lee, Ann');
    assert.deepEqual(suggestions(doc), []);
  });

  test('nothing is offered straight after a separator, before any letter is typed', async () => {
    const { win, doc } = await openCapture();
    type(win, doc.getElementById('caller'), 'Ann Lee, ');
    assert.deepEqual(suggestions(doc), []);
  });

  test('Enter with no suggestion highlighted still submits the entry', async () => {
    const { win, doc } = await openCapture();
    const cb = doc.querySelector('#bookCheckRow input[type=checkbox]');
    cb.checked = true;
    cb.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(200);
    type(win, doc.getElementById('caller'), 'Ann Lee, Bo');
    doc.getElementById('page').value = '21';
    doc.getElementById('caller').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(300);
    assert.equal(doc.getElementById('caller').value, '', 'entry was added and the field cleared');
    assert.match(win.eval('window.__ezMinutesCaptureGetCSV()'), /Ann Lee, Bo/);
  });

  test('a multi-leader entry feeds each leader into the pool as a separate name', async () => {
    const { win, doc } = await openCapture();
    const cb = doc.querySelector('#bookCheckRow input[type=checkbox]');
    cb.checked = true;
    cb.dispatchEvent(new win.Event('change', { bubbles: true }));
    await wait(200);
    type(win, doc.getElementById('caller'), 'Dee Ortiz and Eli Park');
    doc.getElementById('page').value = '21';
    doc.getElementById('addBtn').click();
    await wait(300);
    type(win, doc.getElementById('caller'), 'Eli');
    assert.deepEqual(suggestions(doc), ['Eli Park']);
  });
});
