import { useCallback, useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';
import { AppShell, ErrorNotice } from '../../components/AppShell';
import { listReviewsByReviewer, setKeyTalent, setNoKeyTalent } from '../../data/review';
import { isEditable, missingSteps } from '../../lib/review/steps';
import type { Review } from '../../lib/review/types';
import { GuidePanel } from './GuidePanel';
import { useRef_ } from './referenceData';

interface Row {
  selected: boolean;
  reasons: string[];
  note: string;
  hasContent: boolean;
  locked: boolean;
}

export function KeyTalentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cycle, managerId, team, optionsFor, labelOf, question, pick } = useRef_();
  const [rows, setRows] = useState<Record<number, Row> | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmOff, setConfirmOff] = useState<number | null>(null);
  const [noneOpen, setNoneOpen] = useState(false);
  const [noneReason, setNoneReason] = useState('');
  const uid = useId();
  const q = question('KT_SELECT');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const existing = await listReviewsByReviewer(cycle.id, managerId);
      setReviews(existing);
      const next: Record<number, Row> = {};
      for (const m of team) {
        const r = existing.find((x) => x.employee_id === m.employeeId);
        next[m.employeeId] = {
          selected: r?.is_key_talent ?? false,
          reasons: r?.key_talent_reasons ?? [],
          note: r?.key_talent_note ?? '',
          hasContent: r ? missingSteps(r).length < 10 : false,
          locked: r ? !isEditable(r.status) : false,
        };
      }
      setRows(next);
    } catch {
      setFailed(true);
    }
  }, [cycle.id, managerId, team]);

  useEffect(() => void load(), [load]);

  const persist = useCallback(async (employeeId: number, row: Row) => {
    setSaveFailed(false);
    try {
      await setKeyTalent(cycle.id, employeeId, row.selected, row.reasons, row.note.trim() || null);
    } catch {
      setSaveFailed(true);
    }
  }, [cycle.id]);

  const change = (employeeId: number, patch: Partial<Row>, save = true) => {
    if (!rows) return;
    const row = { ...rows[employeeId], ...patch };
    setRows({ ...rows, [employeeId]: row });
    // A selection is stored once it has its required reason.
    if (save && (!row.selected || row.reasons.length > 0)) void persist(employeeId, row);
  };

  if (failed) return <AppShell><ErrorNotice onRetry={() => void load()} /></AppShell>;
  if (!rows) return <AppShell><p role="status" className="text-muted">{t('app.loading')}</p></AppShell>;

  const selectedIds = team.filter((m) => rows[m.employeeId].selected).map((m) => m.employeeId);
  const invalid = selectedIds.some((id) => rows[id].reasons.length === 0);

  function proceed() {
    if (selectedIds.length === 0) {
      setNoneOpen(true);
      return;
    }
    const first = reviews.find((r) => r.is_key_talent && selectedIds.includes(r.employee_id) && missingSteps(r).length > 0)?.employee_id ?? selectedIds[0];
    navigate(`/team/review/${first}`);
  }

  async function confirmNone() {
    try {
      await setNoKeyTalent(cycle.id, noneReason);
      navigate('/team/check');
    } catch {
      setSaveFailed(true);
    }
  }

  return (
    <AppShell>
      <Link to="/team" className="text-sm text-muted underline">{t('kt.back')}</Link>
      <div className={`mt-3 grid gap-4 ${guideOpen ? 'xl:grid-cols-[1fr_22rem]' : ''}`}>
        <section>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-semibold leading-snug">{pick(q?.question_zh, q?.question_en)}</h1>
            <button type="button" className="btn-secondary shrink-0 px-2 py-2" aria-label={t('wizard.guide')} aria-expanded={guideOpen} onClick={() => setGuideOpen((v) => !v)}>
              <Lightbulb className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">{pick(q?.hint_zh, q?.hint_en)}</p>
          <p className="mt-3 text-sm font-medium" role="status">{t('kt.counter', { n: selectedIds.length, total: team.length })}</p>

          {saveFailed && <div className="mt-3"><ErrorNotice /></div>}

          <ul className="mt-4 space-y-3">
            {team.map((m) => {
              const row = rows[m.employeeId];
              const needsReason = row.selected && row.reasons.length === 0;
              return (
                <li key={m.employeeId} className="card p-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox" checked={row.selected} disabled={row.locked}
                      aria-label={t('kt.selectName', { name: m.fullName })}
                      onChange={(e) => {
                        if (!e.target.checked && row.hasContent) setConfirmOff(m.employeeId);
                        else change(m.employeeId, { selected: e.target.checked });
                      }}
                    />
                    <span>
                      <span className="font-medium">{m.fullName}</span> <span className="text-muted">{m.localName}</span>
                      <span className="block text-sm text-muted">{m.position} · {m.dept}</span>
                    </span>
                  </label>

                  {row.selected && (
                    <div className="mt-3 border-t border-line pt-3">
                      <fieldset disabled={row.locked}>
                        <legend className="label">{t('kt.reasons')}</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {optionsFor('key_talent_reason').map((o) => (
                            <label key={o.value} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox" checked={row.reasons.includes(o.value)}
                                onChange={(e) => change(m.employeeId, {
                                  reasons: e.target.checked ? [...row.reasons, o.value] : row.reasons.filter((v) => v !== o.value),
                                })}
                              />
                              {labelOf('key_talent_reason', o.value)}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {needsReason && <p className="mt-2 text-sm text-risk-fg" role="alert">{t('kt.needReason')}</p>}
                      <label className="label mt-3" htmlFor={`${uid}-${m.employeeId}`}>{t('kt.note')}</label>
                      <input
                        id={`${uid}-${m.employeeId}`} className="field" value={row.note} disabled={row.locked}
                        onChange={(e) => change(m.employeeId, { note: e.target.value }, false)}
                        onBlur={() => { if (row.reasons.length > 0) void persist(m.employeeId, row); }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <button type="button" className="btn-primary mt-5" disabled={invalid} onClick={proceed}>{t('kt.continue')}</button>
        </section>
        {guideOpen && q && <GuidePanel question={q} onClose={() => setGuideOpen(false)} />}
      </div>

      {confirmOff !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby={`${uid}-off`}>
          <div className="card max-w-sm p-5">
            <h2 id={`${uid}-off`} className="font-semibold">{t('kt.deselectTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('kt.deselectBody')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmOff(null)}>{t('kt.cancel')}</button>
              <button type="button" className="btn-primary" onClick={() => { change(confirmOff, { selected: false }); setConfirmOff(null); }}>{t('kt.deselectConfirm')}</button>
            </div>
          </div>
        </div>
      )}

      {noneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby={`${uid}-none`}>
          <div className="card w-full max-w-sm p-5">
            <h2 id={`${uid}-none`} className="font-semibold">{t('kt.noneTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('kt.noneBody')}</p>
            <label className="label mt-3" htmlFor={`${uid}-reason`}>{t('kt.noneReason')}</label>
            <input id={`${uid}-reason`} className="field" value={noneReason} onChange={(e) => setNoneReason(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setNoneOpen(false)}>{t('kt.cancel')}</button>
              <button type="button" className="btn-primary" disabled={noneReason.trim() === ''} onClick={() => void confirmNone()}>{t('kt.noneConfirm')}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
