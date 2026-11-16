// Launch trailer, about 41 s at 120 BPM. Story: the pain today → the turn → the whole picture in numbers →
// three moments that matter to a supervisor → what you take away → launch date.
// Layout rule: text never sits on top of a screenshot. Screens live in a window, captions live under it.
import { H, W, clamp, ease, images, lerp, roundRect, seg, text, wrap } from './engine.js';

export const DURATION = 41.5;
const RED = '#E72E3C';
const RED_SOFT = '#FF7487';
const INK = '#DCE6FF';
const MUTED = 'rgba(220,230,255,0.72)';
const BANNER = 49; // demo banner height in the screenshots, cropped out
const SHOT_RATIO = (1080 - BANNER) / 1920;

// Scene starts (s). Every scene boundary lands on a beat.
const S = { turn: 6.5, data: 9.5, m1: 16, m2: 21.5, m3: 27, take: 32.5, launch: 37 };

export const MUSIC = {
  duration: DURATION,
  bpm: 120,
  chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]],
  energy: (b) => [0.15, 0.22, 0.3, 0.7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.75, 0.6, 0.5, 0.35, 0.25][b] ?? 0.2,
  hits: [S.turn, S.data, S.launch],
  risers: [[5, S.turn], [8.2, S.data], [35.5, S.launch]],
};

