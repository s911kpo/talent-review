import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, LineChart, ShieldCheck } from 'lucide-react';
import { BrandMark, TopControls } from '../../components/AppShell';
import { isBackendConfigured } from '../../data/client';
import { DemoBanner, DemoEntry } from './DemoEntry';

export function LoginLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useTranslation();
  const points = [
    { Icon: Compass, title: t('login.p1Title'), body: t('login.p1Body') },
    { Icon: LineChart, title: t('login.p2Title'), body: t('login.p2Body') },
    { Icon: ShieldCheck, title: t('login.p3Title'), body: t('login.p3Body') },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="relative hidden overflow-hidden bg-navy px-12 py-10 text-white lg:flex lg:flex-col">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-brand/20 blur-3xl" aria-hidden="true" />
          <BrandMark />
          <div className="relative mt-auto max-w-md pb-6">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">{t('login.heroTitle')}</h2>
            <p className="mt-3 text-navy-text">{t('login.heroBody')}</p>
            <ul className="mt-10 space-y-5">
              {points.map(({ Icon, title: pt, body }) => (
                <li key={pt} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span>
                    <span className="block font-medium">{pt}</span>
                    <span className="block text-sm text-navy-text">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4 sm:px-8">
            <span className="lg:hidden"><BrandMark tone="light" /></span>
            <span className="hidden lg:block" />
            <TopControls />
          </div>
          <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-[6vh] sm:px-8">
            <div className="w-full max-w-md">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
              {!isBackendConfigured && (
                <p role="status" className="mt-4 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">
                  {t('login.notConfigured')}
                </p>
              )}
              <div className="card mt-6 p-6">{children}</div>
              <DemoEntry />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
