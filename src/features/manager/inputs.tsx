// The input for each question. Guidance stays outside the fields: no placeholders (SPEC 0.4).
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { searchDirectory } from '../../data/review';
import type { DirectoryEntry, NextRole, PbmEntry, Review, Successor } from '../../lib/review/types';
import { DevPlanCards } from './DevPlanCards';
import { useRef_ } from './referenceData';
import type { StepKey } from '../../lib/review/steps';

export interface StepProps {
  review: Review;
  update: (patch: Partial<Review>) => void;
  labelId: string;
}

function TextBlock({ value, onChange, labelId, rows = 6 }: { value: string | null; onChange: (v: string) => void; labelId: string; rows?: number }) {
  return <textarea aria-labelledby={labelId} className="field" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

function Radios({ name, options, value, onChange, labelId }: {
  name: string; options: { value: string; label: string }[]; value: string | null; onChange: (v: string) => void; labelId: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value} className={`btn cursor-pointer border ${value === o.value ? 'border-brand text-brand' : 'border-line text-ink'}`}>
          <input type="radio" className="sr-only" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function Select({ id, value, onChange, listKey, label }: { id: string; value: string | null; onChange: (v: string) => void; listKey: string; label: string }) {
  const { t } = useTranslation();
  const { optionsFor, labelOf } = useRef_();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="field" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('q.choose')}</option>
        {optionsFor(listKey).map((o) => <option key={o.value} value={o.value}>{labelOf(listKey, o.value)}</option>)}
      </select>
    </div>
  );
}

function AddButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="btn-secondary" disabled={disabled} onClick={onClick}>
      <Plus className="h-4 w-4" aria-hidden="true" />{t('q.add')}
    </button>
  );
}

