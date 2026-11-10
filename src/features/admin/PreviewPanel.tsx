import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { ErrorNotice } from '../../components/AppShell';
import { listPopulation } from '../../data/admin';
import { hrOverview, type TeamOverview } from '../../data/hr';
import { listReviewsByReviewer } from '../../data/review';
import { getOpenCycle, listTeam, type Cycle, type TeamMember } from '../../data/team';
import type { Review } from '../../lib/review/types';
import { ReferenceProvider } from '../manager/referenceData';
import { ReviewSummary } from '../manager/ReviewSummary';

const AFTER_SUBMIT = ['submitted', 'confirmed', 'locked'];

/** Read-only approximation of what a manager sees, using the same draft rule as the database. */
export function PreviewPanel() {
  const { t } = useTranslation();
  const [cycle, setCycle] = useState<Cycle | null | undefined>(undefined);
  const [teams, setTeams] = useState<TeamOverview[]>([]);
  const [managerId, setManagerId] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await getOpenCycle();
      setCycle(c);
      if (c) setTeams(await hrOverview(c.id));
    })().catch(() => setFailed(true));
  }, []);

  if (failed) return <ErrorNotice />;
  if (cycle === undefined) return <p role="status" className="text-muted">{t('app.loading')}</p>;
  if (cycle === null) return <p className="text-muted">{t('hrq.noCycle')}</p>;
  const selected = teams.find((x) => x.reviewer_id === managerId);

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <label className="label" htmlFor="pv-mgr">{t('pv.select')}</label>
        <select id="pv-mgr" className="field" value={managerId ?? ''} onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">{t('q.choose')}</option>
          {teams.map((x) => <option key={x.reviewer_id} value={x.reviewer_id}>{x.full_name}</option>)}
        </select>
      </div>
      {selected && (
        <>
          <p role="status" className="flex items-center gap-2 rounded-card bg-[#FFE9A8] px-3 py-2 text-sm font-medium text-ink">
            <Eye className="h-4 w-4" aria-hidden="true" />{t('pv.banner', { name: selected.full_name })}
          </p>
          <ReferenceProvider managerId={selected.reviewer_id} bare key={selected.reviewer_id}>
            <PreviewBody cycle={cycle} managerId={selected.reviewer_id} teams={teams} />
          </ReferenceProvider>
        </>
      )}
    </div>
  );
}

interface LineGroup { reviewer: TeamOverview; members: TeamMember[]; reviews: Review[]; }

function PreviewBody({ cycle, managerId, teams }: { cycle: Cycle; managerId: number; teams: TeamOverview[] }) {
  const { t } = useTranslation();
  const [direct, setDirect] = useState<{ members: TeamMember[]; reviews: Review[] } | null>(null);
  const [lines, setLines] = useState<LineGroup[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const [members, reviews, population] = await Promise.all([
      listTeam(cycle.id, managerId), listReviewsByReviewer(cycle.id, managerId), listPopulation(cycle.id),
    ]);
    setDirect({ members, reviews });

    const seen = new Set<number>([managerId]);
    const queue = [managerId];
    const below: number[] = [];
    while (queue.length > 0) {
      const boss = queue.shift()!;
      for (const p of population) {
        if (p.supervisor_id === boss && !seen.has(p.employee_id)) {
          seen.add(p.employee_id);
          queue.push(p.employee_id);
          if (teams.some((x) => x.reviewer_id === p.employee_id)) below.push(p.employee_id);
        }
      }
    }

    setLines(await Promise.all(below.map(async (id) => ({
      reviewer: teams.find((x) => x.reviewer_id === id)!,
      members: await listTeam(cycle.id, id),
      reviews: (await listReviewsByReviewer(cycle.id, id)).filter((r) => AFTER_SUBMIT.includes(r.status)),
    }))));
  }, [cycle.id, managerId, teams]);

  useEffect(() => {
    load().catch(() => setFailed(true));
  }, [load]);

  if (failed) return <ErrorNotice />;
  if (!direct) return <p role="status" className="text-muted">{t('app.loading')}</p>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold">{t('pv.direct')}</h2>
        <PeopleList members={direct.members} reviews={direct.reviews} />
      </section>
      {lines.length > 0 && (
        <section>
          <h2 className="font-semibold">{t('pv.line')}</h2>
          {lines.map((g) => (
            <div key={g.reviewer.reviewer_id} className="mt-3">
              <h3 className="text-sm font-medium">{g.reviewer.full_name} · {t(`status.${g.reviewer.status}`)}</h3>
              <PeopleList members={g.members.filter((m) => g.reviews.some((r) => r.employee_id === m.employeeId))} reviews={g.reviews} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function PeopleList({ members, reviews }: { members: TeamMember[]; reviews: Review[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className="mt-2 space-y-2">
      {members.map((m) => {
        const review = reviews.find((r) => r.employee_id === m.employeeId && r.is_key_talent);
        return (
          <li key={m.employeeId} className="card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium">{m.fullName}</span> <span className="text-muted">{m.localName}</span>
                <span className="ml-2 text-sm text-muted">{review ? t(`status.${review.status}`) : t('pv.notKey')}</span>
              </span>
              {review && (
                <button type="button" className="btn-secondary px-2.5 py-1" onClick={() => setOpen(open === m.employeeId ? null : m.employeeId)}>
                  {open === m.employeeId ? t('hrq.hideContent') : t('hrq.viewContent')}
                </button>
              )}
            </div>
            {review && open === m.employeeId && <div className="mt-2 border-t border-line pt-2"><ReviewSummary review={review} /></div>}
          </li>
        );
      })}
    </ul>
  );
}
