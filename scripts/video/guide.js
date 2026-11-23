// Step-by-step guide for Supervisors: from logging in to using the data after the review.
// Real screens (fictional data) with a moving cursor, spotlight and a side panel: what to do, and why it matters.
import { H, W, camera, clamp, cursor, ease, images, lerp, paragraph, ripple, roundRect, seg, spotlight, text, wrap } from './engine.js';

const RED = '#C8102E';
const BLUE = '#2A5BD7';
const INK = '#101828';
const MUTED = '#5D6B82';
const NAVY = '#0E1B33';
const VIEW = { x: 48, y: 180, w: 1380, h: 1380 * 1031 / 1920, r: 16 };
const PANEL = { x: 1460, y: 180, w: 412 };

const CHAPTERS = ['開始之前', '登入與首頁', '選出關鍵人才', '逐題填寫', '檢查與提交', '與 HRBP 討論', '用數據帶團隊', '盤點之後'];

/* ------------------------------------------------------------------ storyboard */
// kind: 'title' | 'chapter' | 'card' | 'step' | 'end'
const S = [];
const chapter = (n) => S.push({ kind: 'chapter', ch: n, dur: 1.5 });
const card = (ch, title, items, foot, dur = 8) => S.push({ kind: 'card', ch, title, items, foot, dur });
const step = (ch, img, focus, title, body, why, o = {}) => S.push({ kind: 'step', ch, img, focus, title, body, why, ...o });
// Quick beat: one line, 3.5 s. Used for the simpler questions and pure clicks.
const quick = (ch, img, focus, title, body, o = {}) => step(ch, img, focus, title, body, null, { dur: 3.5, ...o });

S.push({ kind: 'title', ch: -1, dur: 4 });

chapter(0);
card(0, '為什麼要做人才盤點', [
  ['看見', '找出需要重點培養的關鍵人才。'],
  ['留住', '提早發現流失風險，先採取行動。'],
  ['接得上', '確認關鍵職位空出來時有人接手。'],
], '不評分、不排名、不設比例。每位約 15 分鐘，可以分次填寫。');

chapter(1);
step(1, 't02', 'button', '用工號與 PIN 登入', '輸入工號與 HR 提供的 PIN，按「登入」。', 'PIN 只給本人使用，請勿轉交。', { click: true });
quick(1, 't03', 'card', '第一次登入：4 步導覽', '之後可以從首頁的「說明」再看一次。');
step(1, 't04', 'deadline', '首頁：截止日與進度', '上方是截止日與進度，下方是部屬名單。', '每天安排 2～3 位，品質比最後一天趕完好。');

chapter(2);
quick(2, 't04', 'start', '按「開始選出關鍵人才」', '由你決定誰需要重點關注。', { click: true });
step(2, 't05', 'first', '勾選關鍵人才', '依業務需要決定，不設人數或比例。', '不是績效排名，是「他離開或停止成長，團隊會受明顯影響」的人。');
step(2, 't06', 'reasons', '選原因，開始填寫', '每位至少選一個原因，再按「儲存並開始填寫」。', '原因會匯總成全廠的「為什麼是關鍵人才」。', { pointer: 'continue', click: true });

chapter(3);
const key = (n, img, focus, title, body, why, o) => step(3, img, focus, `第 ${n} 題　${title}`, body, why, o);
const fast = (n, img, focus, title, body) => quick(3, img, focus, `第 ${n} 題　${title}`, body);
key(1, 't101', 'field', '關鍵職位', '這個位子空出來，會直接影響交期、品質或客戶嗎？', '選「是」，第 10 題要填接班人。');
key(2, 't102', 'guide', '績效強項', '不確定怎麼寫，點燈泡看好範例與常見陷阱。', '寫具體事例，討論時才有共同依據。');
fast(3, 't103', 'field', 'PBM 文化強項', '選 1～3 項 Our Values，各寫一句具體行為。');
fast(4, 't104', 'field', 'PBM 改善機會', '選 1～3 項，寫下可以改變的行為。');
fast(5, 't105', 'field', '發展領域', '寫 1～3 個要加強的能力或經驗。');
fast(6, 't106', 'field', '個人職涯期望', '寫本人的想法；還沒談過就勾「尚未與本人討論」。');
fast(7, 't107', 'field', '下一個職位', '填可能的下一個職位與準備度。');
fast(8, 't108', 'field', '流動意願', '是否願意調動職務或地點，以及時間。');
key(9, 't109', 'field', '留任風險', '選高、中、低，勾最多 2 個主要原因。', '高風險 × 關鍵職位，會列為優先處理。');
key(10, 't110', 'field', '接班人', '列出接班人與準備度；沒有人選就選 TBH。', '回答：這個位子明天空出來，有人接嗎？');
key(11, 't111', 'field', '發展計畫', '依 70/20/10 寫目標、行動、負責人與日期。', '70% 從工作中學，比上課更有效。');
fast(12, 't112', 'field', '其他補充', '需要 HR 或上一級 Supervisor 知道的事。');