function RemoveButton({ n, onClick }: { n: number; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="btn-secondary px-2 py-1" aria-label={t('q.remove', { n })} onClick={onClick}>
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function CriticalRole({ review, update, labelId }: StepProps) {
  const { t } = useTranslation();
  return (
    <Radios
      name="critical" labelId={labelId}
      options={[{ value: 'yes', label: t('q.yes') }, { value: 'no', label: t('q.no') }]}
      value={review.is_critical_role === null ? null : review.is_critical_role ? 'yes' : 'no'}
      onChange={(v) => update({ is_critical_role: v === 'yes' })}
    />
  );
}

function PbmList({ entries, onChange }: { entries: PbmEntry[]; onChange: (e: PbmEntry[]) => void }) {
  const { t } = useTranslation();
  const uid = useId();
  const rows = entries.length ? entries : [{ principle: '', evidence: '' }];
  const set = (i: number, patch: Partial<PbmEntry>) => onChange(rows.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <div className="space-y-4">
      {rows.map((entry, i) => (
        <div key={i} className="rounded-card border border-line p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select id={`${uid}-p${i}`} listKey="pbm_principle" label={t('q.principle')} value={entry.principle} onChange={(v) => set(i, { principle: v })} />
            </div>
            {rows.length > 1 && <RemoveButton n={i + 1} onClick={() => onChange(rows.filter((_, j) => j !== i))} />}
          </div>
          <label className="label mt-3" htmlFor={`${uid}-e${i}`}>{t('q.evidence')}</label>
          <textarea id={`${uid}-e${i}`} className="field" rows={2} value={entry.evidence} onChange={(e) => set(i, { evidence: e.target.value })} />
        </div>
      ))}
      <AddButton disabled={rows.length >= 3} onClick={() => onChange([...rows, { principle: '', evidence: '' }])} />
    </div>
  );
}

function DevAreas({ review, update }: StepProps) {
  const { t } = useTranslation();
  const uid = useId();
  const areas = review.development_areas.length ? review.development_areas : [{ idx: 1, text: '' }];
  const write = (next: typeof areas) => update({ development_areas: next });
  const remove = (idx: number) => {
    const hasPlan = review.dev_plan.some((p) => p.area_idx === idx);
    if (hasPlan && !window.confirm(t('q.removeAreaConfirm'))) return;
    update({
      development_areas: areas.filter((a) => a.idx !== idx),
      dev_plan: review.dev_plan.filter((p) => p.area_idx !== idx),
    });
  };
  return (
    <div className="space-y-3">
      {areas.map((a, i) => (
        <div key={a.idx}>
          <label className="label" htmlFor={`${uid}-${a.idx}`}>{t('q.area', { n: i + 1 })}</label>
          <div className="flex items-center gap-2">
            <input id={`${uid}-${a.idx}`} className="field" value={a.text} onChange={(e) => write(areas.map((x) => (x.idx === a.idx ? { ...x, text: e.target.value } : x)))} />
            {areas.length > 1 && <RemoveButton n={i + 1} onClick={() => remove(a.idx)} />}
          </div>
        </div>
      ))}
      <AddButton disabled={areas.length >= 3} onClick={() => write([...areas, { idx: Math.max(...areas.map((a) => a.idx)) + 1, text: '' }])} />
    </div>
  );
}

function Aspirations({ review, update, labelId }: StepProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {!review.aspirations_not_discussed && (
        <TextBlock labelId={labelId} value={review.personal_aspirations} onChange={(v) => update({ personal_aspirations: v })} />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={review.aspirations_not_discussed} onChange={(e) => update({ aspirations_not_discussed: e.target.checked })} />
        {t('q.notDiscussed')}
      </label>
    </div>
  );
}

function NextRoles({ review, update }: StepProps) {
  const { t } = useTranslation();
  const { team } = useRef_();
  const uid = useId();
  const rows: NextRole[] = review.next_roles.length ? review.next_roles : [{ rank: 1, role_title: '', readiness: '' }];
  const write = (next: NextRole[]) => update({ next_roles: next });
  const set = (i: number, patch: Partial<NextRole>) => write(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const titles = [...new Set(team.map((m) => m.position).filter(Boolean))];
  return (
    <div className="space-y-4">
      <datalist id={`${uid}-titles`}>{titles.map((title) => <option key={title} value={title} />)}</datalist>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-3 rounded-card border border-line p-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <div>
            <label className="label" htmlFor={`${uid}-r${i}`}>{t('q.roleTitle')}</label>
            <input id={`${uid}-r${i}`} className="field" list={`${uid}-titles`} value={r.role_title} onChange={(e) => set(i, { role_title: e.target.value })} />
          </div>
          <Select id={`${uid}-s${i}`} listKey="readiness" label={t('q.readiness')} value={r.readiness} onChange={(v) => set(i, { readiness: v })} />
          {rows.length > 1 && <RemoveButton n={i + 1} onClick={() => write(rows.filter((_, j) => j !== i))} />}
        </div>
      ))}
      <AddButton disabled={rows.length >= 3} onClick={() => write([...rows, { rank: rows.length + 1, role_title: '', readiness: '' }])} />
    </div>
  );
}

function Mobility({ review, update, labelId }: StepProps) {
  const { t } = useTranslation();
  const { optionsFor, labelOf } = useRef_();
  const uid = useId();
  return (
    <div className="space-y-4">
      <Radios
        name="mobility" labelId={labelId}
        options={optionsFor('mobility').map((o) => ({ value: o.value, label: labelOf('mobility', o.value) }))}
        value={review.mobility_status}
        onChange={(v) => update({ mobility_status: v, desired_locations: v === 'Not Now' ? null : review.desired_locations })}
      />
      {review.mobility_status && review.mobility_status !== 'Not Now' && (
        <div>
          <label className="label" htmlFor={uid}>{t('q.desiredLocations')}</label>
          <input id={uid} className="field" value={review.desired_locations ?? ''} onChange={(e) => update({ desired_locations: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function Retention({ review, update, labelId }: StepProps) {
  const { t } = useTranslation();
  const { optionsFor, labelOf } = useRef_();
  const needsReasons = review.retention_risk === 'Medium' || review.retention_risk === 'High';
  const toggle = (value: string) => {
    const has = review.retention_reasons.includes(value);
    update({ retention_reasons: has ? review.retention_reasons.filter((r) => r !== value) : [...review.retention_reasons, value] });
  };
  return (
    <div className="space-y-4">
      <Radios
        name="risk" labelId={labelId}
        options={optionsFor('retention_risk').map((o) => ({ value: o.value, label: labelOf('retention_risk', o.value) }))}
        value={review.retention_risk}
        onChange={(v) => update({ retention_risk: v, retention_reasons: v === 'Low' ? [] : review.retention_reasons })}
      />
      {needsReasons && (
        <fieldset>
          <legend className="label">{t('q.retentionReasons')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {optionsFor('retention_reason').map((o) => {
              const checked = review.retention_reasons.includes(o.value);
              return (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={checked} disabled={!checked && review.retention_reasons.length >= 2} onChange={() => toggle(o.value)} />
                  {labelOf('retention_reason', o.value)}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function PersonPicker({ excludeId, onPick }: { excludeId: number; onPick: (e: DirectoryEntry) => void }) {
  const { t } = useTranslation();
  const { cycle } = useRef_();
  const uid = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryEntry[] | null>(null);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults(null);
      return undefined;
    }
    let live = true;
    const handle = window.setTimeout(() => {
      searchDirectory(cycle.id, query)
        .then((rows) => live && setResults(rows.filter((r) => r.employee_id !== excludeId)))
        .catch(() => live && setResults([]));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [query, cycle.id, excludeId]);

  return (
    <div>
      <label className="label" htmlFor={uid}>{t('q.search')}</label>
      <input id={uid} className="field" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
      {results && results.length === 0 && <p className="mt-1 text-sm text-muted">{t('q.noResults')}</p>}
      {results && results.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-card border border-line">
          {results.map((r) => (
            <li key={r.employee_id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-canvas" onClick={() => onPick(r)}>
                {r.full_name} {r.local_name} <span className="text-muted">· {r.position} · {r.dept}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Successors({ review, update }: StepProps) {
  const { t } = useTranslation();
  const uid = useId();
  const blank: Successor = { rank: 1, successor_type: 'internal', successor_employee_id: null, external_name: null, readiness: null };
  const rows = review.successors.length ? review.successors : [blank];
  const write = (next: Successor[]) => update({ successors: next });
  const set = (i: number, patch: Partial<Successor>) => write(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-4">
      {rows.map((s, i) => (
        <div key={i} className="space-y-3 rounded-card border border-line p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label" htmlFor={`${uid}-t${i}`}>{t('q.successorType')}</label>
              <select
                id={`${uid}-t${i}`} className="field" value={s.successor_type}
                onChange={(e) => set(i, {
                  successor_type: e.target.value as Successor['successor_type'],
                  successor_employee_id: null, external_name: null, readiness: null, display_name: undefined,
                })}
              >
                <option value="internal">{t('q.typeInternal')}</option>
                <option value="external">{t('q.typeExternal')}</option>
                <option value="tbh">{t('q.typeTbh')}</option>
              </select>
            </div>
            {rows.length > 1 && <RemoveButton n={i + 1} onClick={() => write(rows.filter((_, j) => j !== i))} />}
          </div>

          {s.successor_type === 'internal' && (s.successor_employee_id
            ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                {t('q.selected', { name: s.display_name ?? s.successor_employee_id })}
                <button type="button" className="text-muted underline" onClick={() => set(i, { successor_employee_id: null, display_name: undefined })}>{t('q.change')}</button>
              </p>
            )
            : <PersonPicker excludeId={review.employee_id} onPick={(p) => set(i, { successor_employee_id: p.employee_id, display_name: p.full_name })} />)}

          {s.successor_type === 'external' && (
            <div>
              <label className="label" htmlFor={`${uid}-n${i}`}>{t('q.externalName')}</label>
              <input id={`${uid}-n${i}`} className="field" value={s.external_name ?? ''} onChange={(e) => set(i, { external_name: e.target.value })} />
            </div>
          )}

          {s.successor_type === 'tbh'
            ? <p className="rounded-card bg-info-bg px-3 py-2 text-sm text-info-fg">{t('q.tbhDesc')}</p>
            : <Select id={`${uid}-s${i}`} listKey="readiness" label={t('q.readiness')} value={s.readiness} onChange={(v) => set(i, { readiness: v })} />}
        </div>
      ))}
      <AddButton disabled={rows.length >= 3} onClick={() => write([...rows, { ...blank, rank: rows.length + 1 }])} />
    </div>
  );
}

export function StepInput({ stepKey, ...props }: StepProps & { stepKey: StepKey }) {
  const { review, update, labelId } = props;
  switch (stepKey) {
    case 'CRITICAL_ROLE': return <CriticalRole {...props} />;
    case 'PERF_STRENGTHS': return <TextBlock labelId={labelId} value={review.performance_strengths} onChange={(v) => update({ performance_strengths: v })} />;
    case 'PBM_STRENGTHS': return <PbmList entries={review.pbm_strengths} onChange={(e) => update({ pbm_strengths: e })} />;
    case 'PBM_IMPROVE': return <PbmList entries={review.pbm_improvements} onChange={(e) => update({ pbm_improvements: e })} />;
    case 'DEV_AREAS': return <DevAreas {...props} />;
    case 'ASPIRATIONS': return <Aspirations {...props} />;
    case 'NEXT_ROLES': return <NextRoles {...props} />;
    case 'MOBILITY': return <Mobility {...props} />;
    case 'RETENTION': return <Retention {...props} />;
    case 'SUCCESSORS': return <Successors {...props} />;
    case 'DEV_PLAN': return <DevPlanCards {...props} />;
    case 'COMMENTS': return <TextBlock labelId={labelId} value={review.additional_comments} onChange={(v) => update({ additional_comments: v })} />;
  }
}
