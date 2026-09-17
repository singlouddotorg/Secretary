// Regression sweep: every bundled sample Singing Record still imports and compiles
// cleanly, no page errors, no horizontal overflow at the usual widths.
const L = require('./lib');
const fs = require('fs');
const path = require('path');

const P = require('./paths');
const SAMPLES = P.samples();

(async () => {
  const { browser, page } = await L.launch();
  const files = fs.readdirSync(SAMPLES).filter(f => f.endsWith('.csv')).sort();
  L.check('15 bundled samples present', files.length === 15, files.length + ' files');

  let bad = [];
  for (const f of files){
    const text = fs.readFileSync(path.join(SAMPLES, f), 'utf8');
    await page.evaluate(() => localStorage.clear()).catch(()=>{});
    await L.open(page);
    const before = page._errors.length;
    await page.click('#stageBtn-setup');
    await page.waitForTimeout(400);
    await page.evaluate((t) => {
      const file = new File([t], 'sample.csv', { type: 'text/csv' });
      const i = document.getElementById('importFileInput');
      Object.defineProperty(i, 'files', { value: [file], configurable: true });
      i.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);
    await page.waitForTimeout(1600);
    await page.click('#stageBtn-export');
    await page.waitForTimeout(1600);
    const info = await page.evaluate(() => {
      const el = document.getElementById('previewText');
      return { len: el ? el.textContent.trim().length : 0 };
    });
    const newErrors = page._errors.slice(before);
    if (info.len < 100 || newErrors.length) bad.push(f + ' (preview ' + info.len + ' chars' + (newErrors.length ? ', ' + newErrors.length + ' errors: ' + newErrors[0] : '') + ')');
  }
  L.check('every sample imports and compiles to real narrative with no errors', bad.length === 0, bad.join('\n'));

  // ---- responsive layout ----
  // Bibliographer is checked here only when it is actually present. In the single working tree
  // it is; in the Secretary repo it is not, and its layout is that repo's business - the
  // bibliographer repo runs the same check on itself. A missing app is skipped rather than
  // failed, which is the difference between "not my concern here" and "broken".
  const apps = [P.minutesApp(), P.tunebooksApp()].filter(Boolean);
  L.check('at least the app this repo owns is present to check', apps.length >= 1, apps.length + ' app(s)');
  for (const appPath of apps){
    const app = require('path').basename(appPath);
    for (const w of [390, 768, 1024, 1280, 1440]){
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('file://' + appPath);
      await page.waitForTimeout(1200);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      L.check(app + ' @ ' + w + 'px: no horizontal overflow', overflow <= 0, 'overflow ' + overflow + 'px');
    }
  }

  await browser.close();
  process.exit(L.summary());
})();
