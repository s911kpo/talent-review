import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';
import { signInWithPin, type LoginResult } from '../../data/auth';
import { isBackendConfigured } from '../../data/client';
import { LoginLayout } from './LoginLayout';

const MESSAGE: Record<Exclude<LoginResult, 'ok'>, string> = {
  invalid: 'login.invalid',
  locked: 'login.locked',
  unavailable: 'login.unavailable',
};

export function LoginPage() {
  const { t } = useTranslation();
  const { profile, refresh } = useSession();
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Exclude<LoginResult, 'ok'> | null>(null);

  if (profile) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithPin(employeeId.trim(), pin);
      if (result === 'ok') await refresh();
      else setError(result);
    } catch {
      setError('unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LoginLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <label className="label" htmlFor="employeeId">{t('login.employeeId')}</label>
          <input
            id="employeeId" className="field" inputMode="numeric" autoComplete="username" required
            value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="pin">{t('login.pin')}</label>
          <input
            id="pin" className="field uppercase tracking-widest" type="password" autoComplete="current-password"
            autoCapitalize="characters" required maxLength={8}
            value={pin} onChange={(e) => setPin(e.target.value)}
          />
        </div>
        {error && <p role="alert" className="rounded-card bg-risk-bg px-3 py-2 text-sm text-risk-fg">{t(MESSAGE[error])}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !isBackendConfigured}>
          {busy ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link className="text-muted underline" to="/hr/login">{t('login.hrLink')}</Link>
      </p>
    </LoginLayout>
  );
}
