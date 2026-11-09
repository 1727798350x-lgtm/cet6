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
    settings: { dailyNew: 0, fontSize: 'm', onlineAudio: true },  // dailyNew 0 = 不限；onlineAudio = 系统语音不可用时联网发音
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
    out.settings.onlineAudio = out.settings.onlineAudio !== false;
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
  const track = $('track');
  const keys = $('keys');
  const favKey = $('favKey');
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
  const audio = {
    ready: false,
    voice: null,
    seq: 0,           // 每次发音自增，过期的回调直接作废
    started: false,   // 系统语音是否真的开始发声
    onlineStarted: false,
    ttsTimer: 0,
    player: null      // 在线发音用的 <audio>
  };

  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const list = speechSynthesis.getVoices() || [];
    const en = list.filter(function (v) { return /^en[-_]/i.test(v.lang); });
    const us = en.filter(function (v) { return /US/i.test(v.lang); });
    return us[0] || en[0] || null;
  }

  function stopAudio() {
    clearTimeout(audio.ttsTimer);
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
    if (audio.player) {
      try { audio.player.pause(); } catch (e) { /* 忽略 */ }
      audio.player = null;
    }
  }

  // 系统语音不可用时的兜底：联网播放发音（有道词典音频，https，一个词约 10KB）
  function playOnline(text, seq) {
    if (seq !== audio.seq) return;
    if (!(model.state && model.state.settings.onlineAudio)) {
      toast('手机缺英语语音包，可在系统设置 → 文字转语音 里安装');
      return;
    }
    try {
      if (audio.player) { try { audio.player.pause(); } catch (e) { /* 忽略 */ } }
      const a = new Audio('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=2');
      a.preload = 'auto';
      a.volume = 1;
      audio.player = a;
      audio.onlineStarted = false;
      a.onerror = function () {
        if (seq !== audio.seq) return;
        toast('发音失败：系统语音不可用，在线发音也没连上，检查一下网络');
      };
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(function () {
          if (seq === audio.seq) audio.onlineStarted = true;
        }).catch(function () {
          /* 被自动播放策略拦了：点一下卡片上的小喇叭即可 */
        });
      }
    } catch (e) { /* 忽略 */ }
  }

  function speak(text) {
    if (!text) return;
    const seq = ++audio.seq;
    audio.started = false;
    audio.onlineStarted = false;
    stopAudio();
    if (!window.speechSynthesis) { playOnline(text, seq); return; }
    const voices = speechSynthesis.getVoices() || [];
    const hasEnglish = voices.some(function (v) { return /^en[-_]/i.test(v.lang); });
    // 装了语音引擎但只有中文音色：直接在线发音，免得把英文读成怪音
    if (voices.length && !hasEnglish) { playOnline(text, seq); return; }
    try {
      if (!audio.voice) audio.voice = pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      if (audio.voice) u.voice = audio.voice;
      u.onstart = function () {
        if (seq !== audio.seq) return;
        audio.started = true;
        clearTimeout(audio.ttsTimer);
      };
      u.onerror = function () {
        if (seq !== audio.seq) return;
        clearTimeout(audio.ttsTimer);
        playOnline(text, seq);
      };
      // 安卓部分机型 cancel() 后紧接着 speak() 会没声音，隔一小会儿再读
      setTimeout(function () {
        if (seq !== audio.seq) return;
        try {
          speechSynthesis.speak(u);
        } catch (e) {
          playOnline(text, seq);
          return;
        }
        // 900ms 内没开始发声也没报错 → 认为系统语音哑了，改用在线发音
        audio.ttsTimer = setTimeout(function () {
          if (seq !== audio.seq || audio.started) return;
          if (!speechSynthesis.speaking && !speechSynthesis.pending) playOnline(text, seq);
        }, 900);
      }, 50);
    } catch (e) {
      playOnline(text, seq);
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

  // 设置里的「测试发音」：把诊断结果直接告诉用户
  function testSpeak() {
    const list = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const en = list.filter(function (v) { return /^en[-_]/i.test(v.lang); });
    speak('hello');
    setTimeout(function () {
      let how;
      if (audio.started) how = '系统语音正常';
      else if (audio.onlineStarted) how = '系统语音不可用，已改用在线发音';
      else how = '没发声：先检查媒体音量/静音，再到系统设置 → 文字转语音 里装英语语音包（或打开在线发音兜底）';
      toast('语音 ' + list.length + ' 个（英文 ' + en.length + ' 个）｜' + how);
    }, 1500);
  }

  /* ---------- 自动发音 ---------- */
  // 换到新单词时自动读一遍；连续快速滑动只读最后停下的那个词
  let autoSpeakTimer = 0;
  function speakCurrent() {
    clearTimeout(autoSpeakTimer);
    autoSpeakTimer = setTimeout(function () {
      const el = model.cards[model.active];
      if (!el) return;
      const w = model.byId[el.dataset.id];
      if (w && w.w) speak(w.w);
    }, 180);
  }

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
    track.appendChild(frag);
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
    updateFavKey();
  }

  function updateFavKey() {
    if (!favKey) return;
    const el = model.cards[model.active];
    const id = el && el.dataset.id;
    const on = !!(id && model.state.favs && model.state.favs[id]);
    favKey.classList.toggle('is-on', on);
    favKey.textContent = on ? '★ 已收藏' : '☆ 收藏';
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

  /* ---------- 平移引擎：一屏一张，滑一下就切一张 ---------- */
  const view = {
    pos: 0,          // 当前视觉位置（卡片索引，拖动时是小数）
    pitch: 0,        // 一张卡的高度（缓存；iOS 工具栏伸缩后要重算）
    pitchDirty: false,
    dragging: false,
    mode: '',        // '' | 'pending' | 'inner' | 'paging'
    startY: 0,
    startPos: 0,
    lastY: 0,
    lastT: 0,
    vel: 0,          // 手指速度 px/ms，向上为负
    inner: null      // 当前卡片正文能不能上下滚
  };

  // 一屏的距离以卡片自身高度为准（100dvh 可能和 feed 的可视高度差几像素）
  function feedHeight() {
    if (view.pitch > 0) return view.pitch;
    const a = model.cards[0];
    const b = model.cards[1];
    const d = (a && b) ? (b.offsetTop - a.offsetTop) : 0;
    view.pitch = d > 0 ? d : ((a && a.offsetHeight) || feed.clientHeight || window.innerHeight || 1);
    return view.pitch;
  }

  function applyPos(pos, animate) {
    view.pos = pos;
    track.style.transition = animate ? 'transform 300ms cubic-bezier(.22,.86,.24,1)' : 'none';
    track.style.transform = 'translate3d(0,' + (-pos * feedHeight()).toFixed(2) + 'px,0)';
  }

  function readPos() {
    const t = window.getComputedStyle(track).transform;
    if (!t || t === 'none') return view.pos;
    const m = /matrix(?:3d)?\(([^)]+)\)/.exec(t);
    if (!m) return view.pos;
    const n = m[1].split(',').map(Number);
    const ty = n.length > 6 ? n[13] : n[5];
    return -ty / feedHeight();
  }

  function bodyOf(el) {
    return el ? el.querySelector('.card__body') : null;
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

  function commitActive(index) {
    model.active = index;
    // 「滑过去不算」：只把浏览位置记下来，不写学习记录
    if (model.mode === 'today') trackCursor();
    updateKeys();
  }

  // 切到第 index 张：renderChunk 预渲染、按钮状态、自动发音都在这里
  function goTo(index, animate) {
    if (!model.cards.length) { applyPos(0, false); return; }
    const target = Math.max(0, Math.min(model.cards.length - 1, index));
    if (target !== model.active) {
      if (target + 6 >= model.rendered && model.rendered < model.queue.length) renderChunk();
      commitActive(target);
      speakCurrent();
    }
    applyPos(target, animate !== false);
  }

  function rate(rating) {
    if (model.lock || view.dragging) return;
    const el = model.cards[model.active];
    if (!el) return;
    applyRate(el, rating);
    model.lock = true;
    setTimeout(function () { model.lock = false; }, 320);

    const next = model.active + 1;
    if (next < model.queue.length) {
      if (next >= model.rendered) renderChunk();
      goTo(next, true);
    } else if (model.mode === 'fav') {
      toast('收藏夹到头了，点左上角回到今天');
    } else {
      setTimeout(showDone, 300);
    }
  }

  /* ---------- 手势：上滑 → 下一个词（下滑回上一个） ---------- */
  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      // 多指（捏合/误触）：放弃这次拖动，回到已经确认的那一张
      if (view.dragging) {
        view.dragging = false;
        view.mode = '';
        goTo(model.active, true);
      }
      return;
    }
    const t = e.touches[0];
    view.dragging = true;
    view.mode = 'pending';
    view.startY = view.lastY = t.clientY;
    view.lastT = Date.now();
    view.vel = 0;
    view.startPos = readPos();
    applyPos(view.startPos, false);
    const body = bodyOf(model.cards[model.active]);
    view.inner = body ? {
      down: body.scrollHeight - body.clientHeight - body.scrollTop > 3,
      up: body.scrollTop > 3
    } : null;
  }

  function onTouchMove(e) {
    if (!view.dragging) return;
    if (e.touches.length !== 1) {
      // 中途多指：放弃这次手势，回到已经确认的那一张
      view.dragging = false;
      view.mode = '';
      if (model.cards.length) goTo(model.active, true);
      return;
    }
    if (!model.cards.length) return;
    const t = e.touches[0];
    const now = Date.now();
    const dt = now - view.lastT;
    if (dt > 0) view.vel = (t.clientY - view.lastY) / dt;
    view.lastY = t.clientY;
    view.lastT = now;
    const dy = t.clientY - view.startY;

    if (view.mode === 'pending') {
      if (Math.abs(dy) < 2) return;
      // 正文比一屏长时才需要让原生滚动先接管；一般卡片正文不会溢出
      if (view.inner && (view.inner.down || view.inner.up)) {
        if (Math.abs(dy) < 7) return;
        if ((dy < 0 && view.inner.down) || (dy > 0 && view.inner.up)) {
          view.mode = 'inner';
          return;
        }
      }
      view.mode = 'paging';
    }
    if (view.mode !== 'paging') return;
    // 尽早拦截：iOS 一旦先开始原生滚动，后面的 touchmove 就不可取消了
    if (e.cancelable) e.preventDefault();

    const h = feedHeight();
    let pos = view.startPos - dy / h;
    const max = model.cards.length - 1;
    if (pos < 0) pos *= 0.32;                          // 第一张继续往下滑：橡皮筋
    else if (pos > max) pos = max + (pos - max) * 0.32; // 最后一张继续往上滑：橡皮筋
    applyPos(pos, false);
  }

  function onTouchEnd() {
    if (!view.dragging) { view.mode = ''; return; }
    view.dragging = false;
    const wasPaging = view.mode === 'paging';
    view.mode = '';
    // 拖动途中视口变了（地址栏伸缩/横屏）：回位重算，别按旧尺子切页
    if (view.pitchDirty) {
      view.pitchDirty = false;
      view.pitch = 0;
      goTo(model.active, true);
      return;
    }
    // 只是点了一下（或卡片正文在滚动）：确保停在整张卡片的位置
    if (!wasPaging) { goTo(model.active, true); return; }

    const h = feedHeight();
    const dist = (view.startY - view.lastY) / h; // > 0 表示手指往上（切下一个）
    const speed = -view.vel;                     // 手指往上甩 → 正数
    // 用「上一张已确定的卡」作基准：动画还没走完就接着滑，也不会丢步
    const base = model.active;
    let target = base;
    if (dist > 0.015 && (dist > 0.09 || speed > 0.45)) target = base + 1;
    else if (dist < -0.015 && (dist < -0.09 || speed < -0.45)) target = base - 1;
    goTo(target, true);
  }

  // 系统打断（来电/返回手势/切后台）：不算用户松手，回位不切页
  function onTouchCancel() {
    if (!view.dragging) { view.mode = ''; return; }
    view.dragging = false;
    view.mode = '';
    if (view.pitchDirty) {
      view.pitchDirty = false;
      view.pitch = 0;
    }
    goTo(model.active, true);
  }

  let wheelAcc = 0;
  let wheelLockedUntil = 0;
  function onWheel(e) {
    if (!model.cards.length) return;
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;             // 按“行”滚的浏览器
    else if (e.deltaMode === 2) d *= feedHeight(); // 按“页”滚的浏览器
    wheelAcc += d;
    const now = Date.now();
    if (now < wheelLockedUntil) return;          // 保留惯性，等冷却结束再判
    if (Math.abs(wheelAcc) >= 20) {
      goTo(model.active + (wheelAcc > 0 ? 1 : -1), true);
      wheelAcc = 0;
      wheelLockedUntil = now + 240;
    }
  }

  /* ---------- 收藏 ---------- */
  function setFav(id, on) {
    if (!id) return;
    model.state.favs = model.state.favs || {};
    if (on) model.state.favs[id] = true; else delete model.state.favs[id];
    const el = model.cards[model.active];
    if (el && el.dataset.id === id) {
      const b = el.querySelector('.fav');
      if (b) {
        b.textContent = on ? '★' : '☆';
        b.classList.toggle('is-on', on);
      }
    }
    save();
    updateFavLabel();
    updateFavKey();
    const w = model.byId[id];
    toast(on ? '已收藏 ' + (w ? w.w : id) : '已取消收藏');
  }

  function toggleFavBtn(btn) {
    const id = btn.dataset.fav;
    if (!id) return;
    setFav(id, !(model.state.favs && model.state.favs[id]));
  }

  function loadQueue(ids) {
    model.queue = ids;
    model.rendered = 0;
    model.cards = [];
    model.active = 0;
    track.innerHTML = '';
    view.pos = 0;
    view.pitch = 0;
    if (!ids.length) { applyPos(0, false); return; }
    renderChunk();
    updateKeys();
    applyPos(0, false);
    speakCurrent();
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
    requestAnimationFrame(function () { goTo(start, true); });
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
    document.querySelectorAll('[data-setting="onlineAudio"] .seg__btn').forEach(function (b) {
      b.classList.toggle('is-on', (b.dataset.value === '1') === !!model.state.settings.onlineAudio);
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
  feed.addEventListener('touchstart', onTouchStart, { passive: true });
  feed.addEventListener('touchmove', onTouchMove, { passive: false });
  feed.addEventListener('touchend', onTouchEnd, { passive: true });
  feed.addEventListener('touchcancel', onTouchCancel, { passive: true });
  feed.addEventListener('wheel', onWheel, { passive: false });

  // 视口变化（iPhone 地址栏伸缩 / 横竖屏）后重新对齐一屏距离
  function relayout() {
    if (view.dragging) { view.pitchDirty = true; return; }
    view.pitchDirty = false;
    view.pitch = 0;
    applyPos(model.active, false);
  }
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);

  feed.addEventListener('click', function (e) {
    if (view.dragging) return; // 正拖着卡片时另一根手指点的，忽略
    const favBtn = e.target.closest('.fav');
    if (favBtn) {
      e.stopPropagation();
      toggleFavBtn(favBtn);
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
    if (view.dragging) return;
    const btn = e.target.closest('.key');
    if (!btn) return;
    if (btn.dataset.rating) { rate(btn.dataset.rating); return; }
    if (btn.dataset.action === 'fav') {
      const el = model.cards[model.active];
      if (!el) return;
      const id = el.dataset.id;
      setFav(id, !(model.state.favs && model.state.favs[id]));
    }
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
  document.querySelectorAll('[data-setting="onlineAudio"] .seg__btn').forEach(function (b) {
    b.addEventListener('click', function () {
      model.state.settings.onlineAudio = b.dataset.value === '1';
      save();
      syncSettingsUI();
      toast(model.state.settings.onlineAudio
        ? '已打开在线发音兜底：系统语音没声音时自动联网发音'
        : '已关闭在线发音兜底：只使用手机系统语音');
    });
  });
  if ($('testSpeakBtn')) $('testSpeakBtn').addEventListener('click', testSpeak);
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

  // 桌面端调试：↓ 下一个 / ↑ 上一个 / 空格朗读 / 1 忘了 2 收藏 3 记得
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'Enter') {
      const el = model.cards[model.active];
      const w = el && model.byId[el.dataset.id];
      if (w) { e.preventDefault(); speak(w.w); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); goTo(model.active + 1, true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); goTo(model.active - 1, true);
    } else if (e.key === '1') { rate('again'); }
    else if (e.key === '2') {
      const el = model.cards[model.active];
      if (el) setFav(el.dataset.id, !(model.state.favs && model.state.favs[el.dataset.id]));
    }
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
    applyPos(0, false);
    speakCurrent();
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
