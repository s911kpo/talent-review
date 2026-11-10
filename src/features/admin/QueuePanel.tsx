import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorNotice } from '../../components/AppShell';
import {
  confirmTeam, decideReopen, hrOverview, listVersions, lockTeam, returnReviews, unlockTeam,
  type TeamOverview, type VersionRow,
} from '../../data/hr';
import { listReviewsByReviewer } from '../../data/review';
import { getOpenCycle, type Cycle } from '../../data/team';
import { diffSnapshots } from '../../lib/review/diff';
import type { Review } from '../../lib/review/types';
import { ReferenceProvider, useRef_ } from '../manager/referenceData';
import { ReviewSummary } from '../manager/ReviewSummary';

export function QueuePanel() {
  const { t } = useTranslation();
  const [cycle, setCycle] = useState<Cycle | null | undefined>(undefined);
  const [teams, setTeams] = useState<TeamOverview[]>([]);
  const [reviewerId, setReviewerId] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const c = await getOpenCycle();
      setCycle(c);
      if (c) setTeams(await hrOverview(c.id));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => void load(), [load]);

  if (failed) return <ErrorNotice onRetry={() => void load()} />;
  if (cycle === undefined) return <p role="status" className="text-muted">{t('app.loading')}</p>;
  if (cycle === null) return <p className="text-muted">{t('hrq.noCycle')}</p>;
  const team = teams.find((x) => x.reviewer_id === reviewerId);

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <label className="label" htmlFor="q-team">{t('hrq.team')}</label>
        <select id="q-team" className="field" value={reviewerId ?? ''} onChange={(e) => setReviewerId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">{t('q.choose')}</option>
          {teams.map((x) => <option key={x.reviewer_id} value={x.reviewer_id}>{x.full_name} · {t(`status.${x.status}`)}</option>)}
        </select>
      </div>
      {team && (
        <ReferenceProvider managerId={team.reviewer_id} bare key={team.reviewer_id}>
          <TeamReview team={team} cycleId={cycle.id} onChanged={load} />
        </ReferenceProvider>
      )}
    </div>
  );
}

