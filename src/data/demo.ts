// In-browser fictional data for local walkthroughs (`npm run demo`). Inactive unless VITE_DATA_MODE=demo.
// It mirrors workflow rules for the screens only; permissions are proven separately in tests/rls.
import type { Profile } from './auth';
import type { Cycle, TeamMember } from './team';
import type { SaveResult } from './review';
import type { TeamOverview } from './hr';
import type { ExportRow } from '../lib/export/planningTool';
import { ConflictError } from './conflict';
import questionsJson from './generated/questionBank.json';
import optionsJson from './generated/options.json';
import { readLocal, writeLocal } from '../lib/localPrefs';
import { generateOrg } from '../lib/mock/orgGenerator';
import { AFTER_SUBMIT, kpis } from '../lib/metrics';
import { emptyReview, isEditable, missingSteps } from '../lib/review/steps';
import type {
  DevPlanItem, DirectoryEntry, LineTeam, NextRole, OptionItem, Question, Review, ReviewComment, Successor, TeamSubmission,
} from '../lib/review/types';

const GM = 900001;
const MANAGER = 900002;
const CYCLE_ID = 'demo-cycle';
const HR_DEMO = -1;

const given = ['Alder', 'Birch', 'Cedar', 'Dune', 'Ember', 'Fern', 'Grove', 'Hazel', 'Iris', 'Juniper', 'Kestrel', 'Linden', 'Maple'];
const zhGiven = ['赤楊', '白樺', '雪松', '沙丘', '餘燼', '蕨葉', '樹林', '榛果', '鳶尾', '杜松', '紅隼', '椴樹', '楓葉'];
const titles = ['Process Engineer', 'Sr. Process Engineer', 'Quality Engineer', 'Technician', 'Production Planner', 'Equipment Engineer'];

const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString().slice(0, 10);
};

interface Person extends TeamMember { supervisor: number; }

const people: Person[] = [];
const person = (employeeId: number, supervisor: number, i: number, position: string, months: number) =>
  people.push({
    employeeId, supervisor, position, dept: i % 2 ? 'Quality' : 'Process Engineering',
    fullName: `Lin, ${given[i % given.length]}`, localName: `林${zhGiven[i % zhGiven.length]}`,
    startDate: monthsAgo(months),
  });

// 'showcase' fills a whole fictional plant with finished reviews (for walkthroughs with leaders);
// the default small team starts empty (for tests and for trying the manager flow).
export const SHOWCASE = import.meta.env.VITE_DEMO_DATASET === 'showcase';
const showcase = SHOWCASE
  ? generateOrg({ size: Number(import.meta.env.VITE_DEMO_SIZE) || 600, cycleId: CYCLE_ID })
  : null;
const genders = new Map<number, string>();

if (showcase) {
  for (const p of showcase.people) {
    people.push({ ...p });
    genders.set(p.employeeId, p.gender);
  }
} else {
  person(MANAGER, GM, 0, 'Supervisor', 96);
  for (let i = 0; i < 4; i++) person(900003 + i, GM, i + 1, 'Supervisor', 80 + i);
  for (let i = 0; i < 10; i++) person(900030 + i, MANAGER, i + 2, titles[i % titles.length], i === 3 ? 2 : 14 + i * 9);
  for (let i = 0; i < 6; i++) person(900040 + i, 900003, i + 5, titles[i % titles.length], 30 + i);
}

const isReviewer = (id: number) => people.some((p) => p.supervisor === id);
/** Everyone below `id` who is not a direct report: the read-only line. */
function lineOf(id: number): Person[] {
  const out: Person[] = [];
  const walk = (boss: number) => {
    for (const p of people.filter((x) => x.supervisor === boss)) {
      if (boss !== id) out.push(p);
      if (isReviewer(p.employeeId)) walk(p.employeeId);
    }
  };
  walk(id);
  return out;
}

