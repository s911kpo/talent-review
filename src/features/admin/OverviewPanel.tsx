import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, ArrowUpDown, CalendarClock, ChartColumn, CheckCheck, CircleDashed, Download, FileDown, Inbox, MessageSquareWarning, Undo2,
} from 'lucide-react';
import { ErrorNotice, PageHeader } from '../../components/AppShell';
import { confirmTeam, hrOverview, type TeamOverview } from '../../data/hr';
import { saveBlob } from '../../lib/export/pinList';
import { ProbeList, Ring } from '../dashboard/ui';
import { Avatar } from '../dashboard/sections';
import { useCycleSelection } from './useCycles';

type SortKey = 'full_name' | 'progress' | 'status' | 'last_updated';
const STATUSES = ['draft', 'returned', 'submitted', 'confirmed', 'locked'] as const;
const STATUS_STYLE: Record<string, { pill: string; bar: string }> = {
  draft: { pill: 'bg-subtle text-muted ring-1 ring-line', bar: '#C3C9D5' },
  returned: { pill: 'bg-risk-bg text-risk-fg', bar: '#D03B3B' },
  submitted: { pill: 'bg-info-bg text-info-fg', bar: '#2A78D6' },
  confirmed: { pill: 'bg-ok-bg text-ok-fg', bar: '#1BAF7A' },
  locked: { pill: 'bg-ok-bg text-ok-fg', bar: '#0E7A4F' },
};
const ROWS = 12;
const done = (r: TeamOverview) => (Number(r.key_count) ? Number(r.complete_count) / Number(r.key_count) : 0);

