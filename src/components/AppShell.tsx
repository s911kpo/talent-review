import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { FONT_STEPS, useSession } from '../app/session';
import { DemoBanner } from '../features/auth/DemoEntry';
import { MolexLogo } from './MolexLogo';

export function TopControls({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const { locale, setLocale, fontScale, setFontScale } = useSession();
  const index = FONT_STEPS.indexOf(fontScale);
  const base = tone === 'dark' ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-subtle hover:text-ink';
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button" className={`btn px-2 py-1 ${base}`} aria-label={`A− ${t('top.fontSmaller')}`}
        disabled={index <= 0} onClick={() => setFontScale(FONT_STEPS[index - 1])}
      >A−</button>
      <button
        type="button" className={`btn px-2 py-1 ${base}`} aria-label={`A+ ${t('top.fontLarger')}`}
        disabled={index >= FONT_STEPS.length - 1} onClick={() => setFontScale(FONT_STEPS[index + 1])}
      >A+</button>
      <span className={`mx-1 h-4 w-px ${tone === 'dark' ? 'bg-white/20' : 'bg-line'}`} aria-hidden="true" />
      <div role="group" aria-label={t('top.language')} className="flex">
        {([['zh-TW', '繁中'], ['en', 'EN']] as const).map(([value, label]) => (
          <button
            key={value} type="button" aria-pressed={locale === value}
            className={`btn whitespace-nowrap px-2 py-1 ${locale === value ? (tone === 'dark' ? 'bg-white/15 text-white' : 'bg-primary-soft text-primary-ink') : base}`}
            onClick={() => setLocale(value)}
          >{label}</button>
        ))}
      </div>
    </div>
  );
}

export function BrandMark({ tone = 'dark', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-3">
      <MolexLogo className="h-5 w-auto shrink-0" />
      <span className={`h-7 w-px ${tone === 'dark' ? 'bg-white/20' : 'bg-line'} ${compact ? 'hidden sm:block' : ''}`} aria-hidden="true" />
      <span className={`leading-tight ${compact ? 'hidden sm:block' : ''}`}>
        <span className={`block text-sm font-semibold ${tone === 'dark' ? 'text-white' : 'text-ink'}`}>{t('app.name')}</span>
        <span className={`block text-xs ${tone === 'dark' ? 'text-navy-text' : 'text-muted'}`}>{t('app.site')}</span>
      </span>
    </span>
  );
}

export interface NavItem { key: string; label: string; Icon: LucideIcon; badge?: number }
export interface NavGroup { label?: string; items: NavItem[] }

function SideNav({ nav, active, onNavigate }: { nav: NavGroup[]; active?: string; onNavigate: (key: string) => void }) {
  const { t } = useTranslation();
  return (
    <div role="tablist" aria-orientation="vertical" aria-label={t('top.navigation')} className="space-y-6">
      {nav.map((group, gi) => (
        <div key={gi}>
          {group.label && <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-navy-text/80">{group.label}</p>}
          <div className="space-y-0.5">
            {group.items.map(({ key, label, Icon, badge }) => {
              const on = key === active;
              return (
                <button
                  key={key} type="button" role="tab" aria-selected={on}
                  onClick={() => onNavigate(key)}
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    on ? 'bg-navy-2 font-medium text-white' : 'text-navy-text hover:bg-white/5 hover:text-white'}`}
                >
                  {on && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" aria-hidden="true" />}
                  <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-white' : 'text-navy-text group-hover:text-white'}`} aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {badge ? <span className="rounded-full bg-brand px-1.5 text-[0.6875rem] font-semibold text-white">{badge}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function UserChip() {
  const { t } = useTranslation();
  const { profile } = useSession();
  if (!profile) return null;
  const initials = profile.displayName.replace(/[^A-Za-z一-鿿]/g, '').slice(0, 2).toUpperCase();
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink" aria-hidden="true">{initials}</span>
      <span className="hidden leading-tight sm:block">
        <span className="block text-sm font-medium">{profile.displayName}</span>
        <span className="block text-xs text-muted">{t(profile.role === 'hr' ? 'top.roleHr' : 'top.roleSupervisor')}</span>
      </span>
    </span>
  );
}

/**
 * Page frame for every signed-in screen. With `nav`, a navy sidebar holds the sections (a drawer below 1024px);
 * without it (the one-question-at-a-time wizard), a single slim top bar keeps the focus on the task.
 */
export function AppShell({ children, nav, active, onNavigate }: {
  children: ReactNode; nav?: NavGroup[]; active?: string; onNavigate?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const { logout } = useSession();
  const [drawer, setDrawer] = useState(false);
  const go = (key: string) => { onNavigate?.(key); setDrawer(false); window.scrollTo({ top: 0 }); };

  const topBar = (
    <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
          {nav && (
            <button type="button" className="btn-ghost px-2 lg:hidden" aria-label={t('top.openMenu')} onClick={() => setDrawer(true)}>
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <span className={nav ? 'lg:hidden' : ''}><BrandMark tone="light" compact /></span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <TopControls />
          <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          <UserChip />
          <button type="button" className="btn-ghost px-2.5" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('top.logout')}</span>
            <span className="sr-only sm:hidden">{t('top.logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );

  if (!nav) {
    return (
      <div className="min-h-screen">
        <DemoBanner />
        {topBar}
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-8 bg-navy px-3 py-5">
      <div className="px-2"><BrandMark /></div>
      <SideNav nav={nav} active={active} onNavigate={go} />
    </div>
  );

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <div className="lg:flex">
        <aside className="hidden w-64 shrink-0 bg-navy lg:block"><div className="sticky top-0 h-screen overflow-y-auto">{sidebar}</div></aside>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('top.navigation')}>
            <div className="absolute inset-0 bg-ink/50" aria-hidden="true" onClick={() => setDrawer(false)} />
            <div className="relative h-full w-72 max-w-[85vw] overflow-y-auto shadow-lift">
              {sidebar}
              <button type="button" className="absolute right-3 top-5 rounded-lg p-1 text-white/80 hover:bg-white/10" aria-label={t('top.closeMenu')} onClick={() => setDrawer(false)}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {topBar}
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Title block at the top of a page: small context line, title, one-sentence purpose, actions on the right. */
export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
