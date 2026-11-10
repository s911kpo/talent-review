import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, Printer } from 'lucide-react';
import { AppShell, ErrorNotice } from '../../components/AppShell';
import { getTeamSubmission, listReviewsByReviewer, requestReopen, setDiscussionDate } from '../../data/review';
import { discussionPoints } from '../../lib/review/quality';
import type { Review, TeamSubmission } from '../../lib/review/types';
import { Markdown } from './GuidePanel';
import { useRef_ } from './referenceData';

export function SubmittedPage() {
  const { t } = useTranslation();
  const { cycle, managerId, memberName, question, pick, labelOf } = useRef_();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [teamState, setTeamState] = useState<TeamSubmission | null>(null);
  const [failed, setFailed] = useState(false);
  const [date, setDate] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState('');
  const uid = useId();
  const guide = question('SUBMIT_HRBP');

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

  const act = async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch {
      setFailed(true);
    }
  };

  if (failed) return <AppShell><ErrorNotice onRetry={() => void load()} /></AppShell>;
  if (!reviews || !teamState) return <AppShell><p role="status" className="text-muted">{t('app.loading')}</p></AppShell>;

  const risky = reviews.filter((r) => r.retention_risk === 'High' || r.retention_risk === 'Medium');
  const gaps = reviews.filter((r) => r.is_critical_role && !r.successors.some((s) => s.readiness === 'Ready Now'));
  const plans = reviews
    .flatMap((r) => r.dev_plan.map((p) => ({ ...p, employee_id: r.employee_id })))
    .sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));
  const points = discussionPoints(reviews);

  return (
    <AppShell>
      <div className="print:hidden">
        <Link to="/team" className="text-sm text-muted underline">{t('wizard.backHome')}</Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{t('sub.title')}</h1>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />{t('sub.print')}
          </button>
        </div>

        <section className="card mt-4 border-brand/30 p-4">
          <h2 className="font-semibold">{pick(guide?.title_zh, guide?.title_en)}</h2>
          <div className="mt-2"><Markdown text={pick(guide?.guide_zh, guide?.guide_en)} /></div>
          <h3 className="mt-3 text-sm font-medium">{t('sub.focusTitle')}</h3>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {points.map((p) => <li key={p.key}>{t(`sub.focus.${p.key}`, { count: p.count })}</li>)}
          </ul>

          {teamState.discussion_status !== 'not_scheduled' && teamState.discussion_date
            ? <p className="mt-3 flex items-center gap-1 text-sm text-ok-fg"><CalendarCheck className="h-4 w-4" aria-hidden="true" />{t('sub.bookedOn', { date: teamState.discussion_date })}</p>
            : (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label className="label" htmlFor={`${uid}-date`}>{t('sub.discussedDate')}</label>
                  <input id={`${uid}-date`} className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <button type="button" className="btn-primary" disabled={!date} onClick={() => void act(() => setDiscussionDate(cycle.id, date))}>{t('sub.booked')}</button>
              </div>
            )}
        </section>

        <section className="card mt-4 p-4">
          {teamState.reopen_requested_at
            ? <p className="text-sm text-info-fg" role="status">{t('sub.reopenSent')}</p>
            : reopenOpen
              ? (
                <div>
                  <label className="label" htmlFor={`${uid}-reason`}>{t('sub.reopenReason')}</label>
                  <textarea id={`${uid}-reason`} className="field" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn-primary" disabled={reason.trim() === ''} onClick={() => void act(() => requestReopen(cycle.id, reason))}>{t('sub.reopenSubmit')}</button>
                    <button type="button" className="btn-secondary" onClick={() => setReopenOpen(false)}>{t('sub.cancel')}</button>
                  </div>
                </div>
              )
              : <button type="button" className="btn-secondary" onClick={() => setReopenOpen(true)}>{t('sub.reopen')}</button>}
        </section>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="text-lg font-semibold">{t('sub.summaryTitle')}</h2>
        <h3 className="mt-3 text-sm font-medium">{t('sub.keyTalent')}</h3>
        <ul className="mt-1 text-sm">{reviews.map((r) => <li key={r.id}>{memberName(r.employee_id)}</li>)}</ul>

        <h3 className="mt-4 text-sm font-medium">{t('sub.risk')}</h3>
        {risky.length === 0 ? <p className="text-sm text-muted">{t('sub.noRisk')}</p> : (
          <ul className="mt-1 text-sm">
            {risky.map((r) => <li key={r.id}>{memberName(r.employee_id)} · {labelOf('retention_risk', r.retention_risk)}</li>)}
          </ul>
        )}

        <h3 className="mt-4 text-sm font-medium">{t('sub.gap')}</h3>
        {gaps.length === 0 ? <p className="text-sm text-muted">{t('sub.noGap')}</p> : (
          <ul className="mt-1 text-sm">{gaps.map((r) => <li key={r.id}>{memberName(r.employee_id)}</li>)}</ul>
        )}

        <h3 className="mt-4 text-sm font-medium">{t('sub.timeline')}</h3>
        {plans.length === 0 ? <p className="text-sm text-muted">{t('sub.noPlans')}</p> : (
          <ul className="mt-1 text-sm">
            {plans.map((p, i) => <li key={i}>{p.target_date} · {memberName(p.employee_id)} · {p.goal}</li>)}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
