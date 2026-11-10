import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleAlert } from 'lucide-react';
import { AppShell, ErrorNotice } from '../../components/AppShell';
import { getTeamSubmission, listReviewsByReviewer, submitTeam } from '../../data/review';
import { teamWarnings } from '../../lib/review/quality';
import { isEditable, missingSteps } from '../../lib/review/steps';
import type { Review, TeamSubmission } from '../../lib/review/types';
import { useRef_ } from './referenceData';

export function CheckSubmitPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cycle, managerId, team, memberName } = useRef_();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [teamState, setTeamState] = useState<TeamSubmission | null>(null);
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [all, ts] = await Promise.all([listReviewsByReviewer(cycle.id, managerId), getTeamSubmission(cycle.id, managerId)]);
      setReviews(all.filter((r) => r.is_key_talent));
      setTeamState(ts);
    } catch {
      setFailed(true);
    }
  }, [cycle.id, managerId]);

  useEffect(() => void load(), [load]);

  const warnings = useMemo(() => {
    if (!reviews) return [];
    return teamWarnings(reviews, new Map(team.map((m) => [m.employeeId, m.startDate])));
  }, [reviews, team]);

  if (failed) return <AppShell><ErrorNotice onRetry={() => void load()} /></AppShell>;
  if (!reviews || !teamState) return <AppShell><p role="status" className="text-muted">{t('app.loading')}</p></AppShell>;

  const open = reviews.filter((r) => isEditable(r.status));
  const incomplete = open.filter((r) => missingSteps(r).length > 0);
  const allAcked = warnings.every((w) => acked.has(w.id));
  const noKey = reviews.length === 0 && (teamState.hr_comment ?? '').startsWith('[NO_KEY_TALENT]');
  const canSubmit = incomplete.length === 0 && allAcked && (reviews.length > 0 || noKey) && !busy;

  async function submit() {
    setBusy(true);
    setSubmitError(false);
    try {
      await submitTeam(cycle.id);
      navigate('/team/submitted');
    } catch {
      setSubmitError(true);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => setAcked((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  return (
    <AppShell>
      <Link to="/team" className="text-sm text-muted underline">{t('wizard.backHome')}</Link>
      <h1 className="mt-3 text-2xl font-semibold">{t('check.title')}</h1>

      {noKey && <p className="mt-3 rounded-card bg-info-bg px-3 py-2 text-sm text-info-fg">{t('check.noKeyNote')}</p>}

      <section className="card mt-4 p-4">
        <h2 className="font-semibold">{t('check.completeness')}</h2>
        <ul className="mt-2 divide-y divide-line">
          {reviews.map((r) => {
            const miss = isEditable(r.status) ? missingSteps(r) : [];
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{memberName(r.employee_id)}</span>
                {miss.length === 0
                  ? <span className="flex items-center gap-1 text-ok-fg"><CircleCheck className="h-4 w-4" aria-hidden="true" />{t('check.done')}</span>
                  : (
                    <Link className="flex items-center gap-1 text-risk-fg underline" to={`/team/review/${r.employee_id}?step=${miss[0]}`}>
                      <CircleAlert className="h-4 w-4" aria-hidden="true" />
                      {t('check.missing', { list: miss.map((k) => t(`summary.${k}`)).join('、') })}
                    </Link>
                  )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-semibold">{t('check.warningsTitle')}</h2>
        {warnings.length === 0 && <p className="mt-2 text-sm text-muted">{t('check.noWarnings')}</p>}
        {warnings.length > 0 && (
          <>
            <p className="mt-1 text-sm text-muted">{t('check.warningsNote')}</p>
            <ul className="mt-2 space-y-2">
              {warnings.map((w) => (
                <li key={w.id} className="rounded-card bg-warn-bg p-3 text-sm text-warn-fg">
                  <p>{t(`check.w.${w.code}`, { name: memberNameOrId(w.employeeId ?? w.successorId, reviews, memberName) })}</p>
                  <label className="mt-1 flex items-center gap-2 font-medium">
                    <input type="checkbox" checked={acked.has(w.id)} onChange={() => toggle(w.id)} />
                    {t('check.ack')}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {incomplete.length > 0 && <p className="mt-4 text-sm text-risk-fg" role="status">{t('check.blockedIncomplete')}</p>}
      {incomplete.length === 0 && !allAcked && <p className="mt-4 text-sm text-warn-fg" role="status">{t('check.blockedAck')}</p>}
      {submitError && <p className="mt-4 text-sm text-risk-fg" role="alert">{t('check.failed')}</p>}

      <button type="button" className="btn-primary mt-4" disabled={!canSubmit} onClick={() => void submit()}>
        {busy ? t('check.submitting') : t('check.submit')}
      </button>
    </AppShell>
  );
}

function memberNameOrId(id: number | undefined, reviews: Review[], memberName: (id: number) => string): string {
  if (id === undefined) return '';
  const successor = reviews.flatMap((r) => r.successors).find((s) => s.successor_employee_id === id);
  return successor?.display_name ?? memberName(id);
}