chapter(4);
step(4, 't20', 'done', '填完看摘要', '「已儲存」代表已自動存檔，可以隨時離開。', null);
step(4, 't21', 'warning', '提交前：品質提醒', '系統提醒容易遺漏的地方；不會擋住提交，請逐條確認。', null);
quick(4, 't22', 'submit', '勾「我已確認」，提交給 HR', '整個團隊一次提交。', { click: true });
step(4, 't23', 'focus', '提交後：預約 HRBP 討論', '系統整理討論焦點，請填入討論日期。', '提交後唯讀；要修改請按「申請修改」。');

chapter(5);
card(5, '與 HRBP 討論，完成定稿', [
  ['預約', '提交後填入討論日期。'],
  ['討論', '與 HRBP、上一級 Supervisor 確認描述是否一致。'],
  ['定稿', 'HR 確認後鎖定。'],
], '校準的是描述是否一致，不是比較或排名。');

chapter(6);
quick(6, 'd01', 'nav', '左側選單切換頁面', '我的團隊、我的組織線、儀表板。');
step(6, 'd02', null, '我的組織線（唯讀）', '帶領其他 Supervisor 時，可在這裡檢視下屬團隊。', '不需要在系統核准，對齊在 HRBP 討論中進行。');
step(6, 'd03', 'kpis', '總覽：五個核心數字', '灰底是全廠對照；「本期重點」整理出最需要注意的事。', null);
step(6, 'd04', 'panel', '每張圖都有引導提問', '看懂現況 → 找出原因 → 決定行動。', '不知道下一句怎麼問時，從這裡開始。', { click: true, pointer: 'probe' });
step(6, 'd05b', 'cell', '點數字，直接看名單', '先看「高 × 關鍵職位」，點進去打開名單與個人檔案。', null, { click: true });
step(6, 'd06b', 'prep', '個人檔案：對話準備', '依填寫內容，挑出可以問的問題。', '是可以問的問題，不是對人的結論。');
step(6, 'd07', 'tabs', '接班梯隊', '黃色長期、紅色無人，就是接班缺口。', '優先指定接班人，或提早規劃招募。');
step(6, 'd09', 'tabs', '職涯與發展', '內部人才庫與發展計畫的執行狀態。', '開缺前，先看內部人選。');

chapter(7);
card(7, '盤點之後，真正的工作才開始', [
  ['兩週內', '和中高風險、還沒談過職涯的人聊 15 分鐘。'],
  ['每一季', '檢視發展計畫的進度。'],
  ['開缺時', '先看接班人與內部人才庫。'],
], '人才發展，發生在盤點之後的每一次對話。');

S.push({ kind: 'end', ch: 8, dur: 4 });

// Time on screen follows the amount of text: reading at 8 characters a second plus 0.8 s, 3.5–7 s.
// Text appears together with the camera move, so the reader is never waiting for the animation.
const chars = (x) => (x.title?.length ?? 0) + (x.body?.length ?? 0) + (x.why?.length ?? 0);
for (const x of S) if (!x.dur) x.dur = clamp(chars(x) / 8 + 0.8, 3.5, 7);
let acc = 0;
for (const x of S) { x.start = acc; acc += x.dur; }
export const DURATION = acc;

export const MUSIC = {
  duration: DURATION, bpm: 84, master: 0.32, drums: true,
  chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [52, 55, 59]],
  energy: () => 0.32, hits: [], risers: [],
};

