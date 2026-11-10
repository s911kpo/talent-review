// HR-maintained reference data: dropdown options, question bank, and the audit log.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorNotice } from '../../components/AppShell';
import { listAllOptions, listAllQuestions, listAudit, saveOption, saveQuestion, type AuditRow, type EditableOption } from '../../data/hr';
import type { Question } from '../../lib/review/types';
import { Markdown } from '../manager/GuidePanel';

export function OptionsPanel() {
  const { t } = useTranslation();
  const [options, setOptions] = useState<EditableOption[]>([]);
  const [listKey, setListKey] = useState('');
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listAllOptions()
      .then((o) => {
        setOptions(o);
        setListKey(o[0]?.list_key ?? '');
      })
      .catch(() => setFailed(true));
  }, []);

  const keys = [...new Set(options.map((o) => o.list_key))];
  const shown = options.filter((o) => o.list_key === listKey).sort((a, b) => a.sort - b.sort);

  const patch = (target: EditableOption, change: Partial<EditableOption>) => {
    setSaved(false);
    setOptions((all) => all.map((o) => (o === target ? { ...o, ...change } : o)));
  };

  async function save() {
    setFailed(false);
    try {
      for (const o of shown) await saveOption(o);
      setSaved(true);
    } catch {
      setFailed(true);
    }
  }

  const add = () => setOptions((all) => [...all, {
    list_key: listKey, value: '', label_zh: '', label_en: '', sort: shown.length + 1, is_active: true,
  }]);

  return (
    <div className="space-y-4">
      {failed && <ErrorNotice />}
      <p className="text-sm text-muted">{t('opts.note')}</p>
      <div className="max-w-xs">
        <label className="label" htmlFor="op-list">{t('opts.list')}</label>
        <select id="op-list" className="field" value={listKey} onChange={(e) => setListKey(e.target.value)}>
          {keys.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto p-2">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">{t('opts.value')}</th><th className="th">{t('opts.labelZh')}</th>
              <th className="th">{t('opts.labelEn')}</th><th className="th">{t('opts.sort')}</th><th className="th">{t('opts.active')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o, i) => (
              <tr key={o.id ?? `${o.value}-${i}`}>
                <td className="td"><input aria-label={`${t('opts.value')} ${i + 1}`} className="field" readOnly={Boolean(o.id)} value={o.value} onChange={(e) => patch(o, { value: e.target.value })} /></td>
                <td className="td"><input aria-label={`${t('opts.labelZh')} ${i + 1}`} className="field" value={o.label_zh} onChange={(e) => patch(o, { label_zh: e.target.value })} /></td>
                <td className="td"><input aria-label={`${t('opts.labelEn')} ${i + 1}`} className="field" value={o.label_en} onChange={(e) => patch(o, { label_en: e.target.value })} /></td>
                <td className="td w-24"><input aria-label={`${t('opts.sort')} ${i + 1}`} className="field" type="number" value={o.sort} onChange={(e) => patch(o, { sort: Number(e.target.value) })} /></td>
                <td className="td"><input aria-label={`${t('opts.active')} ${i + 1}`} type="checkbox" checked={o.is_active} onChange={(e) => patch(o, { is_active: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary" onClick={add}>{t('opts.add')}</button>
        <button type="button" className="btn-primary" onClick={() => void save()}>{t('opts.save')}</button>
        {saved && <span role="status" className="text-sm text-ok-fg">{t('opts.saved')}</span>}
      </div>
    </div>
  );
}

const QUESTION_FIELDS = [
  ['question', 'qb.question', 2], ['hint', 'qb.hint', 2], ['guide', 'qb.guide', 8],
  ['good_example', 'qb.good', 4], ['weak_example', 'qb.weak', 3], ['pitfalls', 'qb.pitfalls', 2],
] as const;

export function QuestionsPanel() {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [key, setKey] = useState('');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listAllQuestions()
      .then((q) => {
        setQuestions(q);
        setKey(q[0]?.key ?? '');
      })
      .catch(() => setFailed(true));
  }, []);

  const current = useMemo(() => questions.find((q) => q.key === key), [questions, key]);

  const edit = (field: string, value: string) => {
    setSaved(false);
    setQuestions((all) => all.map((q) => (q.key === key ? { ...q, [`${field}_${lang}`]: value } : q)));
  };

  async function save() {
    if (!current) return;
    setFailed(false);
    try {
      await saveQuestion(current);
      setSaved(true);
    } catch {
      setFailed(true);
    }
  }

  if (!current) return failed ? <ErrorNotice /> : null;
  const read = (field: string) => (current as unknown as Record<string, string | null>)[`${field}_${lang}`] ?? '';

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        {failed && <ErrorNotice />}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label className="label" htmlFor="qb-key">{t('qb.select')}</label>
            <select id="qb-key" className="field" value={key} onChange={(e) => setKey(e.target.value)}>
              {questions.map((q) => <option key={q.key} value={q.key}>{q.key}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            {(['zh', 'en'] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} className={`btn border ${lang === l ? 'border-brand text-brand' : 'border-line text-muted'}`} onClick={() => setLang(l)}>
                {t(`qb.${l}`)}
              </button>
            ))}
          </div>
        </div>
        {QUESTION_FIELDS.map(([field, label, rows]) => (
          <div key={field}>
            <label className="label" htmlFor={`qb-${field}`}>{t(label)}</label>
            <textarea id={`qb-${field}`} className="field" rows={rows} value={read(field)} onChange={(e) => edit(field, e.target.value)} />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <button type="button" className="btn-primary" onClick={() => void save()}>{t('qb.save')}</button>
          {saved && <span role="status" className="text-sm text-ok-fg">{t('qb.saved')}</span>}
        </div>
      </div>
      <aside className="card self-start p-4">
        <h2 className="mb-2 font-semibold">{t('qb.preview')}</h2>
        <Markdown text={read('guide')} />
      </aside>
    </div>
  );
}

export function AuditPanel() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setRows(await listAudit(filter));
    } catch {
      setFailed(true);
    }
  }, [filter]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(handle);
  }, [load]);

  return (
    <div className="space-y-4">
      {failed && <ErrorNotice onRetry={() => void load()} />}
      <div className="max-w-xs">
        <label className="label" htmlFor="au-filter">{t('aud.filter')}</label>
        <input id="au-filter" className="field" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="card overflow-x-auto p-2">
        {rows?.length === 0 && <p className="p-4 text-muted">{t('aud.empty')}</p>}
        {rows && rows.length > 0 && (
          <table className="w-full">
            <thead>
              <tr><th className="th">{t('aud.time')}</th><th className="th">{t('aud.action')}</th><th className="th">{t('aud.target')}</th><th className="th">{t('aud.detail')}</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap">{new Date(r.created_at).toLocaleString(i18n.language)}</td>
                  <td className="td">{r.action}</td>
                  <td className="td">{r.entity} {r.entity_id}</td>
                  <td className="td break-all">{r.detail ? JSON.stringify(r.detail) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
