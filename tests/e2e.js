/* Real-browser click-through. Usage: node tests/e2e.js [baseUrl] [--shots dir] */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('fs');
const base = (process.argv[2] || 'http://localhost:8080/').replace(/\/?$/, '/');
const shotsIdx = process.argv.indexOf('--shots');
const shots = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
let n = 0;
const ok = (m) => console.log('  ok ' + (++n) + ' ' + m);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const shot = async (name, full) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: !!full }); };

  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // language: starts English (locale en-US), toggle to Arabic and RTL
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr'); ok('English LTR by default');
  await page.click('#langBtn');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl'); ok('Arabic switches to RTL');
  assert.match(await page.textContent('h1'), /ادخل/); ok('Arabic hero text');
  await page.click('#langBtn');
  await shot('01-home');

  // checklist persists
  await page.check('input[data-k=ck1]');
  await page.reload();
  assert.ok(await page.isChecked('input[data-k=ck1]')); ok('checklist persists after reload');

  // bank
  await page.click('.tabs a[href="#/bank"]');
  await page.waitForSelector('.cue');
  assert.equal(await page.locator('.cue').count(), 67); ok('67 questions listed');
  await page.fill('#bq', 'weakness');
  assert.equal(await page.locator('.cue').count(), 1); ok('search narrows to 1');
  await page.fill('#bq', 'zzzzqq');
  assert.ok(await page.isVisible('.empty')); ok('empty state');
  await page.fill('#bq', '');
  await page.click('[data-act=cat][data-c=ask]');
  const askN = await page.locator('.cue').count(); assert.ok(askN > 3 && askN < 10); ok('category filter ' + askN);
  await page.click('[data-act=cat][data-c=all]');
  await page.locator('[data-act=mark]').first().click();
  await page.click('[data-act=flt][data-f=saved]');
  assert.equal(await page.locator('.cue').count(), 1); ok('save + saved filter');
  await page.locator('[data-act=notes]').first().click();
  await page.fill('textarea[data-note]', 'My note about intro');
  await page.click('[data-act=flt][data-f=all]');
  await page.reload(); await page.click('.tabs a[href="#/bank"]'); await page.waitForSelector('.cue');
  await page.locator('[data-act=notes]').first().click();
  assert.equal(await page.inputValue('textarea[data-note]'), 'My note about intro'); ok('note persists');
  await page.locator('[data-act=done]').first().click();
  assert.match(await page.locator('.cue').first().textContent(), /×1/); ok('practiced counter');
  await page.fill('#aqt', 'Why is a manhole round?');
  await page.click('#addq button[type=submit]');
  await page.fill('#bq', 'manhole');
  assert.equal(await page.locator('.cue').count(), 1); ok('custom question added');
  await page.click('[data-act=delq]');
  assert.equal(await page.locator('.cue').count(), 0); ok('custom question deleted');
  await page.fill('#bq', '');
  await shot('02-bank');

  // STAR
  await page.click('.tabs a[href="#/star"]'); await page.waitForSelector('[data-act=newstory]');
  await page.click('[data-act=newstory]');
  await page.fill('#stt', 'Group project rescue');
  await page.fill('#f_s', 'In my final year our group project was two weeks late and one member left');
  await page.fill('#f_t', 'I had to reorganize the work and deliver');
  assert.ok((await page.textContent('#warns')).length > 0);
  await page.fill('#f_a', 'I split the remaining work by strength, set daily check-ins, wrote the backend myself and reviewed every pull request before merging');
  await page.fill('#f_r', 'We delivered on time and scored 92 percent, the best in the class');
  assert.equal((await page.textContent('#pct')).trim(), '100%'); ok('STAR reaches 100%');
  assert.match(await page.textContent('#warns'), /balanced/); ok('STAR balanced message');
  assert.match(await page.textContent('#prev'), /92 percent/); ok('STAR preview');
  await page.click('[data-act=copy]');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clip, /Group project rescue/); ok('copy puts story on clipboard');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=dl]')]);
  assert.match(dl.suggestedFilename(), /\.txt$/); ok('download .txt');
  await shot('03-star', true);
  await page.reload();
  assert.equal(await page.inputValue('#stt'), 'Group project rescue'); ok('story persists');
  // from bank to STAR
  await page.click('.tabs a[href="#/bank"]'); await page.waitForSelector('.cue');
  await page.locator('[data-act=tostar]').nth(13).click();
  await page.waitForSelector('.story'); assert.equal(await page.locator('.story').count(), 2); ok('Build STAR from a question creates a story');

  // mock
  await page.click('.tabs a[href="#/mock"]'); await page.waitForSelector('[data-act=mstart]');
  await page.click('[data-act=mcat][data-c=ask]');
  await page.click('[data-act=set][data-k=count][data-v="3"]');
  await page.click('[data-act=set][data-k=prep][data-v="0"]');
  await page.click('[data-act=set][data-k=secs][data-v="60"]');
  await page.click('[data-act=mstart]');
  assert.match(await page.textContent('#tm'), /01:0\d|01:00|00:59/); ok('timer runs from 01:00');
  await page.waitForTimeout(1300);
  const left = await page.textContent('#tm'); assert.match(left, /00:5\d/); ok('timer counts down ' + left);
  await page.click('[data-act=pause]');
  const p1 = await page.textContent('#tm'); await page.waitForTimeout(1300);
  assert.equal(await page.textContent('#tm'), p1); ok('pause freezes timer');
  await page.click('[data-act=pause]');
  await page.fill('#live', 'um I basically would ask about the team');
  await shot('04-mock-run');
  await page.click('[data-act=doneans]');
  assert.ok(await page.isDisabled('[data-act=next]')); ok('next disabled until rated');
  assert.match(await page.textContent('.stage'), /2 filler/); ok('filler words counted in notes');
  await page.click('[data-act=rate][data-v="4"]');
  for (const k of ['star', 'num', 'short']) await page.check(`input[data-k=${k}]`);
  await shot('05-mock-rate');
  await page.click('[data-act=next]');
  await page.click('[data-act=skipq]');
  await page.click('[data-act=doneans]');
  await page.click('[data-act=rate][data-v="5"]');
  for (const k of ['star', 'num', 'short', 'conf']) await page.check(`input[data-k=${k}]`);
  await page.click('[data-act=next]');
  const res = await page.textContent('.stage');
  assert.match(res, /Session results/); assert.match(res, /2 answered · 1 skipped/); ok('results show 2 answered 1 skipped');
  // score: q1 rating4,checks3 => 48+30=78 ; q3 100 ; avg 89
  assert.match(res, /89/); ok('score is 89');
  await shot('06-results');
  const st = await page.evaluate(() => window.__mq.state());
  assert.equal(st.sessions.length, 1); assert.equal(st.days.length, 1); ok('session + day saved');

  // timeout path (prep 0, 60s not feasible) -> use fake clock
  await page.click('[data-act=again]');
  await page.click('[data-act=set][data-k=count][data-v="3"]');
  await page.click('[data-act=mstart]');
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 70000; });
  await page.waitForSelector('[data-act=rate]', { timeout: 3000 });
  assert.match(await page.textContent('.stage'), /Time is up/); ok('time-up moves to rating');
  await page.evaluate(() => { location.hash = '#/home'; });

  // progress
  await page.click('.tabs a[href="#/me"]'); await page.waitForSelector('.bars');
  assert.ok(await page.isVisible('.bars')); ok('progress chart visible');
  await shot('07-progress', true);
  // export/import roundtrip
  const [exp] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=export]')]);
  const path = await exp.path(); const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  assert.equal(json.sessions.length, 1); ok('export contains session');
  await page.click('[data-act=reset]');
  assert.equal((await page.evaluate(() => window.__mq.state())).sessions.length, 0); ok('reset erases data');
  await page.setInputFiles('#imp', path);
  await page.waitForTimeout(300);
  assert.equal((await page.evaluate(() => window.__mq.state())).sessions.length, 1); ok('import restores data');
  fs.writeFileSync('/tmp/bad.json', '[1,2]');
  await page.setInputFiles('#imp', '/tmp/bad.json');
  await page.waitForFunction(() => /not a valid backup/.test(document.getElementById('toast').textContent), null, { timeout: 3000 }); ok('bad import rejected');

  // Arabic + dark + desktop views
  await page.click('#langBtn'); await page.click('#themeBtn');
  await page.click('.tabs a[href="#/home"]');
  await shot('08-home-ar-dark');
  // no horizontal overflow on mobile in all tabs
  for (const r of ['home', 'bank', 'star', 'mock', 'me']) {
    await page.goto(base + '#/' + r);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(ov <= 0, r + ' overflows by ' + ov);
  }
  ok('no horizontal overflow on 390px for all tabs');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + '#/home');
  await shot('09-desktop');
  const mf = await page.request.get(base + 'manifest.webmanifest'); assert.equal(mf.status(), 200); ok('manifest served');
  await page.goto(base); await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 5000 }); ok('service worker ready (offline cache)');
  assert.deepEqual(errors, []); ok('no console or page errors');
  await browser.close();
  console.log('E2E PASS: ' + n + ' checks');
})().catch((e) => { console.error('E2E FAIL', e); process.exit(1); });