/* ------------------------------------------------------------------ drawing */
function header(ctx, ch) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, 76);
  ctx.fillStyle = '#E4E8F0'; ctx.fillRect(0, 76, W, 1);
  const logo = images.logo; const lw = 120; ctx.drawImage(logo, 48, 38 - lw * logo.height / logo.width / 2, lw, lw * logo.height / logo.width);
  ctx.fillStyle = '#E4E8F0'; ctx.fillRect(186, 22, 2, 32);
  text(ctx, 'Talent Review 主管操作指南', 208, 48, { size: 26, weight: 700, color: INK });
  // Chapter progress.
  const x0 = 640, w = (W - 48 - x0) / CHAPTERS.length;
  CHAPTERS.forEach((name, i) => {
    const x = x0 + i * w;
    const on = i === ch, done = i < ch;
    ctx.fillStyle = on ? RED : done ? '#9AA6BC' : '#E4E8F0';
    roundRect(ctx, x + 4, 58, w - 8, 5, 2.5); ctx.fill();
    text(ctx, `${i + 1} ${name}`, x + 4, 42, { size: 18, weight: on ? 700 : 400, color: on ? INK : done ? MUTED : '#A7B0C0' });
  });
}

function footer(ctx) {
  text(ctx, '畫面為示範資料，人名皆為虛構', 48, H - 30, { size: 20, color: '#8A94A6' });
}

function bgLight(ctx) {
  ctx.fillStyle = '#EEF2F8'; ctx.fillRect(0, 0, W, H);
}

function bgDark(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0A1428'); g.addColorStop(1, NAVY);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

const boxOf = (s) => {
  if (!s.focus) return null;
  const b = window.SHOTS[s.img]?.[s.focus];
  if (!b) console.warn('missing box', s.img, s.focus);
  return b ?? null;
};

/** Camera target for a step: centre and zoom so the focus box is comfortably large. */
function cam(s) {
  const b = boxOf(s);
  if (!b) return { cx: 960, cy: 565, zoom: 1 };
  const zoom = clamp(Math.min(VIEW.w / (b.w * 2.2), VIEW.h / (b.h * 3)), 1, s.maxZoom ?? 1.7);
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, zoom };
}

function windowFrame(ctx) {
  ctx.save();
  ctx.shadowColor = 'rgba(16,24,40,0.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  roundRect(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, VIEW.r); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
}

/** Draws a step's window at local time lt; returns the cursor point at the end. */
function stepWindow(ctx, s, lt, alpha = 1) {
  const img = images[s.img];
  const c = cam(s);
  const pz = ease.inOut(seg(lt, 0.25, 1.0));
  ctx.save();
  ctx.globalAlpha = alpha;
  const map = camera(ctx, img, VIEW, { cx: lerp(960, c.cx, pz), cy: lerp(565, c.cy, pz), zoom: lerp(1, c.zoom, pz), cropTop: 49 });
  const b = boxOf(s);
  if (b) spotlight(ctx, map(b), VIEW, seg(lt, 0.9, 1.3), { color: s.click ? BLUE : RED });
  ctx.restore();
  if (!b) return null;
  const m = map(b);
  return { x: m.x + Math.min(m.w * 0.5, 60), y: m.y + m.h * 0.55 };
}

let lastPoint = { x: VIEW.x + VIEW.w * 0.6, y: VIEW.y + VIEW.h * 0.6 };
const pointCache = new Map();
function endPoint(s) {
  if (pointCache.has(s)) return pointCache.get(s);
  const b = s.pointer ? window.SHOTS[s.img]?.[s.pointer] : boxOf(s);
  let p = null;
  if (b) {
    const c = cam(s);
    const base = VIEW.w / 1920; const sc = base * c.zoom;
    const visW = VIEW.w / sc, visH = VIEW.h / sc;
    const ix = clamp(c.cx - visW / 2, 0, 1920 - visW), iy = clamp(c.cy - visH / 2, 49, Math.max(49, 1080 - visH));
    p = { x: VIEW.x + (b.x - ix) * sc + Math.min(b.w * sc * 0.5, 60), y: VIEW.y + (b.y - iy) * sc + b.h * sc * 0.55 };
  }
  pointCache.set(s, p);
  return p;
}

