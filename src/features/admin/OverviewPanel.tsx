import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Download } from 'lucide-react';
import { ErrorNotice } from '../../components/AppShell';
import { confirmTeam, hrOverview, type TeamOverview } from '../../data/hr';
import { saveBlob } from '../../lib/export/pinList';
import { useCycleSelection } from './useCycles';

type SortKey = 'full_name' | 'key_count' | 'status' | 'last_updated';
const STATUSES = ['draft', 'submitted', 'returned', 'confirmed', 'locked'];

export function OverviewPanel() {
  const { t, i18n } = useTranslation();
  const { cycles, cycleId, setCycleId, failed: cyclesFailed } = useCycleSelection();
  const [rows, setRows] = useState<TeamOverview[]>([]);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortKey>('full_name');
  const [busy, setBusy] = useState(false);

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

  const shown = rows
    .filter((r) => !status || r.status === status)
    .sort((a, b) => String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), 'en', { numeric: true }));
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
    ws.addRow(['Reviewer', 'Direct', 'Key talent', 'Complete', 'Status', 'Last updated', 'Discussion', 'Change request']);
    shown.forEach((r) => ws.addRow([
      r.full_name, Number(r.direct_count), Number(r.key_count), Number(r.complete_count), r.status,
      r.last_updated ?? '', r.discussion_status, r.reopen_reason ?? '',
    ]));
    const buffer = await wb.xlsx.writeBuffer();
    saveBlob(new Blob([buffer]), `TalentReview_Progress_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const sortHeader = (key: SortKey, label: string) => (
    <th className="th">
      <button type="button" className="inline-flex items-center gap-1" onClick={() => setSort(key)}>
        {label}<ArrowUpDown className="h-3 w-3" aria-hidden="true" />
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      {(failed || cyclesFailed) && <ErrorNotice onRetry={() => void load()} />}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <label className="label" htmlFor="ov-cycle">{t('accounts.cycle')}</label>
          <select id="ov-cycle" className="field" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="ov-status">{t('hrq.filterStatus')}</label>
          <select id="ov-status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('hrq.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void downloadProgress()}>
          <Download className="h-4 w-4" aria-hidden="true" />{t('hrq.downloadProgress')}
        </button>
        {submitted.length > 0 && (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void batchConfirm()}>
            {t('hrq.batchConfirm', { count: submitted.length })}
          </button>
        )}
      </div>

      <div className="card overflow-x-auto p-2">
        {shown.length === 0 ? <p className="p-4 text-muted">{t('hrq.empty')}</p> : (
          <table className="w-full">
            <thead>
              <tr>
                {sortHeader('full_name', t('hrq.colReviewer'))}
                <th className="th">{t('hrq.colDirect')}</th>
                {sortHeader('key_count', t('hrq.colKey'))}
                <th className="th">{t('hrq.colDone')}</th>
                {sortHeader('status', t('hrq.colStatus'))}
                {sortHeader('last_updated', t('hrq.colUpdated'))}
                <th className="th">{t('hrq.colDiscussion')}</th>
                <th className="th">{t('hrq.colReopen')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.reviewer_id}>
                  <td className="td">{r.full_name} <span className="text-muted">{r.local_name}</span></td>
                  <td className="td">{Number(r.direct_count)}</td>
                  <td className="td">{Number(r.key_count)}</td>
                  <td className="td">{Number(r.complete_count)} / {Number(r.key_count)}</td>
                  <td className="td">{t(`status.${r.status}`)}</td>
                  <td className="td">{r.last_updated ? new Date(r.last_updated).toLocaleString(i18n.language) : ''}</td>
                  <td className="td">{t(`hrq.discussion.${r.discussion_status}`)}{r.discussion_date ? ` · ${r.discussion_date}` : ''}</td>
                  <td className="td">{r.reopen_requested_at ? <span className="tag bg-warn-bg text-warn-fg">{t('hrq.reopenPending')}</span> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
