import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { ErrorNotice } from '../../components/AppShell';
import {
  createHrAccount, listAppUsers, listExpectedReviewers, provisionPins, setAccountActive,
  type AppUserRow, type ExpectedReviewer, type ProvisionResult,
} from '../../data/admin';
import { buildPinListBlob, saveBlob } from '../../lib/export/pinList';
import { useCycleSelection } from './useCycles';

export function AccountsPanel() {
  const { t } = useTranslation();
  const { cycles, cycleId, setCycleId, failed: cyclesFailed } = useCycleSelection();
  const [reviewers, setReviewers] = useState<ExpectedReviewer[]>([]);
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [issued, setIssued] = useState<ProvisionResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hrEmail, setHrEmail] = useState('');
  const [hrName, setHrName] = useState('');
  const [hrEmployee, setHrEmployee] = useState('');
  const [hrSecret, setHrSecret] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    if (!cycleId) return;
    setFailed(false);
    try {
      const [r, u] = await Promise.all([listExpectedReviewers(cycleId), listAppUsers()]);
      setReviewers(r);
      setUsers(u);
      setSelected(new Set());
    } catch {
      setFailed(true);
    }
  }, [cycleId]);

  useEffect(() => void load(), [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const provision = () => run(async () => {
    setIssued(await provisionPins([...selected]));
    await load();
  });

  const toggleActive = (userId: string, active: boolean) => run(async () => {
    await setAccountActive(userId, active);
    await load();
  });

  const createHr = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setHrSecret(await createHrAccount({
        email: hrEmail.trim(),
        displayName: hrName.trim(),
        employeeId: hrEmployee.trim() ? Number(hrEmployee.trim()) : null,
      }));
      setHrEmail('');
      setHrName('');
      setHrEmployee('');
      await load();
    });
  };

  async function downloadPins() {
    if (!issued) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, ''); // Digits only: YYYYMMDDHHmm.
    saveBlob(await buildPinListBlob(issued.results), `PIN_list_${stamp}.xlsx`);
    setIssued(null); // Plain-text PINs are dropped from memory after the single download.
  }

  const userByEmployee = new Map(users.map((u) => [u.employee_id, u]));
  const hrUsers = users.filter((u) => u.role === 'hr');
  const allSelected = reviewers.length > 0 && selected.size === reviewers.length;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {(failed || cyclesFailed) && <ErrorNotice onRetry={() => void load()} />}

      {issued && (
        <section className="rounded-card bg-warn-bg p-4 text-warn-fg">
          <h2 className="font-semibold">{t('accounts.pinReadyTitle')}</h2>
          <p className="mt-1 text-sm">{t('accounts.pinReadyBody', { count: issued.results.length })}</p>
          {issued.failures.length > 0 && <p className="mt-1 text-sm">{t('accounts.pinFailed', { count: issued.failures.length })}</p>}
          <button type="button" className="btn-primary mt-3" onClick={() => void downloadPins()}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {t('accounts.pinDownload')}
          </button>
        </section>
      )}

      <section className="card overflow-x-auto p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold">{t('accounts.reviewersTitle')}</h2>
          <div className="w-48">
            <label className="label" htmlFor="acc-cycle">{t('accounts.cycle')}</label>
            <select id="acc-cycle" className="field" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </div>
        </div>
        {reviewers.length === 0 && <p className="mt-3 text-muted">{t('accounts.empty')}</p>}
        {reviewers.length > 0 && (
          <>
            <table className="mt-3 w-full">
              <thead>
                <tr>
                  <th className="th">
                    <input
                      type="checkbox" aria-label={t('accounts.selectAll')} checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(reviewers.map((r) => r.employee_id)))}
                    />
                  </th>
                  <th className="th">{t('accounts.colId')}</th>
                  <th className="th">{t('accounts.colName')}</th>
                  <th className="th">{t('accounts.colTeam')}</th>
                  <th className="th">{t('accounts.colAccount')}</th>
                  <th className="th">{t('accounts.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {reviewers.map((r) => {
                  const user = userByEmployee.get(r.employee_id);
                  return (
                    <tr key={r.employee_id}>
                      <td className="td">
                        <input
                          type="checkbox" aria-label={t('accounts.selectOne', { name: r.full_name })}
                          checked={selected.has(r.employee_id)} onChange={() => toggle(r.employee_id)}
                        />
                      </td>
                      <td className="td">{r.employee_id}</td>
                      <td className="td">{r.full_name} <span className="text-muted">{r.local_name}</span></td>
                      <td className="td">{r.team_size}</td>
                      <td className="td">{!r.has_account ? t('accounts.none') : r.account_active ? t('accounts.active') : t('accounts.disabled')}</td>
                      <td className="td">
                        {user && (
                          <button type="button" className="btn-secondary px-2.5 py-1" disabled={busy} onClick={() => void toggleActive(user.user_id, !user.is_active)}>
                            {user.is_active ? t('accounts.disable') : t('accounts.enable')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" className="btn-primary mt-4" disabled={busy || selected.size === 0} onClick={() => void provision()}>
              {t('accounts.provision', { count: selected.size })}
            </button>
          </>
        )}
      </section>

      <section className="card max-w-lg p-4">
        <h2 className="font-semibold">{t('accounts.hrTitle')}</h2>
        {hrUsers.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {hrUsers.map((u) => <li key={u.user_id}>{u.display_name}{u.employee_id ? ` · ${u.employee_id}` : ''}</li>)}
          </ul>
        )}
        {hrSecret && (
          <div className="mt-3 rounded-card bg-warn-bg p-3 text-sm text-warn-fg">
            <p className="font-medium">{t('accounts.hrPasswordTitle')}</p>
            <p className="mt-1">{t('accounts.hrPasswordLabel', { email: hrSecret.email })}</p>
            <code className="mt-1 block select-all break-all">{hrSecret.password}</code>
            <button type="button" className="btn-secondary mt-2 px-2.5 py-1" onClick={() => setHrSecret(null)}>{t('accounts.hrDismiss')}</button>
          </div>
        )}
        <form onSubmit={createHr} className="mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="hr-email">{t('accounts.hrEmail')}</label>
            <input id="hr-email" className="field" type="email" required value={hrEmail} onChange={(e) => setHrEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="hr-name">{t('accounts.hrName')}</label>
            <input id="hr-name" className="field" required value={hrName} onChange={(e) => setHrName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="hr-emp">{t('accounts.hrEmployeeId')}</label>
            <input id="hr-emp" className="field" inputMode="numeric" value={hrEmployee} onChange={(e) => setHrEmployee(e.target.value)} />
            <p className="mt-1 text-sm text-muted">{t('accounts.hrEmployeeHint')}</p>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>{t('accounts.hrCreate')}</button>
        </form>
      </section>
    </div>
  );
}
