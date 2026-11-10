import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { fetchExportRows, hrOverview, type TeamOverview } from '../../data/hr';
import { listOptions } from '../../data/review';
import type { Cycle } from '../../data/team';
import { buildExportBlob, exportFileName } from '../../lib/export/planningTool';
import { saveBlob } from '../../lib/export/pinList';
import { useCycleSelection } from './useCycles';

export type ExportOutcome = 'ok' | 'none' | 'failed';

/** Shared by the HR console and the manager's own export. */
export async function runExport(cycle: Cycle, reviewerId: number | null, scopeName: string): Promise<ExportOutcome> {
  try {
    const [rows, options] = await Promise.all([fetchExportRows(cycle.id, reviewerId), listOptions()]);
    if (rows.length === 0) return 'none';
    const draft = rows.some((r) => r.review.status === 'draft' || r.review.status === 'returned');
    const blob = await buildExportBlob({ quarterLabel: cycle.quarter_label, rows, options, draft });
    saveBlob(blob, exportFileName(cycle.code, scopeName, new Date()));
    return 'ok';
  } catch {
    return 'failed';
  }
}

export function ExportPanel() {
  const { t } = useTranslation();
  const { cycles, cycleId, setCycleId } = useCycleSelection();
  const [teams, setTeams] = useState<TeamOverview[]>([]);
  const [scope, setScope] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportOutcome | null>(null);

  useEffect(() => {
    if (cycleId) hrOverview(cycleId).then(setTeams).catch(() => setResult('failed'));
  }, [cycleId]);

  async function run() {
    const cycle = cycles.find((c) => c.id === cycleId);
    if (!cycle) return;
    setBusy(true);
    setResult(null);
    const reviewer = scope ? Number(scope) : null;
    const name = reviewer === null ? 'All' : (teams.find((x) => x.reviewer_id === reviewer)?.full_name ?? String(reviewer));
    setResult(await runExport(cycle, reviewer, name));
    setBusy(false);
  }

  return (
    <section className="card max-w-lg space-y-3 p-4">
      <h2 className="font-semibold">{t('exp.title')}</h2>
      <p className="text-sm text-muted">{t('exp.note')}</p>
      <div>
        <label className="label" htmlFor="ex-cycle">{t('accounts.cycle')}</label>
        <select id="ex-cycle" className="field" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ex-scope">{t('exp.scope')}</label>
        <select id="ex-scope" className="field" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">{t('exp.scopeAll')}</option>
          {teams.map((x) => <option key={x.reviewer_id} value={x.reviewer_id}>{x.full_name}</option>)}
        </select>
      </div>
      {result === 'none' && <p role="status" className="text-sm text-warn-fg">{t('exp.none')}</p>}
      {result === 'failed' && <p role="alert" className="text-sm text-risk-fg">{t('exp.failed')}</p>}
      <button type="button" className="btn-primary" disabled={busy || !cycleId} onClick={() => void run()}>
        <Download className="h-4 w-4" aria-hidden="true" />{busy ? t('exp.running') : t('exp.run')}
      </button>
    </section>
  );
}
