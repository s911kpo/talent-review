import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleCheck, Lightbulb, ListChecks, Users, X } from 'lucide-react';
import { useSession } from '../../app/session';
import { AppShell, ErrorNotice } from '../../components/AppShell';
import { listComments, listReviewsByReviewer } from '../../data/review';
import { answeredCount, isEditable, isStepComplete, missingSteps, STEP_KEYS, type StepKey } from '../../lib/review/steps';
import { isUnderSixMonths, tenure } from '../../lib/tenure';
import type { Review, ReviewComment } from '../../lib/review/types';
import { GuidePanel } from './GuidePanel';
import { StepInput } from './inputs';
import { useRef_ } from './referenceData';
import { ReviewSummary } from './ReviewSummary';
import { useAutosave, type SaveState } from './useAutosave';

const stamp = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

export function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: string }) {
  const { t, i18n } = useTranslation();
  if (state === 'conflict' || state === 'expired' || state === 'locked') return null;
  const styles: Record<Exclude<SaveState, 'conflict' | 'expired' | 'locked'>, string> = {
    saved: 'text-muted', saving: 'text-muted', error: 'text-risk-fg', offline: 'text-warn-fg',
  };
  const text = state === 'saved' ? t('autosave.saved', { time: stamp(savedAt, i18n.language) })
    : state === 'saving' ? t('autosave.saving')
    : state === 'error' ? t('autosave.error') : t('autosave.offline');
  return <span role="status" className={`text-sm ${styles[state]}`}>{text}</span>;
}

export function WizardPage() {
  const { t } = useTranslation();
  const { employeeId } = useParams();
  const { cycle, managerId } = useRef_();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setReviews(null);
    try {
      const all = (await listReviewsByReviewer(cycle.id, managerId)).filter((r) => r.is_key_talent);
      setReviews(all);
      setComments(await listComments(all.map((r) => r.id)));
    } catch {
      setFailed(true);
    }
  }, [cycle.id, managerId]);

  useEffect(() => void load(), [load]);

  if (failed) return <AppShell><ErrorNotice onRetry={() => void load()} /></AppShell>;
  if (!reviews) return <AppShell><p role="status" className="text-muted">{t('app.loading')}</p></AppShell>;
  const current = reviews.find((r) => r.employee_id === Number(employeeId));
  if (!current) return <AppShell><div className="card p-6 text-muted">{t('team.empty')}</div></AppShell>;

  return (
    <Wizard
      key={current.id}
      initial={current}
      others={reviews}
      comments={comments.filter((c) => c.review_id === current.id)}
      onChanged={(r) => setReviews((list) => list?.map((x) => (x.id === r.id ? r : x)) ?? null)}
    />
  );
}