/* ------------------------------------------------------------------ backdrop */
function backdrop(ctx, t, calm = 0) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#050B18'); g.addColorStop(1, '#0C1830');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = `rgba(120,150,210,${0.06 * (1 - calm)})`; ctx.lineWidth = 1;
  const off = (t * 16) % 80;
  for (let x = -80 + off; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = -80 + off; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const glow = (x, y, r, c) => { const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); };
  glow(W * 0.82 + Math.sin(t * 0.4) * 80, H * 0.2, 760, 'rgba(91,140,255,0.15)');
  glow(W * 0.12, H * 0.9 + Math.cos(t * 0.3) * 60, 640, 'rgba(231,46,60,0.13)');
  for (let i = 0; i < 40; i++) {
    const px = (i * 397 + t * (10 + (i % 5) * 5)) % W;
    const py = (i * 211 + Math.sin(t * 0.6 + i) * 30 + H) % H;
    ctx.fillStyle = `rgba(200,215,255,${0.1 + (i % 4) * 0.05})`;
    ctx.beginPath(); ctx.arc(px, py, 1.2 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  // Vignette for depth.
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function kinetic(ctx, str, x, y, p, { size = 96, color = '#fff', weight = 800, align = 'left', spacing = 0 } = {}) {
  if (p <= 0) return;
  const e = ease.back(clamp(p));
  ctx.save();
  ctx.globalAlpha *= clamp(p * 3);
  ctx.translate(x, y + (1 - e) * 36);
  text(ctx, str, 0, 0, { size, color, weight, align, spacing });
  ctx.restore();
}

function flash(ctx, t, at, len = 0.3, strength = 0.5) {
  const p = seg(t, at, at + len);
  if (p > 0 && p < 1) { ctx.fillStyle = `rgba(255,255,255,${(1 - p) * strength})`; ctx.fillRect(0, 0, W, H); }
}

function demoTag(ctx, alpha = 1, align = 'left') {
  text(ctx, '畫面為示範資料，人名皆為虛構', align === 'left' ? 56 : align === 'center' ? W / 2 : W - 56, H - 34, { size: 22, color: 'rgba(255,255,255,0.5)', alpha, align });
}

/** Frosted panel with a thin bright edge. */
function glass(ctx, x, y, w, h, { r = 24, alpha = 1, accent = null } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.09)'); g.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(200,215,255,0.22)'; ctx.stroke();
  if (accent) { ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = accent; ctx.fillRect(x, y, w, 5); ctx.restore(); }
  ctx.restore();
}

/* ------------------------------------------------------------------ scene A: the pain */
// Scattered spreadsheet fragments, drawn (not screenshots): rows of grey "text", a few red cells.
const SHEETS = [
  { x: 140, y: 120, w: 420, h: 260, r: -0.12, d: 0.6 },
  { x: 1380, y: 90, w: 400, h: 240, r: 0.09, d: 0.9 },
  { x: 90, y: 700, w: 380, h: 250, r: 0.08, d: 1.2 },
  { x: 1450, y: 720, w: 400, h: 260, r: -0.07, d: 0.7 },
  { x: 760, y: 40, w: 360, h: 170, r: 0.04, d: 1.0 },
  { x: 780, y: 880, w: 380, h: 170, r: -0.05, d: 0.8 },
];
function sheet(ctx, s, i, t, collapse) {
  const cx = s.x + s.w / 2 + Math.sin(t * 0.5 + i) * 14 * s.d;
  const cy = s.y + s.h / 2 + Math.cos(t * 0.4 + i) * 10 * s.d;
  const k = ease.inOut(collapse);
  ctx.save();
  ctx.globalAlpha *= (1 - k) * 0.85;
  ctx.translate(lerp(cx, W / 2, k), lerp(cy, H / 2, k));
  ctx.rotate(s.r * (1 - k) + k * (i % 2 ? 0.6 : -0.6));
  ctx.scale(1 - k * 0.9, 1 - k * 0.9);
  const x = -s.w / 2, y = -s.h / 2;
  roundRect(ctx, x, y, s.w, s.h, 10); ctx.fillStyle = 'rgba(235,240,250,0.10)'; ctx.fill();
  ctx.strokeStyle = 'rgba(220,230,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  const rows = Math.floor(s.h / 34), cols = 4, cw = s.w / cols;
  ctx.strokeStyle = 'rgba(220,230,255,0.12)'; ctx.lineWidth = 1;
  for (let r = 1; r < rows; r++) { ctx.beginPath(); ctx.moveTo(x, y + r * 34); ctx.lineTo(x + s.w, y + r * 34); ctx.stroke(); }
  for (let c = 1; c < cols; c++) { ctx.beginPath(); ctx.moveTo(x + c * cw, y); ctx.lineTo(x + c * cw, y + s.h); ctx.stroke(); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const n = (i * 31 + r * 7 + c * 13) % 11;
    if (n < 2) continue;
    const red = n === 9 && r > 0;
    ctx.fillStyle = r === 0 ? 'rgba(220,230,255,0.45)' : red ? 'rgba(231,46,60,0.55)' : 'rgba(220,230,255,0.22)';
    ctx.fillRect(x + c * cw + 10, y + r * 34 + 13, (cw - 20) * (0.35 + (n % 5) * 0.13), 9);
  }
  ctx.restore();
}

function scenePain(ctx, t) {
  const collapse = seg(t, 5.6, S.turn + 0.2);
  SHEETS.forEach((s, i) => sheet(ctx, s, i, t, collapse));
  const qs = ['誰是關鍵人才？', '誰可能離開？', '誰接得上？'];
  const out = seg(t, 3.7, 4.1);
  qs.forEach((q, i) => {
    const p = seg(t, 0.3 + i * 1.05, 0.9 + i * 1.05);
    kinetic(ctx, q, W / 2, 400 + i * 130, p * (1 - out), { size: 88, align: 'center', color: i === 2 ? '#fff' : INK });
  });
  const a = seg(t, 4.0, 4.5) * (1 - seg(t, 6.1, 6.5));
  if (a > 0) {
    text(ctx, '答案，散在', W / 2, 470, { size: 56, color: MUTED, align: 'center', alpha: a, weight: 500 });
    kinetic(ctx, 'Excel、記憶與直覺裡', W / 2, 600, a, { size: 96, align: 'center' });
    ctx.fillStyle = RED; const lw = 640 * ease.out(seg(t, 4.4, 5.0)) * a;
    ctx.fillRect(W / 2 - lw / 2, 650, lw, 5);
  }
}

/* ------------------------------------------------------------------ scene B: the turn */
function sceneTurn(ctx, t) {
  const lt = t - S.turn;
  const a = 1 - seg(t, S.data - 0.3, S.data);
  // Light burst where the fragments collapsed.
  const burst = ease.out(seg(lt, 0, 0.8));
  const rg = ctx.createRadialGradient(W / 2, 360, 0, W / 2, 360, 900 * burst + 1);
  rg.addColorStop(0, `rgba(231,46,60,${0.35 * (1 - burst * 0.6) * a})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const logo = images.logo;
  const s = lerp(1.3, 1, ease.out(seg(lt, 0, 0.6)));
  const lw = 440 * s, lh = lw * logo.height / logo.width;
  ctx.save(); ctx.globalAlpha = a * seg(lt, 0, 0.25);
  ctx.shadowColor = 'rgba(231,46,60,0.6)'; ctx.shadowBlur = 50;
  ctx.drawImage(logo, W / 2 - lw / 2, 300 - lh / 2, lw, lh);
  ctx.restore();
  kinetic(ctx, 'Talent Review', W / 2, 520, seg(lt, 0.3, 0.8) * a, { size: 120, align: 'center' });
  text(ctx, '第一次，用同一套數據，看見整個廠的人才', W / 2, 640, { size: 46, color: INK, align: 'center', alpha: seg(lt, 0.9, 1.4) * a, weight: 500 });
  const sx = lerp(-400, W + 400, seg(lt, 0.4, 1.6));
  const sg = ctx.createLinearGradient(sx - 220, 0, sx + 220, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${0.06 * a})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------------------ scene C: the whole picture */
// Numbers come from the showcase demo data (plant manager view), so they match the screens shown later.
const KPIS = [
  { label: '關鍵人才', value: 134, unit: '位', note: '佔盤點範圍 22%', color: '#7AA2FF' },
  { label: '留任警示', value: 14, unit: '位', note: '關鍵職位 × 高流失風險', color: RED_SOFT },
  { label: '接班就緒率', value: 22, unit: '%', note: '17 / 77 個關鍵職位', color: '#35D49A', ring: 0.22 },
  { label: '職涯對話缺口', value: 20, unit: '%', note: '27 位還沒談過職涯', color: '#FFC34D', ring: 0.2 },
];
function sceneData(ctx, t) {
  const lt = t - S.data;
  const a = 1 - seg(t, S.m1 - 0.35, S.m1);
  ctx.save(); ctx.globalAlpha = a;
  text(ctx, 'OSBU-CONNECTIVITY  ·  新店廠', W / 2, 150, { size: 26, color: RED_SOFT, align: 'center', weight: 700, spacing: 6, alpha: seg(lt, 0, 0.4) });
  kinetic(ctx, '一張畫面，看懂人才全貌', W / 2, 240, seg(lt, 0.1, 0.6), { size: 72, align: 'center' });

  const tw = 390, th = 330, gap = 36, x0 = (W - (tw * 4 + gap * 3)) / 2, y0 = 320;
  KPIS.forEach((k, i) => {
    const p = ease.out(seg(lt, 0.5 + i * 0.25, 1.1 + i * 0.25));
    if (p <= 0) return;
    const x = x0 + i * (tw + gap), y = y0 + (1 - p) * 60;
    ctx.save(); ctx.globalAlpha *= p;
    glass(ctx, x, y, tw, th, { accent: k.color });
    text(ctx, k.label, x + 36, y + 70, { size: 34, color: INK, weight: 600 });
    const count = ease.out(seg(lt, 0.7 + i * 0.25, 2.2 + i * 0.25));
    const num = String(Math.round(k.value * count));
    text(ctx, num, x + 32, y + 210, { size: 132, weight: 800, color: '#fff' });
    ctx.font = `800 132px 'Microsoft JhengHei UI','Microsoft JhengHei',sans-serif`;
    const nw = ctx.measureText(num).width;
    text(ctx, k.unit, x + 40 + nw, y + 210, { size: 44, color: MUTED, weight: 600 });
    text(ctx, k.note, x + 36, y + 280, { size: 28, color: MUTED });
    if (k.ring) {
      const cx = x + tw - 80, cy = y + 80, r = 42;
      ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(220,230,255,0.15)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = k.color; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k.ring * count); ctx.stroke();
    } else {
      // Small bar spark for the count tiles.
      const bars = [0.35, 0.6, 0.45, 0.8, 0.55, 1];
      bars.forEach((b, j) => {
        const bh = 56 * b * ease.out(seg(lt, 0.9 + i * 0.25 + j * 0.06, 1.5 + i * 0.25 + j * 0.06));
        ctx.fillStyle = k.color; ctx.globalAlpha = p * (0.35 + j * 0.11);
        roundRect(ctx, x + tw - 150 + j * 20, y + 100 - bh, 12, bh, 4); ctx.fill();
      });
    }
    ctx.restore();
  });

  // Scan line across the tiles.
  const sy = lerp(y0 - 20, y0 + th + 20, seg(lt, 0.8, 2.6));
  if (lt > 0.8 && lt < 2.6) {
    const sg = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
    sg.addColorStop(0, 'rgba(122,162,255,0)'); sg.addColorStop(0.5, 'rgba(122,162,255,0.18)'); sg.addColorStop(1, 'rgba(122,162,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(x0 - 20, sy - 30, tw * 4 + gap * 3 + 40, 60);
  }

  // The headline insight.
  const ip = ease.out(seg(lt, 3.0, 3.6));
  if (ip > 0) {
    const bw = tw * 4 + gap * 3, by = 720;
    ctx.save(); ctx.globalAlpha *= ip;
    ctx.translate(0, (1 - ip) * 30);
    glass(ctx, x0, by, bw, 120, { r: 20 });
    ctx.fillStyle = RED; roundRect(ctx, x0, by, 10, 120, 5); ctx.fill();
    text(ctx, '系統自動找出', x0 + 50, by + 76, { size: 34, color: MUTED, weight: 500 });
    text(ctx, '31 個關鍵職位，兩年內沒有人能接手', x0 + 280, by + 78, { size: 48, color: '#fff', weight: 800 });
    ctx.restore();
  }
  ctx.restore();
  demoTag(ctx, a * seg(lt, 0.5, 1) * 0.9);
}

/* ------------------------------------------------------------------ scenes D: three moments */
/** Screenshot in a window, cropped to `src` (image px), placed at `dst`. */
function windowShot(ctx, img, src, dst, { alpha = 1, radius = 18 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = 'rgba(91,140,255,0.4)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 24;
  roundRect(ctx, dst.x, dst.y, dst.w, dst.h, radius); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); roundRect(ctx, dst.x, dst.y, dst.w, dst.h, radius); ctx.clip();
  ctx.drawImage(img, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, dst.x, dst.y, dst.w, dst.h, radius); ctx.stroke();
  ctx.restore();
}
const zoomRect = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });
const FULL = { x: 0, y: BANNER, w: 1920, h: 1080 - BANNER };
const area = (x, y, w) => ({ x, y, w, h: w * SHOT_RATIO });
const WIN_W = 1480;
const WIN = { x: (W - WIN_W) / 2, y: 44, w: WIN_W, h: WIN_W * SHOT_RATIO }; // bottom ≈ 839
const CAP_Y = 900;

const MOMENTS = [
  {
    at: S.m1, n: '01', img: 't102', to: area(540, 300, 1180),
    focus: { x: 1250, y: 562, w: 424, h: 222 },
    head: '15 分鐘，把一個人說清楚',
    sub: '12 題逐題引導，每題都有好範例與常見陷阱，寫得具體、寫得一致。',
  },
  {
    at: S.m2, n: '02', img: 'g02', to: area(385, 480, 1100),
    focus: { x: 497, y: 634, w: 290, h: 118 },
    head: '最該先留住的人，一眼看見',
    sub: '關鍵職位 × 高流失風險，系統直接標出要先處理的人。',
  },
  {
    at: S.m3, n: '03', img: 'g03', to: area(1150, 140, 770),
    focus: { x: 1174, y: 293, w: 724, h: 201 },
    head: '點一下，從數字走到人',
    sub: '每位關鍵人才都有對話準備：下一次面談，先問哪一句。',
  },
];
const MOMENT_LEN = S.m2 - S.m1;

function moment(ctx, t, m) {
  const lt = t - m.at;
  const pIn = ease.out(seg(lt, 0, 0.5));
  const out = seg(lt, MOMENT_LEN - 0.35, MOMENT_LEN);
  const a = pIn * (1 - out);
  const zoom = ease.inOut(seg(lt, 0.6, 2.4));
  const src = zoomRect(FULL, m.to, zoom);
  const dst = { ...WIN, y: WIN.y + (1 - pIn) * 40 };
  windowShot(ctx, images[m.img], src, dst, { alpha: a });

  // Focus ring on the element that matters, mapped from image px to the screen.
  const fp = ease.out(seg(lt, 2.4, 2.9));
  if (fp > 0) {
    const sx = dst.w / src.w, sy = dst.h / src.h;
    const pad = 10;
    const fx = dst.x + (m.focus.x - src.x) * sx - pad, fy = dst.y + (m.focus.y - src.y) * sy - pad;
    const fw = m.focus.w * sx + pad * 2, fh = m.focus.h * sy + pad * 2;
    ctx.save();
    roundRect(ctx, dst.x, dst.y, dst.w, dst.h, 18); ctx.clip();
    ctx.globalAlpha = a * fp;
    // Dim everything else inside the window.
    ctx.beginPath(); ctx.rect(dst.x, dst.y, dst.w, dst.h); roundRect(ctx, fx, fy, fw, fh, 16, false);
    ctx.fillStyle = 'rgba(6,13,28,0.26)'; ctx.fill('evenodd');
    const pulse = 0.5 + 0.5 * Math.sin((lt - 2.4) * 5);
    ctx.shadowColor = 'rgba(231,46,60,0.8)'; ctx.shadowBlur = 18 + pulse * 14;
    ctx.lineWidth = 5; ctx.strokeStyle = RED; roundRect(ctx, fx, fy, fw, fh, 16); ctx.stroke();
    ctx.restore();
  }

  // Caption, always below the window.
  const x = WIN.x;
  ctx.save(); ctx.globalAlpha *= 1 - out;
  text(ctx, m.n, x, CAP_Y + 52, { size: 64, weight: 800, color: RED, alpha: seg(lt, 0.1, 0.4) });
  ctx.fillStyle = 'rgba(220,230,255,0.25)'; ctx.fillRect(x + 108, CAP_Y - 4, 2, 120 * ease.out(seg(lt, 0.15, 0.6)));
  kinetic(ctx, m.head, x + 138, CAP_Y + 44, seg(lt, 0.2, 0.7), { size: 56 });
  const lines = wrap(ctx, m.sub, WIN_W - 138, 32);
  lines.slice(0, 1).forEach((l) => text(ctx, l, x + 140, CAP_Y + 104, { size: 32, color: MUTED, alpha: seg(lt, 0.5, 0.9) }));
  ctx.restore();
  text(ctx, '畫面為示範資料，人名皆為虛構', WIN.x + WIN_W, CAP_Y + 104, { size: 22, color: 'rgba(255,255,255,0.45)', align: 'right', alpha: a });
}

/* ------------------------------------------------------------------ scene E: takeaway */
const TAKE = [
  { word: '看見', line1: '誰是關鍵、誰有風險', line2: '誰接得上，一目了然', color: '#7AA2FF' },
  { word: '對話', line1: '每一次職涯對話', line2: '都有準備、有方向', color: '#FFC34D' },
  { word: '行動', line1: '接班與發展計畫', line2: '有人負責、有人追蹤', color: '#35D49A' },
];
function sceneTake(ctx, t) {
  const lt = t - S.take;
  const a = 1 - seg(t, S.launch - 0.3, S.launch);
  ctx.save(); ctx.globalAlpha = a;
  text(ctx, '完成盤點，你帶走的是', W / 2, 250, { size: 52, color: INK, align: 'center', weight: 600, alpha: seg(lt, 0, 0.4) });
  const cw = 500, ch = 400, gap = 50, x0 = (W - (cw * 3 + gap * 2)) / 2, y0 = 330;
  TAKE.forEach((c, i) => {
    const p = ease.out(seg(lt, 0.3 + i * 0.35, 0.9 + i * 0.35));
    if (p <= 0) return;
    const x = x0 + i * (cw + gap), y = y0 + (1 - p) * 70;
    ctx.save(); ctx.globalAlpha *= p;
    glass(ctx, x, y, cw, ch, { r: 28 });
    // Edge light that runs around the top edge once.
    const run = seg(lt, 0.6 + i * 0.35, 1.6 + i * 0.35);
    if (run > 0 && run < 1) {
      const gx = x + run * cw;
      const eg = ctx.createLinearGradient(gx - 120, 0, gx + 120, 0);
      eg.addColorStop(0, 'rgba(255,255,255,0)'); eg.addColorStop(0.5, c.color); eg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = eg; ctx.fillRect(x + 20, y, cw - 40, 3);
    }
    text(ctx, `0${i + 1}`, x + 48, y + 80, { size: 30, color: c.color, weight: 800, spacing: 4 });
    text(ctx, c.word, x + 44, y + 200, { size: 104, weight: 800 });
    ctx.fillStyle = c.color; ctx.fillRect(x + 48, y + 232, 80 * ease.out(seg(lt, 0.7 + i * 0.35, 1.2 + i * 0.35)), 5);
    text(ctx, c.line1, x + 48, y + 300, { size: 36, color: INK, weight: 600 });
    text(ctx, c.line2, x + 48, y + 352, { size: 36, color: MUTED, weight: 500 });
    ctx.restore();
  });
  ctx.restore();
}

/* ------------------------------------------------------------------ scene F: launch */
function sceneLaunch(ctx, t) {
  const lt = t - S.launch;
  const logo = images.logo; const lw = 300, lh = lw * logo.height / logo.width;
  ctx.save(); ctx.globalAlpha = seg(lt, 0, 0.4); ctx.drawImage(logo, W / 2 - lw / 2, 200, lw, lh); ctx.restore();
  kinetic(ctx, 'Talent Review', W / 2, 420, seg(lt, 0.1, 0.6), { size: 92, align: 'center' });
  kinetic(ctx, '11 / 20（五）正式上線', W / 2, 590, seg(lt, 0.4, 1.0), { size: 120, color: RED, align: 'center' });
  const p = seg(lt, 1.0, 1.5);
  if (p > 0) {
    const bw = 1100, bx = (W - bw) / 2, by = 670;
    glass(ctx, bx, by, bw, 110, { r: 55, alpha: p });
    text(ctx, '用工號與 HR 提供的 PIN 登入  ·  每位關鍵人才約 15 分鐘', W / 2, by + 68, { size: 38, color: INK, align: 'center', alpha: p, weight: 500 });
  }
  demoTag(ctx, seg(lt, 1.4, 1.9) * 0.8, 'center');
}

/* ------------------------------------------------------------------ the trailer */
export function draw(ctx, t) {
  backdrop(ctx, t, t >= S.take ? seg(t, S.take, S.take + 1) * 0.6 : 0);
  if (t < S.turn + 0.3) scenePain(ctx, t);
  if (t >= S.turn && t < S.data) sceneTurn(ctx, t);
  flash(ctx, t, S.turn, 0.35, 0.55);
  if (t >= S.data && t < S.m1) sceneData(ctx, t);
  flash(ctx, t, S.data, 0.25, 0.3);
  for (const m of MOMENTS) if (t >= m.at && t < m.at + MOMENT_LEN) moment(ctx, t, m);
  if (t >= S.take && t < S.launch) sceneTake(ctx, t);
  flash(ctx, t, S.launch, 0.4, 0.45);
  if (t >= S.launch) sceneLaunch(ctx, t);
  const end = seg(t, DURATION - 0.6, DURATION);
  if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}
