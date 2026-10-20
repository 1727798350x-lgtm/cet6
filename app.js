/* ===================================================================
 * 刷六级 · 单词信息流
 * 主逻辑：队列 / 台阶式间隔重复 / 本地存储 / 渲染 / 交互
 * -------------------------------------------------------------------
 * 纯逻辑函数（todayStr / addDays / applyRating / buildQueue ...）
 * 不依赖 DOM，可在 Node 里单独测试（见文件末尾的 module.exports）。
 * =================================================================== */
'use strict';

/* ---------------- 常量 ---------------- */
// 台阶：stage 0 → 1 天，1 → 2 天，……，6 → 30 天（封顶）
const STEPS = [1, 2, 4, 7, 15, 30, 30];
const KEY = 'cet6_progress_v1';
const MAX_CARDS = 6000;   // 词库只有几千词，等于不限
const CHUNK = 24;
const SOFT_GOAL = 200;    // 顶部进度条按 200 张填满，只是激励，不是上限
const RATING_TEXT = { again: '忘了', hard: '模糊', good: '记得' };

/* ---------------- 日期工具 ---------------- */
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function todayStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function addDays(dateStr, n) {
  const p = String(dateStr).split('-').map(Number);
  return todayStr(new Date(p[0], p[1] - 1, p[2] + n));
}

/* ---------------- 台阶算法 ---------------- */
function intervalOf(stage) {
  const s = Math.min(Math.max(stage, 0), STEPS.length - 1);
  return STEPS[s];
}

function ratingToStage(cur, rating) {
  if (rating === 'again') return 0;
  if (rating === 'hard') return cur < 0 ? 0 : cur;
  return Math.min(STEPS.length - 1, cur + 1); // good：升一级
}

// 就地更新 state.words[id]，返回该词的进度对象
function applyRating(state, id, rating, today) {
  let p = state.words[id];
  if (!p) {
    p = state.words[id] = { stage: -1, due: today, seen: 0, lapses: 0, last: '' };
  }
  p.seen = (p.seen || 0) + 1;
  p.last = today;
  if (rating === 'again') p.lapses = (p.lapses || 0) + 1;
  p.stage = ratingToStage(typeof p.stage === 'number' ? p.stage : -1, rating);
  p.due = addDays(today, intervalOf(p.stage));
  return p;
}

function markStudy(state, today) {
  const st = state.stats;
  if (st.lastStudy === today) return;
  const y = addDays(today, -1);
  st.streak = st.lastStudy === y ? (st.streak || 0) + 1 : 1;
  st.lastStudy = today;
}

/* ---------------- 队列 ---------------- */
function buildQueue(words, state, today, dailyNew) {
  const due = [];
  let fresh = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const p = state.words[w.id];
    if (!p) fresh.push(w);
    else if (p.due <= today) due.push({ id: w.id, stage: p.stage || 0, due: p.due });
  }
  // 超期最久的先复习；同一天到期的，台阶高的先上（先给正反馈）
  due.sort(function (a, b) {
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    return (b.stage || 0) - (a.stage || 0);
  });
  fresh.sort(function (a, b) { return (a.rank || 0) - (b.rank || 0); });

  // 「滑过去不算」：从上次刷到的位置继续，不用每次从头再来
  const cursor = Number(state.stats && state.stats.cursorRank) || 0;
  if (cursor > 0 && fresh.length) {
    const after = fresh.filter(function (w) { return (w.rank || 0) > cursor; });
    fresh = after.length ? after : fresh;
  }

  const out = [];

  // 前 3 张：最熟的复习词
  const warm = due.slice().sort(function (a, b) {
    return (b.stage || 0) - (a.stage || 0);
  }).slice(0, 3).map(function (x) { return x.id; });
  warm.forEach(function (id) { out.push(id); });

  const restDue = due.map(function (x) { return x.id; }).filter(function (id) {
    return warm.indexOf(id) === -1;
  });
  // dailyNew <= 0 表示不限：新词全部进队列
  const newIds = (dailyNew > 0 ? fresh.slice(0, dailyNew) : fresh).map(function (w) { return w.id; });

  let di = 0, ni = 0;
  // 复习 : 新词 = 2 : 1
  while (di < restDue.length && ni < newIds.length) {
    out.push(restDue[di++]);
    if (di < restDue.length) out.push(restDue[di++]);
    out.push(newIds[ni++]);
  }
  while (di < restDue.length) out.push(restDue[di++]);
  while (ni < newIds.length) out.push(newIds[ni++]);

  // 去重 + 截断
  const seen = Object.create(null);
  const res = [];
  for (let i = 0; i < out.length && res.length < MAX_CARDS; i++) {
    const id = out[i];
    if (seen[id]) continue;
    seen[id] = 1;
    res.push(id);
  }
  return res;
}

