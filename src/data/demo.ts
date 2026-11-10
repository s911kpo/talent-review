// In-browser fictional data for local walkthroughs (`npm run demo`). Inactive unless VITE_DATA_MODE=demo.
// It mirrors workflow rules for the screens only; permissions are proven separately in tests/rls.
import type { Profile } from './auth';
import type { Cycle, TeamMember } from './team';
import type { SaveResult } from './review';
import { ConflictError } from './conflict';
import questionsJson from './generated/questionBank.json';
import optionsJson from './generated/options.json';
import { readLocal, writeLocal } from '../lib/localPrefs';
import { emptyReview, isEditable, missingSteps } from '../lib/review/steps';
import type {
  DevPlanItem, DirectoryEntry, LineTeam, NextRole, OptionItem, Question, Review, Successor, TeamSubmission,
} from '../lib/review/types';

const GM = 900001;
const MANAGER = 900002;
const CYCLE_ID = 'demo-cycle';

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

person(MANAGER, GM, 0, 'Department Manager', 96);
for (let i = 0; i < 4; i++) person(900003 + i, GM, i + 1, 'Department Manager', 80 + i);
for (let i = 0; i < 10; i++) person(900030 + i, MANAGER, i + 2, titles[i % titles.length], i === 3 ? 2 : 14 + i * 9);
for (let i = 0; i < 6; i++) person(900040 + i, 900003, i + 5, titles[i % titles.length], 30 + i);

interface Store {
  user: number | null;
  reviews: Review[];
  teams: Record<string, TeamSubmission>;
}

const blankTeam = (): TeamSubmission => ({
  status: 'draft', submitted_at: null, reopen_requested_at: null, reopen_reason: null,
  hr_comment: null, discussion_status: 'not_scheduled', discussion_date: null,
});

function load(): Store {
  try {
    const raw = readLocal('demo');
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // Corrupt demo state simply starts over.
  }
  return { user: null, reviews: [], teams: {} };
}

let store = load();
const persist = () => writeLocal('demo', JSON.stringify(store));
const me = () => store.user ?? 0;
const team = (id: number) => (store.teams[id] ??= blankTeam());
const wait = async () => new Promise((r) => setTimeout(r, 30));

export const demo = {
  cycle: {
    id: CYCLE_ID, code: 'Q4-2026', quarter_label: 'Q4 2026', status: 'open',
    due_at: '2026-11-30T15:59:59Z',
  } as Cycle,
  questions: questionsJson as unknown as Question[],
  options: optionsJson as OptionItem[],

  signIn(employeeId: string): boolean {
    const id = Number(employeeId);
    if (id !== MANAGER && id !== GM) return false;
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
    return {
      userId: `demo-${store.user}`, employeeId: store.user, role: 'manager',
      displayName: store.user === GM ? 'Wang, Demo GM' : 'Lin, Alder',
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

  directory: async (query: string): Promise<DirectoryEntry[]> => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !q || `${p.fullName} ${p.localName} ${p.position} ${p.dept}`.toLowerCase().includes(q))
      .slice(0, 20)
      .map((p) => ({ employee_id: p.employeeId, local_name: p.localName, full_name: p.fullName, position: p.position, dept: p.dept }));
  },

  lineTeams: async (): Promise<LineTeam[]> => {
    if (me() !== GM) return [];
    return [...new Set(people.filter((p) => p.supervisor !== GM && p.supervisor !== 0).map((p) => p.supervisor))].map((id) => {
      const p = people.find((x) => x.employeeId === id)!;
      return {
        reviewer_id: id, full_name: p.fullName, local_name: p.localName, status: team(id).status,
        member_count: people.filter((x) => x.supervisor === id).length,
      };
    });
  },
};
