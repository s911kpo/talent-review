// Renders one short clip per guide chapter, plus a chapter time list for the launch email.
// Usage: node scripts/video/render-chapters.mjs   (showcase dev server on :5174)
import { chromium } from 'playwright';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'video-build/chapters';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));

await page.goto('http://localhost:5174/scripts/video/render.html?v=guide&still');
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const { marks, total } = await page.evaluate(() => ({ marks: window.MARKS, total: window.DURATION }));

const starts = marks.map((m, i) => ({ ...m, i })).filter((m) => m.kind === 'chapter');
const ranges = starts.map((c, k) => ({
  n: c.ch + 1, name: c.title, from: c.start, to: k + 1 < starts.length ? starts[k + 1].start : total,
}));
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
writeFileSync('video-build/章節時間表.txt', [
  'Talent Review 主管操作指南（完整版 ' + fmt(total) + '）',
  '',
  ...ranges.map((r) => `${fmt(r.from)}  第 ${r.n} 章　${r.name}`),
  '',
  '每一章也有單獨的短片，檔名依章節編號排列。',
].join('\r\n'));

let file = '';
await page.exposeFunction('saveChunk', (b64, first) => { (first ? writeFileSync : appendFileSync)(file, Buffer.from(b64, 'base64')); });
for (const r of ranges) {
  file = `${OUT}/Talent_Review_主管指南_第${r.n}章_${r.name.replace(/\s+/g, '')}.mp4`;
  await page.goto(`http://localhost:5174/scripts/video/render.html?v=guide&from=${r.from}&to=${r.to}`);
  await page.waitForFunction(() => window.finished > 0, null, { timeout: 0, polling: 1000 });
  console.log('chapter', r.n, r.name, `${(r.to - r.from).toFixed(1)}s`, file);
}
await browser.close();
