import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';
import { AppShell, ErrorNotice } from '../../components/AppShell';
import { listOptions, listQuestions } from '../../data/review';
import { getOpenCycle, listTeam, type Cycle, type TeamMember } from '../../data/team';
import type { OptionItem, Question } from '../../lib/review/types';

interface ReferenceData {
  cycle: Cycle;
  managerId: number;
  team: TeamMember[];
  options: OptionItem[];
  questions: Question[];
  optionsFor: (listKey: string) => OptionItem[];
  labelOf: (listKey: string, value: string | null | undefined) => string;
  question: (key: string) => Question | undefined;
  pick: (zh: string | null | undefined, en: string | null | undefined) => string;
  memberName: (id: number) => string;
}

const Ctx = createContext<ReferenceData | null>(null);

export function useRef_(): ReferenceData {
  const value = useContext(Ctx);
  if (!value) throw new Error('useRef_ outside ReferenceProvider');
  return value;
}

export function ReferenceProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { profile } = useSession();
  const [data, setData] = useState<{ cycle: Cycle | null; team: TeamMember[]; options: OptionItem[]; questions: Question[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const managerId = profile?.employeeId ?? 0;

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [cycle, options, questions] = await Promise.all([getOpenCycle(), listOptions(), listQuestions()]);
      const team = cycle ? await listTeam(cycle.id, managerId) : [];
      setData({ cycle, team, options, questions });
    } catch {
      setFailed(true);
    }
  }, [managerId]);

  useEffect(() => void load(), [load]);

  const isEn = i18n.language === 'en';
  const value = useMemo<ReferenceData | null>(() => {
    if (!data?.cycle) return null;
    const { cycle, team, options, questions } = data;
    return {
      cycle, managerId, team, options, questions,
      optionsFor: (k) => options.filter((o) => o.list_key === k),
      labelOf: (k, v) => {
        const o = options.find((x) => x.list_key === k && x.value === v);
        return o ? (isEn ? o.label_en : o.label_zh) : (v ?? '');
      },
      question: (key) => questions.find((q) => q.key === key),
      pick: (zh, en) => (isEn ? en : zh) ?? '',
      memberName: (id) => team.find((m) => m.employeeId === id)?.fullName ?? String(id),
    };
  }, [data, managerId, isEn]);

  if (failed) return <AppShell><ErrorNotice onRetry={() => void load()} /></AppShell>;
  if (!data) return <AppShell><p role="status" className="text-muted">{t('app.loading')}</p></AppShell>;
  if (!value) return <AppShell><div className="card p-6 text-muted">{t('team.noCycle')}</div></AppShell>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
