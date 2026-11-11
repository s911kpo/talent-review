import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ArrowRight, ClipboardCheck, GitFork, MessagesSquare, PersonStanding, Search, ShieldAlert, Sparkles, Star, UserRoundSearch, Users,
} from 'lucide-react';
import type { DashboardData, PlantAverages } from '../../data/dashboard';
import * as m from '../../lib/metrics';
import * as ins from '../../lib/metrics/insights';
import * as s from '../../lib/metrics/story';
import { useRef_ } from '../manager/referenceData';
import { BENCH_COLORS, Chart, INK, PALETTE, RISK_COLORS, STATUS } from './Chart';
import { BigStat, Empty, InfoTip, KpiCard, Legend, LinkButton, Meter, Panel, fmtPct } from './ui';

export type Mode = 'hr' | 'manager';

export interface Ctx {
  ds: m.Dataset;
  data: DashboardData;
  mode: Mode;
  averages: PlantAverages | null;
  open: (title: string, ids: number[]) => void;
  setDept: (dept: string) => void;
}

const useNames = (ctx: Ctx) => {
  const person = new Map(ctx.data.people.map((p) => [p.employee_id, p]));
  return {
    name: (id: number) => person.get(id)?.name ?? ctx.data.reviewerNames.get(id) ?? String(id),
    dept: (id: number) => person.get(id)?.dept ?? '',
  };
};

const initials = (name: string) => name.replace(/[^A-Za-z一-鿿]/g, '').slice(0, 2).toUpperCase();

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary-ink ${size === 'sm' ? 'h-6 w-6 text-[0.625rem]' : 'h-8 w-8 text-xs'}`}>
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ Overview */

export function OverviewSection({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { ds, averages, open } = ctx;
  const k = m.kpis(ds);
  const prog = s.reviewProgress(ds);
  const critical = ds.reviews.filter((r) => r.is_critical_role);
  const ready = critical.filter((r) => r.successors.some((x) => x.successor_type !== 'tbh' && x.readiness === 'Ready Now')).length;
  const notTalked = m.notDiscussed(ds);
  const alert = ds.reviews.filter((r) => r.is_critical_role && r.retention_risk === 'High').map((r) => r.employee_id);
  const avg = (v: number | null | undefined) => (averages ? t('dash.plantAvg', { value: fmtPct(v) }) : null);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard id="completion" Icon={ClipboardCheck} tone="primary" value={fmtPct(prog.pct)} ring={prog.pct}
          sub={t('dash.k.completionSub', { n: prog.submitted, total: prog.total })} />
        <KpiCard id="key" Icon={Star} tone="primary" value={String(k.keyCount)}
          sub={`${t('dash.k.ofScope', { pct: fmtPct(k.keyPct) })} · ${t('dash.notTarget')}`} compare={avg(averages?.key_pct)}
          onOpen={() => open(t('dash.m.key.t'), ds.reviews.map((r) => r.employee_id))} />
        <KpiCard id="alert" Icon={ShieldAlert} tone={alert.length ? 'risk' : 'ok'} value={String(alert.length)}
          sub={t('dash.k.alertSub')} onOpen={alert.length ? () => open(t('dash.m.alert.t'), alert) : undefined} />
        <KpiCard id="ready" Icon={GitFork} tone="ok" value={fmtPct(k.coveragePct)} ring={k.coveragePct}
          sub={t('dash.k.readySub', { n: ready, total: critical.length })} compare={avg(averages?.coverage_pct)} />
        <KpiCard id="talk" Icon={MessagesSquare} tone="warn" value={fmtPct(k.notDiscussedPct)}
          sub={t('dash.k.talkSub', { n: notTalked.length })} compare={avg(averages?.not_discussed_pct)}
          onOpen={notTalked.length ? () => open(t('dash.m.talk.t'), notTalked) : undefined} />
      </div>
      <Headlines ctx={ctx} />
      <DeptHealth ctx={ctx} />
    </div>
  );
}

const HEADLINE_ICON = { riskHotspot: AlertTriangle, uncovered: GitFork, concentration: Users, talkGap: MessagesSquare, fragile: ShieldAlert };
const HEADLINE_TONE = { riskHotspot: 'bg-risk-bg text-risk-fg', uncovered: 'bg-warn-bg text-warn-fg', concentration: 'bg-info-bg text-info-fg', talkGap: 'bg-primary-soft text-primary-ink', fragile: 'bg-warn-bg text-warn-fg' };

function Headlines({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const items = s.headlines(ctx.ds, ctx.mode === 'hr');
  const text = (h: s.Headline) => {
    switch (h.kind) {
      case 'riskHotspot': return t('dash.story.riskHotspot', { dept: h.dept, pct: fmtPct(h.pct), overall: fmtPct(h.overall) });
      case 'uncovered': return t('dash.story.uncovered', { count: h.count, critical: h.critical });
      case 'concentration': return t('dash.story.concentration', { name: h.name, roles: h.roles });
      case 'talkGap': return t('dash.story.talkGap', { count: h.count });
      default: return '';
    }
  };
  return (
    <section aria-labelledby="story" className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-gradient-to-r from-primary-soft to-card px-5 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
        <div>
          <h3 id="story" className="font-semibold">{t('dash.story.title')}</h3>
          <p className="text-sm text-muted">{t('dash.story.subtitle')}</p>
        </div>
      </div>
      {items.length === 0 ? <p className="px-5 py-6 text-sm text-muted">{t('dash.story.none')}</p> : (
        <ol className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {items.map((h, i) => {
            const Icon = HEADLINE_ICON[h.kind];
            return (
              <li key={h.kind} className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  <span className={`grid h-7 w-7 place-items-center rounded-md ${HEADLINE_TONE[h.kind]}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <p className="text-[0.9375rem] font-medium leading-relaxed">{text(h)}</p>
                <p className="text-sm text-muted">{t(`dash.story.${h.kind}Act`)}</p>
                <div className="mt-auto"><LinkButton onClick={() => ctx.open(text(h), h.ids)}>{t('dash.viewList')}</LinkButton></div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