function TeamReview({ team, cycleId, onChanged }: { team: TeamOverview; cycleId: string; onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const { memberName } = useRef_();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const uid = useId();

  const load = useCallback(async () => {
    const all = await listReviewsByReviewer(cycleId, team.reviewer_id);
    setReviews(all.filter((r) => r.is_key_talent));
  }, [cycleId, team.reviewer_id]);

  useEffect(() => {
    load().catch(() => setError(true));
  }, [load]);

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(false);
    try {
      await action();
      setComments({});
      setPicked(new Set());
      await Promise.all([load(), onChanged()]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!reviews) return <p role="status" className="text-muted">{t('app.loading')}</p>;

  const toReturn = reviews
    .filter((r) => r.status === 'submitted' && (comments[r.id] ?? '').trim() !== '')
    .map((r) => ({ review_id: r.id, comment: comments[r.id] }));

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-card bg-risk-bg px-3 py-2 text-sm text-risk-fg">{t('hrq.actionFailed')}</p>}

      <div className="flex flex-wrap gap-2">
        {team.status === 'submitted' && <button type="button" className="btn-primary" disabled={busy} onClick={() => void act(() => confirmTeam(cycleId, team.reviewer_id))}>{t('hrq.confirm')}</button>}
        {team.status === 'confirmed' && <button type="button" className="btn-primary" disabled={busy} onClick={() => void act(() => lockTeam(cycleId, team.reviewer_id))}>{t('hrq.lock')}</button>}
        {team.status === 'locked' && (
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act(() => unlockTeam(cycleId, team.reviewer_id, 'confirmed'))}>{t('hrq.unlockConfirmed')}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act(() => unlockTeam(cycleId, team.reviewer_id, 'draft'))}>{t('hrq.unlockDraft')}</button>
          </>
        )}
      </div>

      {team.reopen_requested_at && (
        <section className="rounded-card bg-warn-bg p-4 text-sm text-warn-fg">
          <h3 className="font-semibold">{t('hrq.reopenTitle')}</h3>
          <p className="mt-1">{t('hrq.reopenReason', { reason: team.reopen_reason })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void act(() => decideReopen(cycleId, team.reviewer_id, true, null))}>{t('hrq.approveAll')}</button>
            <button type="button" className="btn-secondary" disabled={busy || picked.size === 0} onClick={() => void act(() => decideReopen(cycleId, team.reviewer_id, true, [...picked]))}>{t('hrq.approveSelected', { count: picked.size })}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act(() => decideReopen(cycleId, team.reviewer_id, false, null))}>{t('hrq.reject')}</button>
          </div>
        </section>
      )}

      {reviews.length === 0 && <p className="text-muted">{t('hrq.noReviews')}</p>}
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {team.reopen_requested_at && (
                  <input
                    type="checkbox" aria-label={t('hrq.selectForReopen', { name: memberName(r.employee_id) })}
                    checked={picked.has(r.employee_id)}
                    onChange={() => setPicked((prev) => {
                      const next = new Set(prev);
                      if (!next.delete(r.employee_id)) next.add(r.employee_id);
                      return next;
                    })}
                  />
                )}
                <span className="font-medium">{memberName(r.employee_id)}</span>
                <span className="tag bg-canvas text-muted">{t(`status.${r.status}`)}</span>
                <span className="text-sm text-muted">v{r.version}</span>
              </div>
              <button type="button" className="btn-secondary px-2.5 py-1" onClick={() => setOpen(open === r.id ? null : r.id)}>
                {open === r.id ? t('hrq.hideContent') : t('hrq.viewContent')}
              </button>
            </div>
            {r.status === 'submitted' && (
              <div className="mt-3">
                <label className="label" htmlFor={`${uid}-${r.id}`}>{t('hrq.returnComment', { name: memberName(r.employee_id) })}</label>
                <textarea
                  id={`${uid}-${r.id}`} className="field" rows={2} value={comments[r.id] ?? ''}
                  onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })}
                />
              </div>
            )}
            {open === r.id && (
              <div className="mt-3 border-t border-line pt-3">
                <ReviewSummary review={r} />
                <Versions reviewId={r.id} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {toReturn.length > 0 && (
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void act(() => returnReviews(cycleId, team.reviewer_id, toReturn))}>
          {t('hrq.returnSubmit', { count: toReturn.length })}
        </button>
      )}
    </div>
  );
}

function Versions({ reviewId }: { reviewId: string }) {
  const { t, i18n } = useTranslation();
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  useEffect(() => {
    listVersions(reviewId).then(setVersions).catch(() => setVersions([]));
  }, [reviewId]);

  if (!versions) return null;
  return (
    <section className="mt-4">
      <h4 className="text-sm font-medium">{t('hrq.versions')}</h4>
      {versions.length === 0 && <p className="text-sm text-muted">{t('hrq.noVersions')}</p>}
      <ul className="mt-1 space-y-1 text-sm">
        {versions.map((v, i) => {
          const previous = versions[i + 1];
          const changes = compareId === v.id && previous ? diffSnapshots(previous.snapshot, v.snapshot) : null;
          return (
            <li key={v.id}>
              <span>v{v.version} · {v.action} · {new Date(v.created_at).toLocaleString(i18n.language)}</span>
              {v.comment && <span className="text-muted"> · {v.comment}</span>}
              {previous && (
                <button type="button" className="ml-2 text-muted underline" onClick={() => setCompareId(compareId === v.id ? null : v.id)}>{t('hrq.compare')}</button>
              )}
              {changes && changes.length === 0 && <p className="text-muted">{t('hrq.noChanges')}</p>}
              {changes && changes.length > 0 && (
                <dl className="mt-1 rounded-card bg-canvas p-2">
                  {changes.map((c) => (
                    <div key={c.field} className="py-1">
                      <dt className="font-medium">{c.field}</dt>
                      <dd className="break-words text-risk-fg">{c.before}</dd>
                      <dd className="break-words text-ok-fg">{c.after}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