// 还没学过的词里，按 rank 取 n 个（排除 exclude 里的）
function nextFreshIds(words, state, exclude, n) {
  const skip = Object.create(null);
  (exclude || []).forEach(function (id) { skip[id] = 1; });
  const res = [];
  for (let i = 0; i < words.length && res.length < n; i++) {
    const w = words[i];
    if (state.words[w.id]) continue;
    if (skip[w.id]) continue;
    skip[w.id] = 1;
    res.push(w.id);
  }
  return res;
}

// 到期日 <= date 的词数
function countDue(words, state, date) {
  let n = 0;
  for (let i = 0; i < words.length; i++) {
    const p = state.words[words[i].id];
    if (p && p.due <= date) n++;
  }
  return n;
}

function countDoneToday(state, today) {
  let n = 0;
  for (const id in state.words) {
    if (state.words[id].last === today) n++;
  }
  return n;
}

/* ---------------- 存储 ---------------- */
function defaultState() {
  return {
    version: 1,
    updatedAt: '',
    settings: { dailyNew: 0, fontSize: 'm' },  // 0 = 不限
    stats: { streak: 0, lastStudy: '', lastDay: '', todayTotal: 0, cursorRank: 0 },
    favs: {},
    words: {}
  };
}

function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
  if (!raw) return defaultState();
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || !s.words || typeof s.words !== 'object') return defaultState();
    const d = defaultState();
    const out = {
      version: 1,
      updatedAt: s.updatedAt || '',
      settings: Object.assign({}, d.settings, s.settings || {}),
      stats: Object.assign({}, d.stats, s.stats || {}),
      favs: (s.favs && typeof s.favs === 'object') ? s.favs : {},
      words: s.words
    };
    // 清洗：坏数据不拖垮整个 App
    for (const id in out.words) {
      const p = out.words[id];
      if (!p || typeof p !== 'object' || typeof p.due !== 'string') { delete out.words[id]; continue; }
      out.words[id] = {
        stage: typeof p.stage === 'number' ? p.stage : 0,
        due: p.due,
        seen: p.seen || 0,
        lapses: p.lapses || 0,
        last: p.last || '',
        fav: !!p.fav
      };
    }
    if (['s', 'm', 'l'].indexOf(out.settings.fontSize) === -1) out.settings.fontSize = 'm';
    out.stats.cursorRank = Number(out.stats.cursorRank) || 0;
    const dn = Number(out.settings.dailyNew);
    out.settings.dailyNew = (isFinite(dn) && dn >= 0) ? Math.min(500, dn) : 0;
    return out;
  } catch (e) {
    return defaultState();
  }
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------- 词库校验 ---------------- */
function validateWords(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = Object.create(null);
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (!w || !w.id || !w.w || !Array.isArray(w.cn) || !w.cn.length) continue;
    const id = String(w.id).trim();
    if (!id || seen[id]) continue;
    seen[id] = 1;
    out.push({
      id: id,
      w: String(w.w),
      ipa: w.ipa ? String(w.ipa) : '',
      pos: w.pos ? String(w.pos) : '',
      cn: w.cn.map(String),
      ex: w.ex ? String(w.ex) : '',
      exCn: w.exCn ? String(w.exCn) : '',
      root: w.root ? String(w.root) : '',
      fam: Array.isArray(w.fam) ? w.fam.map(String).slice(0, 5) : [],
      sim: Array.isArray(w.sim) ? w.sim.map(String).slice(0, 5) : [],
      lvl: Number(w.lvl) || 1,
      rank: Number(w.rank) || 9999
    });
  }
  out.sort(function (a, b) { return a.rank - b.rank; });
  return out;
}

/* ===================================================================
 * 以下是 DOM 部分：只在浏览器里运行
 * =================================================================== */
