import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from './session';
import { HrLoginPage } from '../features/auth/HrLoginPage';
import { LoginPage } from '../features/auth/LoginPage';
import { MyTeamPage } from '../features/manager/MyTeamPage';
import { HrConsolePage } from '../features/admin/HrConsolePage';

function Guard({ role, children }: { role: 'manager' | 'hr'; children: ReactElement }) {
  const { profile, loading } = useSession();
  const { t } = useTranslation();
  if (loading) return <p className="p-8 text-muted" role="status">{t('app.loading')}</p>;
  if (!profile) return <Navigate to={role === 'hr' ? '/hr/login' : '/login'} replace />;
  if (profile.role !== role) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { profile, loading } = useSession();
  const { t } = useTranslation();
  if (loading) return <p className="p-8 text-muted" role="status">{t('app.loading')}</p>;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === 'hr' ? '/hr' : '/team'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/hr/login" element={<HrLoginPage />} />
      <Route path="/team" element={<Guard role="manager"><MyTeamPage /></Guard>} />
      <Route path="/hr" element={<Guard role="hr"><HrConsolePage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
