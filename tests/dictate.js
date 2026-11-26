/* Dictation check with a fake SpeechRecognition (the real one needs a microphone and Google's service).
   Usage: node tests/dictate.js [baseUrl]   Needs puppeteer-core. */
const path = require('path'), http = require('http'), fs = require('fs');
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function serve(dir) { return new Promise((res) => { const s = http.createServer((q, r) => { let f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; r.end(); } else { r.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' }[path.extname(f)] || 'application/octet-stream'); r.end(d); } }); }).listen(0, () => res(s)); }); }
(async () => {
  let srv, base = process.argv[2];
  if (!base) { srv = await serve(path.join(__dirname, '..')); base = 'http://localhost:' + srv.address().port + '/'; }
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
  const p = await browser.newPage(); await p.setViewport({ width: 390, height: 844 });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.evaluateOnNewDocument(() => {
    window.__rec = null;
    const Fake = function () { window.__rec = this; this.start = () => { this.started = true; }; this.stop = () => { this.started = false; }; };
    window.webkitSpeechRecognition = Fake; window.SpeechRecognition = Fake;
  });
  let bad = 0; const ok = (c, n) => { console.log((c ? '  ok   ' : '  FAIL ') + n); if (!c) bad++; };
  await p.goto(base + '#/mock'); await p.waitForSelector('[data-act=mstart]');
  await p.evaluate(() => document.querySelector('[data-act=mstart]').click()); await sleep(300);
  await p.evaluate(() => document.querySelector('[data-act=startnow]').click()); await sleep(300);
  ok(await p.evaluate(() => !!document.getElementById('dictbtn')), 'dictate button shows when the browser supports speech recognition');
  await p.evaluate(() => document.getElementById('dictbtn').click()); await sleep(200);
  ok(await p.evaluate(() => window.__rec && window.__rec.started && window.__rec.lang === 'en-US'), 'recognition started in English');
  await p.evaluate(() => { const e = { resultIndex: 0, results: [Object.assign([{ transcript: 'um I led the team' }], { isFinal: true })] }; window.__rec.onresult(e); });
  const v = await p.evaluate(() => document.getElementById('live').value);
  ok(/um I led the team/.test(v), 'spoken words land in the answer box: ' + v);
  await p.evaluate(() => document.querySelector('[data-act=doneans]').click()); await sleep(300);
  ok(await p.evaluate(() => window.__rec.started === false), 'dictation stops when the answer ends');
  const t = await p.evaluate(() => document.body.innerText);
  ok(/5 words/.test(t) && /1 filler/i.test(t.replace(/fillers/i, 'filler')) , 'word and filler count use the dictated text: ' + (t.match(/\d+ words[^\n]*/) || [''])[0]);
  ok(errors.length === 0, 'no page errors ' + errors.join('|'));
  await browser.close(); if (srv) srv.close(); console.log(bad ? bad + ' FAILED' : 'DICTATE PASS'); process.exit(bad ? 1 : 0);
})();
