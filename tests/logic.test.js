const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');
const D = require('../js/data.js');

test('words counts Arabic and English', () => {
  assert.equal(L.words(''), 0);
  assert.equal(L.words('  hello   world '), 2);
  assert.equal(L.words('انا بحب الشغل'), 3);
  assert.equal(L.words(null), 0);
});
test('speakingSeconds at 130 wpm', () => {
  assert.equal(L.speakingSeconds(Array(130).fill('w').join(' ')), 60);
  assert.equal(L.speakingSeconds(''), 0);
});
test('fmtTime', () => {
  assert.equal(L.fmtTime(0), '00:00');
  assert.equal(L.fmtTime(65), '01:05');
  assert.equal(L.fmtTime(-4), '00:00');
  assert.equal(L.fmtTime(600), '10:00');
});
test('starCompleteness', () => {
  assert.equal(L.starCompleteness({}), 0);
  const full = { s: 'one two three four five six seven eight', t: 'a b c d e', a: Array(15).fill('x').join(' '), r: 'one two three four five six seven eight' };
  assert.equal(L.starCompleteness(full), 100);
  assert.equal(L.starCompleteness({ s: 'one two three four' }), 13);
});
test('starWarnings', () => {
  const w = L.starWarnings({ s: 'x', t: '', a: '', r: 'we did well' });
  assert.ok(w.includes('short_s') && w.includes('short_a') && w.includes('no_number'));
  const ok = L.starWarnings({ s: Array(9).fill('a').join(' '), t: 'a b c d e', a: Array(16).fill('a').join(' '), r: 'sales grew 20 percent in just one month' });
  assert.deepEqual(ok, []);
  assert.ok(L.starWarnings({ s: Array(40).fill('a').join(' '), t: 'a b c d e', a: Array(15).fill('a').join(' '), r: 'grew 5 times over time' }).includes('too_much_setup'));
  assert.ok(!L.starWarnings({ r: 'نمو ٣٠ بالمية في الشهر' }).includes('no_number'));
});
test('starText joins parts', () => {
  assert.equal(L.starText({ s: ' A ', t: 'B', a: '', r: 'C' }), 'A B C');
});
test('questionScore and sessionScore', () => {
  assert.equal(L.questionScore(5, 4), 100);
  assert.equal(L.questionScore(0, 0), 0);
  assert.equal(L.questionScore(3, 2), 56);
  assert.equal(L.questionScore(9, 9), 100);
  assert.equal(L.sessionScore([]), 0);
  assert.equal(L.sessionScore([{ rating: 5, checks: 4 }, { skipped: true }, { rating: 3, checks: 0 }]), 68);
});
test('grade bands', () => {
  assert.equal(L.grade(90), 'great'); assert.equal(L.grade(70), 'good');
  assert.equal(L.grade(50), 'ok'); assert.equal(L.grade(49), 'keep');
});
test('rng is deterministic and shuffle keeps items', () => {
  const a = L.rng(42), b = L.rng(42);
  assert.equal(a(), b());
  const arr = [1, 2, 3, 4, 5, 6];
  const s = L.shuffle(arr, L.rng(7));
  assert.deepEqual(s.slice().sort(), arr);
  assert.deepEqual(arr, [1, 2, 3, 4, 5, 6]);
});
test('pickQuestions filters category, count, prefers unpracticed', () => {
  const p = L.pickQuestions(D.BANK, { cats: ['ask'], count: 3 }, L.rng(1));
  assert.equal(p.length, 3);
  assert.ok(p.every(q => q.cat === 'ask'));
  const askAll = D.BANK.filter(q => q.cat === 'ask');
  const done = {}; askAll.slice(0, askAll.length - 1).forEach(q => done[q.id] = 1);
  const first = L.pickQuestions(D.BANK, { cats: ['ask'], count: 2, done }, L.rng(3));
  assert.equal(first[0].id, askAll[askAll.length - 1].id);
  assert.equal(L.pickQuestions(D.BANK, { count: 0 }, L.rng(1)).length, 1);
  assert.equal(L.pickQuestions(D.BANK, { cats: ['nope'], count: 3 }, L.rng(1)).length, 0);
});
test('streak', () => {
  assert.equal(L.streak([], '2026-11-26'), 0);
  assert.equal(L.streak(['2026-11-26'], '2026-11-26'), 1);
  assert.equal(L.streak(['2026-11-25', '2026-11-24'], '2026-11-26'), 2);
  assert.equal(L.streak(['2026-11-23'], '2026-11-26'), 0);
  assert.equal(L.streak(['2026-12-01', '2026-11-30', '2026-11-29'], '2026-12-01'), 3);
  assert.equal(L.streak(['2026-03-01', '2026-02-28'], '2026-03-01'), 2);
});
test('dayKey pads', () => {
  assert.equal(L.dayKey(new Date(2026, 0, 5)), '2026-01-05');
});
test('fillerCount', () => {
  assert.equal(L.fillerCount('Um, I like basically did it', 'en'), 3);
  assert.equal(L.fillerCount('انا يعني عملت كده', 'ar'), 2);
  assert.equal(L.fillerCount('', 'en'), 0);
  assert.equal(L.fillerCount('alike umbrella', 'en'), 0);
});
test('sanitizeState rejects junk and cleans', () => {
  assert.throws(() => L.sanitizeState(null));
  assert.throws(() => L.sanitizeState([]));
  const s = L.sanitizeState({ lang: 'fr', theme: 'dark', marked: ['q1', 5], days: ['2026-01-01', 'x'], stories: [{ id: 's1', title: 'T' }, null], sessions: [{ at: 1, items: [] }, { at: 'x' }], done: { q1: '3', q2: -1 } });
  assert.equal(s.lang, 'ar'); assert.equal(s.theme, 'dark');
  assert.deepEqual(s.marked, ['q1']); assert.deepEqual(s.days, ['2026-01-01']);
  assert.equal(s.stories.length, 1); assert.equal(s.sessions.length, 1);
  assert.equal(s.done.q1, 3); assert.equal(s.done.q2, 0);
});
test('bank integrity', () => {
  const ids = new Set(D.BANK.map(q => q.id));
  assert.equal(ids.size, D.BANK.length);
  D.BANK.forEach(q => {
    assert.ok(D.CATS[q.cat], q.id); assert.ok(q.en && q.ar && q.tipEn && q.tipAr, q.id);
    assert.match(q.ar, /[\u0600-\u06FF]/);
  });
  Object.keys(D.CATS).forEach(c => assert.ok(D.BANK.some(q => q.cat === c), c));
});
test('i18n keys match in both languages', () => {
  const I = require('../js/i18n.js');
  const en = Object.keys(I.en).sort(), ar = Object.keys(I.ar).sort();
  assert.deepEqual(en, ar);
  en.forEach(k => { assert.ok(I.en[k] !== '' && I.ar[k] !== '', k); });
});
