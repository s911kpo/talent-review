// Renders a video page to MP4, or stills for review.
// Usage: node scripts/video/render.mjs promo|guide [--stills 0,5,10]
// Needs the showcase dev server on :5174 (it serves this folder and the screenshots).
import { chromium } from 'playwright';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';

const which = process.argv[2] ?? 'promo';
const stillsArg = process.argv.indexOf('--stills');
const OUT = 'video-build';
mkdirSync(`${OUT}/stills`, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.error('pageerror', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });

if (stillsArg > 0) {
  await page.goto(`http://localhost:5174/scripts/video/render.html?v=${which}&still`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const times = process.argv[stillsArg + 1].split(',').map(Number);
  for (const t of times) {
    const data = await page.evaluate((tt) => window.still(tt), t);
    writeFileSync(`${OUT}/stills/${which}-${String(t).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('stills', times.length);
} else {
  const file = `${OUT}/${which}.mp4`;
  await page.exposeFunction('saveChunk', (b64, first) => { (first ? writeFileSync : appendFileSync)(file, Buffer.from(b64, 'base64')); });
  await page.goto(`http://localhost:5174/scripts/video/render.html?v=${which}`);
  let last = '';
  const started = Date.now();
  await page.waitForFunction(() => window.finished > 0 || false, null, { timeout: 0, polling: 2000 }).catch((e) => console.error(e));
  last = await page.locator('#status').textContent();
  console.log(which, last, `${Math.round((Date.now() - started) / 1000)}s`, file);
}
await browser.close();
