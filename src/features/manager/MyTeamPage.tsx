import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { useSession } from '../../app/session';
import { AppShell, ErrorNotice } from '../../components/AppShell';
import { getOpenCycle, listDirectTeam, type Cycle, type TeamMember } from '../../data/team';
import { isUnderSixMonths, tenure } from '../../lib/tenure';

export function MyTeamPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useSession();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const open = await getOpenCycle();
      setCycle(open);
      setTeam(open && profile?.employeeId ? await listDirectTeam(open.id, profile.employeeId) : []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [profile?.employeeId]);

  useEffect(() => void load(), [load]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('team.title')}</h1>
        {cycle && (
          <p className="text-sm text-muted">
            {cycle.quarter_label}
            {cycle.due_at && ` · ${t('team.dueIn', { date: new Date(cycle.due_at).toLocaleDateString(i18n.language) })}`}
            {` · ${t('team.members', { count: team.length })}`}
          </p>
        )}
      </div>

      <div className="mt-6">
        {state === 'loading' && <p role="status" className="text-muted">{t('app.loading')}</p>}
        {state === 'error' && <ErrorNotice onRetry={() => void load()} />}
        {state === 'ready' && !cycle && <EmptyState text={t('team.noCycle')} />}
        {state === 'ready' && cycle && team.length === 0 && <EmptyState text={t('team.empty')} />}
        {state === 'ready' && team.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m) => <MemberCard key={m.employeeId} member={m} />)}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card flex items-center gap-3 p-6 text-muted">
      <Users className="h-5 w-5" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  const { t } = useTranslation();
  const span = tenure(member.startDate);
  return (
    <li className="card p-4">
      <p className="font-medium">{member.fullName} <span className="text-muted">{member.localName}</span></p>
      <p className="mt-1 text-sm text-muted">{member.position}</p>
      <p className="text-sm text-muted">{member.dept}</p>
      <p className="mt-2 text-sm text-muted">
        {span ? t('team.tenure', { years: span.years, months: span.months }) : t('team.tenureUnknown')}
      </p>
      {isUnderSixMonths(member.startDate) && <span className="tag mt-2 bg-info-bg text-info-fg">{t('badge.tntr')}</span>}
    </li>
  );
}
