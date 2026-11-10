import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Download, Info, Printer, Sparkles } from 'lucide-react';
import { useSession } from '../../app/session';
import { AiError, generateAi, listAiOutputs, type AiOutput } from '../../data/ai';
import { hrOverview, type TeamOverview } from '../../data/hr';
import { saveBlob } from '../../lib/export/pinList';
import { Markdown } from '../manager/GuidePanel';
import { ReferenceProvider, useRef_ } from '../manager/referenceData';

const HR_TYPES = [
  'org_health_summary', 'succession_risk_brief', 'learning_map', 'dev_theme_tagging',
  'translate_en', 'hrbp_discussion_brief', 'team_dev_suggestions',
];
const NEEDS_TEAM = new Set(['hrbp_discussion_brief', 'team_dev_suggestions']);
const ERROR_CODES = ['demo_mode', 'ai_not_configured', 'no_data', 'rate_limited', 'scope_required', 'model_refused', 'output_truncated', 'invalid_output', 'forbidden'];

export default function AiPanel({ mode }: { mode: 'hr' | 'manager' }) {
  return <ReferenceProvider bare managerId={mode === 'hr' ? 0 : undefined}><Inner mode={mode} /></ReferenceProvider>;
}

function Inner({ mode }: { mode: 'hr' | 'manager' }) {
  const { t, i18n } = useTranslation();
  const { profile } = useSession();
  const { cycle } = useRef_();
  const [type, setType] = useState(mode === 'hr' ? HR_TYPES[0] : 'team_dev_suggestions');
  const [teams, setTeams] = useState<TeamOverview[]>([]);
  const [scope, setScope] = useState('');
  const [bilingual, setBilingual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<AiOutput | null>(null);
  const [history, setHistory] = useState<AiOutput[]>([]);
  const [copied, setCopied] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistory(await listAiOutputs(cycle.id));
  }, [cycle.id]);

  useEffect(() => {
    loadHistory().catch(() => undefined);
    if (mode === 'hr') hrOverview(cycle.id).then(setTeams).catch(() => undefined);
  }, [loadHistory, mode, cycle.id]);

  async function generate() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const output = await generateAi({
        type, cycleId: cycle.id, locale: i18n.language,
        scopeRef: mode === 'hr' && scope ? Number(scope) : undefined,
        bilingual: mode === 'hr' && bilingual,
      });
      setCurrent(output);
      await loadHistory();
    } catch (err) {
      const code = err instanceof AiError ? err.message : 'ai_failed';
      setError(ERROR_CODES.includes(code) ? code : 'ai_failed');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!current?.content_md) return;
    await navigator.clipboard.writeText(current.content_md);
    setCopied(true);
  }

  const download = () => {
    if (current?.content_md) saveBlob(new Blob([current.content_md], { type: 'text/markdown' }), `${current.output_type}_${current.created_at.slice(0, 10)}.md`);
  };

  const label = (o: AiOutput) => `${t('ai.disclaimer')} · ${o.model ?? ''} · ${new Date(o.created_at).toLocaleString(i18n.language)}`;
  const isJson = current?.output_type === 'dev_theme_tagging';

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <p className="flex items-center gap-2 rounded-card bg-info-bg px-3 py-2 text-sm text-info-fg print:hidden">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />{t('ai.notice')}
        </p>
        {mode === 'manager' && <p className="text-sm text-muted print:hidden">{t('ai.managerNote')}</p>}

        <section className="card space-y-3 p-4 print:hidden">
          {mode === 'hr' && (
            <>
              <div>
                <label className="label" htmlFor="ai-type">{t('ai.type')}</label>
                <select id="ai-type" className="field" value={type} onChange={(e) => setType(e.target.value)}>
                  {HR_TYPES.map((x) => <option key={x} value={x}>{t(`ai.types.${x}`)}</option>)}
                </select>
              </div>
              {NEEDS_TEAM.has(type) && (
                <div>
                  <label className="label" htmlFor="ai-scope">{t('ai.scope')}</label>
                  <select id="ai-scope" className="field" value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="">{t('q.choose')}</option>
                    {teams.map((x) => <option key={x.reviewer_id} value={x.reviewer_id}>{x.full_name}</option>)}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={bilingual} onChange={(e) => setBilingual(e.target.checked)} />
                {t('ai.bilingual')}
              </label>
            </>
          )}
          <button type="button" className="btn-primary" disabled={busy || (mode === 'hr' && NEEDS_TEAM.has(type) && !scope)} onClick={() => void generate()}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {busy ? t('ai.generating') : current ? t('ai.regenerate') : t('ai.generate')}
          </button>
          {error && <p role="alert" className="text-sm text-risk-fg">{t(`ai.err.${error}`)}</p>}
        </section>

        {current && (
          <section className="card p-4">
            <p className="text-xs text-muted">{label(current)}</p>
            <div className="mt-3">
              {isJson ? <pre className="overflow-x-auto text-xs">{current.content_md}</pre> : <Markdown text={current.content_md ?? ''} />}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <button type="button" className="btn-secondary" onClick={() => void copy()}>
                <Copy className="h-4 w-4" aria-hidden="true" />{copied ? t('ai.copied') : t('ai.copy')}
              </button>
              <button type="button" className="btn-secondary" onClick={download}>
                <Download className="h-4 w-4" aria-hidden="true" />{t('ai.downloadMd')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" aria-hidden="true" />{t('ai.print')}
              </button>
            </div>
          </section>
        )}
        <span className="sr-only">{profile?.displayName}</span>
      </div>

      <aside className="card self-start p-4 print:hidden">
        <h3 className="font-semibold">{t('ai.history')}</h3>
        {history.length === 0 && <p className="mt-2 text-sm text-muted">{t('ai.noHistory')}</p>}
        <ul className="mt-2 space-y-1 text-sm">
          {history.map((o) => (
            <li key={o.id}>
              <button type="button" className="w-full rounded-card px-2 py-1 text-left hover:bg-canvas" onClick={() => setCurrent(o)}>
                <span className="block">{t(`ai.types.${o.output_type}`)}</span>
                <span className="block text-xs text-muted">{new Date(o.created_at).toLocaleString(i18n.language)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
