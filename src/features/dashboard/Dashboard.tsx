import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Filter, GitFork, LayoutDashboard, ListChecks, ShieldAlert, Sprout, Users, X } from 'lucide-react';
import { ErrorNotice } from '../../components/AppShell';
import { fetchDashboard, fetchPlantAverages, type DashboardData, type PlantAverages } from '../../data/dashboard';
import * as m from '../../lib/metrics';
import { ReferenceProvider, useRef_ } from '../manager/referenceData';
import { ReviewSummary } from '../manager/ReviewSummary';
import { RISK_COLORS } from './Chart';
import { ActionsSection, Avatar, BenchSection, GrowthSection, OrgSection, OverviewSection, RiskSection, type Ctx, type Mode } from './sections';

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
  const [section, setSection] = useState<SectionKey>('overview');
  const [filters, setFilters] = useState<m.Filters>(m.NO_FILTERS);
  const [drill, setDrill] = useState<{ title: string; ids: number[] } | null>(null);

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

  const ds = useMemo(() => (data ? m.applyFilters(data, filters) : null), [data, filters]);

  if (failed) return <ErrorNotice onRetry={() => void load()} />;
  if (!data || !ds) return <p role="status" className="text-muted">{t('app.loading')}</p>;

  const ctx: Ctx = {
    ds, data, mode, averages,
    open: (title, ids) => setDrill({ title, ids }),
    setDept: (dept) => setFilters({ ...filters, dept }),
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

      {drill && <Drill drill={drill} data={data} onClose={() => setDrill(null)} />}
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

function Drill({ drill, data, onClose }: { drill: { title: string; ids: number[] }; data: DashboardData; onClose: () => void }) {
  const { t } = useTranslation();
  const { labelOf } = useRef_();
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const ids = [...new Set(drill.ids)];
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={drill.title}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" aria-hidden="true" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-canvas shadow-lift">
        <div className="flex items-start justify-between gap-3 border-b border-line bg-card px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-snug">{drill.title}</h2>
            <p className="text-sm text-muted">{t('dash.drill.count', { count: ids.length })}</p>
          </div>
          <button type="button" className="btn-ghost px-2 py-1" aria-label={t('dash.close')} onClick={onClose}><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-4">
          {ids.map((id) => {
            const p = data.people.find((x) => x.employee_id === id);
            const review = data.reviews.find((r) => r.employee_id === id);
            const name = p?.name ?? String(id);
            const open = selected === id;
            return (
              <li key={id} className="card overflow-hidden">
                <button type="button" className="flex w-full items-center gap-3 p-3 text-left hover:bg-subtle/60" aria-expanded={open} disabled={!review}
                  onClick={() => setSelected(open ? null : id)}>
                  <Avatar name={name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="block truncate text-xs text-muted">{[p?.dept, p?.position].filter(Boolean).join(' · ')}</span>
                  </span>
                  {review?.is_critical_role && <span className="tag bg-info-bg text-info-fg">{t('dash.drill.critical')}</span>}
                  {review?.retention_risk && (
                    <span className="tag bg-subtle text-ink"><span className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[review.retention_risk] }} aria-hidden="true" />{labelOf('retention_risk', review.retention_risk)}</span>
                  )}
                  {review && <ChevronDown className={`h-4 w-4 text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />}
                </button>
                {open && review && <div className="border-t border-line bg-card p-4 text-sm"><ReviewSummary review={review} /></div>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
