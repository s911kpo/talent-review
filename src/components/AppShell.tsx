import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { FONT_STEPS, useSession } from '../app/session';
import { DemoBanner } from '../features/auth/DemoEntry';

export function TopControls() {
  const { t } = useTranslation();
  const { locale, setLocale, fontScale, setFontScale } = useSession();
  const index = FONT_STEPS.indexOf(fontScale);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button" className="btn-secondary px-2.5 py-1" aria-label={`A− ${t('top.fontSmaller')}`}
        disabled={index <= 0} onClick={() => setFontScale(FONT_STEPS[index - 1])}
      >A−</button>
      <button
        type="button" className="btn-secondary px-2.5 py-1" aria-label={`A+ ${t('top.fontLarger')}`}
        disabled={index >= FONT_STEPS.length - 1} onClick={() => setFontScale(FONT_STEPS[index + 1])}
      >A+</button>
      <div role="group" aria-label={t('top.language')} className="ml-1 flex">
        {([['zh-TW', '繁中'], ['en', 'EN']] as const).map(([value, label]) => (
          <button
            key={value} type="button" aria-pressed={locale === value}
            className={`btn px-2.5 py-1 ${locale === value ? 'text-brand underline' : 'text-muted'}`}
            onClick={() => setLocale(value)}
          >{label}</button>
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { profile, logout } = useSession();
  return (
    <div className="min-h-screen">
      <DemoBanner />
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="font-semibold">{t('app.name')}</span>
          <div className="flex flex-wrap items-center gap-3">
            <TopControls />
            {profile && <span className="text-sm text-muted">{profile.displayName}</span>}
            <button type="button" className="btn-secondary px-2.5 py-1" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t('top.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function ErrorNotice({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card bg-risk-bg px-4 py-3 text-sm text-risk-fg">
      <span>{t('app.errorGeneric')}</span>
      {onRetry && <button type="button" className="btn-secondary px-2.5 py-1" onClick={onRetry}>{t('app.retry')}</button>}
    </div>
  );
}
