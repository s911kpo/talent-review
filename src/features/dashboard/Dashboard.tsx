import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { ErrorNotice } from '../../components/AppShell';
import { fetchDashboard, fetchPlantAverages, fetchThemeTags, type DashboardData, type PlantAverages } from '../../data/dashboard';
import { hrOverview, type TeamOverview } from '../../data/hr';
import * as m from '../../lib/metrics';
import type { ThemeTag } from '../../lib/metrics';
import { ReferenceProvider, useRef_ } from '../manager/referenceData';
import { ReviewSummary } from '../manager/ReviewSummary';
import { BENCH_COLORS, Chart, RISK_COLORS, type ChartClick } from './Chart';

type Mode = 'hr' | 'manager';
const showPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(Number(v))}%`);
const TABS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
type Tab = (typeof TABS)[number];

export default function Dashboard({ mode }: { mode: Mode }) {
  return <ReferenceProvider bare managerId={mode === 'hr' ? 0 : undefined}><Inner mode={mode} /></ReferenceProvider>;
}

function Inner({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const { cycle } = useRef_();
  const [data, setData] = useState<DashboardData | null>(null);
  const [averages, setAverages] = useState<PlantAverages | null>(null);
  const [tags, setTags] = useState<ThemeTag[] | null>(null);
  const [teams, setTeams] = useState<TeamOverview[]>([]);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('A');
  const [filters, setFilters] = useState<m.Filters>(m.NO_FILTERS);
  const [drill, setDrill] = useState<{ title: string; ids: number[] } | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const d = await fetchDashboard(cycle.id);
      setData(d);
      if (mode === 'manager') setAverages(await fetchPlantAverages(cycle.id));
      if (mode === 'hr') {
        setTeams(await hrOverview(cycle.id));
        setTags(await fetchThemeTags(cycle.id));
      }
    } catch {
      setFailed(true);
    }
  }, [cycle.id, mode]);

  useEffect(() => void load(), [load]);

  const ds = useMemo(() => (data ? m.applyFilters(data, filters) : null), [data, filters]);

  if (failed) return <ErrorNotice onRetry={() => void load()} />;
  if (!data || !ds) return <p role="status" className="text-muted">{t('app.loading')}</p>;

  const k = m.kpis(ds);
  const depts = [...new Set(data.people.map((p) => p.dept))].sort();
  const reviewers = [...new Set(data.people.map((p) => p.reviewer_id))];
  const open = (title: string, ids: number[]) => setDrill({ title, ids });
  const tabs = TABS.filter((x) => x !== 'F' || mode === 'hr');

  return (
    <div className="space-y-4">
      {mode === 'manager' && <p className="text-sm text-muted">{t('dash.scopeNoteManager')}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Select label={t('dash.filterDept')} value={filters.dept} onChange={(v) => setFilters({ ...filters, dept: v })}
          options={[['', t('dash.all')], ...depts.map((d): [string, string] => [d, d])]} />
        <Select label={t('dash.filterReviewer')} value={filters.reviewer === null ? '' : String(filters.reviewer)}
          onChange={(v) => setFilters({ ...filters, reviewer: v ? Number(v) : null })}
          options={[['', t('dash.all')], ...reviewers.map((r): [string, string] => [String(r), data.reviewerNames.get(r) ?? String(r)])]} />
        <Select label={t('dash.filterCritical')} value={filters.critical} onChange={(v) => setFilters({ ...filters, critical: v as m.Filters['critical'] })}
          options={[['', t('dash.all')], ['yes', t('dash.yes')], ['no', t('dash.no')]]} />
        <Select label={t('dash.filterTenure')} value={filters.tenure} onChange={(v) => setFilters({ ...filters, tenure: v as m.Filters['tenure'] })}
          options={[['', t('dash.all')], ...m.TENURE_BANDS.map((b): [string, string] => [b, t(`dash.band.${b}`)])]} />
        <Select label={t('dash.dataState')} value={filters.submittedOnly ? 'sub' : ''} onChange={(v) => setFilters({ ...filters, submittedOnly: v === 'sub' })}
          options={[['', t('dash.includeDraft')], ['sub', t('dash.submittedOnly')]]} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label={t('dash.kCompletion')} value={showPct(k.completionPct)} />
        <Kpi label={t('dash.kKey')} value={String(k.keyCount)} note={t('dash.kKeyNote', { pct: showPct(k.keyPct) })}
          compare={averages && t('dash.plantAvg', { value: showPct(averages.key_pct) })} />
        <Kpi label={t('dash.kCritical')} value={String(k.criticalCount)} />
        <Kpi label={t('dash.kCriticalHigh')} value={String(k.criticalHighRisk)} />
        <Kpi label={t('dash.kCoverage')} value={showPct(k.coveragePct)} compare={averages && t('dash.plantAvg', { value: showPct(averages.coverage_pct) })} />
        <Kpi label={t('dash.kTbh')} value={String(k.tbhRoles)} />
        <Kpi label={t('dash.kPlan')} value={showPct(k.planCompletePct)} compare={averages && t('dash.plantAvg', { value: showPct(averages.plan_complete_pct) })} />
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x}
            className={`btn rounded-b-none border-b-2 ${tab === x ? 'border-brand text-brand' : 'border-transparent text-muted'}`}
            onClick={() => setTab(x)}>{t(`dash.tab${x}`)}</button>
        ))}
      </div>

      {tab === 'A' && <OrgTab ds={ds} />}
      {tab === 'B' && <RiskTab ds={ds} open={open} averages={averages} />}
      {tab === 'C' && <BenchTab ds={ds} open={open} mode={mode} />}
      {tab === 'D' && <CareerTab ds={ds} open={open} averages={averages} />}
      {tab === 'E' && <DevTab ds={ds} open={open} tags={tags} mode={mode} />}
      {tab === 'F' && mode === 'hr' && <ProgressTab teams={teams} />}

      {drill && <Drill drill={drill} data={data} onClose={() => setDrill(null)} />}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="label">
        {label}
        <select className="field mt-1 font-normal" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    </div>
  );
}

function Kpi({ label, value, note, compare }: { label: string; value: string; note?: string; compare?: string | null | false }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      {compare && <p className="mt-1 text-xs text-muted">{compare}</p>}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="font-semibold">{title}</h3>
      {note && <p className="text-sm text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const heatBg = (value: number | null, max: number) => (value === null || max === 0 ? undefined : `rgba(0, 114, 178, ${(0.08 + (value / max) * 0.4).toFixed(2)})`);

function OrgTab({ ds }: { ds: m.Dataset }) {
  const { t } = useTranslation();
  const stats = m.deptStats(ds);
  const tenure = m.tenureDistribution(ds);
  const gender = m.genderByDept(ds);
  const cols: Array<[string, (d: m.DeptStat) => number | null, (v: number | null) => string, number]> = [
    ['dash.cScope', (d) => d.scope, (v) => String(v), Math.max(...stats.map((d) => d.scope), 1)],
    ['dash.cKey', (d) => d.key, (v) => String(v), Math.max(...stats.map((d) => d.key), 1)],
    ['dash.cTenure', (d) => d.avgTenureYears, (v) => (v === null ? '—' : v.toFixed(1)), Math.max(...stats.map((d) => d.avgTenureYears ?? 0), 1)],
    ['dash.cMedHigh', (d) => d.medHighPct, showPct, 100],
    ['dash.cBench', (d) => d.benchAvg, (v) => (v === null ? '—' : v.toFixed(1)), 3],
    ['dash.cPlan', (d) => d.planCompletePct, showPct, 100],
    ['dash.cTntr', (d) => d.tntr, (v) => String(v), Math.max(...stats.map((d) => d.tntr), 1)],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t('dash.treemap')} note={t('dash.treemapNote')}>
        <Chart
          label={t('dash.treemap')}
          option={{
            tooltip: { formatter: (p: { name: string; value: [number, number] }) => `${p.name}: ${p.value[0]} / ${Math.round(p.value[1])}%` },
            visualMap: { show: false, min: 0, max: 100, dimension: 1, inRange: { color: ['#DCEBF7', '#0072B2'] } },
            series: [{
              type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false },
              data: stats.map((d) => ({ name: d.dept, value: [d.scope, d.keyPct] })),
            }],
          }}
        />
      </Panel>
      <Panel title={t('dash.tenure')}>
        <Chart
          label={t('dash.tenure')}
          option={{
            tooltip: { trigger: 'axis' }, legend: { bottom: 0 }, grid: { left: 36, right: 12, top: 12, bottom: 56 },
            xAxis: { type: 'category', data: tenure.map((b) => t(`dash.band.${b.band}`)), axisLabel: { interval: 0, fontSize: 10 } },
            yAxis: { type: 'value', minInterval: 1 },
            series: [
              { name: t('dash.sScope'), type: 'bar', data: tenure.map((b) => b.scope) },
              { name: t('dash.sKey'), type: 'bar', data: tenure.map((b) => b.key) },
            ],
          }}
        />
      </Panel>
      <div className="lg:col-span-2">
        <Panel title={t('dash.heat')}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">{t('dash.cDept')}</th>{cols.map(([key]) => <th key={key} className="th">{t(key)}</th>)}</tr></thead>
              <tbody>
                {stats.map((d) => (
                  <tr key={d.dept}>
                    <td className="td font-medium">{d.dept}</td>
                    {cols.map(([key, read, format, max]) => {
                      const value = read(d);
                      return <td key={key} className="td" style={{ background: heatBg(value, max) }}>{format(value)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div className="lg:col-span-2">
        <Panel title={t('dash.gender')} note={t('dash.genderNote')}>
          <ul className="space-y-1 text-sm">
            {gender.map((g) => (
              <li key={g.dept}>
                <span className="font-medium">{g.dept}</span>：
                {g.suppressed ? t('dash.hidden') : `${t('dash.female')} ${showPct(g.femalePct)} · ${t('dash.male')} ${showPct(g.malePct)}`}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

interface TabProps { ds: m.Dataset; open: (title: string, ids: number[]) => void; averages?: PlantAverages | null; }

function RiskTab({ ds, open, averages }: TabProps) {
  const { t } = useTranslation();
  const { labelOf } = useRef_();
  const matrix = m.riskMatrix(ds);
  const pareto = m.reasonPareto(ds);
  const flight = m.flightRisk(ds);

  const cell = (risk: string, ids: number[], title: string, priority: boolean) => (
    <button
      type="button"
      className={`w-full rounded-card p-4 text-left ${priority ? 'bg-risk-bg text-risk-fg' : 'bg-canvas'}`}
      onClick={() => open(title, ids)}
      aria-label={`${title}: ${t('dash.people', { count: ids.length })}`}
    >
      <span className="block text-2xl font-semibold">{ids.length}</span>
      {priority && <span className="text-xs font-medium">{t('dash.priority')}</span>}
      <span className="sr-only">{risk}</span>
    </button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t('dash.riskMatrix')} note={averages ? t('dash.plantAvg', { value: showPct(averages.med_high_pct) }) : undefined}>
        <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 text-sm">
          <span />
          <span className="text-center font-medium">{t('dash.isCritical')}</span>
          <span className="text-center font-medium">{t('dash.notCritical')}</span>
          {matrix.map((row) => (
            <div key={row.risk} className="contents">
              <span className="self-center font-medium" style={{ color: RISK_COLORS[row.risk] }}>{labelOf('retention_risk', row.risk)}</span>
              {cell(row.risk, row.critical, `${labelOf('retention_risk', row.risk)} × ${t('dash.isCritical')}`, row.risk === 'High')}
              {cell(row.risk, row.other, `${labelOf('retention_risk', row.risk)} × ${t('dash.notCritical')}`, false)}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title={t('dash.pareto')}>
        {pareto.length === 0 ? <p className="text-sm text-muted">{t('dash.noData')}</p> : (
          <Chart
            label={t('dash.pareto')}
            onClick={(p: ChartClick) => open(String(p.name), pareto.find((x) => labelOf('retention_reason', x.reason) === p.name)?.ids ?? [])}
            option={{
              tooltip: {}, grid: { containLabel: true, left: 8, right: 16, top: 8, bottom: 24 },
              xAxis: { type: 'value', minInterval: 1 },
              yAxis: { type: 'category', inverse: true, data: pareto.map((x) => labelOf('retention_reason', x.reason)) },
              series: [{ type: 'bar', data: pareto.map((x) => x.count), itemStyle: { color: '#D9A01B' } }],
            }}
          />
        )}
      </Panel>
      <Panel title={t('dash.flight')} note={t('dash.flightNote')}>
        <p className="text-2xl font-semibold text-brand">{flight.length}</p>
        {flight.length > 0 && <button type="button" className="btn-secondary mt-2" onClick={() => open(t('dash.flight'), flight)}>{t('dash.viewList')}</button>}
      </Panel>
    </div>
  );
}

function BenchTab({ ds, open, mode }: TabProps & { mode: Mode }) {
  const { t } = useTranslation();
  const bench = m.benchByDept(ds);
  const single = m.singlePoints(ds);
  const concentration = m.successorConcentration(ds);
  const links = m.successionLinks(ds);
  const external = m.externalDependencyPct(ds);
  const nameOf = (id: number) => ds.people.find((p) => p.employee_id === id)?.name ?? String(id);

  // Holders and successors are separate nodes, so mutual succession cannot form a cycle.
  const holders = [...new Set(links.map((l) => `H:${nameOf(l.holderId)}`))];
  const successors = [...new Set(links.map((l) => `S:${l.successor}`))];
  const lineColor = (l: m.NetworkLink) => (l.type !== 'internal' ? '#9CA3AF'
    : l.readiness === 'Ready Now' ? BENCH_COLORS.strong : l.readiness === '1-2 years' ? BENCH_COLORS.developing : BENCH_COLORS.thin);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t('dash.bench')}>
        {bench.length === 0 ? <p className="text-sm text-muted">{t('dash.noData')}</p> : (
          <Chart
            label={t('dash.bench')}
            onClick={(p: ChartClick) => {
              const row = bench.find((b) => b.dept === p.name);
              const key = m.BENCH_CLASSES.find((c) => t(`dash.${c}`) === p.seriesName);
              if (row && key) open(`${p.name} · ${p.seriesName}`, row[key]);
            }}
            option={{
              tooltip: { trigger: 'axis' }, legend: { bottom: 0 }, grid: { containLabel: true, left: 8, right: 16, top: 8, bottom: 48 },
              xAxis: { type: 'value', minInterval: 1 },
              yAxis: { type: 'category', data: bench.map((b) => b.dept) },
              series: m.BENCH_CLASSES.map((c) => ({
                name: t(`dash.${c}`), type: 'bar', stack: 'total', itemStyle: { color: BENCH_COLORS[c] },
                data: bench.map((b) => b[c].length),
              })),
            }}
          />
        )}
      </Panel>
      <Panel title={t('dash.singlePoint')}>
        {single.length === 0 ? <p className="text-sm text-muted">{t('dash.noData')}</p> : (
          <>
            <p className="text-2xl font-semibold text-brand">{single.length}</p>
            <ul className="mt-2 text-sm">{single.map((id) => <li key={id}>{nameOf(id)}</li>)}</ul>
            <button type="button" className="btn-secondary mt-2" onClick={() => open(t('dash.singlePoint'), single)}>{t('dash.viewList')}</button>
          </>
        )}
      </Panel>
      {mode === 'hr' && (
        <Panel title={t('dash.concentration')}>
          {concentration.length === 0 ? <p className="text-sm text-muted">{t('dash.noConcentration')}</p> : (
            <ul className="space-y-1 text-sm">
              {concentration.map((c) => (
                <li key={c.id}>
                  <button type="button" className="underline" onClick={() => open(c.name, c.holders)}>{c.name}</button>：{t('dash.people', { count: c.holders.length })}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      <Panel title={t('dash.external')} note={t('dash.externalNote')}>
        <p className="text-2xl font-semibold text-brand">{showPct(external)}</p>
      </Panel>
      <div className="lg:col-span-2">
        <Panel title={t('dash.network')}>
          {links.length === 0 ? <p className="text-sm text-muted">{t('dash.noData')}</p> : (
            <Chart
              label={t('dash.network')}
              height={Math.max(320, holders.length * 28)}
              option={{
                tooltip: { formatter: (p: { name: string }) => p.name.replace(/[HS]:/g, '') },
                series: [{
                  type: 'sankey', left: 8, right: 120, top: 8, bottom: 8, nodeWidth: 10,
                  label: { formatter: (p: { name: string }) => p.name.slice(2) },
                  data: [...holders, ...successors].map((name) => ({ name })),
                  links: links.map((l) => ({
                    source: `H:${nameOf(l.holderId)}`, target: `S:${l.successor}`, value: 1,
                    lineStyle: { color: lineColor(l), opacity: 0.5 },
                  })),
                }],
              }}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function CareerTab({ ds, open, averages }: TabProps) {
  const { t } = useTranslation();
  const { labelOf } = useRef_();
  const funnel = m.readinessFunnel(ds);
  const mobility = m.mobilityDistribution(ds);
  const locations = m.desiredLocations(ds);
  const gaps = m.notDiscussed(ds);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t('dash.funnel')}>
        <Chart
          label={t('dash.funnel')}
          onClick={(p: ChartClick) => open(String(p.name), funnel[p.dataIndex ?? 0]?.ids ?? [])}
          option={{
            tooltip: {}, grid: { containLabel: true, left: 8, right: 16, top: 8, bottom: 24 },
            xAxis: { type: 'value', minInterval: 1 },
            yAxis: { type: 'category', inverse: true, data: funnel.map((s) => labelOf('readiness', s.stage)) },
            series: [{ type: 'bar', data: funnel.map((s) => s.count) }],
          }}
        />
      </Panel>
      <Panel title={t('dash.mobility')}>
        {mobility.length === 0 ? <p className="text-sm text-muted">{t('dash.noData')}</p> : (
          <Chart
            label={t('dash.mobility')}
            onClick={(p: ChartClick) => open(String(p.name), mobility[p.dataIndex ?? 0]?.ids ?? [])}
            option={{
              tooltip: {},
              series: [{ type: 'pie', radius: ['40%', '68%'], data: mobility.map((x) => ({ name: labelOf('mobility', x.status), value: x.count })) }],
            }}
          />
        )}
      </Panel>
      <Panel title={t('dash.gapTalks')} note={averages ? t('dash.plantAvg', { value: showPct(averages.not_discussed_pct) }) : undefined}>
        <p className="text-2xl font-semibold text-brand">{gaps.length}</p>
        {gaps.length > 0 && <button type="button" className="btn-secondary mt-2" onClick={() => open(t('dash.gapTalks'), gaps)}>{t('dash.viewList')}</button>}
      </Panel>
      <Panel title={t('dash.locations')}>
        {locations.length === 0 ? <p className="text-sm text-muted">{t('dash.noLocations')}</p>
          : <ul className="text-sm">{locations.map((l) => <li key={l}>{l}</li>)}</ul>}
      </Panel>
    </div>
  );
}

function DevTab({ ds, open, tags, mode }: TabProps & { tags: ThemeTag[] | null; mode: Mode }) {
  const { t } = useTranslation();
  const { labelOf, optionsFor } = useRef_();
  const mix = m.devMix(ds);
  const timeline = m.planTimeline(ds);
  const owners = m.ownerLoad(ds);
  const pbm = m.pbmDistribution(ds, optionsFor('pbm_principle').map((o) => o.value));
  const themes = tags ? m.themeMatrix(tags, ds) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t('dash.mix')}>
        <Chart
          label={t('dash.mix')}
          option={{
            tooltip: { trigger: 'axis' }, legend: { bottom: 0 }, grid: { left: 40, right: 12, top: 12, bottom: 48 },
            xAxis: { type: 'category', data: mix.map((x) => x.type) }, yAxis: { type: 'value', max: 100 },
            series: [
              { name: t('dash.mixActual'), type: 'bar', data: mix.map((x) => (x.pct === null ? 0 : Math.round(x.pct))) },
              { name: t('dash.mixRef'), type: 'line', data: mix.map((x) => x.reference), lineStyle: { type: 'dashed' } },
            ],
          }}
        />
      </Panel>
      <Panel title={t('dash.timeline')}>
        {timeline.length === 0 ? <p className="text-sm text-muted">{t('dash.noData')}</p> : (
          <Chart
            label={t('dash.timeline')}
            onClick={(p: ChartClick) => open(String(p.name), timeline[p.dataIndex ?? 0]?.ids ?? [])}
            option={{
              tooltip: {}, grid: { left: 32, right: 12, top: 12, bottom: 28 },
              xAxis: { type: 'category', data: timeline.map((x) => x.month) }, yAxis: { type: 'value', minInterval: 1 },
              series: [{ type: 'bar', data: timeline.map((x) => x.count) }],
            }}
          />
        )}
      </Panel>
      <Panel title={t('dash.owners')}>
        {owners.length === 0 ? <p className="text-sm text-muted">{t('dash.noData')}</p> : (
          <Chart
            label={t('dash.owners')}
            option={{
              tooltip: {}, grid: { containLabel: true, left: 8, right: 16, top: 8, bottom: 24 },
              xAxis: { type: 'value', minInterval: 1 }, yAxis: { type: 'category', inverse: true, data: owners.map((x) => x.owner) },
              series: [{ type: 'bar', data: owners.map((x) => x.actions) }],
            }}
          />
        )}
      </Panel>
      <Panel title={t('dash.pbm')}>
        {pbm.length === 0 ? <p className="text-sm text-muted">{t('dash.noData')}</p> : (
          <Chart
            label={t('dash.pbm')}
            option={{
              tooltip: { trigger: 'axis', valueFormatter: (v: number) => String(Math.abs(v)) }, legend: { bottom: 0 },
              grid: { containLabel: true, left: 8, right: 16, top: 8, bottom: 48 },
              xAxis: { type: 'value', minInterval: 1, axisLabel: { formatter: (v: number) => String(Math.abs(v)) } },
              yAxis: { type: 'category', data: pbm.map((x) => labelOf('pbm_principle', x.principle)) },
              series: [
                { name: t('dash.strengths'), type: 'bar', stack: 'p', data: pbm.map((x) => x.strengths), itemStyle: { color: '#009E73' } },
                { name: t('dash.improvements'), type: 'bar', stack: 'p', data: pbm.map((x) => -x.improvements), itemStyle: { color: '#E69F00' } },
              ],
            }}
          />
        )}
      </Panel>
      {mode === 'hr' && (
        <div className="lg:col-span-2">
          <Panel title={t('dash.themes')}>
            {!themes || themes.themes.length === 0 ? <p className="text-sm text-muted">{t('dash.themesEmpty')}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><th className="th" />{themes.depts.map((d) => <th key={d} className="th">{d}</th>)}</tr></thead>
                  <tbody>
                    {themes.themes.map((theme, i) => (
                      <tr key={theme}>
                        <td className="td font-medium">{theme}</td>
                        {themes.cells[i].map((n, j) => <td key={j} className="td" style={{ background: heatBg(n, Math.max(...themes.cells.flat(), 1)) }}>{n}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function ProgressTab({ teams }: { teams: TeamOverview[] }) {
  const { t } = useTranslation();
  return (
    <Panel title={t('dash.progress')}>
      <Chart
        label={t('dash.progress')}
        height={Math.max(300, teams.length * 34)}
        option={{
          tooltip: {}, grid: { containLabel: true, left: 8, right: 24, top: 8, bottom: 24 },
          xAxis: { type: 'value', max: 100 }, yAxis: { type: 'category', inverse: true, data: teams.map((x) => x.full_name) },
          series: [{ type: 'bar', data: teams.map((x) => (Number(x.key_count) ? Math.round((Number(x.complete_count) / Number(x.key_count)) * 100) : 0)) }],
        }}
      />
    </Panel>
  );
}

function Drill({ drill, data, onClose }: { drill: { title: string; ids: number[] }; data: DashboardData; onClose: () => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const review = data.reviews.find((r) => r.employee_id === selected);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" role="dialog" aria-modal="true" aria-label={drill.title}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{drill.title}</h2>
          <button type="button" className="btn-secondary px-2 py-1" aria-label={t('dash.close')} onClick={onClose}><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <ul className="mt-3 space-y-2">
          {drill.ids.map((id) => {
            const p = data.people.find((x) => x.employee_id === id);
            return (
              <li key={id} className="rounded-card border border-line p-3">
                <button type="button" className="w-full text-left" aria-expanded={selected === id} onClick={() => setSelected(selected === id ? null : id)}>
                  <span className="font-medium">{p?.name ?? id}</span> <span className="text-sm text-muted">{p?.dept}</span>
                </button>
                {selected === id && review && <div className="mt-2 border-t border-line pt-2"><ReviewSummary review={review} /></div>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
