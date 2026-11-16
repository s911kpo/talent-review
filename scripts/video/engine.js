// Tiny video engine: draws scenes on a 1920x1080 canvas frame by frame and encodes H.264 + AAC MP4
// in the browser (WebCodecs + mp4-muxer). Deterministic: every frame is drawn from its timestamp.
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const FONT = "'Microsoft JhengHei UI','Microsoft JhengHei','Segoe UI','Noto Sans TC',sans-serif";

/* ------------------------------------------------------------------ easing and helpers */
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  expo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
};
/** 0→1 progress of `t` within [a, b]. */
export const seg = (t, a, b) => clamp((t - a) / (b - a));

export const images = {};
export async function loadImages(map) {
  await Promise.all(Object.entries(map).map(([k, src]) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { images[k] = img; res(); };
    img.onerror = () => rej(new Error(`image ${src}`));
    img.src = src;
  })));
}

export function roundRect(ctx, x, y, w, h, r, newPath = true) {
  if (newPath) ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function text(ctx, str, x, y, { size = 40, weight = 400, color = '#fff', align = 'left', alpha = 1, base = 'alphabetic', spacing = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** Wraps CJK and Latin text to a width; returns the lines. */
export function wrap(ctx, str, maxW, size, weight = 400) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  const lines = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    const tokens = para.match(/[A-Za-z0-9.,%/:+\-–()'’]+\s*|\s+|./gu) ?? [];
    for (const tok of tokens) {
      // Closing punctuation never starts a line: keep it on the current line even if it overflows slightly.
      const closing = /^[，。、；：？！）」』%]/.test(tok);
      if (ctx.measureText(line + tok).width > maxW && line && !closing) { lines.push(line.trimEnd()); line = tok.trimStart(); }
      else line += tok;
    }
    lines.push(line);
  }
  ctx.restore();
  return lines;
}

export function paragraph(ctx, str, x, y, maxW, { size = 32, lh = 1.5, weight = 400, color = '#fff', alpha = 1 } = {}) {
  const lines = wrap(ctx, str, maxW, size, weight);
  lines.forEach((l, i) => text(ctx, l, x, y + i * size * lh, { size, weight, color, alpha }));
  return lines.length * size * lh;
}

/**
 * Draws a screenshot so that `focus` (a rect in image pixels) fills the viewport at the given zoom,
 * clipped to the viewport rect. Returns the mapping from image pixels to canvas pixels.
 */
export function camera(ctx, img, view, { cx, cy, zoom = 1, cropTop = 0 }) {
  const base = view.w / img.width;
  const s = base * zoom;
  const visW = view.w / s;
  const visH = view.h / s;
  const ix = clamp(cx - visW / 2, 0, Math.max(0, img.width - visW));
  const iy = clamp(cy - visH / 2, cropTop, Math.max(cropTop, img.height - visH));
  ctx.save();
  roundRect(ctx, view.x, view.y, view.w, view.h, view.r ?? 0);
  ctx.clip();
  ctx.fillStyle = '#F4F6FA';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.drawImage(img, ix, iy, visW, visH, view.x, view.y, view.w, view.h);
  ctx.restore();
  return (b) => ({ x: view.x + (b.x - ix) * s, y: view.y + (b.y - iy) * s, w: b.w * s, h: b.h * s });
}

export function cursor(ctx, x, y, { press = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  const k = 1 - press * 0.12;
  ctx.scale(1.25 * k, 1.25 * k);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(13.5, 35); ctx.lineTo(18, 33); ctx.lineTo(12.5, 21.5); ctx.lineTo(23, 21.5);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#101828'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
}

export function ripple(ctx, x, y, p, color = '#2A5BD7') {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - p;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(x, y, 10 + 60 * ease.out(p), 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** Dims everything except the box and draws a pulsing outline around it. */
export function spotlight(ctx, b, view, p, { color = '#2A5BD7', dim = 0.42, pad = 12 } = {}) {
  if (!b || p <= 0) return;
  const x = b.x - pad, y = b.y - pad, w = b.w + pad * 2, h = b.h + pad * 2;
  ctx.save();
  roundRect(ctx, view.x, view.y, view.w, view.h, view.r ?? 0);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(view.x, view.y, view.w, view.h);
  roundRect(ctx, x, y, w, h, 14, false);
  ctx.fillStyle = `rgba(14,27,51,${dim * p})`;
  ctx.fill('evenodd');
  ctx.globalAlpha = p;
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ rendering and encoding */

/**
 * Renders `draw(ctx, t)` for every frame of `duration` seconds plus the audio buffer, and returns MP4 bytes.
 * `onProgress(fraction)` is called now and then.
 */
export async function renderMp4({ duration, draw, audio, bitrate = 10e6, onProgress = () => {} }) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    audio: audio ? { codec: 'aac', sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels } : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { throw e; } });
  venc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate, framerate: FPS, avc: { format: 'avc' } });

  const frames = Math.round(duration * FPS);
  for (let i = 0; i < frames; i++) {
    const t = i / FPS;
    ctx.save();
    draw(ctx, t);
    ctx.restore();
    const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / FPS) });
    venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 1));
    if (i % 30 === 0) { onProgress(i / frames); await new Promise((r) => setTimeout(r, 0)); }
  }
  await venc.flush();

  if (audio) {
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { throw e; } });
    aenc.configure({ codec: 'mp4a.40.2', sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels, bitrate: 160000 });
    const block = 1024;
    const chans = [...Array(audio.numberOfChannels)].map((_, c) => audio.getChannelData(c));
    for (let off = 0; off < audio.length; off += block) {
      const n = Math.min(block, audio.length - off);
      const data = new Float32Array(n * chans.length);
      chans.forEach((ch, c) => data.set(ch.subarray(off, off + n), c * n));
      const ad = new AudioData({ format: 'f32-planar', sampleRate: audio.sampleRate, numberOfFrames: n, numberOfChannels: chans.length, timestamp: Math.round((off / audio.sampleRate) * 1e6), data });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
  }
  muxer.finalize();
  onProgress(1);
  return new Uint8Array(muxer.target.buffer);
}