function Wizard({ initial, others, comments, onChanged }: {
  initial: Review; others: Review[]; comments: ReviewComment[]; onChanged: (r: Review) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { team, question, pick } = useRef_();
  const canEdit = isEditable(initial.status);
  const { logout } = useSession();
  const { review, update, state, savedAt, leave } = useAutosave(initial, canEdit);
  const [guideOpen, setGuideOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const labelId = useId();

  useEffect(() => onChanged(review), [review]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepParam = params.get('step');
  const isSummary = stepParam === 'summary';
  const stepIndex = isSummary ? -1 : Math.max(0, STEP_KEYS.indexOf(stepParam as StepKey));
  const stepKey = STEP_KEYS[stepIndex] ?? STEP_KEYS[0];
  const q = question(stepKey);
  const member = team.find((m) => m.employeeId === review.employee_id);
  const span = tenure(member?.startDate);

  const goTo = useCallback((step: string) => {
    setParams({ step });
    setGuideOpen(false);
    setTocOpen(false);
    window.scrollTo({ top: 0 });
  }, [setParams]);

  const markVisited = useCallback(() => {
    if (canEdit && !review.completed_steps.includes(stepKey)) {
      update({ completed_steps: [...review.completed_steps, stepKey] });
    }
  }, [canEdit, review.completed_steps, stepKey, update]);

  const advance = useCallback(() => {
    markVisited();
    goTo(stepIndex >= STEP_KEYS.length - 1 ? 'summary' : STEP_KEYS[stepIndex + 1]);
  }, [markVisited, goTo, stepIndex]);

  useEffect(() => {
    if (isSummary) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, isSummary]);

  const switchPerson = useCallback(async (employeeId: number) => {
    await leave();
    navigate(`/team/review/${employeeId}`);
  }, [leave, navigate]);

  const exitTo = useCallback(async (path: string) => {
    await leave();
    navigate(path);
  }, [leave, navigate]);

  const missing = useMemo(() => missingSteps(review), [review]);
  const nextPerson = others.find((r) => r.id !== review.id && missingSteps(r).length > 0);
  const nameOf = (id: number) => team.find((m) => m.employeeId === id)?.fullName ?? String(id);

  const peopleList = (
    <nav aria-label={t('wizard.people')}>
      <ul className="space-y-1">
        {others.map((r) => {
          const shown = r.id === review.id ? review : r;
          const active = r.id === review.id;
          return (
            <li key={r.id}>
              <button
                type="button" aria-current={active ? 'true' : undefined}
                className={`w-full rounded-card px-3 py-2 text-left text-sm ${active ? 'bg-canvas font-medium text-brand' : 'hover:bg-canvas'}`}
                onClick={() => { setDrawerOpen(false); if (!active) void switchPerson(r.employee_id); }}
              >
                <span className="block">{nameOf(r.employee_id)}</span>
                <span className="block text-xs text-muted">{t('home.badgeProgress', { n: answeredCount(shown) })}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <AppShell>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="flex items-center gap-1 text-sm text-muted underline" onClick={() => void exitTo('/team')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('wizard.backHome')}
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">{t('wizard.versionLine', { version: review.version, time: stamp(savedAt, i18n.language) })}</span>
          <SaveIndicator state={state} savedAt={savedAt} />
        </div>
      </div>

      <header className="card sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-2 p-3">
        <div>
          <p className="font-medium">{member?.fullName} <span className="text-muted">{member?.localName}</span></p>
          <p className="text-sm text-muted">
            {member?.position}{span && ` · ${t('wizard.tenure', { years: span.years, months: span.months })}`}
          </p>
          {isUnderSixMonths(member?.startDate) && <p className="mt-1 text-sm text-info-fg">{t('wizard.tntrHint')}</p>}
        </div>
        <button type="button" className="btn-secondary md:hidden" onClick={() => setDrawerOpen(true)}>
          <Users className="h-4 w-4" aria-hidden="true" />{t('wizard.people')}
        </button>
      </header>

      {!canEdit && <p role="status" className="mb-4 rounded-card bg-info-bg px-3 py-2 text-sm text-info-fg">{t('wizard.readOnly')}</p>}
      {comments.map((c) => (
        <div key={c.id} role="status" className="mb-4 rounded-card bg-risk-bg px-3 py-2 text-sm text-risk-fg">
          <span className="font-medium">{t('wizard.hrComment')}：</span>{c.body}
        </div>
      ))}

      <div className={`grid gap-4 md:grid-cols-[14rem_1fr] ${guideOpen ? 'xl:grid-cols-[14rem_1fr_22rem]' : ''}`}>
        <div className="card hidden self-start p-2 md:block">{peopleList}</div>

        {isSummary ? (
          <section className="card p-5">
            <h1 className="text-xl font-semibold">{t('wizard.summaryTitle')}</h1>
            {missing.length > 0
              ? <p className="mt-1 text-sm text-warn-fg">{t('wizard.summaryMissing', { count: missing.length })}</p>
              : <p className="mt-1 flex items-center gap-1 text-sm text-ok-fg"><CircleCheck className="h-4 w-4" aria-hidden="true" />{t('wizard.summaryDone')}</p>}
            <div className="mt-3"><ReviewSummary review={review} onEdit={canEdit ? goTo : undefined} /></div>
            <div className="mt-5 flex flex-wrap gap-2">
              {nextPerson && (
                <button type="button" className="btn-primary" onClick={() => void switchPerson(nextPerson.employee_id)}>
                  {t('wizard.nextPerson', { name: nameOf(nextPerson.employee_id) })}
                </button>
              )}
              {!nextPerson && <button type="button" className="btn-primary" onClick={() => void exitTo('/team/check')}>{t('wizard.goCheck')}</button>}
            </div>
          </section>
        ) : (
          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted">{t('wizard.stepOf', { n: stepIndex + 1, total: STEP_KEYS.length })}</p>
              <button type="button" className="btn-secondary px-2 py-1" aria-expanded={tocOpen} onClick={() => setTocOpen((v) => !v)}>
                <ListChecks className="h-4 w-4" aria-hidden="true" />{t('wizard.contents')}
              </button>
            </div>
            <div className="mt-2 h-1 rounded-full bg-line" aria-hidden="true">
              <div className="h-1 rounded-full bg-brand" style={{ width: `${((stepIndex + 1) / STEP_KEYS.length) * 100}%` }} />
            </div>

            {tocOpen && (
              <ol className="mt-3 grid gap-1 sm:grid-cols-2">
                {STEP_KEYS.map((key, i) => (
                  <li key={key}>
                    <button type="button" className="flex w-full items-center gap-2 rounded-card px-2 py-1 text-left text-sm hover:bg-canvas" onClick={() => goTo(key)}>
                      {isStepComplete(key, review) && key !== 'COMMENTS'
                        ? <CircleCheck className="h-4 w-4 text-ok-fg" aria-hidden="true" />
                        : <span className="h-4 w-4" aria-hidden="true" />}
                      {i + 1}. {t(`summary.${key}`)}
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {q?.section && <p className="mt-4 text-sm font-medium text-brand">{t(`section.${q.section}`)}</p>}
            <div className="mt-1 flex items-start justify-between gap-3">
              <h1 id={labelId} className="text-xl font-semibold leading-snug">{pick(q?.question_zh, q?.question_en)}</h1>
              <button
                type="button" className="btn-secondary shrink-0 px-2 py-2" aria-label={t('wizard.guide')} aria-expanded={guideOpen}
                onClick={() => setGuideOpen((v) => !v)}
              >
                <Lightbulb className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">{pick(q?.hint_zh, q?.hint_en)}</p>

            <fieldset disabled={!canEdit} className="mt-5">
              <StepInput stepKey={stepKey} review={review} update={update} labelId={labelId} />
            </fieldset>

            <div className="mt-6 flex items-center justify-between gap-2">
              <button type="button" className="btn-secondary" disabled={stepIndex === 0} onClick={() => goTo(STEP_KEYS[stepIndex - 1])}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />{t('wizard.prev')}
              </button>
              <button type="button" className="btn-primary" onClick={advance}>
                {stepIndex === STEP_KEYS.length - 1 ? t('wizard.toSummary') : t('wizard.next')}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {guideOpen && q && !isSummary && <GuidePanel question={q} onClose={() => setGuideOpen(false)} />}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" role="dialog" aria-modal="true" aria-label={t('wizard.people')}>
          <div className="h-full w-72 max-w-[85vw] overflow-y-auto bg-card p-3">
            <div className="mb-2 flex justify-end">
              <button type="button" className="btn-secondary px-2 py-1" aria-label={t('wizard.closePeople')} onClick={() => setDrawerOpen(false)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {peopleList}
          </div>
        </div>
      )}

      {state === 'conflict' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby={`${labelId}-c`}>
          <div className="card max-w-sm p-5">
            <h2 id={`${labelId}-c`} className="font-semibold">{t('autosave.conflictTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('autosave.conflictBody')}</p>
            <button
              type="button" className="btn-primary mt-4"
              onClick={() => {
                try { localStorage.removeItem(`talent-review.pending.${review.id}`); } catch { /* storage may be unavailable */ }
                window.location.reload();
              }}
            >{t('autosave.reload')}</button>
          </div>
        </div>
      )}
      {state === 'expired' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby={`${labelId}-e`}>
          <div className="card max-w-sm p-5">
            <h2 id={`${labelId}-e`} className="font-semibold">{t('autosave.expiredTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('autosave.expiredBody')}</p>
            <button type="button" className="btn-primary mt-4" onClick={() => void logout()}>{t('autosave.signInAgain')}</button>
          </div>
        </div>
      )}
      {state === 'locked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby={`${labelId}-l`}>
          <div className="card max-w-sm p-5">
            <h2 id={`${labelId}-l`} className="font-semibold">{t('autosave.lockedTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('autosave.lockedBody')}</p>
            <button
              type="button" className="btn-primary mt-4"
              onClick={() => {
                try { localStorage.removeItem(`talent-review.pending.${review.id}`); } catch { /* storage may be unavailable */ }
                window.location.reload();
              }}
            >{t('autosave.reload')}</button>
          </div>
        </div>
      )}
      <Link to="/team" className="sr-only">{t('wizard.backHome')}</Link>
    </AppShell>
  );
}
