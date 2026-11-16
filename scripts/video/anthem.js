// Alternative score for the launch promo: a driving, uplifting anthem (original, synthesized).
// Same 120 BPM grid as the picture, so every scene change still lands on a beat.
// Sections follow the promo story: tense pulse (pain) → impact (turn) → full drive (numbers and the
// three moments) → lift (takeaway) → final impact and ring-out (launch).

export async function anthem({ duration, cues }) {
  const { turn, data, take, launch, accents = [] } = cues;
  const sr = 48000;
  const ac = new OfflineAudioContext(2, Math.ceil(sr * duration), sr);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.15;
  const master = ac.createGain(); master.gain.value = 0.8;
  master.gain.setValueAtTime(0.8, duration - 2.5); master.gain.linearRampToValueAtTime(0, duration);
  master.connect(comp).connect(ac.destination);

  const beat = 0.5, bar = 2;
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const noise = (() => {
    const b = ac.createBuffer(1, sr * 2, sr); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();

  /* ---------------------------------------------------------------- instruments */
  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function kick(t, v = 1) {
    const o = ac.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.11);
    const g = ac.createGain(); env(g, t, 1.0 * v, 0.003, 0.32);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.4);
    const c = ac.createBufferSource(); c.buffer = noise; const cf = ac.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 3000;
    const cg = ac.createGain(); env(cg, t, 0.12 * v, 0.001, 0.02); c.connect(cf).connect(cg).connect(master); c.start(t); c.stop(t + 0.03);
  }
  function snare(t, v = 1) {
    const s = ac.createBufferSource(); s.buffer = noise; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
    const g = ac.createGain(); env(g, t, 0.42 * v, 0.002, 0.17); s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + 0.2);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const og = ac.createGain(); env(og, t, 0.25 * v, 0.002, 0.09); o.connect(og).connect(master); o.start(t); o.stop(t + 0.12);
  }
  function hat(t, v = 1, open = false) {
    const s = ac.createBufferSource(); s.buffer = noise; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
    const g = ac.createGain(); env(g, t, 0.09 * v, 0.001, open ? 0.16 : 0.035);
    const p = ac.createStereoPanner(); p.pan.value = 0.25;
    s.connect(f).connect(g).connect(p).connect(master); s.start(t, Math.random()); s.stop(t + 0.2);
  }
  function crash(t, v = 1) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4500;
    const g = ac.createGain(); env(g, t, 0.28 * v, 0.004, 2.2);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 2.4);
  }
  function impact(t) {
    const o = ac.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const g = ac.createGain(); env(g, t, 1.1, 0.004, 1.6); o.connect(g).connect(master); o.start(t); o.stop(t + 1.8);
    const s = ac.createBufferSource(); s.buffer = noise; const f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(7000, t); f.frequency.exponentialRampToValueAtTime(150, t + 1.4);
    const g2 = ac.createGain(); env(g2, t, 0.45, 0.003, 1.4); s.connect(f).connect(g2).connect(master); s.start(t); s.stop(t + 1.6);
    crash(t, 1.1);
  }
  /** Bright saw chord hit, like a brass/synth stab. */
  function stab(t, notes, len = 0.35, v = 1) {
    for (const n of notes) for (const det of [-9, 0, 9]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(900, t + len);
      const g = ac.createGain(); env(g, t, 0.03 * v, 0.004, len);
      o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + len + 0.05);
    }
  }
  /** Pumping pad: chord that ducks on every beat (sidechain feel). */
  function pumpPad(t0, len, notes, level, cutoff) {
    for (const n of notes) for (const det of [-12, 12]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.6;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0);
      for (let t = t0; t < t0 + len - 0.01; t += beat) { g.gain.setValueAtTime(0.002, t); g.gain.linearRampToValueAtTime(level, t + beat * 0.6); }
      g.gain.linearRampToValueAtTime(0.0001, t0 + len + 0.05);
      const p = ac.createStereoPanner(); p.pan.value = det < 0 ? -0.4 : 0.4;
      o.connect(f).connect(g).connect(p).connect(master); o.start(t0); o.stop(t0 + len + 0.1);
    }
  }
  function swellPad(t0, len, notes, level) {
    for (const n of notes) for (const det of [-10, 10]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(600, t0); f.frequency.linearRampToValueAtTime(2600, t0 + len);
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(level, t0 + len * 0.6); g.gain.linearRampToValueAtTime(0.0001, t0 + len + 0.1);
      o.connect(f).connect(g).connect(master); o.start(t0); o.stop(t0 + len + 0.2);
    }
  }
  function bassNote(t, m, len, v = 1) {
    for (const [type, det, lvl] of [['sawtooth', 0, 0.16], ['square', -1200, 0.12]]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = det;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(260, t + len);
      const g = ac.createGain(); env(g, t, lvl * v, 0.004, len * 0.9);
      o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + len);
    }
  }
  function lead(t, m, len, v = 1) {
    for (const [type, det] of [['sawtooth', -7], ['square', 7]]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = det;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3800;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045 * v, t + 0.01);
      g.gain.setValueAtTime(0.045 * v, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      const p = ac.createStereoPanner(); p.pan.value = det < 0 ? -0.15 : 0.15;
      o.connect(f).connect(g).connect(p).connect(master); o.start(t); o.stop(t + len + 0.02);
      // Echo, a dotted eighth later.
      const d = ac.createDelay(1); d.delayTime.value = 0.375; const dg = ac.createGain(); dg.gain.value = 0.28;
      g.connect(d).connect(dg).connect(master);
    }
  }
  /** Snare roll that speeds up and swells into `end`. */
  function roll(start, end) {
    let t = start, step = beat / 2;
    while (t < end - 0.01) {
      const p = (t - start) / (end - start);
      snare(t, 0.25 + 0.75 * p);
      step = p < 0.5 ? beat / 2 : p < 0.8 ? beat / 4 : beat / 8;
      t += step;
    }
  }
  function riser(a, b) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(300, a); f.frequency.exponentialRampToValueAtTime(10000, b);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, a); g.gain.exponentialRampToValueAtTime(0.25, b); g.gain.linearRampToValueAtTime(0, b + 0.02);
    s.connect(f).connect(g).connect(master); s.start(a); s.stop(b + 0.05);
  }

  /* ---------------------------------------------------------------- harmony: D major, I–V–vi–IV */
  const CH = [
    { pad: [62, 66, 69, 74], stab: [74, 78, 81], bass: 38 }, // D
    { pad: [61, 64, 69, 73], stab: [73, 76, 81], bass: 33 }, // A
    { pad: [62, 66, 71, 74], stab: [74, 78, 83], bass: 35 }, // Bm
    { pad: [62, 67, 71, 74], stab: [74, 79, 83], bass: 31 }, // G
  ];
  // Hook, one bar per chord, eighth notes (0 = rest).
  const HOOK = [
    [74, 0, 74, 76, 78, 0, 76, 74],
    [73, 0, 73, 74, 76, 0, 69, 0],
    [74, 0, 74, 76, 78, 0, 81, 78],
    [79, 0, 78, 76, 74, 0, 76, 0],
  ];

  /* ---------------------------------------------------------------- 1. pain: tense pulse in D minor */
  const AM = [50, 53, 57]; // D minor, low
  for (let t = 0; t < turn - 0.01; t += beat / 4) {
    const p = t / turn;
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(AM[0]);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300 + 1600 * p; f.Q.value = 3;
    const g = ac.createGain(); env(g, t, 0.07 + 0.08 * p, 0.003, 0.09);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.12);
  }
  swellPad(0, turn, AM.map((n) => n + 12), 0.018);
  for (let t = 1; t < turn - 1.4; t += beat) kick(t, 0.55 + 0.25 * (t / turn)); // heartbeat
  for (let t = 0.25; t < turn - 1.4; t += beat) hat(t, 0.5);
  roll(turn - 1.5, turn);
  riser(turn - 1.5, turn);

  /* ---------------------------------------------------------------- 2. turn: impact, wide lift */
  impact(turn);
  stab(turn, CH[0].stab, 1.2, 1.4);
  swellPad(turn, data - turn, CH[0].pad, 0.03);
  bassNote(turn, CH[0].bass, 1.5, 1);
  for (let t = turn + beat * 2; t < data - 1.5; t += beat * 2) kick(t, 0.8);
  roll(data - 1.5, data);
  riser(data - 1.5, data);

  /* ---------------------------------------------------------------- 3. drive: numbers and the three moments */
  impact(data);
  stab(data, CH[0].stab, 0.5, 1.3);
  const chordAt = (t) => CH[Math.max(0, Math.floor((t - 10) / bar)) % 4];
  // Chord boundaries fall on even seconds; the half bar from 9.5 to 10 is a pickup on D.
  const driveEnd = take;
  for (let t = data; t < driveEnd - 0.01; t += beat) {
    const k = Math.round((t - data) / beat);
    kick(t, 1);
    hat(t + beat / 2, 1, true);
    hat(t + beat / 4, 0.4); hat(t + beat * 3 / 4, 0.4);
    if (k % 2 === 1) snare(t, 0.9);
  }
  for (let b0 = 10; b0 < driveEnd - 0.01; b0 += bar) {
    const ci = Math.floor((b0 - 10) / bar) % 4;
    const c = CH[ci];
    pumpPad(b0, bar, c.pad, 0.026, 2400);
    for (let k = 0; k < 8; k++) bassNote(b0 + k * beat / 2, c.bass + (k % 2 ? 12 : 0), beat / 2, 1);
    if (b0 >= 12) HOOK[ci].forEach((m, k) => { if (m) lead(b0 + k * beat / 2, m, beat / 2 * 0.95, 1); });
    if (ci === 0) stab(b0, c.stab, 0.3, 1);
  }
  // Pickup half bar.
  pumpPad(data, 0.5, CH[0].pad, 0.026, 2400);
  bassNote(data, CH[0].bass, 0.25); bassNote(data + 0.25, CH[0].bass + 12, 0.25);
  for (const t of accents) { crash(t, 0.8); stab(t, chordAt(t).stab, 0.4, 1.1); }

  /* ---------------------------------------------------------------- 4. lift: takeaway, build to launch */
  impact(take);
  for (let b0 = take; b0 < launch - 0.01; b0 += bar) {
    const ci = [3, 0, 1][Math.floor((b0 - take) / bar)] ?? 1;
    const c = CH[ci];
    swellPad(b0, Math.min(bar, launch - b0), c.pad.map((n) => n + 12), 0.022);
    pumpPad(b0, Math.min(bar, launch - b0), c.pad, 0.02, 3200);
    for (let k = 0; k < 8 && b0 + k * beat / 2 < launch - 1.5; k++) bassNote(b0 + k * beat / 2, c.bass + (k % 2 ? 12 : 0), beat / 2, 0.8);
  }
  for (let t = take; t < launch - 1.5; t += beat) { kick(t, 0.85); hat(t + beat / 2, 0.8, true); }
  // Slow hook, half time, over the cards.
  [[take, 78, 1], [take + 1, 76, 0.5], [take + 1.5, 74, 0.5], [take + 2, 74, 1], [take + 3, 76, 1]].forEach(([t, m, l]) => lead(t, m, l * 0.95, 0.9));
  roll(launch - 1.5, launch);
  riser(launch - 1.5, launch);

  /* ---------------------------------------------------------------- 5. launch: final impact, ring out */
  impact(launch);
  stab(launch, [62, 66, 69, 74, 78, 81], 2.5, 1.5);
  swellPad(launch, duration - launch, [50, 57, 62, 66, 69, 74], 0.03);
  bassNote(launch, 38, 2.5, 1.2);
  lead(launch + 0.5, 81, 1.6, 0.8);

  return ac.startRendering();
}