/* ------------------------------------------------------------------ procedural music (no third-party audio) */

function noiseBuffer(ac, secs = 1) {
  const b = ac.createBuffer(1, ac.sampleRate * secs, ac.sampleRate);
  const d = b.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
  return b;
}

/**
 * Original synthesized score. `energy(bar)` returns 0..1 per bar to shape the arrangement; `hits` are
 * times (s) for impacts; `risers` are [start, end] sweeps.
 */
export async function music({ duration, bpm = 120, chords, energy = () => 1, hits = [], risers = [], master = 0.8, drums = true }) {
  const sr = 48000;
  const ac = new OfflineAudioContext(2, Math.ceil(sr * duration), sr);
  const out = ac.createGain(); out.gain.value = master;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  out.connect(comp).connect(ac.destination);
  // Fade the very end.
  out.gain.setValueAtTime(master, Math.max(0, duration - 1.5));
  out.gain.linearRampToValueAtTime(0, duration);

  const beat = 60 / bpm;
  const bar = beat * 4;
  const noise = noiseBuffer(ac, 2);
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

  const bars = Math.ceil(duration / bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const e = energy(b);
    const chord = chords[b % chords.length];
    // Pad: detuned saws through a lowpass that opens with energy.
    for (const n of chord) for (const det of [-6, 6]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + 2200 * e; f.Q.value = 0.7;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.022, t0 + 0.25); g.gain.setValueAtTime(0.022, t0 + bar - 0.2); g.gain.linearRampToValueAtTime(0, t0 + bar + 0.05);
      o.connect(f).connect(g).connect(out); o.start(t0); o.stop(t0 + bar + 0.1);
    }
    // Bass on eighths.
    if (e > 0.25) for (let k = 0; k < 8; k++) {
      const t = t0 + k * beat / 2;
      const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = hz(chord[0] - 24);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * e, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + beat / 2 * 0.9);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + beat / 2);
    }
    // Arp on sixteenths when energy is high.
    if (e > 0.6) for (let k = 0; k < 16; k++) {
      const t = t0 + k * beat / 4;
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(chord[k % chord.length] + 12);
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      const p = ac.createStereoPanner(); p.pan.value = k % 2 ? 0.35 : -0.35;
      o.connect(g).connect(p).connect(out); o.start(t); o.stop(t + 0.15);
    }
    if (!drums) continue;
    for (let k = 0; k < 4; k++) {
      const t = t0 + k * beat;
      if (e > 0.45) { // kick
        const o = ac.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        const g = ac.createGain(); g.gain.setValueAtTime(0.9 * e, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
      }
      if (e > 0.55 && k % 2 === 1) { // clap
        const s = ac.createBufferSource(); s.buffer = noise;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
        const g = ac.createGain(); g.gain.setValueAtTime(0.32 * e, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        s.connect(f).connect(g).connect(out); s.start(t, 0.3); s.stop(t + 0.2);
      }
      if (e > 0.3) for (const h of [0, 0.5]) { // hats
        const th = t + h * beat;
        const s = ac.createBufferSource(); s.buffer = noise;
        const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
        const g = ac.createGain(); g.gain.setValueAtTime(0.07 * e, th); g.gain.exponentialRampToValueAtTime(0.0001, th + 0.05);
        s.connect(f).connect(g).connect(out); s.start(th, (h + k) * 0.1); s.stop(th + 0.06);
      }
    }
  }
  for (const [a, b] of risers) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, a); f.frequency.exponentialRampToValueAtTime(9000, b);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, a); g.gain.exponentialRampToValueAtTime(0.22, b); g.gain.linearRampToValueAtTime(0, b + 0.02);
    s.connect(f).connect(g).connect(out); s.start(a); s.stop(b + 0.05);
  }
  for (const t of hits) {
    const o = ac.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    const g = ac.createGain(); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(out); o.start(t); o.stop(t + 1.5);
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(200, t + 1.2);
    const g2 = ac.createGain(); g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    s.connect(f).connect(g2).connect(out); s.start(t); s.stop(t + 1.4);
  }
  return ac.startRendering();
}
