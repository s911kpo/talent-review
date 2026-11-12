import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronDown, Compass, GitFork, LayoutGrid, ListChecks, MessagesSquare,
  MonitorPlay, Route, ShieldAlert, Sprout, Target, X,
} from 'lucide-react';
import { ErrorNotice } from '../../components/AppShell';
import { MolexLogo } from '../../components/MolexLogo';
import { fetchDashboard, type DashboardData } from '../../data/dashboard';
import * as m from '../../lib/metrics';
import { execStory, type ExecStory } from '../../lib/metrics/exec';
import * as s from '../../lib/metrics/story';
import { ReferenceProvider, useRef_ } from '../manager/referenceData';
import { Drill, type DrillStep } from '../dashboard/Drill';

/*
 * Executive talent view: the same data as the strategy dashboard, told as a story for leadership.
 * Whole picture first, then risk, succession, development and the decisions to make (Tim, 2026-11-12).
 * Two looks share one page: "command" (dark throughout) and "hybrid" (dark headline band, light analysis).
 */

type Theme = 'command' | 'hybrid';
type Vars = CSSProperties & Record<`--x-${string}`, string>;

const DARK: Vars = {
  '--x-bg': '#060C18', '--x-panel': '#0C1527', '--x-panel2': '#111D35', '--x-line': 'rgba(148,163,184,0.18)',
  '--x-ink': '#EAF0FA', '--x-muted': '#97A5BF', '--x-data': '#4EA8FF', '--x-datasoft': 'rgba(78,168,255,0.16)',
  '--x-track': 'rgba(148,163,184,0.16)', '--x-alert': '#FF5A6E', '--x-alertbg': 'rgba(255,90,110,0.16)',
  '--x-warn': '#F5B83D', '--x-warnbg': 'rgba(245,184,61,0.15)', '--x-good': '#34D6A3', '--x-alertsolid': '#C41E3A', '--x-brand': '#D6193A', '--x-brandtext': '#FF7487',
  '--x-glow': '0 0 22px rgba(78,168,255,0.45)',
};
const LIGHT: Vars = {
  '--x-bg': '#F3F5F9', '--x-panel': '#FFFFFF', '--x-panel2': '#F7F9FC', '--x-line': '#E2E7F0',
  '--x-ink': '#101828', '--x-muted': '#5D6B82', '--x-data': '#2A78D6', '--x-datasoft': '#E4EEFB',
  '--x-track': '#ECEFF5', '--x-alert': '#C8102E', '--x-alertbg': '#FDECEF',
  '--x-warn': '#C27C00', '--x-warnbg': '#FFF4DB', '--x-good': '#0E9F6E', '--x-alertsolid': '#C8102E', '--x-brand': '#C8102E', '--x-brandtext': '#C8102E',
  '--x-glow': 'none',
};

