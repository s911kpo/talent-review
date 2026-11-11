import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TopControls } from '../../components/AppShell';
import { isBackendConfigured } from '../../data/client';
import { DemoBanner, DemoEntry } from './DemoEntry';

export function LoginLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <div className="flex justify-end p-4"><TopControls /></div>
      <main className="flex flex-1 items-start justify-center px-4 pt-[8vh]">
        <div className="card w-full max-w-sm p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          {!isBackendConfigured && (
            <p role="status" className="mt-4 rounded-card bg-warn-bg px-3 py-2 text-sm text-warn-fg">
              {t('login.notConfigured')}
            </p>
          )}
          <div className="mt-5">{children}</div>
          <DemoEntry />
        </div>
      </main>
    </div>
  );
}