type HealthCol = { key: 'riskPct' | 'readyPct' | 'talkGapPct'; label: string; worse: 'higher' | 'lower'; color: string };

function DeptHealth({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const rows = s.deptHealth(ctx.ds).filter((d) => d.key > 0);
  const all = s.overallHealth(ctx.ds);
  const cols: HealthCol[] = [
    { key: 'riskPct', label: t('dash.health.colRisk'), worse: 'higher', color: STATUS.critical },
    { key: 'readyPct', label: t('dash.health.colReady'), worse: 'lower', color: STATUS.good },
    { key: 'talkGapPct', label: t('dash.health.colTalk'), worse: 'higher', color: PALETTE[3] },
  ];
  const flagged = (v: number | null, base: number | null, c: HealthCol, n: number) =>
    v !== null && base !== null && n >= 3 && (c.worse === 'higher' ? v - base >= 10 : base - v >= 10);
  const cell = (v: number | null, c: HealthCol, n: number) => {
    const flag = flagged(v, all[c.key], c, n);
    return (
      <td key={c.key} className="td min-w-[9.5rem]">
        <div className="flex items-center justify-between gap-2">
          <span className={`num font-semibold ${flag ? 'text-risk-fg' : ''}`}>{fmtPct(v)}</span>
          {flag && <span className="tag bg-risk-bg text-risk-fg"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{t('dash.health.flag')}</span>}
        </div>
        <div className="mt-1.5"><Meter pct={v} color={c.color} tick={all[c.key]} /></div>
      </td>
    );
  };
  return (
    <Panel id="health" aside={<span className="hidden items-center gap-1.5 text-xs text-muted sm:flex"><span className="h-3 w-0.5 rounded bg-ink/60" aria-hidden="true" />{t('dash.health.overall')}</span>}>
      {rows.length === 0 ? <Empty /> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th pl-5">{t('dash.filterDept')}</th>
                <th className="th">{t('dash.health.colKey')}</th>
                {cols.map((c) => <th key={c.key} className="th">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-subtle/60">
                <td className="td pl-5 font-semibold">{t('dash.health.overall')}</td>
                <td className="td"><span className="num font-semibold">{all.key}</span> <span className="text-xs text-muted">/ {all.scope}</span></td>
                {cols.map((c) => (
                  <td key={c.key} className="td"><span className="num font-semibold">{fmtPct(all[c.key])}</span></td>
                ))}
              </tr>
              {rows.map((d) => (
                <tr key={d.dept} className="hover:bg-subtle/60">
                  <td className="td pl-5">
                    <button type="button" className="text-left font-medium hover:text-primary hover:underline" onClick={() => ctx.setDept(d.dept)}>{d.dept}</button>
                  </td>
                  <td className="td"><span className="num font-semibold">{d.key}</span> <span className="text-xs text-muted">/ {d.scope} · {fmtPct(d.keyPct)}</span></td>
                  {cols.map((c) => cell(d[c.key], c, c.key === 'readyPct' ? d.critical : d.key))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-5 pt-3 text-xs text-muted">{t('dash.health.flagNote')}</p>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ Organization */

const WOMEN = '#6250D6';
const MEN = '#B9C3D9';

export function OrgSection({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const heads = s.headcountByDept(ctx.ds);
  const max = Math.max(1, ...heads.map((h) => h.scope));
  const tenure = s.tenureShares(m.tenureDistribution(ctx.ds));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel id="headcount" className="lg:col-span-2"
        aside={<Legend items={[{ label: t('dash.org.keyLegend'), color: PALETTE[0] }, { label: t('dash.org.otherLegend'), color: '#C9D7F8' }]} />}>
        {heads.length === 0 ? <Empty /> : (
          <ul className="space-y-2.5">
            {heads.map((h) => (
              <li key={h.dept} className="grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-3 text-sm">
                <button type="button" className="truncate text-left hover:text-primary hover:underline" title={h.dept} onClick={() => ctx.setDept(h.dept)}>{h.dept}</button>
                <span className="flex h-5 overflow-hidden rounded" style={{ width: `${(h.scope / max) * 100}%` }} aria-hidden="true">
                  <span className="h-full rounded-l" style={{ width: `${(h.key / h.scope) * 100}%`, background: PALETTE[0] }} />
                  <span className="ml-0.5 h-full flex-1 rounded-r bg-[#C9D7F8]" />
                </span>
                <span className="num w-28 text-right text-muted"><span className="font-semibold text-ink">{h.key}</span> / {h.scope} · {fmtPct(m.pct(h.key, h.scope))}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <GenderPanel ctx={ctx} />
      <Panel id="tenure" aside={<Legend items={[{ label: t('dash.org.tenureKey'), color: PALETTE[0] }, { label: t('dash.org.tenureAll'), color: MEN }]} />}>
        <ul className="space-y-3">
          {tenure.map((b) => (
            <li key={b.band} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-sm">
              <span className="text-muted">{t(`dash.band.${b.band}`)}</span>
              <span className="space-y-1">
                <span className="flex items-center gap-2"><span className="h-2.5 rounded-sm" style={{ width: `${b.keyPct ?? 0}%`, background: PALETTE[0], minWidth: 2 }} aria-hidden="true" /><span className="num text-xs font-semibold">{fmtPct(b.keyPct)}</span></span>
                <span className="flex items-center gap-2"><span className="h-2.5 rounded-sm" style={{ width: `${b.allPct ?? 0}%`, background: MEN, minWidth: 2 }} aria-hidden="true" /><span className="num text-xs text-muted">{fmtPct(b.allPct)}</span></span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Isotype({ pct, label }: { pct: number | null; label: string }) {
  const { t } = useTranslation();
  const women = pct === null ? 0 : Math.round(pct / 5);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="num text-sm text-muted">{pct === null ? t('dash.org.hidden') : t('dash.org.perTen', { n: women })}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-px" role="img" aria-label={`${label}: ${t('dash.org.female')} ${fmtPct(pct)}`}>
        {Array.from({ length: 20 }, (_, i) => (
          <PersonStanding key={i} className="h-6 w-6" strokeWidth={2.25} style={{ color: pct === null ? INK.grid : i < women ? WOMEN : MEN }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

function GenderPanel({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const g = s.genderView(ctx.ds);
  const gap = g.keyFemalePct !== null && g.scopeFemalePct !== null ? g.keyFemalePct - g.scopeFemalePct : null;
  const verdict = gap === null ? null : gap <= -5 ? 'fewer' : gap >= 5 ? 'more' : 'same';
  const depts = m.genderByDept(ctx.ds);
  return (
    <Panel id="gender" aside={verdict && (
      <span className={`tag ${verdict === 'same' ? 'bg-ok-bg text-ok-fg' : 'bg-warn-bg text-warn-fg'}`}>{t(`dash.org.${verdict}`)}</span>
    )}>
      <div className="grid gap-5">
        <div className="flex items-end gap-6">
          <BigStat value={fmtPct(g.keyFemalePct)} label={`${t('dash.org.keyTalent')} · ${t('dash.org.female')}`} tone="primary" />
          <BigStat value={fmtPct(g.scopeFemalePct)} label={`${t('dash.org.everyone')} · ${t('dash.org.female')}`} />
        </div>
        <Isotype pct={g.keyFemalePct} label={t('dash.org.keyTalent')} />
        <Isotype pct={g.scopeFemalePct} label={t('dash.org.everyone')} />
        <Legend items={[{ label: t('dash.org.female'), color: WOMEN }, { label: t('dash.org.male'), color: MEN }]} />
        <details className="group rounded-lg border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">{t('dash.org.byDept')}</summary>
          <ul className="mt-3 space-y-2">
            {depts.map((d) => (
              <li key={d.dept} className="grid grid-cols-[minmax(6rem,10rem)_1fr_3rem] items-center gap-3 text-xs">
                <span className="truncate" title={d.dept}>{d.dept}</span>
                {d.suppressed ? <span className="col-span-2 text-muted">{t('dash.org.hidden')}</span> : (
                  <>
                    <span className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
                      <span style={{ width: `${d.femalePct}%`, background: WOMEN }} /><span className="flex-1" style={{ background: MEN }} />
                    </span>
                    <span className="num text-right">{fmtPct(d.femalePct)}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ Retention */

export function RiskSection({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { labelOf } = useRef_();
  const matrix = m.riskMatrix(ctx.ds);
  const medHigh = ctx.ds.reviews.filter((r) => r.retention_risk === 'Medium' || r.retention_risk === 'High').length;
  const reasons = m.reasonPareto(ctx.ds).slice(0, 7);
  const poach = m.flightRisk(ctx.ds);
  const conv = ins.conversationPriorities(ctx.ds);
  const talk = [...conv.high, ...conv.medium];
  const cell = (risk: string, ids: number[], critical: boolean) => {
    const title = `${labelOf('retention_risk', risk)} × ${t(critical ? 'dash.risk.critical' : 'dash.risk.other')}`;
    const hot = risk === 'High' && critical;
    return (
      <button type="button" onClick={() => ctx.open(title, ids)} aria-label={`${title}: ${t('dash.people', { count: ids.length })}`}
        className={`relative flex min-h-[5.5rem] flex-col justify-between rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-card ${
          hot ? 'border-risk-fg/30 bg-risk-bg' : 'border-line bg-card'}`}
        style={{ borderLeft: `4px solid ${RISK_COLORS[risk]}` }}>
        {hot && <span className="tag absolute right-2 top-2 bg-risk-fg text-white">{t('dash.risk.priority')}</span>}
        <span className={`num text-3xl font-semibold ${hot ? 'text-risk-fg' : ''}`}>{ids.length}</span>
        <span className="text-xs text-muted">{t('dash.ofKey', { pct: fmtPct(m.pct(ids.length, ctx.ds.reviews.length)) })}</span>
      </button>
    );
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel id="riskMap">
        <div className="grid grid-cols-[3.5rem_1fr_1fr] gap-2 text-sm">
          <span />
          <span className="text-center text-xs font-semibold text-muted">{t('dash.risk.critical')}</span>
          <span className="text-center text-xs font-semibold text-muted">{t('dash.risk.other')}</span>
          {matrix.map((row) => (
            <div key={row.risk} className="contents">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLORS[row.risk] }} aria-hidden="true" />
                {labelOf('retention_risk', row.risk)}
              </span>
              {cell(row.risk, row.critical, true)}
              {cell(row.risk, row.other, false)}
            </div>
          ))}
        </div>
        {ctx.averages && <p className="mt-3 text-xs text-muted">{t('dash.m.riskMap.t')} · {t('dash.plantAvg', { value: fmtPct(ctx.averages.med_high_pct) })}</p>}
      </Panel>
      <Panel id="reasons">
        {reasons.length === 0 ? <Empty /> : (
          <ul className="space-y-3">
            {reasons.map((r) => {
              const p = m.pct(r.count, medHigh) ?? 0;
              return (
                <li key={r.reason}>
                  <button type="button" className="group w-full text-left" onClick={() => ctx.open(labelOf('retention_reason', r.reason), r.ids)}>
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="group-hover:text-primary">{labelOf('retention_reason', r.reason)}</span>
                      <span className="num text-muted"><span className="font-semibold text-ink">{r.count}</span> · {fmtPct(p)}</span>
                    </span>
                    <span className="mt-1 block"><Meter pct={p} color={STATUS.serious} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel id="talkRisk">
        <div className="flex items-end justify-between gap-4">
          <BigStat value={String(talk.length)} label={`${labelOf('retention_risk', 'High')} ${conv.high.length} · ${labelOf('retention_risk', 'Medium')} ${conv.medium.length}`} tone={talk.length ? 'risk' : 'ink'} />
          {talk.length > 0 && <LinkButton onClick={() => ctx.open(t('dash.m.talkRisk.t'), talk)}>{t('dash.viewList')}</LinkButton>}
        </div>
      </Panel>
      <Panel id="poach">
        <div className="flex items-end justify-between gap-4">
          <BigStat value={String(poach.length)} label={t('dash.people', { count: poach.length })} tone={poach.length ? 'risk' : 'ink'} />
          {poach.length > 0 && <LinkButton onClick={() => ctx.open(t('dash.m.poach.t'), poach)}>{t('dash.viewList')}</LinkButton>}
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ Succession */

export function BenchSection({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { name, dept } = useNames(ctx);
  const bench = m.benchByDept(ctx.ds);
  const max = Math.max(1, ...bench.map((b) => m.BENCH_CLASSES.reduce((n, c) => n + b[c].length, 0)));
  const uncovered = s.uncoveredByDept(ctx.ds);
  const uncoveredAll = uncovered.flatMap((u) => u.ids);
  const critical = ctx.ds.reviews.filter((r) => r.is_critical_role);
  const concentration = m.successorConcentration(ctx.ds);
  const external = m.externalDependencyPct(ctx.ds);
  const fragile = ins.fragileCoverage(ctx.ds);
  const legend = <Legend items={m.BENCH_CLASSES.map((c) => ({ label: t(`dash.bench.${c}`), color: BENCH_COLORS[c] }))} />;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel id="benchDept" className="lg:col-span-2" aside={<span className="hidden sm:block">{legend}</span>}>
        {bench.length === 0 ? <Empty /> : (
          <ul className="space-y-2.5">
            {bench.map((b) => {
              const total = m.BENCH_CLASSES.reduce((n, c) => n + b[c].length, 0);
              return (
                <li key={b.dept} className="grid grid-cols-[minmax(6rem,10rem)_1fr_2rem] items-center gap-3 text-sm">
                  <span className="truncate" title={b.dept}>{b.dept}</span>
                  <span className="flex h-6 gap-0.5" style={{ width: `${(total / max) * 100}%` }}>
                    {m.BENCH_CLASSES.filter((c) => b[c].length).map((c) => (
                      <button key={c} type="button" title={`${t(`dash.bench.${c}`)}: ${b[c].length}`}
                        aria-label={`${b.dept} · ${t(`dash.bench.${c}`)}: ${t('dash.roles', { count: b[c].length })}`}
                        onClick={() => ctx.open(`${b.dept} · ${t(`dash.bench.${c}`)}`, b[c])}
                        className="h-full rounded-[3px] text-[0.6875rem] font-semibold transition hover:opacity-80"
                        style={{ flexGrow: b[c].length, background: BENCH_COLORS[c], color: c === 'thin' ? INK.primary : '#fff' }}>
                        {b[c].length / total >= 0.12 ? b[c].length : ''}
                      </button>
                    ))}
                  </span>
                  <span className="num text-right text-muted">{total}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 sm:hidden">{legend}</div>
      </Panel>
      <Panel id="uncovered">
        <BigStat value={String(uncoveredAll.length)} label={`/ ${t('dash.roles', { count: critical.length })}`} tone={uncoveredAll.length ? 'risk' : 'ink'} />
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {uncovered.slice(0, 8).map((u) => (
            <li key={u.dept}>
              <button type="button" onClick={() => ctx.open(`${t('dash.m.uncovered.t')} · ${u.dept}`, u.ids)}
                className="tag border border-line bg-subtle text-ink hover:border-primary/40 hover:text-primary">
                {u.dept}<span className="num font-semibold">{u.ids.length}</span>
              </button>
            </li>
          ))}
        </ul>
        {uncoveredAll.length > 0 && <div className="mt-4"><LinkButton onClick={() => ctx.open(t('dash.m.uncovered.t'), uncoveredAll)}>{t('dash.viewAllRoles', { count: uncoveredAll.length })}</LinkButton></div>}
      </Panel>
      <CoverageMap ctx={ctx} />
      {ctx.mode === 'hr' && (
        <Panel id="concentration" className="lg:col-span-2">
          {concentration.length === 0 ? <p className="text-sm text-muted">{t('dash.bench.noConcentration')}</p> : (
            <ul className="divide-y divide-line">
              {concentration.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <button type="button" className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-subtle/60" onClick={() => ctx.open(`${c.name} · ${t('dash.bench.namedFor', { count: c.holders.length })}`, c.holders)}>
                    <Avatar name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted">{dept(c.id)}</span>
                    </span>
                    <span className="hidden w-32 sm:block"><Meter pct={(c.holders.length / concentration[0].holders.length) * 100} color={PALETTE[5]} /></span>
                    <span className="num w-44 whitespace-nowrap text-right text-sm">{t('dash.bench.namedFor', { count: c.holders.length })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      <div className={`grid gap-6 ${ctx.mode === 'hr' ? '' : 'lg:col-span-3 sm:grid-cols-2'}`}>
        <Panel id="external"><BigStat value={fmtPct(external)} label={t('dash.m.external.formula')} /></Panel>
        <Panel id="fragile">
          <div className="flex items-end justify-between gap-4">
            <BigStat value={String(fragile.length)} label={t('dash.roles', { count: fragile.length })} tone={fragile.length ? 'risk' : 'ink'} />
            {fragile.length > 0 && <LinkButton onClick={() => ctx.open(t('dash.m.fragile.t'), [...new Set(fragile.map((f) => f.holderId))])}>{t('dash.viewList')}</LinkButton>}
          </div>
          {fragile.length > 0 && <p className="mt-3 truncate text-xs text-muted">{fragile.slice(0, 2).map((f) => `${name(f.holderId)} → ${name(f.successorId)}`).join('；')}</p>}
        </Panel>
      </div>
    </div>
  );
}

function CoverageMap({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { name } = useNames(ctx);
  const deptOf = new Map(ctx.ds.people.map((p) => [p.employee_id, p.dept]));
  const critical = ctx.ds.reviews.filter((r) => r.is_critical_role);
  const groups = [...new Set(critical.map((r) => deptOf.get(r.employee_id) ?? ''))].sort((a, b) => a.localeCompare(b, 'en'));
  const best = (r: (typeof critical)[number]) => {
    const order = ['Ready Now', '1-2 years', '3+ years', 'Emergency Cover'];
    const cands = r.successors.filter((x) => x.successor_type !== 'tbh').sort((a, b) => order.indexOf(a.readiness ?? '') - order.indexOf(b.readiness ?? ''));
    return cands[0]?.display_name ?? cands[0]?.external_name ?? t('dash.bench.none');
  };
  return (
    <Panel id="coverage" className="lg:col-span-3">
      {critical.length === 0 ? <Empty /> : (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const roles = critical.filter((r) => deptOf.get(r.employee_id) === g);
            return (
              <div key={g}>
                <p className="mb-1.5 flex justify-between text-xs"><span className="font-medium">{g}</span><span className="num text-muted">{roles.length}</span></p>
                <div className="flex flex-wrap gap-1">
                  {roles.map((r) => {
                    const cls = m.benchClass(m.benchScore(r));
                    const label = `${name(r.employee_id)} · ${t(`dash.bench.${cls}`)} · ${t('dash.bench.successor')}: ${best(r)}`;
                    return (
                      <button key={r.employee_id} type="button" title={label} aria-label={label}
                        onClick={() => ctx.open(name(r.employee_id), [r.employee_id])}
                        className="h-5 w-5 rounded-[4px] transition hover:scale-125 hover:ring-2 hover:ring-ink/20"
                        style={{ background: BENCH_COLORS[cls] }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ Careers and development */

const READY_COLORS = [STATUS.good, PALETTE[0], '#9EC5F4', '#C3C9D5'];
const MIX = ['Experience (70%)', 'Exposure (20%)', 'Education (10%)'];
const MIX_COLORS = [PALETTE[0], PALETTE[2], PALETTE[1]];

function SegmentBar({ parts, onPick }: { parts: { label: string; value: number; color: string; dark?: boolean }[]; onPick?: (i: number) => void }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  return (
    <div className="flex h-9 gap-0.5">
      {parts.filter((p) => p.value > 0).map((p) => {
        const i = parts.indexOf(p);
        const share = (p.value / total) * 100;
        const content = share >= 9 ? `${Math.round(share)}%` : '';
        const style = { flexGrow: p.value, background: p.color, color: p.dark ? INK.primary : '#fff' };
        return onPick ? (
          <button key={p.label} type="button" title={`${p.label}: ${p.value}`} aria-label={`${p.label}: ${p.value}`} onClick={() => onPick(i)}
            className="h-full rounded-[4px] text-xs font-semibold transition hover:opacity-85" style={style}>{content}</button>
        ) : <span key={p.label} title={`${p.label}: ${p.value}`} className="grid h-full place-items-center rounded-[4px] text-xs font-semibold" style={style}>{content}</span>;
      })}
    </div>
  );
}

export function GrowthSection({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { labelOf, optionsFor } = useRef_();
  const pipeline = s.nextStepReadiness(ctx.ds);
  const mobility = m.mobilityDistribution(ctx.ds);
  const mobOrder = optionsFor('mobility').map((o) => o.value);
  mobility.sort((a, b) => mobOrder.indexOf(a.status) - mobOrder.indexOf(b.status));
  const mix = m.devMix(ctx.ds);
  const timeline = m.planTimeline(ctx.ds);
  const peak = timeline.slice().sort((a, b) => b.count - a.count)[0];
  const pbm = m.pbmDistribution(ctx.ds, optionsFor('pbm_principle').map((o) => o.value));
  const pbmMax = Math.max(1, ...pbm.flatMap((p) => [p.strengths, p.improvements]));
  const topS = pbm.slice().sort((a, b) => b.strengths - a.strengths)[0];
  const topI = pbm.slice().sort((a, b) => b.improvements - a.improvements)[0];
  const k = m.kpis(ctx.ds);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel id="pipeline">
        <SegmentBar parts={pipeline.map((p, i) => ({ label: t(`dash.growth.${p.stage}`), value: p.ids.length, color: READY_COLORS[i], dark: i >= 2 }))}
          onPick={(i) => ctx.open(t(`dash.growth.${pipeline[i].stage}`), pipeline[i].ids)} />
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pipeline.map((p, i) => (
            <li key={p.stage}>
              <button type="button" className="w-full rounded-lg border border-line p-2.5 text-left hover:border-primary/40" onClick={() => ctx.open(t(`dash.growth.${p.stage}`), p.ids)}>
                <span className="flex items-center gap-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full" style={{ background: READY_COLORS[i] }} aria-hidden="true" />{t(`dash.growth.${p.stage}`)}</span>
                <span className="num mt-1 block text-xl font-semibold">{p.ids.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel id="mobility">
        {mobility.length === 0 ? <Empty /> : (
          <>
            <SegmentBar parts={mobility.map((x, i) => ({ label: labelOf('mobility', x.status), value: x.count, color: PALETTE[i % PALETTE.length], dark: i === 3 }))}
              onPick={(i) => ctx.open(labelOf('mobility', mobility[i].status), mobility[i].ids)} />
            <div className="mt-4"><Legend items={mobility.map((x, i) => ({ label: `${labelOf('mobility', x.status)} ${x.count}`, color: PALETTE[i % PALETTE.length] }))} /></div>
          </>
        )}
      </Panel>
      <Panel id="mix" aside={<span className="text-right text-xs text-muted">{t('dash.m.planComplete.t')}<span className="num ml-1.5 text-base font-semibold text-ink">{fmtPct(k.planCompletePct)}</span><InfoTip id="planComplete" /></span>}>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted">{t('dash.growth.actual')}</p>
            <SegmentBar parts={mix.map((x, i) => ({ label: labelOf('dev_type', x.type), value: x.count, color: MIX_COLORS[i] }))} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted">{t('dash.growth.reference')}</p>
            <SegmentBar parts={mix.map((x, i) => ({ label: labelOf('dev_type', x.type), value: x.reference, color: `${MIX_COLORS[i]}66`, dark: true }))} />
          </div>
          <Legend items={MIX.map((type, i) => ({ label: labelOf('dev_type', type), color: MIX_COLORS[i] }))} />
        </div>
      </Panel>
      <Panel id="checkpoints" aside={peak && <span className="tag bg-info-bg text-info-fg">{t('dash.growth.dueThisMonth', { month: peak.month, count: peak.count })}</span>}>
        {timeline.length === 0 ? <Empty /> : (
          <Chart label={t('dash.m.checkpoints.t')} height={220}
            onClick={(p) => ctx.open(String(p.name), timeline[p.dataIndex ?? 0]?.ids ?? [])}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: 28, right: 8, top: 12, bottom: 24 },
              xAxis: { type: 'category', data: timeline.map((x) => x.month), axisLine: { lineStyle: { color: INK.axis } }, axisTick: { show: false } },
              yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: INK.grid } } },
              series: [{ type: 'bar', barMaxWidth: 22, data: timeline.map((x) => ({ value: x.count, itemStyle: { color: x === peak ? PALETTE[0] : '#9EC5F4', borderRadius: [4, 4, 0, 0] } })) }],
            }} />
        )}
      </Panel>
      <Panel id="pbm" className="lg:col-span-2" aside={<Legend items={[{ label: t('dash.growth.improvements'), color: PALETTE[1] }, { label: t('dash.growth.strengths'), color: PALETTE[2] }]} />}>
        {pbm.length === 0 ? <Empty /> : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {topS && topS.strengths > 0 && <span className="tag bg-ok-bg text-ok-fg">{t('dash.growth.mostStrength', { value: labelOf('pbm_principle', topS.principle) })}</span>}
              {topI && topI.improvements > 0 && <span className="tag bg-warn-bg text-warn-fg">{t('dash.growth.mostImprove', { value: labelOf('pbm_principle', topI.principle) })}</span>}
            </div>
            <ul className="space-y-2">
              {pbm.map((p) => (
                <li key={p.principle} className="grid grid-cols-[1fr_minmax(7rem,12rem)_1fr] items-center gap-3 text-sm">
                  <span className="flex items-center justify-end gap-2">
                    <span className="num text-xs text-muted">{p.improvements}</span>
                    <span className="h-3 rounded-l-sm" style={{ width: `${(p.improvements / pbmMax) * 100}%`, background: PALETTE[1] }} aria-hidden="true" />
                  </span>
                  <span className="truncate text-center text-xs font-medium" title={labelOf('pbm_principle', p.principle)}>{labelOf('pbm_principle', p.principle)}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 rounded-r-sm" style={{ width: `${(p.strengths / pbmMax) * 100}%`, background: PALETTE[2] }} aria-hidden="true" />
                    <span className="num text-xs text-muted">{p.strengths}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ Action list (HR only) */

function ActionCard({ id, Icon, tone, count, unit, preview, onOpen, children }: {
  id: string; Icon: typeof Search; tone: string; count: number; unit: string; preview: string[]; onOpen?: () => void; children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t(`dash.act.${id}.t`)}</h3>
          <p className="mt-0.5 text-sm text-muted">{t(`dash.act.${id}.why`)}</p>
        </div>
        <span className="text-right">
          <span className="num block text-3xl font-semibold leading-none">{count}</span>
          <span className="text-xs text-muted">{unit}</span>
        </span>
      </div>
      {preview.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {preview.slice(0, 4).map((p) => <li key={p} className="flex items-center gap-1.5 rounded-full bg-subtle py-0.5 pl-0.5 pr-2.5 text-xs"><Avatar name={p} size="sm" />{p}</li>)}
          {preview.length > 4 && <li className="rounded-full bg-subtle px-2.5 py-1 text-xs text-muted">+{preview.length - 4}</li>}
        </ul>
      )}
      {children}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm" style={{ marginTop: '1rem' }}>
        <span className="flex items-center gap-1.5 text-muted"><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />{t(`dash.act.${id}.next`)}</span>
        <span className="flex items-center gap-3">
          <span className="tag bg-subtle text-muted">{t('dash.act.owner')}：{t(`dash.act.${id}.owner`)}</span>
          {onOpen && count > 0 && <LinkButton onClick={onOpen}>{t('dash.viewList')}</LinkButton>}
        </span>
      </div>
    </article>
  );
}

export function ActionsSection({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation();
  const { name } = useNames(ctx);
  const conv = ins.conversationPriorities(ctx.ds);
  const talk = [...conv.high, ...conv.medium];
  const fragile = ins.fragileCoverage(ctx.ds);
  const fragileHolders = [...new Set(fragile.map((f) => f.holderId))];
  const hidden = ins.unlistedSuccessors(ctx.ds);
  const matches = ins.internalMatches(ctx.ds);
  const cal = ins.calibrationSignals(ctx.ds);
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted">{t('dash.act.subtitle')}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <ActionCard id="talk" Icon={MessagesSquare} tone="bg-primary-soft text-primary-ink" count={talk.length} unit={t('dash.unitPeople')}
          preview={talk.map(name)} onOpen={() => ctx.open(t('dash.act.talk.t'), talk)} />
        <ActionCard id="fragile" Icon={ShieldAlert} tone="bg-warn-bg text-warn-fg" count={fragileHolders.length} unit={t('dash.unitRoles')}
          preview={fragile.map((f) => name(f.successorId))} onOpen={() => ctx.open(t('dash.act.fragile.t'), [...new Set(fragile.flatMap((f) => [f.holderId, f.successorId]))])} />
        <ActionCard id="hidden" Icon={UserRoundSearch} tone="bg-info-bg text-info-fg" count={hidden.length} unit={t('dash.unitPeople')}
          preview={hidden.map((h) => name(h.id))} onOpen={() => ctx.open(t('dash.act.hidden.t'), hidden.map((h) => h.id))} />
        <ActionCard id="internal" Icon={Search} tone="bg-ok-bg text-ok-fg" count={matches.length} unit={t('dash.unitRoles')}
          preview={[...new Set(matches.flatMap((x) => x.candidates.map((c) => name(c.id))))]}
          onOpen={() => ctx.open(t('dash.act.internal.t'), [...new Set(matches.flatMap((x) => [x.holderId, ...x.candidates.map((c) => c.id)]))])} />
        <div className="lg:col-span-2">
          <ActionCard id="calibrate" Icon={ClipboardCheck} tone="bg-subtle text-muted" count={cal.length} unit={t('dash.unitTeams')} preview={[]}>
            {cal.length > 0 && (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {cal.map((c) => (
                  <li key={c.reviewerId}>
                    <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-line p-2.5 text-left hover:border-primary/40"
                      onClick={() => ctx.open(name(c.reviewerId), ctx.ds.reviews.filter((r) => r.reviewer_id === c.reviewerId).map((r) => r.employee_id))}>
                      <Avatar name={name(c.reviewerId)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{name(c.reviewerId)}</span>
                        <span className="mt-1 flex flex-wrap gap-1">{c.signals.map((x) => <span key={x} className="tag bg-warn-bg text-warn-fg">{t(`dash.act.sig.${x}`)}</span>)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ActionCard>
        </div>
      </div>
      {talk.length + fragile.length + hidden.length + matches.length + cal.length === 0 && <p className="text-sm text-muted">{t('dash.act.none')}</p>}
    </div>
  );
}
