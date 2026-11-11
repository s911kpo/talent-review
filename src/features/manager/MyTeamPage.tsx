import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChartColumn, CircleHelp, Download, Network, Sparkles, Users, X } from 'lucide-react';
import { runExport } from '../admin/ExportPanel';
import { isAiEnabled } from '../../data/client';
import { useSession } from '../../app/session';
import { AppShell, ErrorNotice, type NavGroup } from '../../components/AppShell';
import { Avatar } from '../dashboard/sections';
import { getTeamSubmission, listLineTeams, listReviewsByReviewer } from '../../data/review';
import { readLocal, writeLocal } from '../../lib/localPrefs';
import { answeredCount, isEditable, missingSteps } from '../../lib/review/steps';
import type { LineTeam, Review, TeamSubmission } from '../../lib/review/types';
import { isUnderSixMonths, tenure } from '../../lib/tenure';
import type { TeamMember } from '../../data/team';
import { useRef_ } from './referenceData';
import { Tour } from './Tour';

const Dashboard = lazy(() => import('../dashboard/Dashboard'));
const AiPanel = lazy(() => import('../ai/AiPanel'));

const STATUS_TONE: Record<TeamSubmission['status'], string> = {
  draft: 'bg-subtle text-muted ring-1 ring-line',
  submitted: 'bg-info-bg text-info-fg',
  returned: 'bg-risk-bg text-risk-fg',
  confirmed: 'bg-ok-bg text-ok-fg',
  locked: 'bg-ok-bg text-ok-fg',
};

export function MyTeamPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useSession();
  const { cycle, managerId, team, memberName } = useRef_();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [teamState, setTeamState] = useState<TeamSubmission | null>(null);
  const [lineTeams, setLineTeams] = useState<LineTeam[]>([]);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'team') as 'team' | 'line' | 'dash' | 'ai';
  const setTab = (next: typeof tab) => setParams(next === 'team' ? {} : { tab: next });
  const [exporting, setExporting] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => readLocal(`tourSeen.${profile?.userId}`) !== '1');
  const [bannerOpen, setBannerOpen] = useState(() => readLocal('mobileBannerSeen') !== '1');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [r, ts, lines] = await Promise.all([
        listReviewsByReviewer(cycle.id, managerId), getTeamSubmission(cycle.id, managerId), listLineTeams(cycle.id),
      ]);
      setReviews(r);
      setTeamState(ts);
      setLineTeams(lines);
    } catch {
      setFailed(true);
    }
  }, [cycle.id, managerId]);

  useEffect(() => void load(), [load]);

  const closeTour = () => {
    writeLocal(`tourSeen.${profile?.userId}`, '1');
    setTourOpen(false);
  };

  if (failed) return <AppShell><ErrorNotice onRetry={() => void load()} /></AppShell>;
  if (!reviews || !teamState) return <AppShell><p role="status" className="text-muted">{t('app.loading')}</p></AppShell>;

  const keyTalent = reviews.filter((r) => r.is_key_talent);
  const complete = keyTalent.filter((r) => !isEditable(r.status) || missingSteps(r).length === 0);
  const pct = keyTalent.length ? Math.round((complete.length / keyTalent.length) * 100) : 0;
  const firstOpen = keyTalent.find((r) => isEditable(r.status) && missingSteps(r).length > 0);
  const anyReturned = keyTalent.some((r) => r.status === 'returned');
  const days = cycle.due_at ? Math.ceil((new Date(cycle.due_at).getTime() - Date.now()) / 86400000) : null;
  const editing = teamState.status === 'draft' || teamState.status === 'returned';

  let action: { label: string; to: string };
  if (!editing) action = { label: t('home.viewSubmitted'), to: '/team/submitted' };
  else if (keyTalent.length === 0) action = { label: t('home.startSelect'), to: '/team/select' };
  else if (firstOpen) action = { label: t('home.continue', { name: memberName(firstOpen.employee_id) }), to: `/team/review/${firstOpen.employee_id}` };
  else action = { label: t('home.check'), to: '/team/check' };

  const tabs = (['team', 'line', 'dash', 'ai'] as const)
    .filter((key) => (key !== 'line' || lineTeams.length > 0) && (key !== 'ai' || isAiEnabled));
  const ICONS = { team: Users, line: Network, dash: ChartColumn, ai: Sparkles };
  const LABELS = { team: 'home.tabTeam', line: 'home.tabLine', dash: 'ai.tabDash', ai: 'ai.tabManager' };
  const nav: NavGroup[] = [{ label: cycle.quarter_label, items: tabs.map((key) => ({ key, label: t(LABELS[key]), Icon: ICONS[key] })) }];

  return (
    <AppShell nav={nav} active={tab} onNavigate={(k) => setTab(k as typeof tab)}>
      {bannerOpen && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-card bg-info-bg px-3 py-2 text-sm text-info-fg md:hidden">
          <span>{t('home.mobileBanner')}</span>
          <button
            type="button" aria-label={t('home.dismiss')}
            onClick={() => { writeLocal('mobileBannerSeen', '1'); setBannerOpen(false); }}
          ><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      )}

      {tab === 'team' && <section className="card relative flex flex-wrap items-center justify-between gap-6 overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-soft" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t('home.tabTeam')} · {cycle.quarter_label}</h1>
            <span className={`tag ${STATUS_TONE[teamState.status]}`}>{t(`status.${teamState.status}`)}</span>
          </div>
          {cycle.due_at && (
            <p className="mt-1 text-sm text-muted">
              {t('team.dueIn', { date: new Date(cycle.due_at).toLocaleDateString(i18n.language) })}
              {days !== null && ` · ${days >= 0 ? t('home.daysLeft', { days }) : t('home.overdue')}`}
            </p>
          )}
          {editing && <p className="mt-1 text-sm text-muted">{t('home.timeHint')}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={action.to} className="btn-primary">{action.label}</Link>
            {editing && keyTalent.length > 0 && <Link to="/team/select" className="btn-secondary">{t('home.editSelect')}</Link>}
            <button type="button" className="btn-secondary" onClick={() => setTourOpen(true)}>
              <CircleHelp className="h-4 w-4" aria-hidden="true" />{t('home.help')}
            </button>
            {keyTalent.length > 0 && (
              <button
                type="button" className="btn-secondary" disabled={exporting}
                onClick={() => {
                  setExporting(true);
                  void runExport(cycle, managerId, profile?.displayName ?? String(managerId)).finally(() => setExporting(false));
                }}
              >
                <Download className="h-4 w-4" aria-hidden="true" />{exporting ? t('exp.running') : t('exp.myTeam')}
              </button>
            )}
          </div>
        </div>
        <div className="relative"><ProgressRing pct={pct} label={t('home.progress')} value={t('home.progressValue', { done: complete.length, total: keyTalent.length })} /></div>
      </section>}

      <div className={tab === 'team' ? 'mt-6' : ''}>
        {tab === 'line' && <h1 className="mb-4 text-2xl font-semibold tracking-tight">{t('home.tabLine')}</h1>}
        {tab === 'team' && team.length === 0 && (
          <div className="card flex items-center gap-3 p-6 text-muted">
            <Users className="h-5 w-5" aria-hidden="true" /><p>{t('team.empty')}</p>
          </div>
        )}
        {tab === 'team' && team.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m) => {
              const review = reviews.find((r) => r.employee_id === m.employeeId && r.is_key_talent);
              return (
                <MemberCard
                  key={m.employeeId} member={m} review={review}
                  onOpen={review ? () => navigate(`/team/review/${m.employeeId}`) : undefined}
                />
              );
            })}
          </ul>
        )}
        {tab === 'line' && <LineTab teams={lineTeams} />}
        <Suspense fallback={<p role="status" className="text-muted">{t('app.loading')}</p>}>
          {tab === 'dash' && <Dashboard mode="manager" />}
          {tab === 'ai' && <AiPanel mode="manager" />}
        </Suspense>
        {anyReturned && <span className="sr-only">{t('home.badgeReturned')}</span>}
      </div>

      {tourOpen && <Tour onClose={closeTour} />}
    </AppShell>
  );
}