function sidePanel(ctx, s, lt) {
  const a = (d) => ease.out(seg(lt, d, d + 0.5));
  const x = PANEL.x, w = PANEL.w;
  let y = PANEL.y + 10;
  text(ctx, `${s.ch + 1}　${CHAPTERS[s.ch]}`, x, y + 22, { size: 22, weight: 700, color: RED, alpha: a(0) });
  y += 52;
  ctx.save(); ctx.globalAlpha = a(0.05); ctx.translate((1 - a(0.05)) * 30, 0);
  const tl = wrap(ctx, s.title, w, 38, 800);
  tl.forEach((l, i) => text(ctx, l, x, y + 38 + i * 52, { size: 38, weight: 800, color: INK }));
  ctx.restore();
  y += tl.length * 52 + 30;
  ctx.save(); ctx.globalAlpha = a(0.15);
  y += paragraph(ctx, s.body, x, y + 28, w, { size: 28, lh: 1.6, color: '#344054' });
  ctx.restore();
  if (s.why) {
    y += 24;
    const lines = wrap(ctx, s.why, w - 48, 26, 500);
    const h = 70 + lines.length * 26 * 1.6;
    const p = a(0.3);
    ctx.save(); ctx.globalAlpha = p;
    roundRect(ctx, x, y, w, h, 16); ctx.fillStyle = '#EEF3FF'; ctx.fill();
    ctx.fillStyle = BLUE; ctx.fillRect(x, y + 16, 5, h - 32);
    text(ctx, '為什麼重要', x + 26, y + 44, { size: 22, weight: 700, color: BLUE });
    lines.forEach((l, i) => text(ctx, l, x + 26, y + 84 + i * 26 * 1.6, { size: 26, weight: 500, color: '#1F3B7A' }));
    ctx.restore();
  }
}

function drawStep(ctx, s, prev, lt) {
  bgLight(ctx);
  header(ctx, s.ch);
  windowFrame(ctx);
  // Cross-fade from the previous step's window.
  if (prev?.kind === 'step' && lt < 0.3) stepWindow(ctx, prev, prev.dur);
  stepWindow(ctx, s, lt, prev?.kind === 'step' ? ease.out(seg(lt, 0, 0.3)) : 1);
  // Cursor travels from where the last step ended.
  const from = (prev?.kind === 'step' && endPoint(prev)) || lastPoint;
  const to = endPoint(s);
  if (to) {
    const pm = ease.inOut(seg(lt, 0.4, 1.1));
    const x = lerp(from.x, to.x, pm), y = lerp(from.y, to.y, pm);
    const press = s.click ? clamp(1 - Math.abs(lt - 1.3) * 6) : 0;
    if (s.click) ripple(ctx, to.x, to.y, seg(lt, 1.25, 1.9), BLUE);
    cursor(ctx, x, y, { press });
  } else if (from) cursor(ctx, from.x, from.y);
  sidePanel(ctx, s, lt);
  footer(ctx);
}

function drawChapter(ctx, s, lt) {
  bgDark(ctx);
  const a = ease.out(seg(lt, 0, 0.5)) * (1 - seg(lt, s.dur - 0.35, s.dur));
  ctx.save(); ctx.globalAlpha = a;
  text(ctx, `CHAPTER ${s.ch + 1}`, 160, 420, { size: 30, weight: 700, color: '#FF7487', spacing: 6 });
  ctx.fillStyle = '#E72E3C'; ctx.fillRect(160, 450, 120 * ease.out(seg(lt, 0.2, 0.9)), 5);
  text(ctx, CHAPTERS[s.ch], 160 + (1 - ease.out(seg(lt, 0.1, 0.7))) * 40, 580, { size: 110, weight: 800, color: '#fff' });
  // Chapter list on the right.
  CHAPTERS.forEach((n, i) => {
    const on = i === s.ch;
    text(ctx, `${i + 1}　${n}`, 1300, 300 + i * 66, { size: on ? 36 : 30, weight: on ? 800 : 400, color: on ? '#fff' : i < s.ch ? 'rgba(185,195,217,0.55)' : 'rgba(185,195,217,0.85)' });
    if (on) { ctx.fillStyle = '#E72E3C'; ctx.fillRect(1268, 300 + i * 66 - 28, 6, 34); }
  });
  ctx.restore();
}

function drawCard(ctx, s, lt) {
  bgLight(ctx);
  header(ctx, s.ch);
  const a = (d) => ease.out(seg(lt, d, d + 0.6));
  text(ctx, s.title, W / 2, 230, { size: 64, weight: 800, color: INK, align: 'center', alpha: a(0.1) });
  const cw = 520, gap = 40, x0 = (W - (cw * 3 + gap * 2)) / 2;
  s.items.forEach(([head, body], i) => {
    const p = a(0.3 + i * 0.25);
    const x = x0 + i * (cw + gap), y = 320 + (1 - p) * 40;
    ctx.save(); ctx.globalAlpha = p;
    ctx.shadowColor = 'rgba(16,24,40,0.10)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    roundRect(ctx, x, y, cw, 400, 24); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.arc(x + 70, y + 80, 34, 0, Math.PI * 2); ctx.fillStyle = i === 0 ? RED : i === 1 ? BLUE : '#0E9F6E'; ctx.fill();
    text(ctx, String(i + 1), x + 70, y + 94, { size: 36, weight: 800, align: 'center' });
    text(ctx, head, x + 40, y + 180, { size: 44, weight: 800, color: INK });
    paragraph(ctx, body, x + 40, y + 240, cw - 80, { size: 30, lh: 1.6, color: '#344054' });
    ctx.restore();
  });
  const p = a(1.1);
  ctx.save(); ctx.globalAlpha = p;
  const lines = wrap(ctx, s.foot, 1500, 34, 700);
  roundRect(ctx, 210, 790, 1500, 60 + lines.length * 50, 20); ctx.fillStyle = NAVY; ctx.fill();
  lines.forEach((l, i) => text(ctx, l, W / 2, 850 + i * 50, { size: 34, weight: 700, color: '#fff', align: 'center' }));
  ctx.restore();
}

