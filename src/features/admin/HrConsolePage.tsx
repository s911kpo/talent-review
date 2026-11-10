import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, FileUp, KeyRound } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { CyclesPanel } from './CyclesPanel';
import { NamelistPanel } from './NamelistPanel';
import { AccountsPanel } from './AccountsPanel';

const TABS = [
  { key: 'cycles', label: 'hr.tabCycles', Icon: CalendarRange },
  { key: 'namelist', label: 'hr.tabNamelist', Icon: FileUp },
  { key: 'accounts', label: 'hr.tabAccounts', Icon: KeyRound },
] as const;

export function HrConsolePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('cycles');
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
        {tab === 'cycles' && <CyclesPanel />}
        {tab === 'namelist' && <NamelistPanel />}
        {tab === 'accounts' && <AccountsPanel />}
      </div>
    </AppShell>
  );
}
