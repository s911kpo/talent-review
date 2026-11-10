import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { ErrorNotice } from '../../components/AppShell';
import { importNamelist, listPopulation, type ImportResult } from '../../data/admin';
import { analyzeNamelist, diffPopulation, type Issue, type NamelistAnalysis, type PopulationDiff } from '../../lib/namelist/namelist';
import { NamelistFormatError, parseNamelistFile } from '../../lib/namelist/parseXlsx';
import { useCycleSelection } from './useCycles';

export function NamelistPanel() {
  const { t } = useTranslation();
  const { cycles, cycleId, setCycleId, failed } = useCycleSelection();
  const [analysis, setAnalysis] = useState<NamelistAnalysis | null>(null);
  const [diff, setDiff] = useState<PopulationDiff | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setAnalysis(null);
    setDiff(null);
    setFileError(null);
    setServerError(null);
    setResult(null);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    reset();
    setBusy(true);
    try {
      const raw = await parseNamelistFile(await file.arrayBuffer());
      const next = analyzeNamelist(raw);
      setAnalysis(next);
      setDiff(diffPopulation(next.rows, await listPopulation(cycleId)));
    } catch (err) {
      setFileError(
        err instanceof NamelistFormatError
          ? t('namelist.missingColumns', { columns: err.missing.join(', ') })
          : t('namelist.readError'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!analysis) return;
    setBusy(true);
    setServerError(null);
    try {
      setResult(await importNamelist(cycleId, analysis.rows));
    } catch (err) {
      setServerError((err as { message?: string }).message ?? 'unknown');
    } finally {
      setBusy(false);
    }
  }

  const errors = analysis?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = analysis?.issues.filter((i) => i.level === 'warning') ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      {failed && <ErrorNotice />}
      <section className="card space-y-4 p-4">
        <div>
          <label className="label" htmlFor="nl-cycle">{t('namelist.cycle')}</label>
          <select id="nl-cycle" className="field" value={cycleId} onChange={(e) => { setCycleId(e.target.value); reset(); }}>
            {cycles.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="nl-file">{t('namelist.file')}</label>
          <input id="nl-file" className="field" type="file" accept=".xlsx" disabled={!cycleId || busy} onChange={(e) => void onFile(e)} />
          <p className="mt-1 text-sm text-muted">{t('namelist.privacyNote')}</p>
        </div>
        {fileError && <p role="alert" className="rounded-card bg-risk-bg px-3 py-2 text-sm text-risk-fg">{fileError}</p>}
      </section>

      {analysis && (
        <section className="card space-y-4 p-4">
          <h2 className="font-semibold">{t('namelist.summaryTitle')}</h2>
          <p>{t('namelist.summary', { total: analysis.rows.length, inScope: analysis.inScopeCount, reviewers: analysis.reviewerIds.length })}</p>

          {analysis.issues.length === 0 && (
            <p className="flex items-center gap-2 text-ok-fg"><CircleCheck className="h-4 w-4" aria-hidden="true" />{t('namelist.noIssues')}</p>
          )}
          {errors.length > 0 && <IssueList title={t('namelist.errorsTitle', { count: errors.length })} issues={errors} tone="error" />}
          {warnings.length > 0 && <IssueList title={t('namelist.warningsTitle', { count: warnings.length })} issues={warnings} tone="warning" />}

          {diff && (
            <div>
              <h3 className="text-sm font-medium">{t('namelist.diffTitle')}</h3>
              <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                <li className="tag bg-info-bg text-info-fg">{t('namelist.diffAdded', { count: diff.added.length })}</li>
                <li className="tag bg-info-bg text-info-fg">{t('namelist.diffRemoved', { count: diff.removed.length })}</li>
                <li className="tag bg-info-bg text-info-fg">{t('namelist.diffSupervisor', { count: diff.supervisorChanged.length })}</li>
                <li className="tag bg-info-bg text-info-fg">{t('namelist.diffScope', { count: diff.scopeChanged.length })}</li>
              </ul>
            </div>
          )}

          {analysis.hasErrors && <p role="alert" className="text-sm text-risk-fg">{t('namelist.blocked')}</p>}
          {serverError && <p role="alert" className="rounded-card bg-risk-bg px-3 py-2 text-sm text-risk-fg">{t('namelist.serverRejected', { reason: serverError })}</p>}
          {result && (
            <p role="status" className="rounded-card bg-ok-bg px-3 py-2 text-sm text-ok-fg">
              {t('namelist.done', { rows: result.rows, transferred: result.reviews_transferred })}
            </p>
          )}
          {!result && (
            <button type="button" className="btn-primary" disabled={analysis.hasErrors || busy} onClick={() => void confirm()}>
              {t('namelist.confirm')}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function IssueList({ title, issues, tone }: { title: string; issues: Issue[]; tone: 'error' | 'warning' }) {
  const { t } = useTranslation();
  const Icon = tone === 'error' ? CircleAlert : TriangleAlert;
  const colors = tone === 'error' ? 'bg-risk-bg text-risk-fg' : 'bg-warn-bg text-warn-fg';
  return (
    <div className={`rounded-card p-3 text-sm ${colors}`}>
      <h3 className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4" aria-hidden="true" />{title}</h3>
      <ul className="mt-2 space-y-1">
        {issues.map((issue, i) => (
          <li key={i}>
            {issue.rowNumber !== undefined && `${t('namelist.row', { row: issue.rowNumber })} · `}
            {issue.employeeId !== undefined && `${t('namelist.employee', { id: issue.employeeId })} · `}
            {t(`namelist.issue.${issue.code}`)}
            {issue.detail && ` (${issue.detail})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