const panel = 'rounded-2xl border border-[color:var(--x-line)] bg-[var(--x-panel)]';
const muted = 'text-[color:var(--x-muted)]';
const CHAPTERS = [
  { key: 'whole', Icon: LayoutGrid },
  { key: 'risk', Icon: ShieldAlert },
  { key: 'bench', Icon: GitFork },
  { key: 'growth', Icon: Sprout },
  { key: 'actions', Icon: ListChecks },
] as const;
type ChapterKey = (typeof CHAPTERS)[number]['key'];

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v)}%`);

interface Ctx {
  ds: m.Dataset;
  story: ExecStory;
  open: (title: string, ids: number[]) => void;
  setDept: (dept: string) => void;
  present: boolean;
}

export default function ExecPage() {
  return <ReferenceProvider bare managerId={0}><Exec /></ReferenceProvider>;
}

function Exec() {
  const { t } = useTranslation();
  const { cycle } = useRef_();
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [drill, setDrill] = useState<DrillStep | null>(null);
  // Look, presentation mode, chapter and department live in the URL: Back returns, and a view can be shared.
  const [params, setParams] = useSearchParams();
  const theme: Theme = params.get('theme') === 'hybrid' ? 'hybrid' : 'command';
  const present = params.get('present') === '1';
  const chapter = Math.min(CHAPTERS.length - 1, Math.max(0, Number(params.get('ch') ?? 0) || 0));
  const dept = params.get('dept') ?? '';
  const update = useCallback((patch: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace });
  }, [params, setParams]);

  const load = useCallback(async () => {
    setFailed(false);
    try { setData(await fetchDashboard(cycle.id)); } catch { setFailed(true); }
  }, [cycle.id]);
  useEffect(() => void load(), [load]);

  const ds = useMemo(() => (data ? m.applyFilters(data, { ...m.NO_FILTERS, dept }) : null), [data, dept]);
  const story = useMemo(() => (ds ? execStory(ds) : null), [ds]);

  const go = useCallback((i: number) => update({ ch: i > 0 ? String(i) : null }, true), [update]);
  useEffect(() => {
    if (!present) return;
    const key = (e: KeyboardEvent) => {
      if (drill) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(Math.min(CHAPTERS.length - 1, chapter + 1)); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(Math.max(0, chapter - 1)); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [present, chapter, go, drill]);

  const togglePresent = () => {
    if (!present) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    update({ present: present ? null : '1', ch: null });
  };

  const hero = DARK;
  const body = theme === 'command' ? DARK : LIGHT;

  if (failed) return <div className="p-6"><ErrorNotice onRetry={() => void load()} /></div>;
  if (!data || !ds || !story) return <p role="status" className="p-8 text-muted">{t('app.loading')}</p>;

  const ctx: Ctx = {
    ds, story, present,
    open: (title, ids) => setDrill({ kind: 'list', title, ids }),
    setDept: (d) => { update({ dept: d || null }); if (!present) window.scrollTo({ top: 0, behavior: 'smooth' }); },
  };
  const views: Record<ChapterKey, ReactNode> = {
    whole: <Whole ctx={ctx} />,
    risk: <Risk ctx={ctx} />,
    bench: <Bench ctx={ctx} />,
    growth: <Growth ctx={ctx} />,
    actions: <Actions ctx={ctx} />,
  };
  const shown = present ? [CHAPTERS[chapter]] : CHAPTERS;

  return (
    <div className="min-h-screen bg-[var(--x-bg)] text-[color:var(--x-ink)]" style={body}>
      <div style={hero} className="bg-[var(--x-bg)] text-[color:var(--x-ink)]">
        <Header theme={theme} present={present} dept={dept} story={story} cycleLabel={cycle.quarter_label}
          onTheme={(th) => update({ theme: th === 'command' ? null : th }, true)} onPresent={togglePresent} onPlant={() => ctx.setDept('')} />
        {!present && <ChapterNav onJump={(k) => document.getElementById(`ch-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />}
        {theme === 'hybrid' && shown[0].key === 'whole' && (
          <div className="mx-auto max-w-[1400px] px-4 pb-8 sm:px-8"><Chapter index={0} k="whole" ctx={ctx}>{views.whole}</Chapter></div>
        )}
      </div>

      <main className="mx-auto max-w-[1400px] space-y-14 px-4 py-8 sm:px-8">
        {shown.filter((c) => !(theme === 'hybrid' && c.key === 'whole')).map((c) => (
          <Chapter key={c.key} index={CHAPTERS.findIndex((x) => x.key === c.key)} k={c.key} ctx={ctx}>{views[c.key]}</Chapter>
        ))}
        {present && <PresentNav chapter={chapter} go={go} />}
      </main>

      {drill && <Drill start={drill} data={data} onClose={() => setDrill(null)} />}
    </div>
  );
}

function Header({ theme, present, dept, story, cycleLabel, onTheme, onPresent, onPlant }: {
  theme: Theme; present: boolean; dept: string; story: ExecStory; cycleLabel: string;
  onTheme: (t: Theme) => void; onPresent: () => void; onPlant: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="border-b border-[color:var(--x-line)]">
      <div className="h-1 bg-[var(--x-brand)]" aria-hidden="true" />
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <MolexLogo className="h-7 w-auto shrink-0" />
          <span className="h-8 w-px bg-[var(--x-line)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className={`truncate text-xs font-medium uppercase tracking-[0.14em] ${muted}`}>{t('exec.org')}</p>
            <h1 className="truncate text-lg font-semibold sm:text-xl">{t('exec.title')} <span className={`font-normal ${muted}`}>· {t('exec.status')}</span></h1>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <span className={`hidden text-sm md:inline ${muted}`}>{t('exec.cycle', { cycle: cycleLabel })}</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--x-line)] px-3 py-1 text-xs" title={t('exec.progressNote', { done: story.progress.submitted, total: story.progress.total })}>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--x-track)]" aria-hidden="true">
              <span className="block h-full rounded-full bg-[var(--x-good)]" style={{ width: `${story.progress.pct ?? 0}%` }} />
            </span>
            {t('exec.progress', { pct: fmt(story.progress.pct) })}
          </span>
          <div role="group" aria-label={t('exec.theme')} className="inline-flex rounded-full border border-[color:var(--x-line)] p-0.5 text-xs">
            {(['command', 'hybrid'] as const).map((th) => (
              <button key={th} type="button" aria-pressed={theme === th} onClick={() => onTheme(th)}
                className={`rounded-full px-3 py-1 font-medium transition ${theme === th ? 'bg-[var(--x-ink)] text-[color:var(--x-bg)]' : `${muted} hover:text-[color:var(--x-ink)]`}`}>
                {t(th === 'command' ? 'exec.themeCommand' : 'exec.themeHybrid')}
              </button>
            ))}
          </div>
          <button type="button" onClick={onPresent}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--x-brand)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110">
            {present ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />}
            {t(present ? 'exec.exitPresent' : 'exec.present')}
          </button>
          {!present && (
            <Link to="/hr?p=dashboard" className={`inline-flex items-center gap-1 text-xs hover:text-[color:var(--x-ink)] hover:underline ${muted}`}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />{t('exec.backToConsole')}
            </Link>
          )}
        </div>
      </div>
      {dept && (
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 pb-3 text-sm sm:px-8">
          <button type="button" onClick={onPlant} className="inline-flex items-center gap-1 font-semibold text-[color:var(--x-data)] hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('exec.backToPlant')}
          </button>
          <span className={muted}>{t('exec.filtered', { dept })}</span>
        </div>
      )}
    </header>
  );
}

