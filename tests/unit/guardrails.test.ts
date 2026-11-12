// Automated checks for the non-negotiable principles in SPEC section 0, and i18n completeness.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import zhBase from '../../src/i18n/zh-TW.json';
import enBase from '../../src/i18n/en.json';
import zhManager from '../../src/i18n/manager.zh-TW.json';
import enManager from '../../src/i18n/manager.en.json';

import zhHr from '../../src/i18n/hr.zh-TW.json';
import enHr from '../../src/i18n/hr.en.json';

import zhDash from '../../src/i18n/dash.zh-TW.json';
import enDash from '../../src/i18n/dash.en.json';
import zhExec from '../../src/i18n/exec.zh-TW.json';
import enExec from '../../src/i18n/exec.en.json';

const zh = { ...zhBase, ...zhManager, ...zhHr, ...zhDash, ...zhExec };
const en = { ...enBase, ...enManager, ...enHr, ...enDash, ...enExec };

const root = join(__dirname, '..', '..');
const srcDir = join(root, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sources = walk(srcDir).filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f: string) => readFileSync(f, 'utf8');

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  // A list (for example probing questions) is one key read with returnObjects; its items count too.
  return Object.entries(obj).flatMap(([k, v]) =>
    Array.isArray(v) ? [`${prefix}${k}`, ...flatten(v as unknown as Record<string, unknown>, `${prefix}${k}.`)]
      : typeof v === 'object' && v !== null ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  const zhKeys = new Set(flatten(zh));
  const enKeys = new Set(flatten(en));

  it('has identical keys in both languages', () => {
    expect([...zhKeys].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !zhKeys.has(k))).toEqual([]);
  });

  it('defines every key used in code', () => {
    const missing: string[] = [];
    const patterns = [/\bt\('([a-zA-Z0-9_.]+)'/g, /'((?:login|hrLogin|hr|app|top|team|cycles|namelist|accounts|badge|home|kt|wizard|autosave|q|plan|check|sub|tour|hrq|exp|opts|qb|aud|pv|dash|exec|ai)\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)'/g];
    for (const file of sources) {
      for (const pattern of patterns) {
        for (const match of read(file).matchAll(pattern)) {
          if (!zhKeys.has(match[1])) missing.push(`${relative(root, file)}: ${match[1]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('covers every namelist issue code', () => {
    const codes = read(join(srcDir, 'lib/namelist/namelist.ts')).match(/export type IssueCode[\s\S]*?;/)![0].match(/'([a-z_]+)'/g)!;
    for (const quoted of codes) {
      expect(zhKeys.has(`namelist.issue.${quoted.replace(/'/g, '')}`), quoted).toBe(true);
    }
  });
});

describe('SPEC section 0', () => {
  it('uses no placeholder attribute on inputs', () => {
    const hits = sources.filter((f) => /\bplaceholder\s*=/.test(read(f)));
    expect(hits).toEqual([]);
  });

  it('uses no emoji in source or translations', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    const files = [...sources, join(srcDir, 'i18n/zh-TW.json'), join(srcDir, 'i18n/en.json')];
    expect(files.filter((f) => emoji.test(read(f)))).toEqual([]);
  });

  it('never mentions forced distribution concepts', () => {
    const banned = /九宮格|強制分配|強制比例|9[- ]?box|nine[- ]?box|forced distribution/i;
    expect(sources.filter((f) => banned.test(read(f)))).toEqual([]);
  });

  it('never stores birth month', () => {
    const migrations = walk(join(root, 'supabase/migrations'));
    const columnDefs = /\bbirth\w*\s+(text|int|date|smallint|numeric)/i;
    expect(migrations.filter((f) => columnDefs.test(read(f)))).toEqual([]);
    expect(read(join(srcDir, 'lib/namelist/namelist.ts'))).not.toMatch(/birth\w*\s*:/i);
  });

  it('keeps fixtures fictional', () => {
    const seed = read(join(root, 'supabase/seed/fake_seed.sql'));
    expect(seed).not.toMatch(/\b191886\b/);
    expect(seed).not.toMatch(/Eason|Terence|Antonio|Vincent|Tommy/);
  });
});

describe('architecture', () => {
  it('creates the Supabase client only inside src/data', () => {
    const outside = sources.filter(
      (f) => !relative(srcDir, f).startsWith('data') && /@supabase\/supabase-js|supabase\(\)/.test(read(f)),
    );
    expect(outside).toEqual([]);
  });
});