function drawTitle(ctx, s, lt, end = false) {
  bgDark(ctx);
  const a = (d) => ease.out(seg(lt, d, d + 0.7));
  const out = 1 - seg(lt, s.dur - 0.5, s.dur);
  ctx.save(); ctx.globalAlpha = out;
  const logo = images.logo; const lw = 260, lh = lw * logo.height / logo.width;
  ctx.globalAlpha = out * a(0); ctx.drawImage(logo, W / 2 - lw / 2, 200, lw, lh); ctx.globalAlpha = out;
  if (!end) {
    text(ctx, 'Talent Review 主管操作指南', W / 2, 430, { size: 84, weight: 800, align: 'center', alpha: a(0.3) });
    text(ctx, '從人才盤點到數據應用，一次看懂', W / 2, 510, { size: 40, color: '#B9C3D9', align: 'center', alpha: a(0.7) });
    CHAPTERS.forEach((n, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 300 + col * 340, y = 640 + row * 90;
      text(ctx, `${i + 1}`, x, y, { size: 40, weight: 800, color: '#FF7487', alpha: a(1.2 + i * 0.12) });
      text(ctx, n, x + 44, y, { size: 36, weight: 600, color: '#fff', alpha: a(1.2 + i * 0.12) });
    });
  } else {
    text(ctx, '開始你的第一次人才盤點', W / 2, 450, { size: 80, weight: 800, align: 'center', alpha: a(0.3) });
    text(ctx, '11 / 30（一）正式上線', W / 2, 570, { size: 64, weight: 800, color: '#FF5A6E', align: 'center', alpha: a(0.7) });
    text(ctx, '有任何問題，請聯絡你的 HRBP', W / 2, 680, { size: 40, color: '#B9C3D9', align: 'center', alpha: a(1.1) });
  }
  ctx.restore();
  text(ctx, '畫面為示範資料，人名皆為虛構', 48, H - 30, { size: 20, color: 'rgba(185,195,217,0.6)' });
}

export function draw(ctx, t) {
  let i = S.findIndex((s) => t < s.start + s.dur);
  if (i < 0) i = S.length - 1;
  const s = S[i];
  const lt = t - s.start;
  const prev = S[i - 1];
  if (s.kind === 'title') drawTitle(ctx, s, lt);
  else if (s.kind === 'end') drawTitle(ctx, s, lt, true);
  else if (s.kind === 'chapter') drawChapter(ctx, s, lt);
  else if (s.kind === 'card') drawCard(ctx, s, lt);
  else drawStep(ctx, s, prev, lt);
  // Fade in/out of the whole video.
  const f = Math.max(1 - seg(t, 0, 0.6), seg(t, DURATION - 0.8, DURATION));
  if (f > 0) { ctx.fillStyle = `rgba(0,0,0,${f})`; ctx.fillRect(0, 0, W, H); }
}

/** Start times for review stills. */
export const MARKS = S.map((s) => ({ chars: (s.title?.length ?? 0) + (s.body?.length ?? 0) + (s.why?.length ?? 0) + (s.items ? s.items.flat().join('').length + (s.foot?.length ?? 0) : 0), kind: s.kind, ch: s.ch, title: s.title ?? CHAPTERS[s.ch] ?? s.kind, body: s.body ?? '', why: s.why ?? '', start: +s.start.toFixed(2), dur: +s.dur.toFixed(2), at: +(s.start + Math.min(s.dur - 0.2, 3)).toFixed(2) }));
void lastPoint;

/** Mostly still UI: a lower bitrate keeps the file shareable by email or Teams. */
export const BITRATE = 3e6;
