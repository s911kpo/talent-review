import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronRight, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useSession } from '../../app/session';
import { demoAccounts, demoHrEmail, resetDemo, signInHr, signInWithPin } from '../../data/auth';

/** One-click entry for the fictional demo, so a walkthrough needs no PIN. Renders nothing outside demo mode. */
export function DemoEntry() {
  const { t } = useTranslation();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const accounts = demoAccounts();
  if (!accounts) return null;

  async function enter(run: () => Promise<unknown>) {
    setBusy(true);
    try {
      await run();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  // Molex has no section or department manager titles: everyone who leads a team is a Supervisor.
  const options = [
    { key: 'hr', Icon: ShieldCheck, label: t('demo.asHr'), note: t('demo.asHrNote'), run: () => signInHr(demoHrEmail, 'demo') },
    { key: 'gm', Icon: Building2, label: t('demo.asGm'), note: t('demo.asGmNote'), run: () => signInWithPin(String(accounts.gm), 'DEMO') },
    { key: 'lead', Icon: Users, label: t('demo.asLeadSupervisor'), note: t('demo.asLeadSupervisorNote'), run: () => signInWithPin(String(accounts.leadSupervisor), 'DEMO') },
    ...(accounts.supervisor ? [{ key: 'sup', Icon: UserRound, label: t('demo.asSupervisor'), note: t('demo.asSupervisorNote'), run: () => signInWithPin(String(accounts.supervisor), 'DEMO') }] : []),
  ];

  return (
    <section aria-labelledby="demo-entry" className="mt-8">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <h2 id="demo-entry" className="eyebrow">{t('demo.title')}</h2>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <p className="mt-3 text-center text-sm text-muted">{t('demo.body')}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map(({ key, Icon, label, note, run }) => (
          <button
            key={key} type="button" disabled={busy} onClick={() => void enter(run)}
            className="group flex items-center gap-3 rounded-card border border-line bg-card p-3 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift disabled:opacity-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-ink"><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-muted">{note}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

/** Thin notice at the top of every demo screen, with a way back to the starting data. */
export function DemoBanner() {
  const { t } = useTranslation();
  if (!demoAccounts()) return null;
  return (
    <div role="note" className="bg-warn-bg px-4 py-1.5 text-center text-xs text-warn-fg">
      {t('demo.banner')}{' '}
      <button type="button" className="font-medium underline" onClick={() => { resetDemo(); window.location.reload(); }}>{t('demo.reset')}</button>
    </div>
  );
}