export function OverviewPanel({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { t, i18n } = useTranslation();
  const { cycles, cycleId, setCycleId, failed: cyclesFailed } = useCycleSelection();
  const [rows, setRows] = useState<TeamOverview[]>([]);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortKey>('progress');
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    if (!cycleId) return;
    setFailed(false);
    try {
      setRows(await hrOverview(cycleId));
    } catch {
      setFailed(true);
    }
  }, [cycleId]);

  useEffect(() => void load(), [load]);

  const cycle = cycles.find((c) => c.id === cycleId);
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const submittedTeams = rows.filter((r) => ['submitted', 'confirmed', 'locked'].includes(r.status)).length;
  const teamPct = rows.length ? Math.round((submittedTeams / rows.length) * 100) : 0;
  const keyTotal = rows.reduce((n, r) => n + Number(r.key_count), 0);
  const keyDone = rows.reduce((n, r) => n + Number(r.complete_count), 0);
  const reopen = rows.filter((r) => r.reopen_requested_at).length;
  const notStarted = rows.filter((r) => r.status === 'draft' && Number(r.key_count) === 0).length;
  const days = cycle?.due_at ? Math.ceil((new Date(cycle.due_at).getTime() - Date.now()) / 86400000) : null;

  const shown = rows
    .filter((r) => !status || r.status === status)
    .sort((a, b) => (sort === 'progress' ? done(a) - done(b)
      : sort === 'status' ? STATUSES.indexOf(a.status as (typeof STATUSES)[number]) - STATUSES.indexOf(b.status as (typeof STATUSES)[number])
        : String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), 'en', { numeric: true })));
  const submitted = rows.filter((r) => r.status === 'submitted');

  async function batchConfirm() {
    setBusy(true);
    setFailed(false);
    try {
      for (const r of submitted) await confirmTeam(cycleId, r.reviewer_id);
      await load();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function downloadProgress() {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Progress');
    ws.addRow(['Supervisor', 'Direct', 'Key talent', 'Complete', 'Status', 'Last updated', 'Discussion', 'Change request']);
    shown.forEach((r) => ws.addRow([
      r.full_name, Number(r.direct_count), Number(r.key_count), Number(r.complete_count), r.status,
      r.last_updated ?? '', r.discussion_status, r.reopen_reason ?? '',
    ]));
    const buffer = await wb.xlsx.writeBuffer();
    saveBlob(new Blob([buffer]), `TalentReview_Progress_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const sortHeader = (key: SortKey, label: string) => (
    <th className="th">
      <button type="button" className={`inline-flex items-center gap-1 uppercase ${sort === key ? 'text-ink' : ''}`} onClick={() => setSort(key)}>
        {label}<ArrowUpDown className="h-3 w-3" aria-hidden="true" />
      </button>
    </th>
  );

  const todo = [
    { key: 'confirm', Icon: Inbox, n: count('submitted'), tone: 'bg-info-bg text-info-fg', to: 'queue' },
    { key: 'reopen', Icon: MessageSquareWarning, n: reopen, tone: 'bg-warn-bg text-warn-fg', to: 'queue' },
    { key: 'returned', Icon: Undo2, n: count('returned'), tone: 'bg-risk-bg text-risk-fg', to: 'queue' },
    { key: 'notStarted', Icon: CircleDashed, n: notStarted, tone: 'bg-subtle text-muted', to: '' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={cycle ? `${cycle.code}${cycle.status ? ` · ${t(`cycles.status.${cycle.status}`)}` : ''}` : undefined}
        title={t('hrHome.hrTitle')}
        subtitle={t('hrHome.hrSubtitle')}
        actions={(
          <>
            <label className="sr-only" htmlFor="ov-cycle">{t('accounts.cycle')}</label>
            <select id="ov-cycle" className="field w-40 py-1.5 text-sm" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
            <button type="button" className="btn-secondary" onClick={() => void downloadProgress()}>
              <Download className="h-4 w-4" aria-hidden="true" />{t('hrq.downloadProgress')}
            </button>
          </>
        )}
      />
      {(failed || cyclesFailed) && <ErrorNotice onRetry={() => void load()} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
        <section className="card relative overflow-hidden p-6" aria-labelledby="hr-progress">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary-soft" aria-hidden="true" />
          <div className="relative flex flex-wrap items-center gap-8">
            <div className="relative grid place-items-center">
              <Ring pct={teamPct} color="#2A5BD7" size={136} />
              <span className="absolute text-center">
                <span className="num block text-3xl font-semibold">{teamPct}%</span>
                <span className="block text-xs text-muted">{t('hrHome.teamsSubmitted')}</span>
              </span>
            </div>
            <div className="min-w-[14rem] flex-1">
              <h2 id="hr-progress" className="text-lg font-semibold">{t('hrHome.progressTitle')}</h2>
              <dl className="mt-3 grid grid-cols-3 gap-4">
                <div><dt className="text-xs text-muted">{t('hrHome.teams')}</dt><dd className="num text-2xl font-semibold">{submittedTeams}<span className="text-base text-muted"> / {rows.length}</span></dd></div>
                <div><dt className="text-xs text-muted">{t('hrHome.keyDone')}</dt><dd className="num text-2xl font-semibold">{keyDone}<span className="text-base text-muted"> / {keyTotal}</span></dd></div>
                <div>
                  <dt className="text-xs text-muted">{t('hrHome.deadline')}</dt>
                  <dd className={`num flex items-center gap-1 text-2xl font-semibold ${days !== null && days < 7 ? 'text-risk-fg' : ''}`}>
                    <CalendarClock className="h-5 w-5" aria-hidden="true" />{days === null ? '—' : days >= 0 ? t('hrHome.days', { days }) : t('hrHome.overdue')}
                  </dd>
                </div>
              </dl>
              <div className="mt-5">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                  {STATUSES.map((s) => count(s) > 0 && <span key={s} style={{ flexGrow: count(s), background: STATUS_STYLE[s].bar }} />)}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {STATUSES.map((s) => (
                    <li key={s} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[s].bar }} aria-hidden="true" />
                      {t(`status.${s}`)} <span className="num font-semibold text-ink">{count(s)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
        <Calibration rows={rows} />
        </div>

        <div className="flex flex-col gap-6">
        <section className="card p-5" aria-labelledby="hr-todo">
          <h2 id="hr-todo" className="font-semibold">{t('hrHome.todoTitle')}</h2>
          <ul className="mt-3 space-y-1">
            {todo.map(({ key, Icon, n, tone, to }) => (
              <li key={key}>
                <button type="button" disabled={!to || n === 0} onClick={() => to && onNavigate?.(to)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition enabled:hover:bg-subtle disabled:cursor-default">
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="flex-1 text-sm">{t(`hrHome.todo.${key}`)}</span>
                  <span className={`num text-lg font-semibold ${n === 0 ? 'text-muted' : ''}`}>{n}</span>
                  {to && n > 0 && <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
            <button type="button" className="btn-secondary" onClick={() => onNavigate?.('dashboard')}><ChartColumn className="h-4 w-4" aria-hidden="true" />{t('ai.tabHrDash')}</button>
            <button type="button" className="btn-secondary" onClick={() => onNavigate?.('export')}><FileDown className="h-4 w-4" aria-hidden="true" />{t('hrq.tabExport')}</button>
          </div>
        </section>
        <Stalled rows={rows} />
        </div>
      </div>

      <section className="card overflow-hidden" aria-labelledby="hr-teams">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="hr-teams" className="font-semibold">{t('hrHome.teamsTitle')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={t('hrq.filterStatus')} className="flex flex-wrap gap-1 rounded-lg bg-subtle p-1">
              {['', ...STATUSES].map((s) => (
                <button key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${status === s ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink'}`}>
                  {s ? t(`status.${s}`) : t('hrq.all')} <span className="num text-muted">{s ? count(s) : rows.length}</span>
                </button>
              ))}
            </div>
            {submitted.length > 0 && (
              <button type="button" className="btn-primary py-1.5" disabled={busy} onClick={() => void batchConfirm()}>
                <CheckCheck className="h-4 w-4" aria-hidden="true" />{t('hrq.batchConfirm', { count: submitted.length })}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {shown.length === 0 ? <p className="p-6 text-center text-sm text-muted">{t('hrq.empty')}</p> : (
            <table className="w-full">
              <thead>
                <tr>
                  {sortHeader('full_name', t('hrq.colReviewer'))}
                  <th className="th">{t('hrq.colDirect')}</th>
                  {sortHeader('progress', t('hrq.colDone'))}
                  {sortHeader('status', t('hrq.colStatus'))}
                  <th className="th">{t('hrq.colDiscussion')}</th>
                  {sortHeader('last_updated', t('hrq.colUpdated'))}
                  <th className="th">{t('hrq.colReopen')}</th>
                </tr>
              </thead>
              <tbody>
                {(all ? shown : shown.slice(0, ROWS)).map((r) => {
                  const p = Math.round(done(r) * 100);
                  return (
                    <tr key={r.reviewer_id} className="hover:bg-subtle/60">
                      <td className="td">
                        <span className="flex items-center gap-3">
                          <Avatar name={r.full_name} />
                          <span><span className="block font-medium">{r.full_name}</span><span className="block text-xs text-muted">{r.local_name}</span></span>
                        </span>
                      </td>
                      <td className="td num">{Number(r.direct_count)}</td>
                      <td className="td min-w-[10rem]">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 rounded-full bg-line/70" aria-hidden="true"><span className="block h-full rounded-full bg-primary" style={{ width: `${p}%` }} /></span>
                          <span className="num w-14 text-right text-xs text-muted">{Number(r.complete_count)} / {Number(r.key_count)}</span>
                        </span>
                      </td>
                      <td className="td"><span className={`tag ${STATUS_STYLE[r.status]?.pill ?? ''}`}>{t(`status.${r.status}`)}</span></td>
                      <td className="td text-xs">{t(`hrq.discussion.${r.discussion_status}`)}{r.discussion_date ? <span className="block text-muted">{r.discussion_date}</span> : null}</td>
                      <td className="td text-xs text-muted">{r.last_updated ? new Date(r.last_updated).toLocaleDateString(i18n.language) : '—'}</td>
                      <td className="td">{r.reopen_requested_at ? <span className="tag bg-warn-bg text-warn-fg">{t('hrq.reopenPending')}</span> : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {shown.length > ROWS && (
          <div className="border-t border-line px-5 py-3 text-center">
            <button type="button" className="btn-ghost" onClick={() => setAll(!all)}>{all ? t('hrHome.showLess') : t('hrHome.showAll', { count: shown.length })}</button>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * The step after submission: each team's calibration discussion with the HRBP and the +1 Supervisor.
 * Shows how many are done, scheduled or still to book, and the next few dates.
 */
function Calibration({ rows }: { rows: TeamOverview[] }) {
  const { t, i18n } = useTranslation();
  const ready = rows.filter((r) => ['submitted', 'confirmed', 'locked'].includes(r.status));
  const by = (s: string) => ready.filter((r) => r.discussion_status === s);
  const parts = [
    { key: 'done', n: by('done').length, color: '#1BAF7A' },
    { key: 'scheduled', n: by('scheduled').length, color: '#2A78D6' },
    { key: 'not_scheduled', n: by('not_scheduled').length, color: '#EDA100' },
  ];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = by('scheduled').filter((r) => (r.discussion_date ?? '') >= today)
    .sort((a, b) => String(a.discussion_date).localeCompare(String(b.discussion_date))).slice(0, 6);
  return (
    <section className="card flex-1 p-6" aria-labelledby="hr-cal">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="hr-cal" className="text-lg font-semibold">{t('hrHome.calTitle')}</h2>
          <p className="mt-0.5 text-sm text-muted">{t('hrHome.calSubtitle', { count: ready.length })}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line/60" aria-hidden="true">
            {parts.map((p) => p.n > 0 && <span key={p.key} style={{ flexGrow: p.n, background: p.color }} />)}
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-3">
            {parts.map((p) => (
              <li key={p.key} className="rounded-lg bg-subtle p-3">
                <span className="flex items-center gap-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />{t(`hrq.discussion.${p.key}`)}</span>
                <span className="num mt-1 block text-2xl font-semibold">{p.n}</span>
              </li>
            ))}
          </ul>
          {parts[2].n > 0 && <p className="mt-3 text-sm text-warn-fg">{t('hrHome.calNudge', { count: parts[2].n })}</p>}
          <div className="mt-5"><ProbeList items={t('hrHome.calProbes', { returnObjects: true }) as string[]} /></div>
        </div>
        <div>
          <p className="eyebrow">{t('hrHome.calNext')}</p>
          {upcoming.length === 0 ? <p className="mt-3 text-sm text-muted">{t('hrHome.calNone')}</p> : (
            <ul className="mt-2 divide-y divide-line">
              {upcoming.map((r) => {
                const d = new Date(`${r.discussion_date}T00:00:00`);
                return (
                  <li key={r.reviewer_id} className="flex items-center gap-3 py-2">
                    <span className="grid w-11 shrink-0 place-items-center rounded-lg border border-line py-1 leading-none">
                      <span className="text-[0.625rem] text-muted">{d.toLocaleDateString(i18n.language, { month: 'short' })}</span>
                      <span className="num text-base font-semibold">{d.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.full_name}</span>
                      <span className="block text-xs text-muted">{t('hrHome.calKey', { count: Number(r.key_count) })}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const STALL_DAYS = 5;

/** Teams still drafting (or returned) with no saves for a while: who to nudge today. */
function Stalled({ rows }: { rows: TeamOverview[] }) {
  const { t } = useTranslation();
  const now = Date.now();
  const idle = (r: TeamOverview) => (r.last_updated ? Math.floor((now - new Date(r.last_updated).getTime()) / 86400000) : null);
  const stalled = rows.filter((r) => ['draft', 'returned'].includes(r.status) && (idle(r) ?? STALL_DAYS) >= STALL_DAYS)
    .sort((a, b) => (idle(b) ?? 99) - (idle(a) ?? 99));
  return (
    <section className="card flex-1 p-5" aria-labelledby="hr-stalled">
      <h2 id="hr-stalled" className="font-semibold">{t('hrHome.stalledTitle')}</h2>
      <p className="mt-0.5 text-sm text-muted">{t('hrHome.stalledNote', { days: STALL_DAYS })}</p>
      {stalled.length === 0 ? <p className="mt-3 text-sm text-muted">{t('hrHome.stalledNone')}</p> : (
        <ul className="mt-3 divide-y divide-line">
          {stalled.slice(0, 5).map((r) => (
            <li key={r.reviewer_id} className="flex items-center gap-3 py-2">
              <Avatar name={r.full_name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.full_name}</span>
                <span className="block text-xs text-muted">{Number(r.complete_count)} / {Number(r.key_count)} · {t(`status.${r.status}`)}</span>
              </span>
              <span className="tag bg-warn-bg text-warn-fg">{idle(r) === null ? t('hrHome.neverSaved') : t('hrHome.idleDays', { days: idle(r) })}</span>
            </li>
          ))}
        </ul>
      )}
      {stalled.length > 5 && <p className="mt-2 text-xs text-muted">{t('hrHome.stalledMore', { count: stalled.length - 5 })}</p>}
    </section>
  );
}
