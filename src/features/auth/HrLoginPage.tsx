import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';
import { signInHr } from '../../data/auth';
import { isBackendConfigured } from '../../data/client';
import { LoginLayout } from './LoginLayout';

export function HrLoginPage() {
  const { t } = useTranslation();
  const { profile, refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signInHr(email.trim(), password);
      if (result === 'ok') await refresh();
      else setError(result === 'invalid' ? 'hrLogin.invalid' : 'login.unavailable');
    } catch {
      setError('login.unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LoginLayout title={t('hrLogin.title')} subtitle={t('hrLogin.subtitle')}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">{t('hrLogin.email')}</label>
          <input id="email" className="field" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">{t('hrLogin.password')}</label>
          <input id="password" className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="rounded-card bg-risk-bg px-3 py-2 text-sm text-risk-fg">{t(error)}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !isBackendConfigured}>
          {busy ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link className="text-muted underline" to="/login">{t('login.managerLink')}</Link>
      </p>
    </LoginLayout>
  );
}