function ProgressRing({ pct, label, value }: { pct: number; label: string; value: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${label} ${pct}%`}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#E4E8F0" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke="#2A5BD7" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 32 32)"
        />
        <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="600" fill="#101828">{pct}%</text>
      </svg>
      <div><p className="text-sm font-medium">{label}</p><p className="text-sm text-muted">{value}</p></div>
    </div>
  );
}

function MemberCard({ member, review, onOpen }: { member: TeamMember; review?: Review; onOpen?: () => void }) {
  const { t } = useTranslation();
  const span = tenure(member.startDate);
  const body = (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={member.fullName} />
        <div className="min-w-0">
          <p className="truncate font-medium">{member.fullName} <span className="text-muted">{member.localName}</span></p>
          <p className="truncate text-sm text-muted">{member.position}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">{member.dept}</p>
      <p className="mt-2 text-sm text-muted">
        {span ? t('team.tenure', { years: span.years, months: span.months }) : t('team.tenureUnknown')}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {isUnderSixMonths(member.startDate) && <span className="tag bg-info-bg text-info-fg">{t('badge.tntr')}</span>}
        {review && <span className="tag bg-ok-bg text-ok-fg">{t('home.badgeKey')}</span>}
        {review && <span className="tag bg-subtle text-muted">{t('home.badgeProgress', { n: answeredCount(review) })}</span>}
        {review?.status === 'returned' && <span className="tag bg-risk-bg text-risk-fg">{t('home.badgeReturned')}</span>}
      </div>
    </>
  );
  return (
    <li className="card transition hover:shadow-lift">
      {onOpen
        ? <button type="button" className="h-full w-full rounded-card p-4 text-left transition hover:bg-subtle" onClick={onOpen}>{body}</button>
        : <div className="p-4">{body}</div>}
    </li>
  );
}

function LineTab({ teams }: { teams: LineTeam[] }) {
  const { t } = useTranslation();
  if (teams.length === 0) return <div className="card p-6 text-muted">{t('home.lineEmpty')}</div>;
  return (
    <div>
      <p className="mb-3 text-sm text-muted">{t('home.lineNote')}</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((m) => (
          <li key={m.reviewer_id} className="card p-4">
            <p className="flex items-center gap-3 font-medium"><Avatar name={m.full_name} /><span>{m.full_name} <span className="text-muted">{m.local_name}</span></span></p>
            <p className="mt-1 text-sm text-muted">{t('home.lineMembers', { count: Number(m.member_count) })}</p>
            <span className={`tag mt-2 ${STATUS_TONE[m.status]}`}>{t(`status.${m.status}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
