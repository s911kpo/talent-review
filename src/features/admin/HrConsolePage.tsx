import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, ChartColumn, ClipboardCheck, Eye, FileDown, FileUp, Home, KeyRound, ListTree, ScrollText, SlidersHorizontal, Sparkles } from 'lucide-react';
import { AppShell, PageHeader, type NavGroup } from '../../components/AppShell';
import { isAiEnabled } from '../../data/client';
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

// `own` pages draw their own header (the home page and the dashboard).
const PAGES = [
  { key: 'overview', group: 'work', label: 'hr.navHome', Icon: Home, Panel: OverviewPanel, own: true },
  { key: 'queue', group: 'work', label: 'hrq.tabQueue', Icon: ClipboardCheck, Panel: QueuePanel },
  { key: 'dashboard', group: 'work', label: 'ai.tabHrDash', Icon: ChartColumn, Panel: DashboardTab, own: true },
  { key: 'export', group: 'work', label: 'hrq.tabExport', Icon: FileDown, Panel: ExportPanel },
  { key: 'ai', group: 'work', label: 'ai.tabHr', Icon: Sparkles, Panel: AiTab },
  { key: 'preview', group: 'admin', label: 'hrq.tabPreview', Icon: Eye, Panel: PreviewPanel },
  { key: 'cycles', group: 'admin', label: 'hr.tabCycles', Icon: CalendarRange, Panel: CyclesPanel },
  { key: 'namelist', group: 'admin', label: 'hr.tabNamelist', Icon: FileUp, Panel: NamelistPanel },
  { key: 'accounts', group: 'admin', label: 'hr.tabAccounts', Icon: KeyRound, Panel: AccountsPanel },
  { key: 'options', group: 'admin', label: 'hrq.tabOptions', Icon: SlidersHorizontal, Panel: OptionsPanel },
  { key: 'questions', group: 'admin', label: 'hrq.tabQuestions', Icon: ListTree, Panel: QuestionsPanel },
  { key: 'audit', group: 'admin', label: 'hrq.tabAudit', Icon: ScrollText, Panel: AuditPanel },
] as const;
type PageKey = (typeof PAGES)[number]['key'];

export function HrConsolePage() {
  const { t } = useTranslation();
  const [page, setPage] = useState<PageKey>('overview');
  const pages = PAGES.filter((x) => x.key !== 'ai' || isAiEnabled);
  const current = pages.find((x) => x.key === page) ?? pages[0];
  const nav: NavGroup[] = (['work', 'admin'] as const).map((group) => ({
    label: t(`hr.nav.${group}`),
    items: pages.filter((x) => x.group === group).map(({ key, label, Icon }) => ({ key, label: t(label), Icon })),
  }));
  const Active = current.Panel;
  return (
    <AppShell nav={nav} active={current.key} onNavigate={(k) => setPage(k as PageKey)}>
      {!('own' in current) && <PageHeader eyebrow={t(`hr.nav.${current.group}`)} title={t(current.label)} subtitle={t(`hr.desc.${current.key}`)} />}
      <Suspense fallback={<p role="status" className="text-muted">{t('app.loading')}</p>}>
        {current.key === 'overview' ? <OverviewPanel onNavigate={(k) => setPage(k as PageKey)} /> : <Active />}
      </Suspense>
    </AppShell>
  );
}
