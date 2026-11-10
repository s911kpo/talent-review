import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, ChartColumn, ClipboardCheck, Eye, FileDown, FileUp, KeyRound, LayoutGrid, ListTree, ScrollText, SlidersHorizontal, Sparkles } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { AccountsPanel } from './AccountsPanel';
import { CyclesPanel } from './CyclesPanel';
import { AuditPanel, OptionsPanel, QuestionsPanel } from './EditorsPanels';
import { ExportPanel } from './ExportPanel';
import { NamelistPanel } from './NamelistPanel';
import { OverviewPanel } from './OverviewPanel';
import { PreviewPanel } from './PreviewPanel';
import { QueuePanel } from './QueuePanel';

const Dashboard = lazy(() => import('../dashboard/Dashboard'));
const AiPanel = lazy(() => import('../ai/AiPanel'));
const DashboardTab = () => <Dashboard mode="hr" />;
const AiTab = () => <AiPanel mode="hr" />;

const TABS = [
  { key: 'overview', label: 'hrq.tabOverview', Icon: LayoutGrid, Panel: OverviewPanel },
  { key: 'queue', label: 'hrq.tabQueue', Icon: ClipboardCheck, Panel: QueuePanel },
  { key: 'dashboard', label: 'ai.tabHrDash', Icon: ChartColumn, Panel: DashboardTab },
  { key: 'export', label: 'hrq.tabExport', Icon: FileDown, Panel: ExportPanel },
  { key: 'ai', label: 'ai.tabHr', Icon: Sparkles, Panel: AiTab },
  { key: 'preview', label: 'hrq.tabPreview', Icon: Eye, Panel: PreviewPanel },
  { key: 'cycles', label: 'hr.tabCycles', Icon: CalendarRange, Panel: CyclesPanel },
  { key: 'namelist', label: 'hr.tabNamelist', Icon: FileUp, Panel: NamelistPanel },
  { key: 'accounts', label: 'hr.tabAccounts', Icon: KeyRound, Panel: AccountsPanel },
  { key: 'options', label: 'hrq.tabOptions', Icon: SlidersHorizontal, Panel: OptionsPanel },
  { key: 'questions', label: 'hrq.tabQuestions', Icon: ListTree, Panel: QuestionsPanel },
  { key: 'audit', label: 'hrq.tabAudit', Icon: ScrollText, Panel: AuditPanel },
] as const;

export function HrConsolePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('overview');
  const Active = TABS.find((x) => x.key === tab)!.Panel;
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">{t('hr.title')}</h1>
      <div role="tablist" className="mt-4 flex flex-wrap gap-1 border-b border-line">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key} type="button" role="tab" aria-selected={tab === key}
            className={`btn rounded-b-none border-b-2 ${tab === key ? 'border-brand text-brand' : 'border-transparent text-muted'}`}
            onClick={() => setTab(key)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {t(label)}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <Suspense fallback={<p role="status" className="text-muted">{t('app.loading')}</p>}><Active /></Suspense>
      </div>
    </AppShell>
  );
}
