(function () {
  'use strict';
  var L = window.MQ, DATA = window.MQ_DATA, I18N = window.MQ_I18N;
  var KEY = 'moqabala:v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- state ---------- */
  function fresh() {
    return { lang: (navigator.language || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en', theme: 'light',
      custom: [], marked: [], done: {}, notes: {}, stories: [], sessions: [], days: [], check: [] };
  }
  var S;
  function load() {
    try { var raw = localStorage.getItem(KEY); S = raw ? L.sanitizeState(JSON.parse(raw)) : fresh(); if (!raw) S = fresh(); }
    catch (e) { S = fresh(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage full'); } }
  load();
  var ui = { bank: { q: '', cat: 'all', f: 'all', open: {} }, star: { id: null }, mock: { cats: [], count: 5, secs: 90, prep: 15, sound: true }, run: null };

  function t(k) { return (I18N[S.lang] && I18N[S.lang][k]) || I18N.en[k] || k; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return S.lang === 'ar' ? String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }) : String(n); }
  function fmt(sec) { return num(L.fmtTime(sec)); }
  function allQuestions() {
    return DATA.BANK.concat(S.custom.map(function (c) { return { id: c.id, cat: c.cat, en: c.text, ar: c.text, tipEn: '', tipAr: '', custom: true }; }));
  }
  function qById(id) { return allQuestions().filter(function (q) { return q.id === id; })[0]; }
  function qText(q) { return S.lang === 'ar' ? q.ar : q.en; }
  function qAlt(q) { return q.custom ? '' : (S.lang === 'ar' ? q.en : q.ar); }
  function qTip(q) { return S.lang === 'ar' ? q.tipAr : q.tipEn; }
  function catName(c) { return DATA.CATS[c] ? DATA.CATS[c][S.lang] : c; }
  var toastT;
  function toast(m) { var el = $('#toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 1800); }

  /* ---------- shell ---------- */
  var ROUTES = [['home', '⌂', 'nav_home'], ['bank', '❓', 'nav_bank'], ['star', '★', 'nav_star'], ['mock', '▶', 'nav_mock'], ['me', '◔', 'nav_me']];
  function route() { var h = (location.hash || '#/home').replace('#/', '').split('?')[0]; return ROUTES.some(function (r) { return r[0] === h; }) ? h : 'home'; }
  function applyShell() {
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = S.theme;
    document.title = S.lang === 'ar' ? 'مقابلة | Moqabala' : 'Moqabala | Interview prep';
    $('#langBtn').textContent = t('lang_btn');
    $('#themeBtn').setAttribute('aria-label', t('theme'));
    $('#themeBtn').textContent = S.theme === 'dark' ? '☀' : '☾';
    $('#brandName').textContent = t('app');
    $('#skip').textContent = t('skip_link');
    $('#foot').textContent = t('footer');
    $('#tabs').innerHTML = ROUTES.map(function (r) {
      return '<a href="#/' + r[0] + '"' + (route() === r[0] ? ' aria-current="page"' : '') + '><span class="ic" aria-hidden="true">' + r[1] + '</span>' + esc(t(r[2])) + '</a>';
    }).join('');
  }
  function render() {
    if (dict.rec && !(ui.run && ui.run.phase === 'answer' && !ui.run.finished)) stopDictate();
    applyShell();
    var r = route(), app = $('#app');
    if (r !== 'mock' && ui.run) stopRun();
    app.innerHTML = ({ home: vHome, bank: vBank, star: vStar, mock: vMock, me: vMe })[r]();
    if (r === 'bank') renderBankList();
    if (r === 'star') starLive();
    if (r === 'mock' && ui.run) tickUI();
  }

  /* ---------- home ---------- */
  function practicedCount() { return Object.keys(S.done).filter(function (k) { return S.done[k] > 0 && qById(k); }).length; }
  function qotd() {
    var all = DATA.BANK, d = new Date(), n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
    return all[n % all.length];
  }
  function vHome() {
    var q = qotd(), st = L.streak(S.days), CK = ['ck1', 'ck2', 'ck3', 'ck4', 'ck5', 'ck6'];
    return '<section class="hero"><h1>' + esc(t('hero_h')) + '</h1><p>' + esc(t('hero_p')) + '</p>' +
      '<div class="row"><a class="btn primary" href="#/mock">' + esc(t('go_mock')) + '</a><a class="btn ghost" href="#/star">' + esc(t('go_star')) + '</a><a class="btn ghost" href="#/bank">' + esc(t('go_bank')) + '</a></div></section>' +
      '<div class="stats">' + stat(st, 's_streak') + stat(practicedCount() + '/' + allQuestions().length, 's_done') + stat(S.stories.length, 's_stories') + stat(S.sessions.length, 's_mocks') + '</div>' +
      '<div class="stack" style="margin-top:16px"><div class="card"><h3>' + esc(t('qotd')) + '</h3>' +
      '<p class="q" style="font-size:1.2rem;font-weight:700;margin-bottom:4px">' + esc(qText(q)) + '</p><p class="muted small">' + esc(qAlt(q)) + '</p>' +
      '<div class="row"><span class="stamp">' + esc(catName(q.cat)) + '</span><span class="grow"></span><button class="btn sm primary" data-act="qotd" data-id="' + q.id + '">' + esc(t('qotd_cta')) + '</button></div></div>' +
      '<div class="card"><div class="row"><h3 class="grow">' + esc(t('checklist')) + '</h3><span class="pill">' + num(S.check.length) + '/' + num(CK.length) + '</span></div>' +
      CK.map(function (k) { return '<label class="ck"><input type="checkbox" data-act="ck" data-k="' + k + '"' + (S.check.indexOf(k) >= 0 ? ' checked' : '') + '><span>' + esc(t(k)) + '</span></label>'; }).join('') +
      '<button class="btn sm ghost" data-act="ckreset">' + esc(t('reset_check')) + '</button></div></div>';
  }
  function stat(v, k) { return '<div class="stat"><b>' + esc(num(v)) + '</b><span>' + esc(t(k)) + '</span></div>'; }

  /* ---------- bank ---------- */
  function vBank() {
    var b = ui.bank, cats = Object.keys(DATA.CATS);
    return '<h2>' + esc(t('nav_bank')) + '</h2>' +
      '<input type="search" id="bq" value="' + esc(b.q) + '" placeholder="' + esc(t('search_ph')) + '" aria-label="' + esc(t('search_ph')) + '">' +
      '<div class="chips scroll" style="margin:10px -16px" role="group" aria-label="' + esc(t('filter_cat')) + '">' +
      ['all'].concat(cats).map(function (c) { return '<button class="chip" data-act="cat" data-c="' + c + '" aria-pressed="' + (b.cat === c) + '">' + esc(c === 'all' ? t('all') : catName(c)) + '</button>'; }).join('') + '</div>' +
      '<div class="seg" role="group">' + [['all', 'all'], ['saved', 'saved'], ['fresh', 'fresh']].map(function (f) { return '<button data-act="flt" data-f="' + f[0] + '" aria-pressed="' + (b.f === f[0]) + '">' + esc(t(f[1])) + '</button>'; }).join('') + '</div>' +
      '<p class="muted small" id="bcount" style="margin-top:10px"></p><div class="list" id="blist"></div>' +
      '<div class="card" style="margin-top:16px"><h3>' + esc(t('add_q')) + '</h3><form id="addq"><input type="text" id="aqt" maxlength="300" placeholder="' + esc(t('add_q_ph')) + '" aria-label="' + esc(t('add_q')) + '">' +
      '<select id="aqc" aria-label="' + esc(t('filter_cat')) + '" style="margin-top:8px">' + Object.keys(DATA.CATS).map(function (c) { return '<option value="' + c + '">' + esc(catName(c)) + '</option>'; }).join('') + '</select>' +
      '<button class="btn dark" style="margin-top:10px" type="submit">' + esc(t('add_btn')) + '</button></form></div>';
  }
  function filteredBank() {
    var b = ui.bank, q = b.q.trim().toLowerCase();
    return allQuestions().filter(function (x) {
      if (b.cat !== 'all' && x.cat !== b.cat) return false;
      if (b.f === 'saved' && S.marked.indexOf(x.id) < 0) return false;
      if (b.f === 'fresh' && S.done[x.id] > 0) return false;
      if (q && (x.en + ' ' + x.ar + ' ' + x.tipEn + ' ' + x.tipAr).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function cueHTML(q) {
    var saved = S.marked.indexOf(q.id) >= 0, n = S.done[q.id] || 0, note = S.notes[q.id] || '', open = ui.bank.open[q.id];
    return '<article class="cue" data-cat="' + q.cat + '" data-id="' + q.id + '"><div class="row"><span class="stamp">' + esc(catName(q.cat)) + '</span>' +
      (q.custom ? '<span class="pill">' + esc(t('custom')) + '</span>' : '') + (n ? '<span class="pill">' + esc(t('practiced') + ' ×' + num(n)) + '</span>' : '') + '</div>' +
      '<p class="q">' + esc(qText(q)) + '</p>' + (qAlt(q) ? '<p class="alt" dir="' + (S.lang === 'ar' ? 'ltr' : 'rtl') + '">' + esc(qAlt(q)) + '</p>' : '') +
      (qTip(q) ? '<details><summary>' + esc(t('show_tip')) + '</summary><div class="tip">' + esc(qTip(q)) + '</div></details>' : '') +
      (open ? '<textarea data-note="' + q.id + '" placeholder="' + esc(t('notes_ph')) + '" aria-label="' + esc(t('notes')) + '">' + esc(note) + '</textarea>' : '') +
      '<div class="acts"><button class="btn sm ghost starbtn" data-act="mark" data-id="' + q.id + '" aria-pressed="' + saved + '">' + (saved ? '★ ' + esc(t('unsave_q')) : '☆ ' + esc(t('save_q'))) + '</button>' +
      '<button class="btn sm ghost" data-act="notes" data-id="' + q.id + '">✎ ' + esc(t('notes')) + (note ? ' •' : '') + '</button>' +
      '<button class="btn sm ghost" data-act="done" data-id="' + q.id + '">✓ ' + esc(t('mark_done')) + '</button>' +
      '<button class="btn sm ghost" data-act="tostar" data-id="' + q.id + '">★ ' + esc(t('to_star')) + '</button>' +
      (q.custom ? '<button class="btn sm danger ghost" data-act="delq" data-id="' + q.id + '">' + esc(t('del')) + '</button>' : '') + '</div></article>';
  }
  function renderBankList() {
    var items = filteredBank();
    $('#bcount').textContent = num(items.length) + ' ' + t('results');
    $('#blist').innerHTML = items.length ? items.map(cueHTML).join('') : '<div class="empty">' + esc(t('no_results')) + '</div>';
  }

  /* ---------- STAR ---------- */
  function newStory(qid) {
    var s = { id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 99), title: '', q: qid || '', s: '', t: '', a: '', r: '', at: Date.now() };
    S.stories.unshift(s); save(); ui.star.id = s.id; return s;
  }
  function curStory() { return S.stories.filter(function (s) { return s.id === ui.star.id; })[0]; }
  function vStar() {
    if (!curStory() && S.stories.length) ui.star.id = S.stories[0].id;
    var st = curStory();
    var list = S.stories.length ? S.stories.map(function (s) {
      var c = L.starCompleteness(s);
      return '<button class="story' + (s.id === ui.star.id ? ' sel' : '') + '" data-act="pick" data-id="' + s.id + '"><span class="grow"><b>' + esc(s.title || '—') + '</b><span class="meter"><i style="width:' + c + '%"></i></span></span><span class="pill">' + num(c) + '%</span></button>';
    }).join('') : '<div class="empty">' + esc(t('no_stories')) + '</div>';
    var keys = [['s', 'st_s', 'h_s'], ['t', 'st_t', 'h_t'], ['a', 'st_a', 'h_a'], ['r', 'st_r', 'h_r']];
    var editor = st ? '<div class="card stack"><div><label for="stt">' + esc(t('story_title')) + '</label><input type="text" id="stt" maxlength="120" value="' + esc(st.title) + '" placeholder="' + esc(t('story_title_ph')) + '"></div>' +
      '<div><label for="stq">' + esc(t('link_q')) + '</label><select id="stq"><option value="">' + esc(t('none')) + '</option>' +
      allQuestions().filter(function (q) { return ['behav', 'team', 'lead', 'strength', 'situ'].indexOf(q.cat) >= 0 || q.custom; }).map(function (q) { return '<option value="' + q.id + '"' + (q.id === st.q ? ' selected' : '') + '>' + esc(qText(q)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="letters" id="letters">' + keys.map(function (k) { return '<b data-l="' + k[0] + '">' + k[0].toUpperCase() + '</b>'; }).join('') + '</div>' +
      keys.map(function (k) { return '<div><label for="f_' + k[0] + '">' + esc(t(k[1])) + '<span class="hint">' + esc(t(k[2])) + '</span></label><textarea id="f_' + k[0] + '" data-f="' + k[0] + '">' + esc(st[k[0]]) + '</textarea><div class="cnt" id="c_' + k[0] + '"></div></div>'; }).join('') +
      '<div><div class="row"><b class="grow">' + esc(t('complete')) + '</b><b id="pct"></b></div><div class="meter"><i id="meter" style="width:0"></i></div></div>' +
      '<ul class="warn" id="warns"></ul>' +
      '<div><h3>' + esc(t('preview')) + '</h3><div class="preview" id="prev"></div><p class="muted small" id="spk"></p></div>' +
      '<div class="row"><button class="btn dark" data-act="copy">' + esc(t('copy')) + '</button><button class="btn ghost" data-act="dl">' + esc(t('download')) + '</button><span class="grow"></span><button class="btn danger ghost" data-act="delstory">' + esc(t('del')) + '</button></div></div>' : '';
    return '<h2>' + esc(t('star_h')) + '</h2><p class="muted">' + esc(t('star_p')) + '</p><div class="cols"><div class="stack"><button class="btn primary" data-act="newstory" style="width:100%">+ ' + esc(t('new_story')) + '</button><div class="list">' + list + '</div></div><div>' + editor + '</div></div>';
  }
  function starLive() {
    var st = curStory(); if (!st) return;
    var c = L.starCompleteness(st);
    $('#pct').textContent = num(c) + '%'; $('#meter').style.width = c + '%';
    ['s', 't', 'a', 'r'].forEach(function (k) {
      $('#c_' + k).textContent = num(L.words(st[k])) + ' ' + t('words');
      $('#letters b[data-l=' + k + ']').classList.toggle('on', L.words(st[k]) >= ({ s: 8, t: 5, a: 15, r: 8 })[k]);
    });
    var sel = $('.story.sel');
    if (sel) { sel.querySelector('b').textContent = st.title || '—'; sel.querySelector('.meter i').style.width = c + '%'; sel.querySelector('.pill').textContent = num(c) + '%'; }
    var w = L.starWarnings(st);
    $('#warns').className = 'warn' + (w.length ? '' : ' okmsg');
    $('#warns').innerHTML = w.length ? w.map(function (x) { return '<li>' + esc(t('w_' + x)) + '</li>'; }).join('') : '<li>✓ ' + esc(t('w_ok')) + '</li>';
    $('#prev').textContent = L.starText(st) || '…';
    $('#spk').textContent = t('speak') + ': ' + fmt(L.starSeconds(st)) + ' (' + t('ideal') + ')';
  }
  function starFile(st) {
    var q = qById(st.q);
    return (st.title || 'STAR') + '\n' + (q ? qText(q) + '\n' : '') + '\n' +
      ['s', 't', 'a', 'r'].map(function (k) { return t('st_' + k) + ': ' + (st[k] || '').trim(); }).join('\n\n') + '\n\n---\n' + L.starText(st) + '\n';
  }

  /* ---------- mock ---------- */
  function poolSize() { var m = ui.mock; return allQuestions().filter(function (q) { return !m.cats.length || m.cats.indexOf(q.cat) >= 0; }).length; }
  function vMock() {
    if (ui.run) return vRun();
    var m = ui.mock, p = poolSize();
    function seg(key, vals, label, suffix) {
      return '<div><label>' + esc(t(label)) + '</label><div class="seg" role="group">' + vals.map(function (v) { return '<button data-act="set" data-k="' + key + '" data-v="' + v + '" aria-pressed="' + (m[key] === v) + '">' + num(v) + (suffix || '') + '</button>'; }).join('') + '</div></div>';
    }
    return '<h2>' + esc(t('mock_h')) + '</h2><p class="muted">' + esc(t('mock_p')) + '</p><div class="card stack">' +
      '<div><label>' + esc(t('m_cats')) + '</label><div class="chips">' + Object.keys(DATA.CATS).map(function (c) { return '<button class="chip" data-act="mcat" data-c="' + c + '" aria-pressed="' + (m.cats.indexOf(c) >= 0) + '">' + esc(catName(c)) + '</button>'; }).join('') + '</div></div>' +
      seg('count', [3, 5, 8, 10], 'm_count') + seg('secs', [60, 90, 120, 180], 'm_time') + seg('prep', [0, 15, 30], 'm_prep') +
      '<label class="ck"><input type="checkbox" data-act="sound"' + (m.sound ? ' checked' : '') + '><span>' + esc(t('m_sound')) + '</span></label>' +
      '<p class="muted small">' + num(p) + ' ' + esc(t('m_pool')) + '</p>' +
      '<button class="btn primary" data-act="mstart"' + (p ? '' : ' disabled') + '>▶ ' + esc(t('m_start')) + '</button>' + (p ? '' : '<p class="muted">' + esc(t('m_none')) + '</p>') + '</div>';
  }
  function startRun() {
    var m = ui.mock, qs = L.pickQuestions(allQuestions(), { cats: m.cats, count: Math.min(m.count, poolSize()), done: S.done }, Math.random);
    ui.run = { items: qs.map(function (q) { return { qid: q.id, en: q.en, ar: q.ar, cat: q.cat, tipEn: q.tipEn, tipAr: q.tipAr, custom: q.custom, note: '', rating: 0, checks: {}, used: 0, skipped: false }; }),
      i: 0, phase: 'none', limit: m.secs, prep: m.prep, deadline: 0, left: 0, paused: false, timer: null, timeUp: false, startedAt: 0, finished: false };
    beginQuestion();
  }
  function beginQuestion() {
    var r = ui.run;
    r.timeUp = false; r.paused = false;
    if (r.prep > 0) { r.phase = 'prep'; r.total = r.prep; } else { r.phase = 'answer'; r.total = r.limit; }
    r.left = r.total; r.deadline = Date.now() + r.total * 1000;
    clearInterval(r.timer); r.timer = setInterval(tick, 250);
    render();
  }
  function stopRun() { if (ui.run) clearInterval(ui.run.timer); ui.run = null; }
  function tick() {
    var r = ui.run; if (!r || r.paused || (r.phase !== 'prep' && r.phase !== 'answer')) return;
    r.left = Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000));
    tickUI();
    if (r.left <= 0) {
      if (r.phase === 'prep') { r.phase = 'answer'; r.total = r.limit; r.left = r.limit; r.deadline = Date.now() + r.limit * 1000; r.startedAt = Date.now(); render(); }
      else { r.timeUp = true; beep(); toRate(r.limit); }
    }
  }
  function tickUI() {
    var r = ui.run; if (!r) return;
    var tm = $('#tm'), fg = $('#fg'); if (!tm) return;
    tm.textContent = fmt(r.left);
    var C = 2 * Math.PI * 44;
    fg.setAttribute('stroke-dasharray', C.toFixed(1));
    fg.setAttribute('stroke-dashoffset', (C * (1 - r.left / r.total)).toFixed(1));
    $('#ring').classList.toggle('low', r.left <= 10 && r.phase === 'answer');
  }
  function toRate(used) {
    var r = ui.run; clearInterval(r.timer); r.items[r.i].used = used; r.phase = 'rate'; render();
  }
  function beep() {
    if (!ui.mock.sound) return;
    try { var C = window.AudioContext || window.webkitAudioContext, c = new C(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = .15; o.start(); setTimeout(function () { o.stop(); c.close(); }, 350); } catch (e) { }
    try { navigator.vibrate && navigator.vibrate(200); } catch (e) { }
  }
  function itemText(it) { return S.lang === 'ar' ? it.ar : it.en; }
  function vRun() {
    var r = ui.run, it = r.items[r.i];
    var dots = '<div class="dots" aria-hidden="true">' + r.items.map(function (_, k) { return '<i class="' + (k < r.i ? 'on' : k === r.i ? 'cur' : '') + '"></i>'; }).join('') + '</div>';
    var head = '<div class="row"><b class="grow">' + esc(t('q_of') + ' ' + num(r.i + 1) + ' ' + t('of') + ' ' + num(r.items.length)) + '</b>' + dots + '</div>';
    if (r.finished) return vResults();
    var qh = '<div class="qtext">' + esc(itemText(it)) + '</div>' + (!it.custom ? '<div class="alt small" dir="' + (S.lang === 'ar' ? 'ltr' : 'rtl') + '">' + esc(S.lang === 'ar' ? it.en : it.ar) + '</div>' : '');
    if (r.phase === 'rate') {
      var n = Object.keys(it.checks).filter(function (k) { return it.checks[k]; }).length;
      return '<section class="stage">' + head + qh + (r.timeUp ? '<p><b>⏰ ' + esc(t('time_up')) + '</b></p>' : '') +
        '<p class="small" style="opacity:.8">' + esc(t('used')) + ': ' + fmt(it.used) + ' / ' + fmt(r.limit) + (it.note ? ' · ' + num(L.words(it.note)) + ' ' + esc(t('words')) + ' · ' + num(L.fillerCount(it.note, S.lang)) + ' ' + esc(t('fillers')) : '') + '</p>' +
        '<h3>' + esc(t('rate_h')) + '</h3><p class="small" style="opacity:.8">' + esc(t('rate_p')) + '</p><div class="rate" role="group">' +
        [1, 2, 3, 4, 5].map(function (v) { return '<button data-act="rate" data-v="' + v + '" aria-pressed="' + (it.rating === v) + '">' + num(v) + '</button>'; }).join('') + '</div>' +
        ['star', 'num', 'short', 'conf'].map(function (k) { return '<label class="chk"><input type="checkbox" data-act="rchk" data-k="' + k + '"' + (it.checks[k] ? ' checked' : '') + '>' + esc(t('c_' + k)) + '</label>'; }).join('') +
        ((S.lang === 'ar' ? it.tipAr : it.tipEn) ? '<div class="tip" style="background:rgba(255,255,255,.08)">💡 ' + esc(S.lang === 'ar' ? it.tipAr : it.tipEn) + '</div>' : '') +
        '<div class="row" style="margin-top:14px"><button class="btn primary" data-act="next"' + (it.rating ? '' : ' disabled') + '>' + esc(r.i === r.items.length - 1 ? t('finish') : t('next_q')) + '</button><span class="muted small" style="color:inherit;opacity:.6">' + num(n) + '/' + num(4) + '</span></div></section>';
    }
    var C = 2 * Math.PI * 44;
    return '<section class="stage">' + head + (r.phase === 'prep' ? '<p class="small" style="opacity:.8">' + esc(t('get_ready')) + '</p>' : '') + qh +
      '<div class="ringwrap"><div class="ring" id="ring"><svg viewBox="0 0 100 100" width="112" height="112"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" id="fg" cx="50" cy="50" r="44" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="0"/></svg><div class="tm" id="tm" role="timer">' + fmt(r.left) + '</div></div>' +
      '<div class="stack grow">' + (r.phase === 'prep' ? '<button class="btn primary" data-act="startnow">' + esc(t('start_now')) + '</button>' :
        '<button class="btn primary" data-act="doneans">✓ ' + esc(t('done_ans')) + '</button>') +
      '<div class="row"><button class="btn sm" data-act="pause">' + esc(r.paused ? t('resume') : t('pause')) + '</button><button class="btn sm" data-act="skipq">' + esc(t('skip')) + '</button><button class="btn sm" data-act="quit">' + esc(t('quit')) + '</button></div></div></div>' +
      (r.phase === 'answer' ? '<label for="live" class="small" style="opacity:.8">' + esc(t('notes_live')) + '</label><textarea id="live">' + esc(it.note) + '</textarea>' + (SR ? '<div class="row" style="margin-top:8px"><button class="btn sm" data-act="dictate" id="dictbtn" aria-pressed="' + !!dict.rec + '">' + (dict.rec ? '⏹ ' + esc(t('dict_stop')) : '🎤 ' + esc(t('dict_start'))) + '</button><span class="small" id="dictst" style="opacity:.7">' + esc(dict.rec ? t('dict_on') : t('dict_hint')) + '</span></div>' : '') : '') + '</section>';
  }
  function finishRun() {
    var r = ui.run, today = L.dayKey();
    var sess = { at: Date.now(), limit: r.limit, score: L.sessionScore(r.items.map(function (i) { return { skipped: i.skipped, rating: i.rating, checks: Object.keys(i.checks).filter(function (k) { return i.checks[k]; }).length }; })),
      items: r.items.map(function (i) { return { qid: i.qid, cat: i.cat, en: i.en, ar: i.ar, rating: i.rating, checks: Object.keys(i.checks).filter(function (k) { return i.checks[k]; }).length, used: i.used, skipped: i.skipped, words: L.words(i.note), fillers: L.fillerCount(i.note, S.lang) }; }) };
    S.sessions.push(sess);
    r.items.forEach(function (i) { if (!i.skipped) { S.done[i.qid] = (S.done[i.qid] || 0) + 1; if (i.note.trim() && !S.notes[i.qid]) S.notes[i.qid] = i.note; } });
    if (S.days.indexOf(today) < 0) S.days.push(today);
    save(); r.finished = true; r.sess = sess; clearInterval(r.timer); render();
  }
  function vResults() {
    var s = ui.run.sess, ans = s.items.filter(function (i) { return !i.skipped; }), sk = s.items.length - ans.length;
    var avg = ans.length ? Math.round(ans.reduce(function (a, i) { return a + i.used; }, 0) / ans.length) : 0;
    var low = ans.slice().sort(function (a, b) { return L.questionScore(a.rating, a.checks) - L.questionScore(b.rating, b.checks); }).filter(function (i) { return L.questionScore(i.rating, i.checks) < 85; }).slice(0, 2);
    return '<section class="stage"><h2>' + esc(t('res_h')) + '</h2><div class="row"><div class="bigscore">' + num(s.score) + '</div><div><div>' + esc(t('score')) + ' / ' + num(100) + '</div><b>' + esc(t('g_' + L.grade(s.score))) + '</b></div></div>' +
      '<p class="small" style="opacity:.85">' + num(ans.length) + ' ' + esc(t('answered')) + ' · ' + num(sk) + ' ' + esc(t('skipped')) + ' · ' + esc(t('avg_time')) + ': ' + fmt(avg) + '</p>' +
      (low.length ? '<h3>' + esc(t('lowest')) + '</h3><ul>' + low.map(function (i) { return '<li>' + esc(S.lang === 'ar' ? i.ar : i.en) + ' (' + num(L.questionScore(i.rating, i.checks)) + ')</li>'; }).join('') + '</ul>' : '') +
      '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="again">' + esc(t('again')) + '</button><a class="btn" href="#/me">' + esc(t('nav_me')) + '</a><a class="btn" href="#/home">' + esc(t('home_btn')) + '</a></div></section>';
  }

  /* ---------- progress ---------- */
  function vMe() {
    var ss = S.sessions.slice(-10), sc = {}, cn = {};
    S.sessions.forEach(function (s) { s.items.forEach(function (i) { if (i.skipped) return; sc[i.cat] = (sc[i.cat] || 0) + L.questionScore(i.rating, i.checks); cn[i.cat] = (cn[i.cat] || 0) + 1; }); });
    var cats = Object.keys(cn).sort();
    return '<h2>' + esc(t('me_h')) + '</h2><div class="stats">' + stat(L.streak(S.days), 's_streak') + stat(practicedCount() + '/' + allQuestions().length, 's_done') + stat(S.stories.length, 's_stories') + stat(S.sessions.length, 's_mocks') + '</div>' +
      '<div class="stack" style="margin-top:14px"><div class="card"><h3>' + esc(t('recent')) + '</h3>' + (ss.length ?
        '<div class="bars" role="img" aria-label="' + esc(t('recent')) + '">' + ss.map(function (s) { return '<div style="height:' + Math.max(4, s.score) + '%"><span>' + num(s.score) + '</span></div>'; }).join('') + '</div>' +
        '<div class="list" style="margin-top:12px">' + S.sessions.slice(-5).reverse().map(function (s) { return '<div class="row small"><b>' + esc(new Date(s.at).toLocaleDateString(S.lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })) + '</b><span class="grow muted">' + num(s.items.length) + ' ' + esc(t('results')) + '</span><span class="pill">' + num(s.score) + ' ' + esc(t('pts')) + '</span></div>'; }).join('') + '</div>' :
        '<div class="empty">' + esc(t('no_sessions')) + '<br><a class="btn primary" style="margin-top:10px" href="#/mock">' + esc(t('go_mock')) + '</a></div>') + '</div>' +
      (cats.length ? '<div class="card"><h3>' + esc(t('by_cat')) + '</h3><div class="list">' + cats.map(function (c) { var a = Math.round(sc[c] / cn[c]); return '<div class="catbar"><span>' + esc(catName(c)) + '</span><div class="meter"><i style="width:' + a + '%"></i></div><b>' + num(a) + '</b></div>'; }).join('') + '</div></div>' : '') +
      '<div class="card"><h3>' + esc(t('data_h')) + '</h3><p class="muted small">' + esc(t('data_p')) + '</p><div class="row"><button class="btn sm dark" data-act="export">' + esc(t('export')) + '</button><label class="btn sm ghost" style="margin:0" for="imp">' + esc(t('import')) + '</label><input type="file" id="imp" accept="application/json,.json" hidden><button class="btn sm danger ghost" data-act="reset">' + esc(t('reset')) + '</button></div></div></div>';
  }

  /* ---------- events ---------- */
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function () { toast(t('copied')); }, fallback);
    fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(t('copied')); } catch (e) { } ta.remove(); }
  }
  function download(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.dataset.act, id = el.dataset.id, r = ui.run;
    if (a === 'ck') { var k = el.dataset.k, i = S.check.indexOf(k); if (el.checked && i < 0) S.check.push(k); if (!el.checked && i >= 0) S.check.splice(i, 1); save(); render(); return; }
    if (a === 'sound' || a === 'rchk') return; // handled on change
    switch (a) {
      case 'ckreset': S.check = []; save(); render(); break;
      case 'qotd': ui.mock.cats = []; ui.bank.q = ''; ui.bank.cat = 'all'; ui.bank.f = 'all'; ui.bank.open[id] = true; location.hash = '#/bank'; setTimeout(function () { var c = $('.cue[data-id=' + id + ']'); if (c) c.scrollIntoView({ block: 'center' }); }, 30); break;
      case 'cat': ui.bank.cat = el.dataset.c; render(); break;
      case 'flt': ui.bank.f = el.dataset.f; render(); break;
      case 'mark': var m = S.marked.indexOf(id); if (m >= 0) S.marked.splice(m, 1); else S.marked.push(id); save(); renderBankList(); $$('[data-act=flt]').length; break;
      case 'notes': ui.bank.open[id] = !ui.bank.open[id]; renderBankList(); if (ui.bank.open[id]) { var ta = $('[data-note=' + id + ']'); ta && ta.focus(); } break;
      case 'done': S.done[id] = (S.done[id] || 0) + 1; var td = L.dayKey(); if (S.days.indexOf(td) < 0) S.days.push(td); save(); renderBankList(); toast(t('saved_ok')); break;
      case 'tostar': var ex = S.stories.filter(function (s) { return s.q === id && !L.starText(s); })[0]; if (ex) ui.star.id = ex.id; else { var q = qById(id); var ns = newStory(id); ns.title = q ? qText(q).slice(0, 60) : ''; save(); } location.hash = '#/star'; break;
      case 'delq': if (confirm(t('confirm_del'))) { S.custom = S.custom.filter(function (c) { return c.id !== id; }); delete S.notes[id]; delete S.done[id]; S.marked = S.marked.filter(function (x) { return x !== id; }); save(); renderBankList(); } break;
      case 'newstory': newStory(); render(); var f = $('#stt'); f && f.focus(); break;
      case 'pick': ui.star.id = id; render(); break;
      case 'copy': var st = curStory(); st && copyText(starFile(st)); break;
      case 'dl': var s2 = curStory(); s2 && download('star-' + (s2.id) + '.txt', starFile(s2)); break;
      case 'delstory': if (confirm(t('confirm_del'))) { S.stories = S.stories.filter(function (s) { return s.id !== ui.star.id; }); ui.star.id = null; save(); render(); toast(t('deleted')); } break;
      case 'mcat': var ci = ui.mock.cats.indexOf(el.dataset.c); if (ci >= 0) ui.mock.cats.splice(ci, 1); else ui.mock.cats.push(el.dataset.c); render(); break;
      case 'set': ui.mock[el.dataset.k] = Number(el.dataset.v); render(); break;
      case 'mstart': if (poolSize()) startRun(); break;
      case 'startnow': r.left = 0; r.deadline = 0; r.startedAt = Date.now(); r.phase = 'answer'; r.total = r.limit; r.left = r.limit; r.deadline = Date.now() + r.limit * 1000; render(); break;
      case 'dictate': if (dict.rec) stopDictate(); else startDictate(); render(); break;
      case 'doneans': stopDictate(); saveLive(); toRate(Math.min(r.limit, Math.round(r.limit - r.left))); break;
      case 'pause': saveLive(); if (r.paused) { r.deadline = Date.now() + r.left * 1000; r.paused = false; } else { r.left = Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000)); r.paused = true; } render(); break;
      case 'skipq': r.items[r.i].skipped = true; clearInterval(r.timer); advance(); break;
      case 'quit': if (confirm(t('confirm_quit'))) { stopRun(); render(); } break;
      case 'rate': r.items[r.i].rating = Number(el.dataset.v); render(); break;
      case 'next': advance(); break;
      case 'again': stopRun(); render(); break;
      case 'export': download('moqabala-backup.json', JSON.stringify(S, null, 2), 'application/json'); break;
      case 'reset': if (confirm(t('confirm_reset'))) { var lang = S.lang; S = fresh(); S.lang = lang; save(); render(); } break;
    }
  });
  /* optional dictation: the browser's speech recognition turns your spoken answer into the notes box, so words and fillers are counted on what you said */
  var SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  var dict = { rec: null };
  function stopDictate() { if (dict.rec) { var r = dict.rec; dict.rec = null; try { r.onend = null; r.stop(); } catch (e) { } } }
  function startDictate() {
    if (!SR || dict.rec) return;
    var rec = new SR(); rec.lang = S.lang === 'ar' ? 'ar-EG' : 'en-US'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = function (ev) {
      var ta = $('#live'); if (!ta || !ui.run) return; var add = '';
      for (var k = ev.resultIndex; k < ev.results.length; k++) if (ev.results[k].isFinal) add += ev.results[k][0].transcript + ' ';
      if (add) { ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + add.trim() + ' '; ui.run.items[ui.run.i].note = ta.value; }
    };
    rec.onerror = function (ev) { var st = $('#dictst'); if (st) st.textContent = ev.error === 'not-allowed' ? t('dict_denied') : t('dict_err'); if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { dict.rec = null; var b = $('#dictbtn'); if (b) b.textContent = '🎤 ' + t('dict_start'); } };
    rec.onend = function () { if (dict.rec === rec) { try { rec.start(); } catch (e) { dict.rec = null; } } };
    dict.rec = rec; try { rec.start(); } catch (e) { dict.rec = null; }
  }
  function saveLive() { var ta = $('#live'); if (ta && ui.run) ui.run.items[ui.run.i].note = ta.value; }
  function advance() {
    var r = ui.run; if (r.i >= r.items.length - 1) { finishRun(); return; }
    r.i++; beginQuestion();
  }
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset.act === 'sound') ui.mock.sound = el.checked;
    if (el.dataset.act === 'rchk' && ui.run) { ui.run.items[ui.run.i].checks[el.dataset.k] = el.checked; render(); }
    if (el.id === 'stq') { var s = curStory(); if (s) { s.q = el.value; save(); } }
    if (el.id === 'imp' && el.files[0]) {
      var fr = new FileReader();
      fr.onload = function () { try { S = L.sanitizeState(JSON.parse(fr.result)); save(); render(); toast(t('imported')); } catch (err) { toast(t('bad_file')); } };
      fr.readAsText(el.files[0]);
    }
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'bq') { ui.bank.q = el.value; renderBankList(); }
    else if (el.dataset.note) { S.notes[el.dataset.note] = el.value; save(); }
    else if (el.id === 'stt') { var s = curStory(); s.title = el.value; save(); starLive(); }
    else if (el.dataset.f) { var s2 = curStory(); s2[el.dataset.f] = el.value; save(); starLive(); }
    else if (el.id === 'live' && ui.run) { ui.run.items[ui.run.i].note = el.value; }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'addq') {
      e.preventDefault(); var v = $('#aqt').value.trim(); if (!v) return;
      S.custom.push({ id: 'c' + Date.now().toString(36), cat: $('#aqc').value, text: v }); save(); $('#aqt').value = ''; renderBankList(); toast(t('saved_ok'));
    }
  });
  $('#langBtn').addEventListener('click', function () { S.lang = S.lang === 'ar' ? 'en' : 'ar'; save(); render(); });
  $('#themeBtn').addEventListener('click', function () { S.theme = S.theme === 'dark' ? 'light' : 'dark'; save(); render(); });
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
  window.__mq = { state: function () { return S; } };
  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () { });
})();