function ChapterNav({ onJump }: { onJump: (k: ChapterKey) => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('exec.chapters')} className="sticky top-0 z-30 border-b border-[color:var(--x-line)] bg-[var(--x-bg)]/95 backdrop-blur">
      <ol className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 py-2 sm:px-8">
        {CHAPTERS.map(({ key, Icon }, i) => (
          <li key={key} className="shrink-0">
            <button type="button" onClick={() => onJump(key)} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm hover:bg-[var(--x-panel2)] hover:text-[color:var(--x-ink)] ${muted}`}>
              <span className="num text-xs font-semibold text-[color:var(--x-brandtext)]">{String(i).padStart(2, '0')}</span>
              <Icon className="h-4 w-4" aria-hidden="true" />{t(`exec.ch.${key}.t`)}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PresentNav({ chapter, go }: { chapter: number; go: (i: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[color:var(--x-line)] pt-5">
      <button type="button" disabled={chapter === 0} onClick={() => go(chapter - 1)} className={`inline-flex items-center gap-1.5 text-sm disabled:opacity-30 ${muted} hover:text-[color:var(--x-ink)]`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('exec.prev')}
      </button>
      <ol className="flex gap-2" aria-label={t('exec.chapters')}>
        {CHAPTERS.map(({ key }, i) => (
          <li key={key}>
            <button type="button" aria-label={t(`exec.ch.${key}.t`)} aria-current={i === chapter ? 'step' : undefined} onClick={() => go(i)}
              className={`block h-2 rounded-full transition-all ${i === chapter ? 'w-8 bg-[var(--x-brand)]' : 'w-2 bg-[var(--x-track)] hover:bg-[var(--x-muted)]'}`} />
          </li>
        ))}
      </ol>
      <button type="button" disabled={chapter === CHAPTERS.length - 1} onClick={() => go(chapter + 1)} className={`inline-flex items-center gap-1.5 text-sm disabled:opacity-30 ${muted} hover:text-[color:var(--x-ink)]`}>
        {t('exec.next')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------------------------- chapter frame */

function Chapter({ index, k, ctx, children }: { index: number; k: ChapterKey; ctx: Ctx; children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const showNotes = ctx.present || open;
  return (
    <section id={`ch-${k}`} aria-labelledby={`ch-${k}-t`} className="scroll-mt-16">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-4">
          <span className="num text-4xl font-light leading-none text-[color:var(--x-brandtext)] sm:text-5xl">{String(index).padStart(2, '0')}</span>
          <div>
            <h2 id={`ch-${k}-t`} className="text-2xl font-semibold tracking-tight sm:text-3xl">{t(`exec.ch.${k}.t`)}</h2>
            <p className={`mt-1 text-sm sm:text-base ${muted}`}>{t(`exec.ch.${k}.q`)}</p>
          </div>
        </div>
        {!ctx.present && (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
            className={`inline-flex items-center gap-1.5 rounded-full border border-[color:var(--x-line)] px-3 py-1.5 text-xs font-medium hover:text-[color:var(--x-ink)] ${muted}`}>
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />{t(open ? 'exec.notesHide' : 'exec.notesShow')}
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>
      {showNotes && (
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {([['def', BookOpen], ['value', Target], ['use', Route]] as const).map(([n, Icon]) => (
            <div key={n} className="rounded-xl border-l-2 border-[color:var(--x-brand)] bg-[var(--x-panel2)] px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--x-brandtext)]"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{t(`exec.note${n === 'def' ? 'Def' : n === 'value' ? 'Value' : 'Use'}`)}</p>
              <p className="mt-1.5 text-sm leading-relaxed">{t(`exec.ch.${k}.${n}`)}</p>
            </div>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="mb-5 max-w-4xl text-lg leading-relaxed sm:text-xl">{children}</p>;
}

/** A number that opens the people behind it. */
function Count({ value, ids, title, ctx, className = '', unit }: { value: ReactNode; ids: number[]; title: string; ctx: Ctx; className?: string; unit?: string }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={() => ctx.open(title, ids)} title={`${title}：${t('exec.people', { count: new Set(ids).size })}`}
      className={`num rounded-md text-left underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--x-data)] ${className}`}>
      {value}{unit && <span className={`ml-1 text-sm font-normal ${muted}`}>{unit}</span>}
      <span className="sr-only">{t('exec.viewList')}</span>
    </button>
  );
}

function Ring({ pct, color, size = 132, children }: { pct: number | null; color: string; size?: number; children?: ReactNode }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--x-track)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------- 00 whole picture */

function Whole({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { health, risk, bench, signals } = ctx.story;
  const talkIds = ctx.ds.reviews.filter((r) => r.aspirations_not_discussed).map((r) => r.employee_id);
  const top = signals[0];
  const tiles = [
    { key: 'risk', pct: health.riskPct, color: 'var(--x-alert)', ids: risk.medHigh, sub: t('exec.whole.riskSub', { count: risk.medHigh.length }) },
    { key: 'ready', pct: health.readyPct, color: 'var(--x-good)', ids: bench.readyIds, sub: t('exec.whole.readySub', { ready: bench.readyIds.length, total: bench.critical }) },
    { key: 'talk', pct: health.talkGapPct, color: 'var(--x-warn)', ids: talkIds, sub: t('exec.whole.talkSub', { count: talkIds.length }) },
  ];
  return (
    <>
      <Lead>
        {t('exec.whole.story', { key: health.key, risk: fmt(health.riskPct), critical: bench.critical, ready: fmt(health.readyPct) })}{' '}
        {top
          ? <span className="text-[color:var(--x-alert)]">{t('exec.whole.storyHot', { dept: top.dept, measure: t(`exec.whole.measure.${top.measure}`), value: fmt(top.value), gap: Math.round(top.gap), dir: t(top.measure === 'readyPct' ? 'exec.whole.lower' : 'exec.whole.higher') })}</span>
          : <span className={muted}>{t('exec.whole.storyCalm')}</span>}
      </Lead>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${panel} flex flex-col justify-between p-5`}>
          <p className={`text-sm font-medium ${muted}`}>{t('exec.whole.key')}</p>
          <Count ctx={ctx} title={t('exec.whole.key')} ids={ctx.ds.reviews.map((r) => r.employee_id)}
            value={<span className="text-6xl font-semibold tracking-tight" style={{ textShadow: 'var(--x-glow)' }}>{health.key}</span>} className="mt-3" />
          <p className={`mt-2 text-sm ${muted}`}>{t('exec.whole.keySub', { pct: fmt(health.keyPct) })} · {t('exec.people', { count: health.scope })}</p>
        </div>
        {tiles.map((x) => (
          <div key={x.key} className={`${panel} flex items-center gap-5 p-5`}>
            <Ring pct={x.pct} color={x.color} size={112}>
              <Count ctx={ctx} title={t(`exec.whole.${x.key}`)} ids={x.ids} value={<span className="text-2xl font-semibold">{fmt(x.pct)}</span>} />
            </Ring>
            <div className="min-w-0">
              <p className="text-base font-semibold">{t(`exec.whole.${x.key}`)}</p>
              <p className={`mt-1 text-sm ${muted}`}>{x.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <DeptHeat ctx={ctx} />
    </>
  );
}

function DeptHeat({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const rows = s.deptHealth(ctx.ds).filter((d) => d.key > 0);
  const all = ctx.story.health;
  const flagged = new Set(ctx.story.signals.map((x) => `${x.dept}|${x.measure}`));
  const cols = ['riskPct', 'readyPct', 'talkGapPct'] as const;
  const color = { riskPct: 'var(--x-alert)', readyPct: 'var(--x-good)', talkGapPct: 'var(--x-warn)' };
  if (rows.length < 2) return null;
  return (
    <div className={`${panel} mt-4 overflow-hidden`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
        <h3 className="text-base font-semibold">{t('exec.whole.grid')}</h3>
        <p className={`text-xs ${muted}`}>{t('exec.whole.gridNote')}</p>
      </div>
      <div className="overflow-x-auto px-2 pb-3 pt-2">
        <table className="w-full min-w-[40rem] border-separate border-spacing-x-1 border-spacing-y-1 text-sm">
          <thead>
            <tr className={`text-left text-xs ${muted}`}>
              <th className="px-3 py-2 font-medium" scope="col">{t('dash.filterDept')}</th>
              <th className="px-3 py-2 font-medium" scope="col">{t('exec.whole.keyCol')}</th>
              {cols.map((c) => <th key={c} className="px-3 py-2 font-medium" scope="col">{t(`exec.whole.measure.${c}`)}</th>)}
            </tr>
            <tr className="font-semibold">
              <td className="rounded-lg bg-[var(--x-panel2)] px-3 py-2">{t('exec.plant')}</td>
              <td className="num rounded-lg bg-[var(--x-panel2)] px-3 py-2">{all.key}</td>
              {cols.map((c) => <td key={c} className="num rounded-lg bg-[var(--x-panel2)] px-3 py-2">{fmt(all[c])}</td>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.dept}>
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <button type="button" className="text-left hover:text-[color:var(--x-data)] hover:underline" onClick={() => ctx.setDept(d.dept)}>{d.dept}</button>
                </th>
                <td className="num px-3 py-2">{d.key} <span className={`text-xs ${muted}`}>/ {d.scope}</span></td>
                {cols.map((c) => {
                  const hot = flagged.has(`${d.dept}|${c}`);
                  const v = d[c];
                  return (
                    <td key={c} className={`rounded-lg px-3 py-2 ${hot ? 'bg-[var(--x-alertbg)]' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className={`num w-10 font-semibold ${hot ? 'text-[color:var(--x-alert)]' : ''}`}>{fmt(v)}</span>
                        <span className="relative h-1.5 flex-1 rounded-full bg-[var(--x-track)]" aria-hidden="true">
                          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v ?? 0}%`, background: hot ? 'var(--x-alert)' : color[c], opacity: hot ? 1 : 0.55 }} />
                          {all[c] !== null && <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-[var(--x-ink)]/70" style={{ left: `${all[c]}%` }} />}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- 01 risk */

function Risk({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { labelOf } = useRef_();
  const { risk } = ctx.story;
  const levels = ['High', 'Medium', 'Low'];
  const cellIds = (level: string, critical: boolean) =>
    ctx.ds.reviews.filter((r) => r.retention_risk === level && r.is_critical_role === critical).map((r) => r.employee_id);
  const total = ctx.ds.reviews.length || 1;
  const reasons = risk.reasons.slice(0, 5);
  const reasonMax = Math.max(1, ...reasons.map((r) => r.count));
  return (
    <>
      <Lead>
        {t('exec.risk.story', { count: risk.medHigh.length, high: risk.highCritical.length })}{' '}
        {risk.topReason && t('exec.risk.storyReason', { reason: labelOf('retention_reason', risk.topReason.reason), pct: fmt(risk.topReasonPct) })}
      </Lead>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_0.7fr]">
        <div className={`${panel} p-5`}>
          <h3 className="mb-3 text-base font-semibold">{t('exec.risk.map')}</h3>
          <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-2 text-sm">
            <span />
            {levels.map((l) => <span key={l} className={`text-center text-xs font-medium ${muted}`}>{labelOf('retention_risk', l)}</span>)}
            {[true, false].map((crit) => (
              <RiskRow key={String(crit)} label={t(crit ? 'exec.risk.critical' : 'exec.risk.other')}>
                {levels.map((l) => {
                  const ids = cellIds(l, crit);
                  const tone = crit && l === 'High' ? 'alert' : crit && l === 'Medium' ? 'warn' : 'none';
                  return (
                    <div key={l} className={`flex h-24 flex-col items-center justify-center rounded-xl ${tone === 'alert' ? 'bg-[var(--x-alertsolid)] text-white' : tone === 'warn' ? 'bg-[var(--x-warnbg)]' : 'bg-[var(--x-panel2)]'}`}>
                      <Count ctx={ctx} title={`${labelOf('retention_risk', l)} × ${t(crit ? 'exec.risk.critical' : 'exec.risk.other')}`} ids={ids}
                        value={<span className="text-3xl font-semibold">{ids.length}</span>} />
                      <span className={`text-xs ${tone === 'alert' ? 'text-white/90' : muted}`}>{fmt(m.pct(ids.length, total))}</span>
                    </div>
                  );
                })}
              </RiskRow>
            ))}
          </div>
        </div>
        <div className={`${panel} p-5`}>
          <h3 className="text-base font-semibold">{t('exec.risk.reasons')}</h3>
          <p className={`mb-3 text-xs ${muted}`}>{t('exec.risk.reasonsNote')}</p>
          <ul className="space-y-3">
            {reasons.map((r, i) => (
              <li key={r.reason}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{labelOf('retention_reason', r.reason)}</span>
                  <Count ctx={ctx} title={labelOf('retention_reason', r.reason)} ids={r.ids} value={<span className="font-semibold">{r.count}</span>} unit={fmt(m.pct(r.count, risk.medHigh.length))} />
                </div>
                <span className="mt-1 block h-2 rounded-full bg-[var(--x-track)]" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${(r.count / reasonMax) * 100}%`, background: i < 2 ? 'var(--x-alert)' : 'var(--x-data)', opacity: i < 2 ? 1 : 0.6 }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${panel} flex flex-col justify-center gap-4 p-5`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--x-warnbg)]"><MessagesSquare className="h-6 w-6 text-[color:var(--x-warn)]" aria-hidden="true" /></span>
          <div>
            <Count ctx={ctx} title={t('exec.risk.talkFirst')} ids={risk.talkFirst}
              value={<span className="text-5xl font-semibold" style={{ textShadow: 'var(--x-glow)' }}>{risk.talkFirst.length}</span>} />
            <p className="mt-2 text-base font-semibold">{t('exec.risk.talkFirst')}</p>
            <p className={`mt-1 text-sm ${muted}`}>{t('exec.risk.talkFirstNote')}</p>
          </div>
        </div>
      </div>
    </>
  );
}

function RiskRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="flex items-center pr-2 text-xs font-medium [writing-mode:horizontal-tb]">{label}</span>
      {children}
    </>
  );
}

/* ---------------------------------------------------------------------------------------- 02 bench */

const BENCH_ROWS = ['gap', 'thin', 'developing', 'strong'] as const;
const CLASS_COLOR: Record<string, string> = { strong: 'var(--x-good)', developing: 'var(--x-data)', thin: 'var(--x-warn)', gap: 'var(--x-alert)' };

function Bench({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { labelOf } = useRef_();
  const { bench, health } = ctx.story;
  const matrix = s.roleRiskMatrix(ctx.ds);
  const zone = (b: string, r: string) => (b === 'gap' && r === 'High' ? 'critical' : (b === 'gap' && r === 'Medium') || (b === 'thin' && r === 'High') ? 'serious' : null);
  const depthTotal = bench.depth.reduce((n, d) => n + d.ids.length, 0) || 1;
  const depthColor: Record<string, string> = { '0': 'var(--x-alert)', '1': 'var(--x-warn)', '2+': 'var(--x-data)' };
  return (
    <>
      <Lead>
        {t('exec.bench.story', { total: bench.critical, ready: bench.readyIds.length, danger: bench.danger.all.length })}{' '}
        {bench.thinPct !== null && t('exec.bench.storyThin', { pct: fmt(bench.thinPct) })}
      </Lead>
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.4fr_1fr]">
        <div className={`${panel} flex flex-col items-center justify-center gap-3 p-5`}>
          <Ring pct={health.readyPct} color="var(--x-good)" size={168}>
            <Count ctx={ctx} title={t('exec.bench.readyRing')} ids={bench.readyIds}
              value={<span className="text-4xl font-semibold" style={{ textShadow: 'var(--x-glow)' }}>{fmt(health.readyPct)}</span>} />
            <span className={`text-xs ${muted}`}>{bench.readyIds.length} / {bench.critical}</span>
          </Ring>
          <p className="text-base font-semibold">{t('exec.bench.readyRing')}</p>
          <ul className="mt-2 w-full space-y-1.5 border-t border-[color:var(--x-line)] pt-3 text-sm">
            {(['strong', 'developing', 'thin', 'gap'] as const).map((b) => {
              const ids = matrix.find((x) => x.bench === b)!.cells.flatMap((c) => c.ids);
              return (
                <li key={b} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CLASS_COLOR[b] }} aria-hidden="true" />{t(`exec.bench.class.${b}`)}</span>
                  <Count ctx={ctx} title={t(`exec.bench.class.${b}`)} ids={ids} value={<span className="font-semibold">{ids.length}</span>} />
                </li>
              );
            })}
          </ul>
        </div>
        <div className={`${panel} p-5`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold">{t('exec.bench.matrix')}</h3>
            <span className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--x-alert)]" aria-hidden="true" />{t('exec.bench.dangerCritical')}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--x-alertbg)] ring-1 ring-[color:var(--x-alert)]" aria-hidden="true" />{t('exec.bench.dangerSerious')}</span>
            </span>
          </div>
          <div className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] gap-1.5 text-sm">
            <span className={`text-[11px] ${muted}`}>{t('exec.bench.matrixY')}</span>
            {s.MATRIX_RISK.map((r) => <span key={r} className={`text-center text-xs font-medium ${muted}`}>{labelOf('retention_risk', r)}</span>)}
            {BENCH_ROWS.map((b) => (
              <RiskRow key={b} label={t(`exec.bench.class.${b}`)}>
                {s.MATRIX_RISK.map((r) => {
                  const ids = matrix.find((x) => x.bench === b)!.cells.find((c) => c.risk === r)!.ids;
                  const z = zone(b, r);
                  return (
                    <div key={r} className={`flex h-14 items-center justify-center rounded-lg ${z === 'critical' ? 'bg-[var(--x-alertsolid)] text-white' : z === 'serious' ? 'bg-[var(--x-alertbg)] text-[color:var(--x-alert)] ring-1 ring-[color:var(--x-alert)]/50' : `bg-[var(--x-panel2)] ${muted}`}`}>
                      {ids.length > 0
                        ? <Count ctx={ctx} title={`${t(`exec.bench.class.${b}`)} × ${labelOf('retention_risk', r)}`} ids={ids} value={<span className={`text-xl ${z ? 'font-semibold' : ''}`}>{ids.length}</span>} />
                        : <span className="text-sm opacity-50">0</span>}
                    </div>
                  );
                })}
              </RiskRow>
            ))}
          </div>
          <p className={`mt-2 text-right text-[11px] ${muted}`}>{t('exec.bench.matrixX')} →</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className={`${panel} p-5`}>
            <h3 className="mb-3 text-base font-semibold">{t('exec.bench.depth')}</h3>
            <div className="flex h-4 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {bench.depth.map((d) => <span key={d.depth} style={{ width: `${(d.ids.length / depthTotal) * 100}%`, background: depthColor[d.depth] }} />)}
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {bench.depth.map((d) => (
                <li key={d.depth}>
                  <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: depthColor[d.depth] }} aria-hidden="true" />{t(`exec.bench.depthLabel.${d.depth}`)}</span>
                  <Count ctx={ctx} title={`${t('exec.bench.depth')}：${t(`exec.bench.depthLabel.${d.depth}`)}`} ids={d.ids} value={<span className="text-2xl font-semibold">{d.ids.length}</span>} />
                </li>
              ))}
            </ul>
          </div>
          <div className={`${panel} flex-1 p-5`}>
            <p className="text-base font-semibold">{t('exec.bench.fragile')}</p>
            <Count ctx={ctx} title={t('exec.bench.fragile')} ids={bench.fragileHolders}
              value={<span className="text-4xl font-semibold text-[color:var(--x-warn)]">{bench.fragileHolders.length}</span>} unit={t('dash.unitRoles')} />
            <p className={`mt-1 text-sm ${muted}`}>{t('exec.bench.fragileNote')}</p>
          </div>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------------------------------- 03 growth */

const PLAN_COLOR: Record<string, string> = { 'Not Started': 'var(--x-muted)', 'On Track': 'var(--x-data)', 'At Risk': 'var(--x-alert)', Completed: 'var(--x-good)' };

function Growth({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { labelOf, optionsFor } = useRef_();
  const { growth } = ctx.story;
  const pbm = m.pbmDistribution(ctx.ds, optionsFor('pbm_principle').map((o) => o.value));
  const pbmMax = Math.max(1, ...pbm.flatMap((p) => [p.strengths, p.improvements]));
  const topImprove = pbm.slice().sort((a, b) => b.improvements - a.improvements)[0];
  const readyMax = Math.max(1, ...growth.readiness.map((g) => g.ids.length));
  const goalTotal = growth.totalGoals || 1;
  return (
    <>
      <Lead>
        {t('exec.growth.story', { pool: growth.pool.length, total: growth.totalGoals, stalled: growth.stalledGoals })}{' '}
        {topImprove && topImprove.improvements > 0 && t('exec.growth.storyPbm', { value: labelOf('pbm_principle', topImprove.principle) })}
      </Lead>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${panel} flex flex-col p-5`}>
          <h3 className="mb-4 text-base font-semibold">{t('exec.growth.readiness')}</h3>
          <ol className="grid min-h-[11rem] flex-1 grid-cols-4 items-end gap-3">
            {growth.readiness.map((g, i) => (
              <li key={g.stage} className="flex h-full flex-col items-center justify-end gap-1 text-center">
                <Count ctx={ctx} title={labelOf('readiness', g.stage)} ids={g.ids} value={<span className="text-lg font-semibold">{g.ids.length}</span>} />
                <span className="w-full max-w-[3.5rem] rounded-t-md" aria-hidden="true"
                  style={{ height: `${Math.max(4, (g.ids.length / readyMax) * 100)}%`, background: i === 0 ? 'var(--x-good)' : 'var(--x-data)', opacity: i === 0 ? 1 : 0.85 - i * 0.18 }} />
                <span className={`text-[11px] leading-tight ${muted}`}>{labelOf('readiness', g.stage)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-4">
          <div className={`${panel} flex items-center gap-4 p-5`}>
            <Compass className="h-8 w-8 shrink-0 text-[color:var(--x-data)]" aria-hidden="true" />
            <div>
              <Count ctx={ctx} title={t('exec.growth.pool')} ids={growth.pool}
                value={<span className="text-4xl font-semibold" style={{ textShadow: 'var(--x-glow)' }}>{growth.pool.length}</span>} />
              <p className="text-base font-semibold">{t('exec.growth.pool')}</p>
              <p className={`text-sm ${muted}`}>{t('exec.growth.poolNote')}</p>
            </div>
          </div>
          <div className={`${panel} flex-1 p-5`}>
            <h3 className="mb-3 text-base font-semibold">{t('exec.growth.plans')}</h3>
            <div className="flex h-4 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {growth.plans.map((p) => <span key={p.status} style={{ width: `${(p.goals / goalTotal) * 100}%`, background: PLAN_COLOR[p.status] }} />)}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {growth.plans.map((p) => (
                <li key={p.status} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLOR[p.status] }} aria-hidden="true" />{t(`dash.planStatus.${p.status}`)}</span>
                  <Count ctx={ctx} title={t(`dash.planStatus.${p.status}`)} ids={p.ids} value={<span className="font-semibold">{p.goals}</span>} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={`${panel} p-5`}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold">{t('exec.growth.pbm')}</h3>
            <span className="flex gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--x-warn)]" aria-hidden="true" />{t('exec.growth.improvements')}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--x-data)]" aria-hidden="true" />{t('exec.growth.strengths')}</span>
            </span>
          </div>
          <ul className="space-y-2.5">
            {pbm.map((p) => (
              <li key={p.principle} className="text-sm">
                <p className="truncate text-xs">{labelOf('pbm_principle', p.principle)}</p>
                <div className="mt-1 grid grid-cols-2 items-center gap-0.5">
                  <span className="flex items-center justify-end gap-1.5">
                    <span className={`num text-xs ${muted}`}>{p.improvements}</span>
                    <span className="h-2.5 rounded-l-full bg-[var(--x-warn)]" style={{ width: `${(p.improvements / pbmMax) * 85}%` }} aria-hidden="true" />
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 rounded-r-full bg-[var(--x-data)]" style={{ width: `${(p.strengths / pbmMax) * 85}%` }} aria-hidden="true" />
                    <span className={`num text-xs ${muted}`}>{p.strengths}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------------------- 04 actions */

function Actions({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { risk, bench, growth } = ctx.story;
  const items = [
    { key: 'danger', ids: bench.danger.all, unit: 'roles', tone: 'var(--x-alert)' },
    { key: 'talk', ids: risk.talkFirst, unit: 'people', tone: 'var(--x-warn)' },
    { key: 'fragile', ids: bench.fragileHolders, unit: 'roles', tone: 'var(--x-warn)' },
    { key: 'riskNoPlan', ids: growth.riskNoPlan, unit: 'people', tone: 'var(--x-data)' },
    { key: 'pool', ids: growth.pool, unit: 'people', tone: 'var(--x-good)' },
  ].filter((x) => x.ids.length > 0);
  return (
    <>
      <Lead>{t('exec.actions.story', { count: items.length })}</Lead>
      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {items.map((x, i) => (
          <li key={x.key} className={`${panel} relative flex flex-col overflow-hidden p-5`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: x.tone }} aria-hidden="true" />
            <span className={`num text-xs font-semibold ${muted}`}>{String(i + 1).padStart(2, '0')}</span>
            <Count ctx={ctx} title={t(`exec.actions.items.${x.key}.t`)} ids={x.ids}
              value={<span className="text-5xl font-semibold" style={{ color: x.tone }}>{new Set(x.ids).size}</span>}
              unit={t(x.unit === 'roles' ? 'dash.unitRoles' : 'dash.unitPeople')} className="mt-1" />
            <p className="mt-2 text-base font-semibold leading-snug">{t(`exec.actions.items.${x.key}.t`)}</p>
            <p className={`mt-1 text-sm ${muted}`}>{t(`exec.actions.items.${x.key}.why`)}</p>
            <p className="mt-3 flex items-start gap-1.5 text-sm"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--x-brandtext)]" aria-hidden="true" />{t(`exec.actions.items.${x.key}.act`)}</p>
            <p className={`mt-auto pt-3 text-xs ${muted}`}>{t('exec.actions.owner')}：{t(`exec.actions.items.${x.key}.owner`)}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
