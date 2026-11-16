// Launch trailer (about 36 s, 120 BPM so every cut lands on a beat). Light UI shown in a dark, branded frame.
import { H, W, clamp, ease, images, lerp, roundRect, seg, text, wrap } from './engine.js';

export const DURATION = 31;
const RED = '#E72E3C';
const BLUE = '#5B8CFF';
const BANNER = 49; // demo banner height in the screenshots, cropped out

export const MUSIC = {
  duration: DURATION,
  bpm: 120,
  chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]],
  energy: (b) => [0.2, 0.4, 0.55, 0.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.65, 0.35, 0.2][b] ?? 0.2,
  hits: [4, 25.5],
  risers: [[2.4, 4], [23.8, 25.5]],
};

/* ------------------------------------------------------------------ backdrop */
function backdrop(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#060D1C'); g.addColorStop(1, '#0E1B33');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Slow moving grid.
  ctx.save();
  ctx.strokeStyle = 'rgba(120,150,210,0.07)'; ctx.lineWidth = 1;
  const off = (t * 20) % 80;
  for (let x = -80 + off; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = -80 + off; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // Soft glows.
  const glow = (x, y, r, c) => { const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); };
  glow(W * 0.8 + Math.sin(t * 0.4) * 80, H * 0.25, 700, 'rgba(91,140,255,0.16)');
  glow(W * 0.15, H * 0.85 + Math.cos(t * 0.3) * 60, 600, 'rgba(231,46,60,0.12)');
  // Particles.
  for (let i = 0; i < 46; i++) {
    const px = (i * 397 + t * (12 + (i % 5) * 6)) % W;
    const py = (i * 211 + Math.sin(t * 0.6 + i) * 30 + H) % H;
    ctx.fillStyle = `rgba(200,215,255,${0.12 + (i % 4) * 0.06})`;
    ctx.beginPath(); ctx.arc(px, py, 1.2 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Screenshot in a floating window, cropped to `src` (image px), placed at `dst` with tilt and alpha. */
function windowShot(ctx, img, src, dst, { alpha = 1, tilt = 0, glow = true, radius = 18 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(dst.x + dst.w / 2, dst.y + dst.h / 2);
  ctx.transform(1, tilt * 0.6, 0, 1, 0, 0);
  ctx.rotate(tilt * 0.15);
  const x = -dst.w / 2, y = -dst.h / 2;
  if (glow) { ctx.shadowColor = 'rgba(91,140,255,0.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 20; }
  roundRect(ctx, x, y, dst.w, dst.h, radius); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); roundRect(ctx, x, y, dst.w, dst.h, radius); ctx.clip();
  ctx.drawImage(img, src.x, src.y, src.w, src.h, x, y, dst.w, dst.h);
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, x, y, dst.w, dst.h, radius); ctx.stroke();
  ctx.restore();
}

/** A source rect zooming from `a` to `b` (image px) as p goes 0→1, keeping 16:9. */
const zoomRect = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });
const full = { x: 0, y: BANNER, w: 1920, h: 1080 - BANNER };
const fit = (cx, cy, w) => ({ x: cx - w / 2, y: cy - (w * (1080 - BANNER) / 1920) / 2, w, h: w * (1080 - BANNER) / 1920 });

function kinetic(ctx, str, x, y, p, { size = 96, color = '#fff', weight = 800, align = 'left' } = {}) {
  if (p <= 0) return;
  const e = ease.back(clamp(p));
  ctx.save();
  ctx.globalAlpha = clamp(p * 3);
  ctx.translate(x, y + (1 - e) * 40);
  text(ctx, str, 0, 0, { size, color, weight, align });
  ctx.restore();
}

function flash(ctx, t, at, len = 0.25) {
  const p = seg(t, at, at + len);
  if (p > 0 && p < 1) { ctx.fillStyle = `rgba(255,255,255,${(1 - p) * 0.55})`; ctx.fillRect(0, 0, W, H); }
}

function demoTag(ctx, alpha = 1) {
  text(ctx, '畫面為示範資料，人名皆為虛構', 48, H - 36, { size: 22, color: 'rgba(255,255,255,0.55)', alpha });
}

/* ------------------------------------------------------------------ feature beat */
function feature(ctx, t, start, { n, head, sub, img, from, to, side = 'right', extra }) {
  const lt = t - start;
  const pIn = ease.out(seg(lt, 0, 0.7));
  const pOut = seg(lt, 2.65, 3);
  const alpha = 1 - pOut;
  // Text block.
  const tx = side === 'right' ? 130 : 1150;
  ctx.save();
  ctx.globalAlpha = alpha;
  text(ctx, n, tx, 360, { size: 30, weight: 700, color: RED, alpha: clamp(lt * 3), spacing: 4 });
  ctx.fillStyle = RED; ctx.fillRect(tx, 384, 90 * ease.out(seg(lt, 0.1, 0.6)), 4);
  kinetic(ctx, head[0], tx, 480, seg(lt, 0.15, 0.75), { size: 72 });
  kinetic(ctx, head[1], tx, 570, seg(lt, 0.4, 1.0), { size: 72, color: '#DCE6FF' });
  const lines = wrap(ctx, sub, 600, 32);
  lines.forEach((l, i) => text(ctx, l, tx, 660 + i * 48, { size: 32, color: 'rgba(220,230,255,0.85)', alpha: clamp((lt - 0.9 - i * 0.12) * 3) }));
  ctx.restore();
  // Screenshot.
  const shotX = side === 'right' ? 1330 : 590;
  const slide = (1 - pIn) * (side === 'right' ? 500 : -500);
  const dst = fit(shotX + slide, 540, 980);
  const zoom = ease.inOut(seg(lt, 0.6, 2.6));
  windowShot(ctx, images[img], zoomRect(from, to, zoom), dst, { alpha: alpha * clamp(lt * 2.5), tilt: side === 'right' ? -0.05 : 0.05 });
  if (extra) extra(ctx, lt, alpha);
  demoTag(ctx, alpha * 0.9);
}

function badge(ctx, str, x, y, p, color = RED) {
  if (p <= 0) return;
  const e = ease.back(clamp(p));
  ctx.save();
  ctx.translate(x, y); ctx.scale(e, e);
  ctx.font = `700 34px 'Microsoft JhengHei UI','Microsoft JhengHei',sans-serif`;
  const w = ctx.measureText(str).width + 56;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24;
  roundRect(ctx, -w / 2, -34, w, 68, 34); ctx.fillStyle = color; ctx.fill();
  ctx.shadowColor = 'transparent';
  text(ctx, str, 0, 12, { size: 34, weight: 700, align: 'center' });
  ctx.restore();
}

/* ------------------------------------------------------------------ the trailer */
export function draw(ctx, t) {
  backdrop(ctx, t);

  // 0–2: hook line.
  if (t < 2.1) {
    const a = 1 - seg(t, 1.85, 2.1);
    ctx.fillStyle = RED; const lw = 520 * ease.inOut(seg(t, 0.1, 0.9));
    ctx.fillRect(W / 2 - lw / 2, 470, lw, 4);
    text(ctx, '這一季，', W / 2, 420, { size: 44, color: 'rgba(220,230,255,0.9)', align: 'center', alpha: seg(t, 0.3, 0.7) * a });
    kinetic(ctx, '人才盤點不再只是填表', W / 2, 580, seg(t, 0.9, 1.5) * a, { size: 78, align: 'center' });
  }

  // 2–4: three beats.
  if (t >= 2 && t < 4.05) {
    const words = [['看見人才', '#fff'], ['留住人才', '#DCE6FF'], ['發展人才', RED]];
    words.forEach(([w, c], i) => kinetic(ctx, w, W / 2, 420 + i * 130, seg(t, 2 + i * 0.5, 2.4 + i * 0.5), { size: 110, color: c, align: 'center' }));
  }
  flash(ctx, t, 4);

  // 4–6.5: logo reveal.
  if (t >= 4 && t < 6.6) {
    const lt = t - 4;
    const a = 1 - seg(t, 6.25, 6.55);
    const s = lerp(1.25, 1, ease.out(seg(lt, 0, 0.6)));
    const logo = images.logo;
    const lw = 520 * s, lh = lw * logo.height / logo.width;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(231,46,60,0.6)'; ctx.shadowBlur = 50;
    ctx.drawImage(logo, W / 2 - lw / 2, 330 - lh / 2, lw, lh);
    ctx.restore();
    kinetic(ctx, 'Talent Review', W / 2, 560, seg(lt, 0.35, 0.9) * a, { size: 104, align: 'center' });
    text(ctx, '人才盤點系統  ·  新店廠', W / 2, 650, { size: 40, color: 'rgba(220,230,255,0.85)', align: 'center', alpha: seg(lt, 0.8, 1.3) * a, spacing: 6 });
    // Light sweep.
    const sx = lerp(-400, W + 400, seg(lt, 0.5, 1.6));
    const sg = ctx.createLinearGradient(sx - 200, 0, sx + 200, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${0.07 * a})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  }

  // 6.5–21.5: five features, 3 s each.
  if (t >= 6.5 && t < 9.5) feature(ctx, t, 6.5, {
    n: '01', head: ['一次一題', '15 分鐘完成一位'], sub: '12 題依序引導，自動存檔，可以分次填寫。',
    img: 't102', from: full, to: { x: 520, y: 300, w: 760, h: 760 * 1031 / 1920 },
    extra: (c, lt, a) => badge(c, '自動存檔', 1600, 300, seg(lt, 1.1, 1.5) * a, '#11A36A'),
  });
  if (t >= 9.5 && t < 12.5) feature(ctx, t, 9.5, {
    n: '02', head: ['不知道怎麼寫？', '看範例就會'], sub: '每一題都有判斷方式、好範例、弱範例與常見陷阱。',
    img: 't102', side: 'left', from: full, to: { x: 1180, y: 320, w: 760, h: 760 * 1031 / 1920 },
  });
  if (t >= 12.5 && t < 15.5) feature(ctx, t, 12.5, {
    n: '03', head: ['一張儀表板', '看懂整個團隊'], sub: '完成率、關鍵人才、留任警示、接班就緒率、職涯對話缺口。',
    img: 'g01', from: full, to: { x: 360, y: 460, w: 1560, h: 1560 * 1031 / 1920 },
  });
  if (t >= 15.5 && t < 18.5) feature(ctx, t, 15.5, {
    n: '04', head: ['誰可能離開？', '誰接得上？'], sub: '留任風險與接班梯隊，一眼看出要先處理的人與職位。',
    img: 'g02', side: 'left', from: full, to: { x: 380, y: 480, w: 760, h: 760 * 1031 / 1920 },
    extra: (c, lt, a) => {
      const p = ease.out(seg(lt, 1.0, 1.5));
      if (p > 0) windowShot(c, images.g04, { x: 390, y: 490, w: 990, h: 990 * 1031 / 1920 }, { x: 560 - (1 - p) * 80, y: 600, w: 560, h: 560 * 1031 / 1920 }, { alpha: p * a, tilt: 0.04 });
    },
  });
  if (t >= 18.5 && t < 21.5) feature(ctx, t, 18.5, {
    n: '05', head: ['點一下', '從數字到人'], sub: '對話準備：系統依填寫內容，幫你想好下一句話怎麼問。',
    img: 'g03', from: full, to: { x: 1150, y: 270, w: 770, h: 770 * 1031 / 1920 },
  });

  // 21.5–25.5: montage, one cut per beat.
  if (t >= 21.5 && t < 25.5) {
    const cuts = [['t04', '我的團隊'], ['t06', '選出關鍵人才'], ['t21', '提交前品質提醒'], ['m01', '手機也能看'], ['g05', '組織畫像'], ['g06', '發展計畫追蹤'], ['g04', '接班梯隊'], ['t23', '一鍵提交 HR']];
    const i = Math.min(cuts.length - 1, Math.floor((t - 21.5) / 0.5));
    const lt = (t - 21.5) % 0.5;
    const [img, word] = cuts[i];
    const zoom = 1 + lt * 0.12;
    if (img === 'm01') {
      const ph = images.m01; const h = 900 * zoom; const w = h * ph.width / ph.height;
      windowShot(ctx, ph, { x: 0, y: 0, w: ph.width, h: ph.height }, { x: W / 2 - w / 2, y: H / 2 - h / 2, w, h }, { radius: 44 });
    } else {
      windowShot(ctx, images[img], full, fit(W / 2, H / 2, 1500 * zoom), { radius: 20 });
    }
    ctx.fillStyle = 'rgba(6,13,28,0.35)'; ctx.fillRect(0, 0, W, H);
    badge(ctx, word, W / 2, H / 2, seg(lt, 0, 0.12) * 1.0, i % 2 ? '#2A5BD7' : RED);
    flash(ctx, t, 21.5 + i * 0.5, 0.12);
    demoTag(ctx, 0.9);
  }
  flash(ctx, t, 25.5, 0.4);

  // 25.5–31: launch card.
  if (t >= 25.5) {
    const lt = t - 25.5;
    const logo = images.logo; const lw = 300, lh = lw * logo.height / logo.width;
    ctx.save(); ctx.globalAlpha = seg(lt, 0, 0.4); ctx.drawImage(logo, W / 2 - lw / 2, 230, lw, lh); ctx.restore();
    kinetic(ctx, 'Talent Review', W / 2, 440, seg(lt, 0.1, 0.6), { size: 88, align: 'center' });
    kinetic(ctx, '11 / 20（五）正式上線', W / 2, 600, seg(lt, 0.5, 1.1), { size: 110, color: RED, align: 'center' });
    text(ctx, '用工號與 HR 提供的 PIN 登入  ·  每位關鍵人才約 15 分鐘', W / 2, 720, { size: 38, color: 'rgba(220,230,255,0.9)', align: 'center', alpha: seg(lt, 1.2, 1.7) });
    demoTag(ctx, seg(lt, 1.5, 2) * 0.8);
  }
  // Fade to black at the end.
  const end = seg(t, DURATION - 0.6, DURATION);
  if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}

void BLUE;
