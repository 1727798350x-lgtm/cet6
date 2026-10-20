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
const MAX_CARDS = 300;
const CHUNK = 24;
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
  const fresh = [];
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

  const out = [];

  // 前 3 张：最熟的复习词
  const warm = due.slice().sort(function (a, b) {
    return (b.stage || 0) - (a.stage || 0);
  }).slice(0, 3).map(function (x) { return x.id; });
  warm.forEach(function (id) { out.push(id); });

  const restDue = due.map(function (x) { return x.id; }).filter(function (id) {
    return warm.indexOf(id) === -1;
  });
  const newIds = fresh.slice(0, Math.max(0, dailyNew | 0)).map(function (w) { return w.id; });

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
    settings: { dailyNew: 30, fontSize: 'm' },
    stats: { streak: 0, lastStudy: '', lastDay: '', todayTotal: 0 },
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
    out.settings.dailyNew = Math.min(80, Math.max(5, Number(out.settings.dailyNew) || 30));
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
    toastTimer: 0
  };

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

  /* ---------- 渲染 ---------- */
  function cardHTML(w) {
    return '' +
      '<div class="card__inner">' +
        '<div class="card__face card__front">' +
          '<div class="card__word">' + esc(w.w) + '</div>' +
          '<div class="card__ipa">' + esc(w.ipa) + '</div>' +
          '<div class="card__hint">先想一下意思</div>' +
          '<div class="card__tap">点卡片看释义</div>' +
        '</div>' +
        '<div class="card__face card__back">' +
          '<div class="back__head">' +
            '<span class="back__word">' + esc(w.w) + '</span>' +
            '<span class="back__ipa">' + esc(w.ipa) + '</span>' +
            '<button class="speak" data-speak="' + esc(w.w) + '" aria-label="朗读单词">' +
              '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
                '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>' +
                '<path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
                '<path d="M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="back__pos">' + esc(w.pos) + '</div>' +
          '<div class="back__cn">' + esc(w.cn.join('；')) + '</div>' +
          '<div class="back__rule"></div>' +
          '<div class="back__ex">' + esc(w.ex) + '</div>' +
          '<div class="back__excn">' + esc(w.exCn) + '</div>' +
          (w.root ? '<div class="back__root">' + esc(w.root) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card__flag" aria-hidden="true"></div>';
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
      el.innerHTML = cardHTML(w);
      frag.appendChild(el);
      model.cards.push(el);
    }
    model.rendered = end;
    feed.appendChild(frag);
  }

  /* ---------- 顶部进度 ---------- */
  function updateTop() {
    const done = countDoneToday(model.state, model.today);
    const total = Math.max(model.state.stats.todayTotal || 0, done, 1);
    countLabel.textContent = done + ' / ' + total;
    progressFill.style.width = Math.min(100, (done / total) * 100) + '%';
    dayLabel.textContent = '今天 · ' + model.today.slice(5).replace('-', '/');
  }

  /* ---------- 三键状态 ---------- */
  function updateKeys() {
    const el = model.cards[model.active];
    const flipped = !!(el && el.classList.contains('is-back'));
    keys.classList.toggle('is-locked', !flipped);
    keyBtns.forEach(function (b) { b.disabled = !flipped; });
    keyHint.textContent = flipped ? '这张你记住了吗？' : '先点卡片看释义，再评分';
  }

  /* ---------- 卡片交互 ---------- */
  function toggleFlip(card) {
    // 只允许「正面 → 背面」：翻开后点内容是为了滚动，不能再误触翻回去
    if (card.classList.contains('is-rated')) return;
    if (card.classList.contains('is-back')) return;
    card.classList.add('is-back');
    updateKeys();
  }

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
    if (!el || !el.classList.contains('is-back')) return;
    applyRate(el, rating);
    model.lock = true;
    setTimeout(function () { model.lock = false; }, 340);

    const next = model.active + 1;
    if (next < model.queue.length) {
      if (next >= model.rendered) renderChunk();
      requestAnimationFrame(function () { scrollToIndex(next); });
    } else {
      setTimeout(showDone, 300);
    }
  }

  function setActive(next, movingDown) {
    const prev = model.active;
    if (movingDown && prev >= 0) {
      const prevEl = model.cards[prev];
      // 没翻面就滑过去了 → 记为“模糊”（这就是“刷”的主路径）
      if (prevEl && !prevEl.classList.contains('is-rated')) applyRate(prevEl, 'hard');
    }
    model.active = next;
    updateKeys();
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
    const speakBtn = e.target.closest('.speak');
    if (speakBtn) {
      e.stopPropagation();
      speak(speakBtn.dataset.speak);
      return;
    }
    const card = e.target.closest('.card');
    if (card) toggleFlip(card);
  });

  keys.addEventListener('click', function (e) {
    const btn = e.target.closest('.key');
    if (!btn) return;
    rate(btn.dataset.rating);
  });

  $('gearBtn').addEventListener('click', function () {
    $('settings').hidden = false;
  });
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
      toast('每日新词改为 ' + v + '，明天生效');
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
      if (el) { e.preventDefault(); toggleFlip(el); }
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
    model.today = todayStr();
    model.state = loadState();
    model.state.settings.dailyNew = Math.min(80, Math.max(5, Number(model.state.settings.dailyNew) || 30));
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
