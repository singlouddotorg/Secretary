// The version a user can see must be the version they are running.
//
// The v156 review found instructions.html displaying 1.0.0-beta.96 against a beta.102
// runtime - six revisions stale, in exactly the place someone looks when writing a bug
// report or reading a screenshot. The number now lives in one place (shared-utils.js) and
// every page reads it, but a no-build project has nothing that would catch it drifting
// back apart. This is that something.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SUITE_DIR = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(SUITE_DIR, ...p), 'utf8');

// The app is minutes.html in the shared working tree and index.html in its own repository
// (three apps cannot all be called index.html in one folder; one app in its own repo should
// be). This test reads the app's source directly rather than through loadPage(), so it needs
// the same resolution - otherwise it fails on a missing filename rather than on anything
// actually being wrong, which is exactly the kind of false alarm that teaches people to
// ignore a suite.
const APP_FILE = fs.existsSync(path.join(SUITE_DIR, 'minutes.html')) ? 'minutes.html' : 'index.html';

// Each app in the Sing Loud Suite versions itself. This file enforces that for Secretary -
// the app and the page describing it must agree - and that no stale literal is hiding
// anywhere else in it. Bibliographer and Simple Minutes declare their own, in their own repos.
const MINUTES_VERSION = require(path.join(SUITE_DIR, 'minutes-version.js')).VERSION;

test('version provenance', async (t) => {
  await t.test('minutes-version.js exports a real, well-formed version', () => {
    assert.ok(MINUTES_VERSION, 'minutes-version.js must export VERSION');
    assert.match(MINUTES_VERSION, /^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/,
      'VERSION should look like a version: ' + MINUTES_VERSION);
  });

  await t.test('shared-utils.js carries its own version, not an application\'s', () => {
    // Bibliographer vendors this same file. If it held Secretary's number, Bibliographer would ship
    // Secretary's version inside it - the drift this suite keeps having, in a new costume.
    const shared = require(path.join(SUITE_DIR, 'shared-utils.js'));
    assert.ok(shared.SHARED_UTILS_VERSION, 'shared-utils.js should report its own version');
    assert.equal(shared.SUITE_VERSION, undefined,
      'shared-utils.js must no longer carry a suite-wide version; each app versions itself');
  });

  await t.test('the app reads its version constant rather than carrying its own literal', () => {
    const minutes = read(APP_FILE);
    assert.match(minutes, /var SUITE_VERSION = EZMinutesVersion\.VERSION;/,
      APP_FILE + ' should derive its version from minutes-version.js');
    assert.match(minutes, /<script src="minutes-version\.js"><\/script>/,
      APP_FILE + ' must actually load minutes-version.js');
    // A second, hard-coded "1.0.0-beta.NN" anywhere in the app is how the drift started.
    // The changelog comment legitimately mentions older versions, so only look at real code.
    const codeOnly = minutes.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const strayLiterals = codeOnly.match(/["']\d+\.\d+\.\d+-beta\.\d+["']/g) || [];
    assert.deepEqual(strayLiterals, [],
      APP_FILE + ' should hold no hard-coded version literal in code: ' + strayLiterals.join(', '));
  });

  await t.test('the Instructions fallback text matches the shared version', () => {
    // instructions.html rewrites these at runtime from shared-utils.js, but keeps literal
    // text so the page still shows a real version when opened alone or with scripting off.
    // That fallback is only honest if it is kept current, which is what this checks.
    const instructions = read('instructions.html');
    const shown = instructions.match(/Secretary · Version ([^ ]+) · Schema 5/g) || [];
    assert.ok(shown.length >= 2, 'expected the version to appear in the body and the footer');
    shown.forEach((line) => {
      assert.ok(line.includes(MINUTES_VERSION),
        'stale version text in instructions.html: "' + line + '" (minutes-version.js says ' + MINUTES_VERSION + ')');
    });
  });

  await t.test('Instructions actually loads the shared file it reads the version from', () => {
    const instructions = read('instructions.html');
    assert.match(instructions, /<script src="minutes-version\.js"><\/script>/,
      'instructions.html must load minutes-version.js for the runtime version to resolve');
    assert.match(instructions, /EZMinutesVersion\.VERSION/,
      'instructions.html must read the app version constant');
  });

  await t.test('the working tree\'s simple-minutes/tunebook-library.js mirrors the canonical copy', () => {
    // Simple Minutes lives at simple-minutes/simple-minutes.html in the shared working
    // tree - unlike Secretary and Bibliographer, which sit at the tree root beside
    // tunebook-library.js already. Its own bundled copy (added by the 2026-09-06c revised
    // review's offline-fallback fix) has to sit in that same subfolder for a relative
    // <script src="tunebook-library.js"> to resolve there at all, which means the working
    // tree necessarily holds two copies of one file. build-suite.sh always regenerates
    // the shipped copy from the root file, so drift can never reach a real delivery - but
    // it could still sit unnoticed in the working tree itself, silently making local
    // testing of the app exercise stale data. This is the same principle as the
    // build-suite.sh verification step, checked here too since that script only runs at
    // assembly time, not on every edit to either file.
    const mirrorPath = path.join(SUITE_DIR, 'simple-minutes', 'tunebook-library.js');
    if (!fs.existsSync(mirrorPath)) return; // nothing to compare inside a generated single-app repo
    const canonical = fs.readFileSync(path.join(SUITE_DIR, 'tunebook-library.js'));
    const mirror = fs.readFileSync(mirrorPath);
    assert.ok(canonical.equals(mirror),
      'simple-minutes/tunebook-library.js has drifted from the canonical tunebook-library.js at the tree root - copy the root file over it');
  });

  await t.test('minutes-version.js actually sits beside Instructions', () => {
    // Instructions reads its version from shared-utils.js at runtime. If that file were not
    // shipped next to it, every reader would silently fall back to the literal text - which
    // is the drift this whole test file exists to prevent, arriving by another route.
    //
    // This used to assert it by reading build-release.sh's file list. That worked while
    // everything lived in one tree, but build-release.sh is a working-tree tool and is not
    // part of what it produces - so in the generated minutes repo the assertion failed on a
    // missing file rather than on anything being wrong. Asking the filesystem is both
    // simpler and truer: it checks the thing itself rather than a script's intention to do
    // it, and it is correct in the working tree and in a published repo alike.
    assert.ok(fs.existsSync(path.join(SUITE_DIR, 'instructions.html')),
      'instructions.html should be here');
    assert.ok(fs.existsSync(path.join(SUITE_DIR, 'minutes-version.js')),
      'minutes-version.js must sit beside instructions.html, or the runtime version lookup silently falls back');
  });
});