function boot() {
  const $ = function (id) { return document.getElementById(id); };
  const feed = $('feed');
  const keys = $('keys');
  const keyHint = $('keyHint');
  const progressFill = $('progressFill');
  const countLabel = $('countLabel');
  const dayLabel = $('dayLabel');
  const toastEl = $('toast');

  const model = {
    words: [],
    byId: Object.create(null),
    queue: [],
    cards: [],
    rendered: 0,
    active: -1,
    state: null,
    today: '',
    lock: false,
    toastTimer: 0,
    mode: 'today',
    senseIndex: null
  };

  let saveTimer = 0;
  function saveSoon() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = 0; save(); }, 1000);
  }

  const keyBtns = Array.prototype.slice.call(keys.querySelectorAll('.key'));

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(model.toastTimer);
    model.toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
  }

  function save() {
    if (!saveState(model.state)) toast('保存失败：存储空间可能已满，请先导出备份');
  }

  /* ---------- 发音 ---------- */
  const audio = { ready: false, voice: null };

  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const list = speechSynthesis.getVoices() || [];
    const en = list.filter(function (v) { return /^en[-_]/i.test(v.lang); });
    const us = en.filter(function (v) { return /US/i.test(v.lang); });
    return us[0] || en[0] || null;
  }

  function speak(text) {
    if (!window.speechSynthesis) { toast('这个浏览器不支持朗读，先看音标吧'); return; }
    try {
      if (!audio.voice) audio.voice = pickVoice();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      if (audio.voice) u.voice = audio.voice;
      speechSynthesis.speak(u);
    } catch (e) {
      toast('朗读失败，可以先看音标');
    }
  }

  if (window.speechSynthesis) {
    audio.voice = pickVoice();
    if (typeof speechSynthesis.onvoiceschanged !== 'undefined') {
      speechSynthesis.onvoiceschanged = function () { audio.voice = pickVoice(); };
    }
  }

  // iOS 需要一次用户手势解锁音频
  document.addEventListener('pointerdown', function () {
    if (audio.ready || !window.speechSynthesis) return;
    audio.ready = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) { /* 忽略 */ }
  }, { once: true });

  /* ---------- 相关词 ---------- */
  // 同义：释义里至少一条完全相同的其他词
  function synonymsOf(w) {
    if (!model.senseIndex) return [];
    const seen = Object.create(null);
    const out = [];
    w.cn.forEach(function (s) {
      const arr = model.senseIndex.get(s) || [];
      for (let i = 0; i < arr.length && out.length < 3; i++) {
        const x = arr[i];
        if (x.id === w.id || seen[x.id]) continue;
        seen[x.id] = 1;
        out.push(x.w);
      }
    });
    return out;
  }

  function relRow(k, v) {
    return '<div class="rel__row"><span class="rel__k">' + k + '</span>' +
      '<span class="rel__v">' + esc(v.join(' · ')) + '</span></div>';
  }

  function relHTML(w) {
    const rows = [];
    const fam = (w.fam || []).filter(function (x) { return x && x.toLowerCase() !== w.w.toLowerCase(); });
    if (fam.length) rows.push(relRow('派生', fam));
    const syn = synonymsOf(w);
    if (syn.length) rows.push(relRow('同义', syn));
    const sim = (w.sim || []).filter(Boolean);
    if (sim.length) rows.push(relRow('形近', sim));
    if (!rows.length) return '';
    return '<div class="card__rel">' + rows.join('') + '</div>';
  }

  /* ---------- 渲染 ---------- */
  function cardHTML(w, isFav) {
    const svg = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
      '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>' +
      '<path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '</svg>';
    return '' +
      '<div class="card__body">' +
        '<div class="card__head">' +
          '<span class="card__word">' + esc(w.w) + '</span>' +
          '<span class="card__flag" aria-hidden="true"></span>' +
          '<button class="fav' + (isFav ? ' is-on' : '') + '" data-fav="' + esc(w.id) + '" aria-label="收藏">' +
            (isFav ? '★' : '☆') + '</button>' +
          '<button class="speak" data-speak="' + esc(w.w) + '" aria-label="朗读单词">' + svg + '</button>' +
        '</div>' +
        '<div class="card__ipa">' + esc(w.ipa) + '</div>' +
        (w.pos ? '<div class="card__pos">' + esc(w.pos) + '</div>' : '') +
        '<div class="card__cn">' + esc(w.cn.join('；')) + '</div>' +
        (w.ex ? '<div class="card__rule"></div>' : '') +
        (w.ex ? '<div class="card__ex">' + esc(w.ex) + '</div>' : '') +
        (w.exCn ? '<div class="card__excn">' + esc(w.exCn) + '</div>' : '') +
        (w.root ? '<div class="card__root">' + esc(w.root) + '</div>' : '') +
        relHTML(w) +
      '</div>';
  }

  function renderChunk() {
    const end = Math.min(model.queue.length, model.rendered + CHUNK);
    if (end <= model.rendered) return;
    const frag = document.createDocumentFragment();
    for (let i = model.rendered; i < end; i++) {
      const w = model.byId[model.queue[i]];
      if (!w) continue;
      const el = document.createElement('article');
      el.className = 'card';
      el.dataset.id = w.id;
      el.innerHTML = cardHTML(w, !!(model.state.favs && model.state.favs[w.id]));
      frag.appendChild(el);
      model.cards.push(el);
    }
    model.rendered = end;
    feed.appendChild(frag);
  }

  /* ---------- 顶部进度 ---------- */
  function updateTop() {
    dayLabel.textContent = (model.mode === 'fav') ? '收藏夹' : ('今天 · ' + model.today.slice(5).replace('-', '/'));
    if (model.mode === 'fav') return;
    const done = countDoneToday(model.state, model.today);
    countLabel.textContent = '已刷 ' + done + ' 张';
    progressFill.style.width = Math.min(100, (done / SOFT_GOAL) * 100) + '%';
  }

  function updateFavLabel() {
    const b = $('favBtn');
    if (!b) return;
    const n = Object.keys(model.state.favs || {}).length;
    b.textContent = n ? '收藏夹（' + n + ' 个词）' : '收藏夹（还没有收藏）';
  }

  /* ---------- 三键状态 ---------- */
  function updateKeys() {
    keys.classList.remove('is-locked');
    keyBtns.forEach(function (b) { b.disabled = false; });
    keyHint.textContent = '按感觉点一下，或直接上滑到下一个';
  }

  /* ---------- 卡片交互 ---------- */
  function applyRate(el, rating) {
    const id = el.dataset.id;
    applyRating(model.state, id, rating, model.today);
    markStudy(model.state, model.today);
    el.classList.add('is-rated', 'flag-' + rating);
    el.dataset.rating = rating;
    const flag = el.querySelector('.card__flag');
    if (flag) flag.textContent = RATING_TEXT[rating];
    save();
    updateTop();

    // 答错的词：当天再来一次（排到队列末尾，不会打乱已经在滑的卡片）
    if (rating === 'again') {
      const later = model.queue.indexOf(id, model.active + 1);
      if (later === -1) {
        model.queue.push(id);
        if (model.rendered >= model.queue.length - 1) renderChunk();
      }
    }
  }

  function scrollToIndex(i) {
    const h = feed.clientHeight || window.innerHeight;
    feed.scrollTo({ top: i * h, behavior: 'smooth' });
  }

  function rate(rating) {
    if (model.lock) return;
    const el = model.cards[model.active];
    if (!el) return;
    applyRate(el, rating);
    model.lock = true;
    setTimeout(function () { model.lock = false; }, 340);

    const next = model.active + 1;
    if (next < model.queue.length) {
      if (next >= model.rendered) renderChunk();
      requestAnimationFrame(function () { scrollToIndex(next); });
    } else if (model.mode === 'fav') {
      toast('收藏夹到头了，点左上角回到今天');
    } else {
      setTimeout(showDone, 300);
    }
  }

  function setActive(next, movingDown) {
    model.active = next;
    // 「滑过去不算」：只把浏览位置记下来，不写学习记录
    if (model.mode === 'today') trackCursor();
    updateKeys();
  }

  function trackCursor() {
    const el = model.cards[model.active];
    if (!el || el.classList.contains('is-rated')) return;
    const w = model.byId[el.dataset.id];
    if (!w) return;
    if (!model.state.words[w.id] && (w.rank || 0) > (model.state.stats.cursorRank || 0)) {
      model.state.stats.cursorRank = w.rank || 0;
      saveSoon();
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      const h = feed.clientHeight || window.innerHeight;
      if (!h) return;
      let idx = Math.round(feed.scrollTop / h);
      idx = Math.max(0, Math.min(idx, model.cards.length - 1));
      if (idx !== model.active) setActive(idx, idx > model.active);
      if (idx + 6 >= model.rendered && model.rendered < model.queue.length) renderChunk();
    });
  }

  /* ---------- 收藏 ---------- */
  function toggleFav(btn) {
    const id = btn.dataset.fav;
    if (!id) return;
    model.state.favs = model.state.favs || {};
    const on = !model.state.favs[id];
    if (on) model.state.favs[id] = true; else delete model.state.favs[id];
    btn.textContent = on ? '★' : '☆';
    btn.classList.toggle('is-on', on);
    save();
    updateFavLabel();
    const w = model.byId[id];
    toast(on ? '已收藏 ' + (w ? w.w : id) : '已取消收藏');
  }

  function loadQueue(ids) {
    model.queue = ids;
    model.rendered = 0;
    model.cards = [];
    model.active = 0;
    feed.innerHTML = '';
    feed.scrollTop = 0;
    if (!ids.length) return;
    renderChunk();
    updateKeys();
  }

  function enterFav() {
    model.state.favs = model.state.favs || {};
    const ids = Object.keys(model.state.favs).filter(function (id) { return !!model.byId[id]; });
    if (!ids.length) { toast('还没有收藏的词：点卡片右上角 ☆'); return; }
    ids.sort(function (a, b) { return (model.byId[a].rank || 0) - (model.byId[b].rank || 0); });
    model.mode = 'fav';
    $('settings').hidden = true;
    $('backBtn').hidden = false;
    document.body.classList.add('mode-fav');
    loadQueue(ids);
    updateTop();
    countLabel.textContent = '收藏 ' + ids.length + ' 个';
    progressFill.style.width = '100%';
  }

  function exitFav() {
    model.mode = 'today';
    $('backBtn').hidden = true;
    document.body.classList.remove('mode-fav');
    loadQueue(buildQueue(model.words, model.state, model.today, model.state.settings.dailyNew));
    updateTop();
  }

  /* ---------- 完成页 ---------- */
  function showDone() {
    const done = countDoneToday(model.state, model.today);
    const dueTomorrow = countDue(model.words, model.state, addDays(model.today, 1));
    $('doneCount').textContent = done;
    $('doneStreak').textContent = model.state.stats.streak || 0;
    $('doneDue').textContent = dueTomorrow;
    $('doneTip').textContent = dueTomorrow > 0
      ? '明天有 ' + dueTomorrow + ' 个词会到期，别断。'
      : '明天没有到期的词，可以只学新词。';
    $('doneScreen').hidden = false;
    updateTop();
  }

  function moreWords(n) {
    const ids = nextFreshIds(model.words, model.state, model.queue, n);
    if (!ids.length) { toast('词库里的词都学过了，去 words.js 里加词吧'); return; }
    const start = model.queue.length;
    model.queue = model.queue.concat(ids);
    model.state.stats.todayTotal = (model.state.stats.todayTotal || 0) + ids.length;
    save();
    $('doneScreen').hidden = true;
    renderChunk();
    updateTop();
    requestAnimationFrame(function () { scrollToIndex(start); });
  }

  /* ---------- 设置 ---------- */
  function syncSettingsUI() {
    document.body.dataset.fs = model.state.settings.fontSize;
    document.querySelectorAll('[data-setting="dailyNew"] .seg__btn').forEach(function (b) {
      b.classList.toggle('is-on', Number(b.dataset.value) === model.state.settings.dailyNew);
    });
    document.querySelectorAll('[data-setting="fontSize"] .seg__btn').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.value === model.state.settings.fontSize);
    });
  }

  function exportBackup() {
    try {
      const blob = new Blob([JSON.stringify(model.state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cet6-progress-' + model.today + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('已导出进度文件');
    } catch (e) {
      toast('导出失败，换个浏览器试试');
    }
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object' || !data.words || typeof data.words !== 'object') {
          throw new Error('bad file');
        }
        if (!confirm('导入会覆盖当前进度，确定吗？')) return;
        localStorage.setItem(KEY, JSON.stringify(data));
        location.reload();
      } catch (e) {
        toast('这个文件不像进度备份，导入失败');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- 事件绑定 ---------- */
  feed.addEventListener('scroll', onScroll, { passive: true });

  feed.addEventListener('click', function (e) {
    const favBtn = e.target.closest('.fav');
    if (favBtn) {
      e.stopPropagation();
      toggleFav(favBtn);
      return;
    }
    const speakBtn = e.target.closest('.speak');
    if (speakBtn) {
      e.stopPropagation();
      speak(speakBtn.dataset.speak);
      return;
    }
  });

  keys.addEventListener('click', function (e) {
    const btn = e.target.closest('.key');
    if (!btn) return;
    rate(btn.dataset.rating);
  });

  $('gearBtn').addEventListener('click', function () {
    updateFavLabel();
    $('settings').hidden = false;
  });
  $('favBtn').addEventListener('click', enterFav);
  $('backBtn').addEventListener('click', exitFav);
  $('closeSettings').addEventListener('click', function () {
    $('settings').hidden = true;
  });
  $('settings').addEventListener('click', function (e) {
    if (e.target.id === 'settings') $('settings').hidden = true;
  });

  document.querySelectorAll('[data-setting="dailyNew"] .seg__btn').forEach(function (b) {
    b.addEventListener('click', function () {
      const v = Number(b.dataset.value);
      model.state.settings.dailyNew = v;
      save();
      syncSettingsUI();
      toast(v ? '每日新词改为 ' + v + ' 个，明天生效' : '已改为不限每日新词，明天生效');
    });
  });
  document.querySelectorAll('[data-setting="fontSize"] .seg__btn').forEach(function (b) {
    b.addEventListener('click', function () {
      model.state.settings.fontSize = b.dataset.value;
      save();
      syncSettingsUI();
    });
  });
  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-fs-btn]');
    if (!t) return;
    model.state.settings.fontSize = t.dataset.fsBtn;
    document.body.dataset.fs = t.dataset.fsBtn;
  });

  $('exportBtn').addEventListener('click', exportBackup);
  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function (e) {
    importBackup(e.target.files && e.target.files[0]);
    e.target.value = '';
  });
  $('resetBtn').addEventListener('click', function () {
    if (!confirm('清空所有学习进度？这个操作不能撤销，建议先导出备份。')) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
    location.reload();
  });

  $('moreBtn').addEventListener('click', function () { moreWords(20); });
  $('closeDone').addEventListener('click', function () { $('doneScreen').hidden = true; });

  // 桌面端调试：↓ 下一个 / ↑ 上一个 / 空格翻面 / 1 2 3 评分
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'Enter') {
      const el = model.cards[model.active];
      if (el) { e.preventDefault(); speak(el.dataset.id); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); scrollToIndex(Math.min(model.active + 1, model.cards.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); scrollToIndex(Math.max(model.active - 1, 0));
    } else if (e.key === '1') { rate('again'); }
    else if (e.key === '2') { rate('hard'); }
    else if (e.key === '3') { rate('good'); }
  });

  /* ---------- 启动 ---------- */
  function init() {
    // words.js 用 const 声明，属于全局词法绑定，不挂在 window 上
    const rawWords = (typeof CET6_WORDS !== 'undefined') ? CET6_WORDS : (window.CET6_WORDS || []);
    const words = validateWords(rawWords);
    if (!words.length) {
      document.body.innerHTML =
        '<div class="fatal">词库是空的：请检查 words.js 里的 CET6_WORDS 是否存在且字段完整。</div>';
      return;
    }
    model.words = words;
    words.forEach(function (w) { model.byId[w.id] = w; });

    // 同义索引：释义完全相同的词
    model.senseIndex = new Map();
    words.forEach(function (w) {
      w.cn.forEach(function (sn) {
        if (!sn) return;
        if (!model.senseIndex.has(sn)) model.senseIndex.set(sn, []);
        const arr = model.senseIndex.get(sn);
        if (arr.length < 60) arr.push(w);
      });
    });
    model.today = todayStr();
    model.state = loadState();
    const dn = Number(model.state.settings.dailyNew);
    model.state.settings.dailyNew = (isFinite(dn) && dn >= 0) ? Math.min(500, dn) : 0;
    document.body.dataset.fs = model.state.settings.fontSize;

    // 跨天：只重置“今天”的计数，不动任何词的进度
    if (model.state.stats.lastDay !== model.today) {
      model.state.stats.lastDay = model.today;
      model.state.stats.todayTotal = 0;
    }

    model.queue = buildQueue(words, model.state, model.today, model.state.settings.dailyNew);
    if (!model.state.stats.todayTotal) {
      model.state.stats.todayTotal = model.queue.length + countDoneToday(model.state, model.today);
    }
    save();

    syncSettingsUI();
    updateFavLabel();
    updateTop();

    if (!model.queue.length) {
      showDone();
      return;
    }

    renderChunk();
    model.active = 0;
    updateKeys();
  }

  init();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

/* 供 Node 测试使用（浏览器里 module 不存在，不会执行） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STEPS: STEPS,
    todayStr: todayStr,
    addDays: addDays,
    intervalOf: intervalOf,
    ratingToStage: ratingToStage,
    applyRating: applyRating,
    markStudy: markStudy,
    buildQueue: buildQueue,
    nextFreshIds: nextFreshIds,
    countDue: countDue,
    countDoneToday: countDoneToday,
    validateWords: validateWords,
    defaultState: defaultState
  };
}
