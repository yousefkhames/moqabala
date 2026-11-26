/* Generates README screenshots from a seeded demo state. Usage: node docs/shots.js http://localhost:PORT/ */
const { chromium } = require('playwright-core');
const base = (process.argv[2] || 'http://localhost:8080/').replace(/\/?$/, '/');
const day = (n) => { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const mk = (at, score) => ({ at, limit: 90, score, items: [{ qid: 'q1', cat: 'intro', en: 'Tell me about yourself.', ar: 'احكيلي عن نفسك.', rating: 4, checks: 3, used: 70, skipped: false, words: 0, fillers: 0 }, { qid: 'q14', cat: 'behav', en: 'x', ar: 'x', rating: 3, checks: 2, used: 85, skipped: false, words: 0, fillers: 0 }] });
const seed = (lang, theme) => ({ lang, theme, custom: [], marked: ['q14', 'q24'], done: { q1: 2, q7: 1, q14: 1, q24: 1 }, notes: { q1: 'Final-year CS student, built 2 web apps, want to grow in AI.' }, check: ['ck1', 'ck2'],
  stories: [{ id: 's1', title: 'Rescued the graduation project', q: 'q14', at: 1, s: 'In my final year our group project was two weeks late and one member dropped out.', t: 'I had to reorganize the work so we could still deliver.', a: 'I split the remaining work by strength, set daily 15 minute check-ins, built the backend myself and reviewed every pull request before merging.', r: 'We delivered on time and scored 92 percent, the best in the class.' }, { id: 's2', title: 'Learned React in a week', q: '', at: 2, s: 'Our team needed a front end and nobody knew React.', t: 'I volunteered to learn it.', a: 'I followed one course', r: '' }],
  sessions: [mk(Date.now() - 4 * 864e5, 52), mk(Date.now() - 3 * 864e5, 61), mk(Date.now() - 2 * 864e5, 68), mk(Date.now() - 864e5, 77), mk(Date.now() - 36e5, 84)], days: [day(3), day(2), day(1), day(0)] });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  async function go(name, lang, theme, hash, act) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(base); await page.evaluate((s) => localStorage.setItem('moqabala:v1', JSON.stringify(s)), seed(lang, theme));
    await page.goto(base + hash); await page.reload(); await page.waitForTimeout(300);
    if (act) await act(page);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `docs/${name}.png` }); await ctx.close();
  }
  await go('home', 'en', 'light', '#/home');
  await go('questions', 'en', 'light', '#/bank', async (p) => { await p.fill('#bq', 'team'); });
  await go('star', 'en', 'light', '#/star');
  await go('mock', 'en', 'light', '#/mock', async (p) => { await p.click('[data-act=set][data-k=prep][data-v="0"]'); await p.click('[data-act=mstart]'); await p.waitForTimeout(1500); await p.fill('#live', 'Key points: team, growth, impact'); });
  await go('progress', 'en', 'light', '#/me');
  await go('arabic-dark', 'ar', 'dark', '#/home');
  await browser.close();
})();
