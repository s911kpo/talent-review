import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronDown, ChevronRight, MessageCircleQuestion, X } from 'lucide-react';
import type { DashboardData } from '../../data/dashboard';
import { personProbes } from '../../lib/metrics/story';
import type { Review } from '../../lib/review/types';
import { useRef_ } from '../manager/referenceData';
import { ReviewSummary } from '../manager/ReviewSummary';
import { RISK_COLORS } from './Chart';
import { Avatar } from './sections';

export type DrillStep = { kind: 'list'; title: string; ids: number[] } | { kind: 'person'; id: number };

/**
 * Side sheet for drilling into a number: list → person → their successor → ... with breadcrumbs and Back,
 * so a reader can follow a thread and return to exactly where they were.
 */
export function Drill({ start, data, onClose, tone = 'light' }: { start: DrillStep; data: DashboardData; onClose: () => void; tone?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const [stack, setStack] = useState<DrillStep[]>([start]);
  const current = stack[stack.length - 1];
  const nameOf = (id: number) => data.people.find((p) => p.employee_id === id)?.name ?? data.reviewerNames.get(id) ?? String(id);
  const label = (st: DrillStep) => (st.kind === 'list' ? st.title : nameOf(st.id));
  const push = (st: DrillStep) => setStack([...stack, st]);
  const back = () => (stack.length > 1 ? setStack(stack.slice(0, -1)) : onClose());

  useEffect(() => setStack([start]), [start]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 z-50 flex justify-end ${tone === 'dark' ? 'drill-dark' : ''}`} role="dialog" aria-modal="true" aria-label={label(current)}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" aria-hidden="true" onClick={onClose} />
      <div className={`relative flex h-full w-full max-w-xl flex-col bg-canvas shadow-lift ${tone === 'dark' ? 'border-l-2 border-[#D6193A]' : ''}`}>
        <div className="border-b border-line bg-card px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            {stack.length > 1 ? (
              <button type="button" className="btn-ghost -ml-2 px-2 py-1" onClick={back}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('dash.back')}
              </button>
            ) : <span />}
            <button type="button" className="btn-ghost px-2 py-1" aria-label={t('dash.close')} onClick={onClose}><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
          {stack.length > 1 && (
            <nav aria-label="breadcrumb" className="mt-2">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
                {stack.map((st, i) => (
                  <li key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                    {i < stack.length - 1
                      ? <button type="button" className="max-w-[12rem] truncate hover:text-primary hover:underline" onClick={() => setStack(stack.slice(0, i + 1))}>{label(st)}</button>
                      : <span className="max-w-[12rem] truncate font-medium text-ink" aria-current="page">{label(st)}</span>}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {current.kind === 'list' && (
            <div className="mt-2">
              <h2 className="text-lg font-semibold leading-snug">{current.title}</h2>
              <p className="text-sm text-muted">{t('dash.drill.count', { count: new Set(current.ids).size })}</p>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {current.kind === 'list'
            ? <PersonList ids={[...new Set(current.ids)]} data={data} onOpen={(id) => push({ kind: 'person', id })} />
            : <PersonProfile id={current.id} data={data} onOpen={(id) => push({ kind: 'person', id })} />}
        </div>
      </div>
    </div>
  );
}

function RiskTag({ risk }: { risk: string | null }) {
  const { labelOf } = useRef_();
  if (!risk) return null;
  return <span className="tag bg-subtle text-ink"><span className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[risk] }} aria-hidden="true" />{labelOf('retention_risk', risk)}</span>;
}

function PersonList({ ids, data, onOpen }: { ids: number[]; data: DashboardData; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-2">
      {ids.map((id) => {
        const p = data.people.find((x) => x.employee_id === id);
        const review = data.reviews.find((r) => r.employee_id === id);
        const name = p?.name ?? String(id);
        return (
          <li key={id}>
            <button type="button" onClick={() => onOpen(id)}
              className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-primary/40 hover:shadow-lift">
              <Avatar name={name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{name}<span className="sr-only">, {t('dash.openPerson', { name })}</span></span>
                <span className="block truncate text-xs text-muted">{[p?.dept, p?.position].filter(Boolean).join(' · ')}</span>
              </span>
              {review?.is_critical_role && <span className="tag bg-info-bg text-info-fg">{t('dash.drill.critical')}</span>}
              <RiskTag risk={review?.retention_risk ?? null} />
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-subtle p-3">
      <p className="eyebrow">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function PersonProfile({ id, data, onOpen }: { id: number; data: DashboardData; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  const { labelOf } = useRef_();
  const [full, setFull] = useState(false);
  useEffect(() => setFull(false), [id]);
  const p = data.people.find((x) => x.employee_id === id);
  const review: Review | undefined = data.reviews.find((r) => r.employee_id === id);
  const name = p?.name ?? String(id);
  const known = new Set(data.people.map((x) => x.employee_id));
  const successorOf = data.reviews.filter((r) => r.successors.some((s) => s.successor_type === 'internal' && s.successor_employee_id === id));
  const probes = review ? personProbes(review) : [];
  const none = <span className="text-muted">{t('dash.noneEntered')}</span>;
  const personLink = (pid: number, text: string) => (known.has(pid)
    ? <button type="button" className="font-medium text-primary hover:underline" onClick={() => onOpen(pid)}>{text}</button>
    : <span>{text}</span>);

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-4 p-4">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{name}</h2>
          <p className="truncate text-sm text-muted">{[p?.dept, p?.position].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {review?.is_critical_role && <span className="tag bg-info-bg text-info-fg">{t('dash.drill.critical')}</span>}
          <RiskTag risk={review?.retention_risk ?? null} />
        </div>
      </div>

      {probes.length > 0 && (
        <section className="rounded-card border border-primary/20 bg-primary-soft/60 p-4" aria-labelledby="conv-prep">
          <h3 id="conv-prep" className="flex items-center gap-1.5 text-sm font-semibold text-primary-ink"><MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />{t('dash.convPrep')}</h3>
          <p className="mt-0.5 text-xs text-muted">{t('dash.convPrepNote')}</p>
          <ol className="mt-2 space-y-1.5 text-sm">
            {probes.map((pr, i) => <li key={pr.key} className="flex gap-2"><span className="num text-primary-ink">{i + 1}.</span><span>{t(`dash.person.${pr.key}`, pr.params)}</span></li>)}
          </ol>
        </section>
      )}

      {review && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t('dash.fieldKeyWhy')}>{review.key_talent_reasons.length ? review.key_talent_reasons.map((r) => labelOf('key_talent_reason', r)).join('、') : none}</Field>
          <Field label={t('dash.fieldRisk')}>
            {review.retention_risk ? <>{labelOf('retention_risk', review.retention_risk)}{review.retention_reasons.length ? <span className="text-muted"> · {review.retention_reasons.map((r) => labelOf('retention_reason', r)).join('、')}</span> : null}</> : none}
          </Field>
          <Field label={t('dash.fieldNext')}>
            {review.next_roles.length ? review.next_roles.map((n) => <span key={n.rank} className="block">{n.role_title} <span className="text-muted">· {labelOf('readiness', n.readiness)}</span></span>) : none}
          </Field>
          <Field label={t('dash.fieldMobility')}>{review.mobility_status ? labelOf('mobility', review.mobility_status) : none}</Field>
          <Field label={t('dash.fieldSuccessors')}>
            {review.successors.length ? review.successors.map((s, i) => (
              <span key={i} className="block">
                {s.successor_type === 'tbh' ? 'TBH'
                  : s.successor_type === 'internal' && s.successor_employee_id ? personLink(s.successor_employee_id, s.display_name ?? String(s.successor_employee_id))
                    : s.display_name ?? s.external_name ?? ''}
                {s.readiness && <span className="text-muted"> · {labelOf('readiness', s.readiness)}</span>}
              </span>
            )) : none}
          </Field>
          <Field label={t('dash.fieldPlan')}>
            {review.dev_plan.filter((x) => x.goal.trim()).length ? review.dev_plan.filter((x) => x.goal.trim()).map((x, i) => (
              <span key={i} className="block truncate" title={x.goal}>{x.goal} <span className="text-muted">· {t(`dash.planStatus.${x.status || 'Not Started'}`)}</span></span>
            )) : none}
          </Field>
        </div>
      )}

      {successorOf.length > 0 && (
        <Field label={t('dash.successorOf')}>
          <span className="flex flex-wrap gap-x-3 gap-y-1">{successorOf.map((r) => <span key={r.employee_id}>{personLink(r.employee_id, nameOf(data, r.employee_id))}</span>)}</span>
        </Field>
      )}

      {review && (
        <div className="card overflow-hidden">
          <button type="button" className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-subtle/60" aria-expanded={full} onClick={() => setFull(!full)}>
            {t('dash.drill.expand')}<ChevronDown className={`h-4 w-4 transition ${full ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {full && <div className="border-t border-line p-4 text-sm"><ReviewSummary review={review} /></div>}
        </div>
      )}
    </div>
  );
}

const nameOf = (data: DashboardData, id: number) => data.people.find((p) => p.employee_id === id)?.name ?? String(id);
