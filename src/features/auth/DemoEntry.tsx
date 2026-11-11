import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, UserRound, Users, ShieldCheck } from 'lucide-react';
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

  const options = [
    { key: 'hr', icon: ShieldCheck, label: t('demo.asHr'), run: () => signInHr(demoHrEmail, 'demo') },
    { key: 'gm', icon: Building2, label: t('demo.asGm'), run: () => signInWithPin(String(accounts.gm), 'DEMO') },
    { key: 'dept', icon: Users, label: t('demo.asDeptHead'), run: () => signInWithPin(String(accounts.deptHead), 'DEMO') },
    ...(accounts.section ? [{ key: 'section', icon: UserRound, label: t('demo.asSection'), run: () => signInWithPin(String(accounts.section), 'DEMO') }] : []),
  ];

  return (
    <section aria-labelledby="demo-entry" className="mt-6 rounded-card bg-info-bg p-4 text-info-fg">
      <h2 id="demo-entry" className="font-semibold">{t('demo.title')}</h2>
      <p className="mt-1 text-sm">{t('demo.body')}</p>
      <div className="mt-3 grid gap-2">
        {options.map(({ key, icon: Icon, label, run }) => (
          <button key={key} type="button" className="btn-secondary justify-start" disabled={busy} onClick={() => void enter(run)}>
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
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
    <div role="note" className="bg-warn-bg px-4 py-2 text-center text-sm text-warn-fg">
      {t('demo.banner')}{' '}
      <button type="button" className="underline" onClick={() => { resetDemo(); window.location.reload(); }}>{t('demo.reset')}</button>
    </div>
  );
}
