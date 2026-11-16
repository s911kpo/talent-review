// Writes chapter markers into an MP4 (Nero 'chpl' box in moov/udta, the format ffmpeg writes and
// players such as VLC, PotPlayer, MPC-HC and mpv show on the seek bar), keeping it one single file.
// Chapter starts come from the guide timeline, so they stay in step with the video.
// Usage: node scripts/video/add-chapters.mjs video-build/guide.mp4 video-build/guide-timeline.json
import { readFileSync, writeFileSync } from 'node:fs';

const [file, timelineFile] = process.argv.slice(2);
const buf = readFileSync(file);
const marks = JSON.parse(readFileSync(timelineFile, 'utf8'));
const chapters = [
  { start: 0, title: '片頭' },
  ...marks.filter((m) => m.kind === 'chapter').map((m) => ({ start: m.start, title: `第 ${m.ch + 1} 章　${m.title}` })),
];

/* ------------------------------------------------------------------ box helpers */
function boxes(b, start, end) {
  const out = [];
  for (let p = start; p < end;) {
    let size = b.readUInt32BE(p);
    const type = b.toString('latin1', p + 4, p + 8);
    let header = 8;
    if (size === 1) { size = Number(b.readBigUInt64BE(p + 8)); header = 16; }
    if (size === 0) size = end - p;
    out.push({ type, start: p, end: p + size, body: p + header });
    p += size;
  }
  return out;
}
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta']);
function walk(b, start, end, fn) {
  for (const x of boxes(b, start, end)) { fn(x); if (CONTAINERS.has(x.type)) walk(b, x.body, x.end, fn); }
}

/* ------------------------------------------------------------------ build chpl */
const entries = chapters.map((c) => {
  const title = Buffer.from(c.title, 'utf8').subarray(0, 255);
  const e = Buffer.alloc(9 + title.length);
  e.writeBigUInt64BE(BigInt(Math.round(c.start * 1e7)), 0); // 100 ns units
  e.writeUInt8(title.length, 8);
  title.copy(e, 9);
  return e;
});
const chplBody = Buffer.concat([Buffer.from([1, 0, 0, 0]), Buffer.alloc(4), Buffer.from([chapters.length]), ...entries]);
const chpl = Buffer.concat([Buffer.alloc(8), chplBody]);
chpl.writeUInt32BE(chpl.length, 0); chpl.write('chpl', 4, 'latin1');

/* ------------------------------------------------------------------ insert into moov */
const top = boxes(buf, 0, buf.length);
const moov = top.find((x) => x.type === 'moov');
const mdat = top.find((x) => x.type === 'mdat');
if (!moov || !mdat) throw new Error('not an MP4 with moov and mdat');
if (boxes(buf, moov.body, moov.end).some((x) => x.type === 'udta')) throw new Error('moov already has udta; chapters already added?');

const udta = Buffer.concat([Buffer.alloc(8), chpl]);
udta.writeUInt32BE(udta.length, 0); udta.write('udta', 4, 'latin1');
const delta = udta.length;

const out = Buffer.concat([buf.subarray(0, moov.end), udta, buf.subarray(moov.end)]);
out.writeUInt32BE(moov.end - moov.start + delta, moov.start);
// The media data moves by `delta` when moov sits in front of it: shift every chunk offset.
if (moov.start < mdat.start) {
  let fixed = 0;
  walk(out, moov.body, moov.end + delta, (x) => {
    if (x.type === 'stco') {
      const n = out.readUInt32BE(x.body + 4);
      for (let i = 0; i < n; i++) { const o = x.body + 8 + i * 4; out.writeUInt32BE(out.readUInt32BE(o) + delta, o); }
      fixed += n;
    } else if (x.type === 'co64') {
      const n = out.readUInt32BE(x.body + 4);
      for (let i = 0; i < n; i++) { const o = x.body + 8 + i * 8; out.writeBigUInt64BE(out.readBigUInt64BE(o) + BigInt(delta), o); }
      fixed += n;
    }
  });
  console.log('chunk offsets shifted', fixed);
}
writeFileSync(file, out);

// Read back what was written.
const again = boxes(out, 0, out.length).find((x) => x.type === 'moov');
let found = null;
walk(out, again.body, again.end, (x) => { if (x.type === 'chpl') found = x; });
const n = out.readUInt8(found.body + 8);
let p = found.body + 9;
const list = [];
for (let i = 0; i < n; i++) {
  const t = Number(out.readBigUInt64BE(p)) / 1e7; const len = out.readUInt8(p + 8);
  list.push(`${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}  ${out.toString('utf8', p + 9, p + 9 + len)}`);
  p += 9 + len;
}
console.log(list.join('\n'));
