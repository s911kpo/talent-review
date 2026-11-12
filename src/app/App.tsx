import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from './session';
import { HrLoginPage } from '../features/auth/HrLoginPage';
import { LoginPage } from '../features/auth/LoginPage';
import { CheckSubmitPage } from '../features/manager/CheckSubmitPage';
import { KeyTalentPage } from '../features/manager/KeyTalentPage';
import { MyTeamPage } from '../features/manager/MyTeamPage';
import { ReferenceProvider } from '../features/manager/referenceData';
import { SubmittedPage } from '../features/manager/SubmittedPage';
import { WizardPage } from '../features/manager/WizardPage';
import { HrConsolePage } from '../features/admin/HrConsolePage';

const ExecPage = lazy(() => import('../features/exec/ExecPage'));

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
      <Route path="/team" element={<Guard role="manager"><ReferenceProvider><Outlet /></ReferenceProvider></Guard>}>
        <Route index element={<MyTeamPage />} />
        <Route path="select" element={<KeyTalentPage />} />
        <Route path="review/:employeeId" element={<WizardPage />} />
        <Route path="check" element={<CheckSubmitPage />} />
        <Route path="submitted" element={<SubmittedPage />} />
      </Route>
      <Route path="/hr" element={<Guard role="hr"><HrConsolePage /></Guard>} />
      <Route path="/hr/exec" element={<Guard role="hr"><Suspense fallback={null}><ExecPage /></Suspense></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
