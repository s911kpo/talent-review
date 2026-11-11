import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Filter, GitFork, LayoutDashboard, ListChecks, ShieldAlert, Sprout, Users, X } from 'lucide-react';
import { ErrorNotice } from '../../components/AppShell';
import { fetchDashboard, fetchPlantAverages, type DashboardData, type PlantAverages } from '../../data/dashboard';
import * as m from '../../lib/metrics';
import { ReferenceProvider, useRef_ } from '../manager/referenceData';
import { Drill, type DrillStep } from './Drill';
import { ActionsSection, BenchSection, GrowthSection, OrgSection, OverviewSection, RiskSection, type Ctx, type Mode } from './sections';

const SECTIONS = [
  { key: 'overview', Icon: LayoutDashboard, View: OverviewSection },
  { key: 'org', Icon: Users, View: OrgSection },
  { key: 'risk', Icon: ShieldAlert, View: RiskSection },
  { key: 'bench', Icon: GitFork, View: BenchSection },
  { key: 'growth', Icon: Sprout, View: GrowthSection },
  { key: 'actions', Icon: ListChecks, View: ActionsSection, hrOnly: true },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

export default function Dashboard({ mode }: { mode: Mode }) {
  return <ReferenceProvider bare managerId={mode === 'hr' ? 0 : undefined}><Inner mode={mode} /></ReferenceProvider>;
}

function Inner({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const { cycle } = useRef_();
  const [data, setData] = useState<DashboardData | null>(null);
  const [averages, setAverages] = useState<PlantAverages | null>(null);
  const [failed, setFailed] = useState(false);
  // Section and filters live in the URL, so the browser Back button returns from a drill-in
  // and a view can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const section = (params.get('sec') ?? 'overview') as SectionKey;
  const filters = readFilters(params);
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next);
  };
  const setSection = (sec: SectionKey) => { update({ sec: sec === 'overview' ? null : sec }); window.scrollTo({ top: 0 }); };
  const setFilters = (f: m.Filters) => update(writeFilters(f));
  const [drill, setDrill] = useState<DrillStep | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await fetchDashboard(cycle.id));
      if (mode === 'manager') setAverages(await fetchPlantAverages(cycle.id));
    } catch {
      setFailed(true);
    }
  }, [cycle.id, mode]);

  useEffect(() => void load(), [load]);

  const filterKey = JSON.stringify(filters);
  const ds = useMemo(() => (data ? m.applyFilters(data, filters) : null), [data, filterKey]);

  if (failed) return <ErrorNotice onRetry={() => void load()} />;
  if (!data || !ds) return <p role="status" className="text-muted">{t('app.loading')}</p>;

  const ctx: Ctx = {
    ds, data, mode, averages,
    open: (title, ids) => setDrill({ kind: 'list', title, ids }),
    openPerson: (id) => setDrill({ kind: 'person', id }),
    setDept: (dept) => { setFilters({ ...filters, dept }); window.scrollTo({ top: 0 }); },
    goSection: (sec) => setSection(sec as SectionKey),
  };
  const shown = SECTIONS.filter((x) => !('hrOnly' in x) || mode === 'hr');
  const View = shown.find((x) => x.key === section)?.View ?? OverviewSection;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t('dash.title')}</h2>
        <p className="mt-1 text-sm text-muted">{t(mode === 'hr' ? 'dash.subtitleHr' : 'dash.subtitleManager', { cycle: cycle.quarter_label })}</p>
        {mode === 'manager' && <p className="mt-1 text-xs text-muted">{t('dash.scopeNoteManager')}</p>}
      </div>

      <FilterBar data={data} filters={filters} setFilters={setFilters} />
      {filters.dept && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-primary/20 bg-primary-soft px-4 py-2.5 text-sm">
          <button type="button" className="inline-flex items-center gap-1 font-medium text-primary-ink hover:underline" onClick={() => setFilters({ ...filters, dept: '' })}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('dash.backToPlant')}
          </button>
          <span className="text-muted">{t('dash.filteredBy')}：<span className="font-semibold text-ink">{filters.dept}</span></span>
        </div>
      )}

      <div role="tablist" aria-label={t('dash.title')} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {shown.map(({ key, Icon }) => {
          const on = key === section;
          return (
            <button key={key} type="button" role="tab" aria-selected={on} onClick={() => setSection(key)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                on ? 'bg-ink text-white shadow-card' : 'bg-card text-muted ring-1 ring-line hover:text-ink'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />{t(`dash.sec.${key}`)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel"><View ctx={ctx} /></div>

      {drill && <Drill start={drill} data={data} onClose={() => setDrill(null)} />}
    </div>
  );
}

function FilterBar({ data, filters, setFilters }: { data: DashboardData; filters: m.Filters; setFilters: (f: m.Filters) => void }) {
  const { t } = useTranslation();
  const depts = [...new Set(data.people.map((p) => p.dept))].sort();
  const reviewers = [...new Set(data.people.map((p) => p.reviewer_id))];
  const active = JSON.stringify(filters) !== JSON.stringify(m.NO_FILTERS);
  const reviewerLabel = (r: number) => {
    const name = data.reviewerNames.get(r) ?? String(r);
    return reviewers.filter((x) => data.reviewerNames.get(x) === name).length > 1 ? `${name} (${r})` : name;
  };
  return (
    <div className="card flex flex-wrap items-end gap-3 p-3">
      <span className="hidden items-center gap-1.5 self-center px-1 text-sm font-medium text-muted md:flex"><Filter className="h-4 w-4" aria-hidden="true" />{t('dash.filters')}</span>
      <Select label={t('dash.filterDept')} value={filters.dept} onChange={(v) => setFilters({ ...filters, dept: v })}
        options={[['', t('dash.all')], ...depts.map((d): [string, string] => [d, d])]} />
      <Select label={t('dash.filterReviewer')} value={filters.reviewer === null ? '' : String(filters.reviewer)}
        onChange={(v) => setFilters({ ...filters, reviewer: v ? Number(v) : null })}
        options={[['', t('dash.all')], ...reviewers.map((r): [string, string] => [String(r), reviewerLabel(r)])]} />
      <Select label={t('dash.filterCritical')} value={filters.critical} onChange={(v) => setFilters({ ...filters, critical: v as m.Filters['critical'] })}
        options={[['', t('dash.all')], ['yes', t('dash.yes')], ['no', t('dash.no')]]} />
      <Select label={t('dash.filterTenure')} value={filters.tenure} onChange={(v) => setFilters({ ...filters, tenure: v as m.Filters['tenure'] })}
        options={[['', t('dash.all')], ...m.TENURE_BANDS.map((b): [string, string] => [b, t(`dash.band.${b}`)])]} />
      <Select label={t('dash.dataState')} value={filters.submittedOnly ? 'sub' : ''} onChange={(v) => setFilters({ ...filters, submittedOnly: v === 'sub' })}
        options={[['', t('dash.includeDraft')], ['sub', t('dash.submittedOnly')]]} />
      {active && (
        <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setFilters(m.NO_FILTERS)}>
          <X className="h-4 w-4" aria-hidden="true" />{t('dash.clearFilters')}
        </button>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="min-w-[9rem] flex-1 text-xs font-medium text-muted sm:flex-none">
      {label}
      <span className="relative mt-1 block">
        <select className={`field appearance-none py-1.5 pr-8 text-sm ${value ? 'border-primary/50 bg-primary-soft text-primary-ink' : ''}`}
          value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </span>
    </label>
  );
}

function readFilters(p: URLSearchParams): m.Filters {
  const sup = p.get('sup');
  return {
    dept: p.get('dept') ?? '',
    reviewer: sup ? Number(sup) : null,
    critical: (p.get('crit') ?? '') as m.Filters['critical'],
    tenure: (p.get('ten') ?? '') as m.Filters['tenure'],
    submittedOnly: p.get('sub') === '1',
  };
}

function writeFilters(f: m.Filters): Record<string, string | null> {
  return {
    dept: f.dept || null,
    sup: f.reviewer === null ? null : String(f.reviewer),
    crit: f.critical || null,
    ten: f.tenure || null,
    sub: f.submittedOnly ? '1' : null,
  };
}
