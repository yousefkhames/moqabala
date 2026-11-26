/* Pure logic for Moqabala. No DOM. Works in browser and Node. */
(function (root) {
  'use strict';
  var WPM = 130; // typical comfortable speaking pace

  function words(text) {
    var m = String(text || '').trim().match(/[^\s]+/g);
    return m ? m.length : 0;
  }
  function speakingSeconds(text, wpm) {
    return Math.round((words(text) / (wpm || WPM)) * 60);
  }
  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }
  var STAR_KEYS = ['s', 't', 'a', 'r'];
  var STAR_MIN_WORDS = { s: 8, t: 5, a: 15, r: 8 };
  /* completeness 0-100: each part is full credit at its minimum word count */
  function starCompleteness(st) {
    var total = 0;
    STAR_KEYS.forEach(function (k) {
      var w = words(st && st[k]);
      total += Math.min(1, w / STAR_MIN_WORDS[k]) * 25;
    });
    return Math.round(total);
  }
  function starHasNumber(st) {
    return /[0-9\u0660-\u0669]/.test(String(st && st.r || ''));
  }
  function starWarnings(st) {
    var out = [];
    STAR_KEYS.forEach(function (k) {
      if (words(st && st[k]) < STAR_MIN_WORDS[k]) out.push('short_' + k);
    });
    if (words(st && st.r) >= 1 && !starHasNumber(st)) out.push('no_number');
    if (words(st && st.a) > 0 && words(st && st.s) > words(st && st.a) * 2) out.push('too_much_setup');
    return out;
  }
  function starText(st) {
    return STAR_KEYS.map(function (k) { return String(st[k] || '').trim(); })
      .filter(Boolean).join(' ');
  }
  function starSeconds(st) { return speakingSeconds(starText(st)); }

  /* mock scoring: rating 1-5 (60%) + checklist of 4 (40%) -> 0-100 */
  function questionScore(rating, checks) {
    rating = Math.min(5, Math.max(0, Number(rating) || 0));
    var c = Math.min(4, Math.max(0, Number(checks) || 0));
    return Math.round((rating / 5) * 60 + (c / 4) * 40);
  }
  function sessionScore(items) {
    var done = (items || []).filter(function (i) { return !i.skipped; });
    if (!done.length) return 0;
    var sum = done.reduce(function (a, i) { return a + questionScore(i.rating, i.checks); }, 0);
    return Math.round(sum / done.length);
  }
  function grade(score) {
    if (score >= 85) return 'great';
    if (score >= 70) return 'good';
    if (score >= 50) return 'ok';
    return 'keep';
  }

  /* seeded RNG (mulberry32) so picks are testable */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* pick questions, prefer never-practiced ones first */
  function pickQuestions(bank, opts, rand) {
    opts = opts || {};
    var cats = opts.cats && opts.cats.length ? opts.cats : null;
    var pool = bank.filter(function (q) { return !cats || cats.indexOf(q.cat) >= 0; });
    var done = opts.done || {};
    var fresh = shuffle(pool.filter(function (q) { return !done[q.id]; }), rand);
    var seen = shuffle(pool.filter(function (q) { return done[q.id]; }), rand);
    return fresh.concat(seen).slice(0, Math.max(1, opts.count === undefined ? 5 : Number(opts.count) || 1));
  }

  /* streak over a list of YYYY-MM-DD strings (local days) */
  function dayKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function prevDay(key) {
    var p = key.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2] - 1);
    return dayKey(d);
  }
  function streak(days, todayKey) {
    var set = {};
    (days || []).forEach(function (d) { set[d] = 1; });
    var cur = todayKey || dayKey();
    if (!set[cur]) cur = prevDay(cur); // today not practiced yet: streak is still alive
    var n = 0;
    while (set[cur]) { n++; cur = prevDay(cur); }
    return n;
  }

  var FILLERS = {
    en: ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'kind of', 'sort of'],
    ar: ['يعني', 'اه', 'ايه', 'كده', 'بقى', 'مش عارف', 'حاجة كده']
  };
  function fillerCount(text, lang) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[^\w\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var n = 0;
    (FILLERS[lang] || FILLERS.en).forEach(function (f) {
      var idx = 0, needle = ' ' + f + ' ';
      while ((idx = t.indexOf(needle, idx)) >= 0) { n++; idx += f.length + 1; }
    });
    return n;
  }

  /* backup validation: returns a clean state or throws */
  function sanitizeState(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad_file');
    var s = {
      lang: obj.lang === 'en' ? 'en' : 'ar',
      theme: obj.theme === 'dark' ? 'dark' : 'light',
      custom: [], marked: [], done: {}, notes: {}, stories: [], sessions: [], days: [], check: []
    };
    if (Array.isArray(obj.custom)) s.custom = obj.custom.filter(function (q) { return q && typeof q.id === 'string' && typeof q.text === 'string'; })
      .map(function (q) { return { id: q.id.slice(0, 40), cat: String(q.cat || 'behav'), text: q.text.slice(0, 300) }; });
    if (Array.isArray(obj.marked)) s.marked = obj.marked.filter(function (x) { return typeof x === 'string'; });
    if (obj.done && typeof obj.done === 'object') Object.keys(obj.done).forEach(function (k) { s.done[k] = Math.max(0, Number(obj.done[k]) || 0); });
    if (obj.notes && typeof obj.notes === 'object') Object.keys(obj.notes).forEach(function (k) { s.notes[k] = String(obj.notes[k]).slice(0, 4000); });
    if (Array.isArray(obj.stories)) s.stories = obj.stories.filter(function (x) { return x && typeof x.id === 'string'; })
      .map(function (x) { return { id: x.id, title: String(x.title || '').slice(0, 120), q: String(x.q || ''), s: String(x.s || ''), t: String(x.t || ''), a: String(x.a || ''), r: String(x.r || ''), at: Number(x.at) || 0 }; });
    if (Array.isArray(obj.sessions)) s.sessions = obj.sessions.filter(function (x) { return x && typeof x.at === 'number' && Array.isArray(x.items); }).slice(-200);
    if (Array.isArray(obj.days)) s.days = obj.days.filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); });
    if (Array.isArray(obj.check)) s.check = obj.check.filter(function (x) { return typeof x === 'string'; });
    return s;
  }

  var api = { words: words, speakingSeconds: speakingSeconds, fmtTime: fmtTime, starCompleteness: starCompleteness,
    starWarnings: starWarnings, starText: starText, starSeconds: starSeconds, questionScore: questionScore,
    sessionScore: sessionScore, grade: grade, rng: rng, shuffle: shuffle, pickQuestions: pickQuestions,
    dayKey: dayKey, streak: streak, fillerCount: fillerCount, sanitizeState: sanitizeState, WPM: WPM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MQ = api;
})(typeof self !== 'undefined' ? self : this);
