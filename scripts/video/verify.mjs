// Checks a rendered MP4 plays: duration, size, a decoded frame, and that the audio track has sound.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const file = process.argv[2];
const at = Number(process.argv[3] ?? 5);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:5174/login');
const r = await p.evaluate(async ([src, t]) => {
  const v = document.createElement('video'); v.src = src; v.muted = true; v.preload = 'auto';
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('video error ' + v.error?.code)); });
  v.currentTime = t; await new Promise((res) => { v.onseeked = res; });
  const c = document.createElement('canvas'); c.width = 960; c.height = 540; c.getContext('2d').drawImage(v, 0, 0, 960, 540);
  const buf = await (await fetch(src)).arrayBuffer();
  let rms = null;
  try {
    const ab = await new AudioContext().decodeAudioData(buf.slice(0));
    const d = ab.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i += 50) s += d[i] * d[i];
    rms = Math.sqrt(s / (d.length / 50)); rms = { rms: +rms.toFixed(4), seconds: +ab.duration.toFixed(2) };
  } catch (e) { rms = 'no audio: ' + e.message; }
  return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, audio: rms, frame: c.toDataURL('image/jpeg', 0.8) };
}, [`/${file}`, at]);
writeFileSync(file.replace('.mp4', `-check.jpg`), Buffer.from(r.frame.split(',')[1], 'base64'));
delete r.frame; console.log(JSON.stringify(r)); await b.close();
