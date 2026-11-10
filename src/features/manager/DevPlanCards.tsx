import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { allEducation, planWarnings } from '../../lib/review/quality';
import { activeAreas } from '../../lib/review/steps';
import type { DevPlanItem } from '../../lib/review/types';
import type { StepProps } from './inputs';
import { useRef_ } from './referenceData';

const blankPlan = (area_idx: number): DevPlanItem => ({
  area_idx, goal: '', dev_type: '', actions: '', support: '', owner: '', start_date: null, target_date: null,
  checkpoint: '', status: 'Not Started', progress_notes: '',
});

export function DevPlanCards({ review, update }: StepProps) {
  const { t } = useTranslation();
  const { optionsFor, labelOf } = useRef_();
  const uid = useId();
  const areas = activeAreas(review);

  if (areas.length === 0) return <p className="rounded-card bg-info-bg px-3 py-2 text-sm text-info-fg">{t('plan.noAreas')}</p>;

  const planFor = (idx: number) => review.dev_plan.find((p) => p.area_idx === idx) ?? blankPlan(idx);
  const set = (idx: number, patch: Partial<DevPlanItem>) => {
    const next = { ...planFor(idx), ...patch };
    const others = review.dev_plan.filter((p) => p.area_idx !== idx);
    update({ dev_plan: [...others, next] });
  };

  return (
    <div className="space-y-6">
      {areas.map((area, n) => {
        const plan = planFor(area.idx);
        const id = (f: string) => `${uid}-${area.idx}-${f}`;
        const touched = review.dev_plan.some((p) => p.area_idx === area.idx);
        const warnings = touched ? planWarnings(plan) : [];
        return (
          <section key={area.idx} className="space-y-3 rounded-card border border-line p-4">
            <h3 className="font-medium">{t('plan.cardTitle', { n: n + 1, text: area.text })}</h3>
            <div>
              <label className="label" htmlFor={id('goal')}>{t('plan.goal')}</label>
              <textarea id={id('goal')} className="field" rows={2} value={plan.goal} onChange={(e) => set(area.idx, { goal: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor={id('type')}>{t('plan.type')}</label>
              <select id={id('type')} className="field" value={plan.dev_type} onChange={(e) => set(area.idx, { dev_type: e.target.value })}>
                <option value="">{t('q.choose')}</option>
                {optionsFor('dev_type').map((o) => <option key={o.value} value={o.value}>{o.value} · {labelOf('dev_type', o.value)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={id('actions')}>{t('plan.actions')}</label>
              <textarea id={id('actions')} className="field" rows={4} value={plan.actions} onChange={(e) => set(area.idx, { actions: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor={id('support')}>{t('plan.support')}</label>
              <input id={id('support')} className="field" value={plan.support} onChange={(e) => set(area.idx, { support: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor={id('owner')}>{t('plan.owner')}</label>
              <input id={id('owner')} className="field" value={plan.owner} onChange={(e) => set(area.idx, { owner: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={id('start')}>{t('plan.start')}</label>
                <input id={id('start')} className="field" type="date" value={plan.start_date ?? ''} onChange={(e) => set(area.idx, { start_date: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor={id('target')}>{t('plan.target')}</label>
                <input id={id('target')} className="field" type="date" value={plan.target_date ?? ''} onChange={(e) => set(area.idx, { target_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor={id('checkpoint')}>{t('plan.checkpoint')}</label>
              <textarea id={id('checkpoint')} className="field" rows={2} value={plan.checkpoint} onChange={(e) => set(area.idx, { checkpoint: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor={id('status')}>{t('plan.status')}</label>
              <select id={id('status')} className="field" value={plan.status} onChange={(e) => set(area.idx, { status: e.target.value })}>
                {optionsFor('plan_status').map((o) => <option key={o.value} value={o.value}>{labelOf('plan_status', o.value)}</option>)}
              </select>
            </div>
            {warnings.length > 0 && (
              <div className="rounded-card bg-warn-bg p-3 text-sm text-warn-fg">
                <p className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" aria-hidden="true" />{t('plan.qualityTitle')}</p>
                <ul className="mt-1 list-disc pl-5">{warnings.map((w) => <li key={w}>{t(`plan.w.${w}`)}</li>)}</ul>
              </div>
            )}
          </section>
        );
      })}
      {allEducation(review.dev_plan) && (
        <p className="rounded-card bg-warn-bg px-3 py-2 text-sm text-warn-fg">{t('plan.allEducation')}</p>
      )}
    </div>
  );
}
