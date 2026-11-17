import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorNotice } from '../../components/AppShell';
import { Pencil } from 'lucide-react';
import { createCycle, dueAtFromDate, listCycles, setCycleDue, setCycleStatus } from '../../data/admin';
import type { Cycle } from '../../data/team';

export function CyclesPanel() {
  const { t, i18n } = useTranslation();
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState('');
  const [quarter, setQuarter] = useState('');
  const [due, setDue] = useState('');
  // Due-date editing: one row at a time.
  const [editing, setEditing] = useState<string | null>(null);
  const [newDue, setNewDue] = useState('');
  const [notice, setNotice] = useState('');

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
        due_at: due ? dueAtFromDate(due) : null,
      });
      setCode('');
      setQuarter('');
      setDue('');
    });
  }

  /** The due date as YYYY-MM-DD in Taipei, for the date field. */
  const taipeiDate = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10) : '');

  function saveDue(c: Cycle) {
    if (!newDue) return;
    void run(async () => {
      await setCycleDue(c.id, newDue);
      setEditing(null);
      setNotice(t('cycles.dueSaved', { code: c.code, date: new Date(dueAtFromDate(newDue)).toLocaleDateString(i18n.language) }));
    });
  }

  return (
    <div className="space-y-6">
      {failed && <ErrorNotice onRetry={() => void load()} />}
      {notice && <p role="status" className="rounded-card bg-ok-bg px-3 py-2 text-sm text-ok-fg">{notice}</p>}

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
                  <td className="td">
                    {editing === c.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`due-${c.id}`}>{t('cycles.dueFor', { code: c.code })}</label>
                        <input id={`due-${c.id}`} className="field w-auto" type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
                        <button type="button" className="btn-primary px-2.5 py-1" disabled={!newDue} onClick={() => saveDue(c)}>{t('cycles.saveDue')}</button>
                        <button type="button" className="btn-secondary px-2.5 py-1" onClick={() => setEditing(null)}>{t('cycles.cancelDue')}</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{c.due_at ? new Date(c.due_at).toLocaleDateString(i18n.language) : t('cycles.noDue')}</span>
                        <button
                          type="button" className="btn-secondary px-2 py-1 text-xs"
                          onClick={() => { setEditing(c.id); setNewDue(taipeiDate(c.due_at)); setNotice(''); }}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />{t('cycles.editDue')}
                        </button>
                      </div>
                    )}
                  </td>
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
