import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { STEP_KEYS, type StepKey } from '../../lib/review/steps';
import type { Review } from '../../lib/review/types';
import { useRef_ } from './referenceData';

export function ReviewSummary({ review, onEdit }: { review: Review; onEdit?: (step: StepKey) => void }) {
  const { t } = useTranslation();
  const { labelOf } = useRef_();

  const content: Record<StepKey, ReactNode> = {
    CRITICAL_ROLE: review.is_critical_role === null ? null : review.is_critical_role ? t('q.yes') : t('q.no'),
    PERF_STRENGTHS: review.performance_strengths,
    PBM_STRENGTHS: review.pbm_strengths.map((p, i) => <p key={i}>{labelOf('pbm_principle', p.principle)}：{p.evidence}</p>),
    PBM_IMPROVE: review.pbm_improvements.map((p, i) => <p key={i}>{labelOf('pbm_principle', p.principle)}：{p.evidence}</p>),
    DEV_AREAS: review.development_areas.map((a, i) => <p key={a.idx}>{i + 1}. {a.text}</p>),
    ASPIRATIONS: review.aspirations_not_discussed ? t('q.notDiscussed') : review.personal_aspirations,
    NEXT_ROLES: review.next_roles.map((n) => <p key={n.rank}>{n.role_title} · {labelOf('readiness', n.readiness)}</p>),
    MOBILITY: review.mobility_status && `${labelOf('mobility', review.mobility_status)}${review.desired_locations ? ` · ${review.desired_locations}` : ''}`,
    RETENTION: review.retention_risk && `${labelOf('retention_risk', review.retention_risk)}${review.retention_reasons.length ? ` · ${review.retention_reasons.map((r) => labelOf('retention_reason', r)).join('、')}` : ''}`,
    SUCCESSORS: review.successors.map((s, i) => (
      <p key={i}>
        {s.successor_type === 'tbh' ? t('q.typeTbh') : `${s.display_name ?? s.external_name ?? s.successor_employee_id ?? ''} · ${labelOf('readiness', s.readiness)}`}
      </p>
    )),
    DEV_PLAN: review.dev_plan.map((p, i) => (
      <div key={i} className="mb-2">
        <p className="font-medium">{p.goal}</p>
        <p className="text-muted">{p.dev_type} · {p.start_date} – {p.target_date} · {p.owner}</p>
        <p className="whitespace-pre-line">{p.actions}</p>
        <p className="text-muted">{p.checkpoint}</p>
      </div>
    )),
    COMMENTS: review.additional_comments,
  };

  const isEmpty = (v: ReactNode) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

  return (
    <dl className="divide-y divide-line">
      {STEP_KEYS.map((key) => (
        <div key={key} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto] sm:gap-4">
          <dt className="text-sm font-medium">{t(`summary.${key}`)}</dt>
          <dd className="whitespace-pre-line text-sm">
            {isEmpty(content[key]) ? <span className="text-muted">{t('wizard.notAnswered')}</span> : content[key]}
          </dd>
          {onEdit && (
            <button type="button" className="btn-secondary justify-self-start px-2 py-1" onClick={() => onEdit(key)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />{t('wizard.edit')}
            </button>
          )}
        </div>
      ))}
    </dl>
  );
}
