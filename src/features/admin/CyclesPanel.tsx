import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorNotice } from '../../components/AppShell';
import { createCycle, listCycles, setCycleStatus } from '../../data/admin';
import type { Cycle } from '../../data/team';

export function CyclesPanel() {
  const { t, i18n } = useTranslation();
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState('');
  const [quarter, setQuarter] = useState('');
  const [due, setDue] = useState('');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setCycles(await listCycles());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => void load(), [load]);

  async function run(action: () => Promise<void>) {
    setFailed(false);
    try {
      await action();
      await load();
    } catch {
      setFailed(true);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await createCycle({
        code: code.trim(),
        quarter_label: quarter.trim(),
        due_at: due ? new Date(`${due}T23:59:59+08:00`).toISOString() : null,
      });
      setCode('');
      setQuarter('');
      setDue('');
    });
  }

  return (
    <div className="space-y-6">
      {failed && <ErrorNotice onRetry={() => void load()} />}

      <section className="card overflow-x-auto p-4">
        <h2 className="font-semibold">{t('cycles.listTitle')}</h2>
        {cycles?.length === 0 && <p className="mt-3 text-muted">{t('cycles.empty')}</p>}
        {cycles && cycles.length > 0 && (
          <table className="mt-3 w-full">
            <thead>
              <tr>
                <th className="th">{t('cycles.colCode')}</th>
                <th className="th">{t('cycles.colQuarter')}</th>
                <th className="th">{t('cycles.colStatus')}</th>
                <th className="th">{t('cycles.colDue')}</th>
                <th className="th">{t('cycles.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id}>
                  <td className="td">{c.code}</td>
                  <td className="td">{c.quarter_label}</td>
                  <td className="td">{t(`cycles.status.${c.status}`)}</td>
                  <td className="td">{c.due_at ? new Date(c.due_at).toLocaleDateString(i18n.language) : ''}</td>
                  <td className="td">
                    {c.status !== 'open' && (
                      <button type="button" className="btn-secondary px-2.5 py-1" onClick={() => void run(() => setCycleStatus(c.id, 'open'))}>
                        {t('cycles.open')}
                      </button>
                    )}
                    {c.status === 'open' && (
                      <button type="button" className="btn-secondary px-2.5 py-1" onClick={() => void run(() => setCycleStatus(c.id, 'closed'))}>
                        {t('cycles.close')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card max-w-lg p-4">
        <h2 className="font-semibold">{t('cycles.createTitle')}</h2>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="cycle-code">{t('cycles.code')}</label>
            <input id="cycle-code" className="field" required value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="cycle-quarter">{t('cycles.quarterLabel')}</label>
            <input id="cycle-quarter" className="field" required value={quarter} onChange={(e) => setQuarter(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="cycle-due">{t('cycles.dueAt')}</label>
            <input id="cycle-due" className="field" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">{t('cycles.create')}</button>
        </form>
      </section>
    </div>
  );
}