/** Quick-entry accounts shown on the demo login screens: a Supervisor with Supervisors below, and one without. */
export function demoEntryPoints() {
  const leadsOthers = (id: number) => people.some((p) => p.supervisor === id && isReviewer(p.employeeId));
  const supervisor = people.find((p) => p.employeeId !== GM && p.employeeId !== MANAGER && isReviewer(p.employeeId) && !leadsOthers(p.employeeId));
  return { gm: GM, leadSupervisor: MANAGER, supervisor: supervisor?.employeeId ?? null };
}

interface Store {
  user: number | null;
  reviews: Review[];
  teams: Record<string, TeamSubmission>;
  comments?: ReviewComment[];
}

const blankTeam = (): TeamSubmission => ({
  status: 'draft', submitted_at: null, reopen_requested_at: null, reopen_reason: null,
  hr_comment: null, discussion_status: 'not_scheduled', discussion_date: null,
});

const STORE_KEY = SHOWCASE ? 'demo-showcase-v1' : 'demo';

function load(fresh = false): Store {
  if (fresh) return initial();
  try {
    const raw = readLocal(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // Corrupt demo state simply starts over.
  }
  return initial();
}

function initial(): Store {
  if (showcase) return { user: null, reviews: structuredClone(showcase.reviews), teams: structuredClone(showcase.teams), comments: structuredClone(showcase.comments) };
  return { user: null, reviews: [], teams: {} };
}

let store = load();
const toDashPerson = (p: Person) => ({
  employee_id: p.employeeId, name: p.fullName, dept: p.dept, reviewer_id: p.supervisor, position: p.position,
  start_date: p.startDate, gender: genders.get(p.employeeId) ?? (p.employeeId % 2 ? 'M' : 'F'),
});

const persist = () => writeLocal(STORE_KEY, JSON.stringify(store));
const me = () => store.user ?? 0;
const team = (id: number) => (store.teams[id] ??= blankTeam());
const wait = async () => new Promise((r) => setTimeout(r, 30));

export const demo = {
  entryPoints: demoEntryPoints,
  /** Puts the demo back to its starting data. */
  reset() {
    store = load(true);
    persist();
  },

  cycle: {
    id: CYCLE_ID, code: 'Q4-2026', quarter_label: 'Q4 2026', status: 'open',
    due_at: '2026-11-30T15:59:59Z',
  } as Cycle,
  questions: questionsJson as unknown as Question[],
  options: optionsJson as OptionItem[],

  signIn(employeeId: string): boolean {
    const id = Number(employeeId);
    if (SHOWCASE ? !isReviewer(id) : id !== MANAGER && id !== GM) return false;
    store.user = id;
    persist();
    return true;
  },
  signOut() {
    store.user = null;
    persist();
  },
  profile(): Profile | null {
    if (!store.user) return null;
    if (store.user === HR_DEMO) {
      return { userId: 'demo-hr', employeeId: null, role: 'hr', displayName: 'Demo HR', locale: readLocal('locale') === 'en' ? 'en' : 'zh-TW', fontScale: Number(readLocal('fontScale')) || 1 };
    }
    return {
      userId: `demo-${store.user}`, employeeId: store.user, role: 'manager',
      displayName: SHOWCASE ? people.find((p) => p.employeeId === store.user)?.fullName ?? '' : store.user === GM ? 'Wang, Demo GM' : 'Lin, Alder',
      locale: readLocal('locale') === 'en' ? 'en' : 'zh-TW',
      fontScale: Number(readLocal('fontScale')) || 1,
    };
  },

  team: (managerId: number): TeamMember[] => people.filter((p) => p.supervisor === managerId),
  reviews: async (reviewerId: number) => {
    await wait();
    return store.reviews.filter((r) => r.reviewer_id === reviewerId).map((r) => structuredClone(r));
  },
  teamSubmission: async (id: number) => structuredClone(team(id)),

  async setKeyTalent(employeeId: number, selected: boolean, reasons: string[], note: string | null) {
    let r = store.reviews.find((x) => x.employee_id === employeeId);
    if (!r) {
      r = emptyReview({ id: `demo-${employeeId}`, cycle_id: CYCLE_ID, employee_id: employeeId, reviewer_id: me() });
      r.status = 'not_selected';
      r.is_key_talent = false;
      store.reviews.push(r);
    }
    r.is_key_talent = selected;
    r.key_talent_reasons = reasons;
    r.key_talent_note = note;
    r.status = !selected ? 'not_selected' : r.status === 'not_selected' ? 'draft' : r.status;
    r.rev += 1;
    persist();
  },

  async saveReview(review: Review, next_roles: NextRole[], successors: Successor[], dev_plan: DevPlanItem[]): Promise<SaveResult> {
    await wait();
    const i = store.reviews.findIndex((r) => r.id === review.id);
    const current = store.reviews[i];
    if (!current || !isEditable(current.status)) throw new Error('review_not_editable');
    if (current.rev !== review.rev) throw new ConflictError();
    const updated_at = new Date().toISOString();
    const names = new Map(review.successors.map((s) => [s.successor_employee_id, s.display_name]));
    store.reviews[i] = {
      ...review, next_roles, dev_plan, status: current.status, version: current.version, rev: current.rev + 1, updated_at,
      successors: successors.map((s) => ({ ...s, display_name: names.get(s.successor_employee_id) })),
    };
    persist();
    return { rev: current.rev + 1, version: current.version, updated_at };
  },

  async snapshot(id: string) {
    const r = store.reviews.find((x) => x.id === id)!;
    r.version += 1;
    persist();
    return r.version;
  },

  async setNoKeyTalent(reason: string) {
    team(me()).hr_comment = `[NO_KEY_TALENT] ${reason}`;
    persist();
  },

  async submitTeam() {
    const mine = store.reviews.filter((r) => r.reviewer_id === me() && r.is_key_talent);
    if (mine.some((r) => isEditable(r.status) && missingSteps(r).length > 0)) throw new Error('incomplete_reviews');
    for (const r of mine) {
      if (isEditable(r.status)) {
        r.status = 'submitted';
        r.version += 1;
        r.rev += 1;
      }
    }
    Object.assign(team(me()), { status: 'submitted', submitted_at: new Date().toISOString() });
    persist();
  },

  async requestReopen(reason: string) {
    Object.assign(team(me()), { reopen_requested_at: new Date().toISOString(), reopen_reason: reason });
    persist();
  },

  async setDiscussion(date: string) {
    Object.assign(team(me()), { discussion_status: 'scheduled', discussion_date: date });
    persist();
  },

  dashboard: async () => {
    const hr = store.user === HR_DEMO;
    // Same rules as the database: own team in any state, the line only from submitted onward.
    const line = hr ? [] : lineOf(me());
    const list = hr ? people.filter((p) => p.supervisor !== 0) : [...people.filter((p) => p.supervisor === me()), ...line];
    const lineIds = new Set(line.map((p) => p.employeeId));
    return {
      people: list.map((p) => toDashPerson(p)),
      reviews: store.reviews.filter((r) => r.is_key_talent && (hr || r.reviewer_id === me()
        || (lineIds.has(r.employee_id) && AFTER_SUBMIT.includes(r.status)))).map((r) => structuredClone(r)),
      reviewerNames: new Map(people.map((p) => [p.employeeId, p.fullName])),
    };
  },

  plantAverages: async () => {
    if (!SHOWCASE) return { key_pct: 22, med_high_pct: 31, coverage_pct: 44, plan_complete_pct: 58, not_discussed_pct: 17 };
    const k = kpis({
      people: people.filter((p) => p.supervisor !== 0).map(toDashPerson),
      reviews: store.reviews.filter((r) => r.is_key_talent && AFTER_SUBMIT.includes(r.status)),
    });
    const round = (v: number | null) => (v === null ? null : Math.round(v));
    return {
      key_pct: round(k.keyPct), med_high_pct: round(k.medHighPct), coverage_pct: round(k.coveragePct),
      plan_complete_pct: round(k.planCompletePct), not_discussed_pct: round(k.notDiscussedPct),
    };
  },

  population: () => people.map((p) => ({ employee_id: p.employeeId, in_scope: true, supervisor_id: p.supervisor })),

  signInHr(email: string): boolean {
    if (email !== 'demo-hr@talentreview.local') return false;
    store.user = HR_DEMO;
    persist();
    return true;
  },

  hrOverview: async (): Promise<TeamOverview[]> => {
    const ids = SHOWCASE ? [...new Set(people.map((p) => p.supervisor).filter((s) => s !== 0))] : [MANAGER, 900003];
    return ids.map((id) => {
      const p = people.find((x) => x.employeeId === id)!;
      const mine = store.reviews.filter((r) => r.reviewer_id === id && r.is_key_talent);
      const t = team(id);
      return {
        reviewer_id: id, full_name: p.fullName, local_name: p.localName,
        direct_count: people.filter((x) => x.supervisor === id).length,
        key_count: mine.length, complete_count: mine.filter((r) => missingSteps(r).length === 0).length,
        status: t.status, last_updated: mine[0]?.updated_at ?? null, discussion_status: t.discussion_status,
        discussion_date: t.discussion_date, reopen_requested_at: t.reopen_requested_at, reopen_reason: t.reopen_reason,
      };
    });
  },

  async hrReturn(reviewerId: number, items: { review_id: string; comment: string }[]) {
    for (const item of items) {
      const r = store.reviews.find((x) => x.id === item.review_id && x.reviewer_id === reviewerId);
      if (r?.status !== 'submitted') throw new Error('review_not_returnable');
      r.status = 'returned';
      r.version += 1;
      r.rev += 1;
      (store.comments ??= []).push({ id: `c${Date.now()}`, review_id: r.id, body: item.comment, created_at: new Date().toISOString() });
    }
    team(reviewerId).status = 'returned';
    persist();
  },

  async hrSetTeam(reviewerId: number, from: TeamSubmission['status'], to: 'confirmed' | 'locked' | 'draft') {
    if (team(reviewerId).status !== from) throw new Error('illegal_status_transition');
    for (const r of store.reviews) {
      if (r.reviewer_id === reviewerId && r.status === from) {
        r.status = to;
        r.version += 1;
        r.rev += 1;
      }
    }
    team(reviewerId).status = to;
    persist();
  },

  async hrDecideReopen(reviewerId: number, approve: boolean, employeeIds: number[] | null) {
    if (approve) {
      for (const r of store.reviews) {
        if (r.reviewer_id === reviewerId && ['submitted', 'confirmed'].includes(r.status)
          && (employeeIds === null || employeeIds.includes(r.employee_id))) {
          r.status = 'draft';
          r.version += 1;
          r.rev += 1;
        }
      }
      team(reviewerId).status = 'draft';
    }
    Object.assign(team(reviewerId), { reopen_requested_at: null, reopen_reason: null });
    persist();
  },

  comments: async (ids: string[]): Promise<ReviewComment[]> => (store.comments ?? []).filter((c) => ids.includes(c.review_id)),

  exportRows: async (reviewerId: number | null): Promise<ExportRow[]> =>
    store.reviews
      .filter((r) => r.is_key_talent && (reviewerId === null || r.reviewer_id === reviewerId))
      .map((review) => {
        const p = people.find((x) => x.employeeId === review.employee_id)!;
        return {
          review,
          employee: { fullName: p.fullName, localName: p.localName, position: p.position, dept: p.dept },
          supervisorName: people.find((x) => x.employeeId === review.reviewer_id)?.fullName ?? '',
        };
      }),

  directory: async (query: string): Promise<DirectoryEntry[]> => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !q || `${p.fullName} ${p.localName} ${p.position} ${p.dept}`.toLowerCase().includes(q))
      .slice(0, 20)
      .map((p) => ({ employee_id: p.employeeId, local_name: p.localName, full_name: p.fullName, position: p.position, dept: p.dept }));
  },

  lineTeams: async (): Promise<LineTeam[]> => {
    if (!SHOWCASE && me() !== GM) return [];
    const below = new Set(lineOf(me()).map((p) => p.supervisor));
    return [...below].filter((id) => id !== me()).map((id) => {
      const p = people.find((x) => x.employeeId === id)!;
      return {
        reviewer_id: id, full_name: p.fullName, local_name: p.localName, status: team(id).status,
        member_count: people.filter((x) => x.supervisor === id).length,
      };
    });
  },
};
