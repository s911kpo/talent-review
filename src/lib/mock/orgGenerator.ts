// Fictional organization generator for the showcase demo and for scale tests.
// Every name, number and sentence here is invented. Departments carry deliberate patterns so the
// dashboards have something real to show (a flight-risk hotspot, an aging bench, a successor
// everyone leans on), the way a real plant would. Nothing here ranks people or sets quotas.
import { STEP_KEYS } from '../review/steps';
import type {
  DevPlanItem, NextRole, PbmEntry, Review, ReviewComment, ReviewStatus, Successor, TeamSubmission,
} from '../review/types';

export interface MockPerson {
  employeeId: number;
  supervisor: number;
  fullName: string;
  localName: string;
  position: string;
  dept: string;
  startDate: string;
  gender: 'M' | 'F';
}

export interface MockOrg {
  gm: number;
  people: MockPerson[];
  reviewers: number[];
  reviews: Review[];
  teams: Record<number, TeamSubmission>;
  comments: ReviewComment[];
}

export interface GenerateOptions {
  size: number;
  seed?: number;
  today?: Date;
  cycleId?: string;
}

type Dist = Record<string, number>;

interface DeptProfile {
  name: string;
  share: number;
  titles: string[];
  nouns: string[];
  risk: Dist;
  reasons: string[];
  readiness: Dist;
  tbh: number;
  critical: number;
  keyRate: number;
  notDiscussed: number;
  eduHeavy: number;
  mobile: number;
  tenureYears: [number, number];
}

const READY_HEALTHY: Dist = { 'Ready Now': 0.3, '1-2 years': 0.45, '3+ years': 0.15, 'Emergency Cover': 0.1 };

export const DEPTS: DeptProfile[] = [
  {
    name: 'Process Engineering', share: 0.16, titles: ['Process Engineer', 'Sr. Process Engineer', 'Process Technician'],
    nouns: ['MPO 端面研磨', '熔接參數調校', '良率改善', '製程 FMEA'],
    risk: { Low: 0.55, Medium: 0.32, High: 0.13 }, reasons: ['Competitive Market', 'Career Move', 'Compensation Reasons'],
    readiness: READY_HEALTHY, tbh: 0.08, critical: 0.45, keyRate: 0.3, notDiscussed: 0.1, eduHeavy: 0.15, mobile: 0.35, tenureYears: [0.3, 10],
  },
  {
    name: 'NPI & Optical Design', share: 0.1, titles: ['Optical Engineer', 'NPI Engineer', 'Sr. Optical Engineer'],
    nouns: ['光學模擬', '新產品試產', '客戶規格轉換', '光路設計'],
    risk: { Low: 0.25, Medium: 0.4, High: 0.35 }, reasons: ['Competitive Market', 'Career Move', 'Role Development/Role Fit'],
    readiness: { 'Ready Now': 0.12, '1-2 years': 0.38, '3+ years': 0.35, 'Emergency Cover': 0.15 }, tbh: 0.35, critical: 0.7, keyRate: 0.42, notDiscussed: 0.12, eduHeavy: 0.1, mobile: 0.5, tenureYears: [0.2, 6],
  },
  {
    name: 'Quality Assurance', share: 0.12, titles: ['Quality Engineer', 'Sr. Quality Engineer', 'QC Inspector'],
    nouns: ['客訴 8D', '供應商稽核', 'SPC 監控', 'IATF 文件'],
    risk: { Low: 0.45, Medium: 0.4, High: 0.15 }, reasons: ['Compensation Reasons', 'Work Environment', 'Competitive Market'],
    readiness: READY_HEALTHY, tbh: 0.1, critical: 0.5, keyRate: 0.3, notDiscussed: 0.15, eduHeavy: 0.25, mobile: 0.25, tenureYears: [0.5, 12],
  },
  {
    name: 'Manufacturing', share: 0.26, titles: ['Production Supervisor', 'Line Leader', 'Production Technician'],
    nouns: ['產線換線', '人員排班', '5S 現場管理', '新人帶訓'],
    risk: { Low: 0.6, Medium: 0.3, High: 0.1 }, reasons: ['Risk of burnout', 'Family Reasons', 'Compensation Reasons'],
    readiness: { 'Ready Now': 0.25, '1-2 years': 0.4, '3+ years': 0.2, 'Emergency Cover': 0.15 }, tbh: 0.05, critical: 0.3, keyRate: 0.15, notDiscussed: 0.45, eduHeavy: 0.6, mobile: 0.12, tenureYears: [0.2, 15],
  },
  {
    name: 'Equipment Engineering', share: 0.1, titles: ['Equipment Engineer', 'Sr. Equipment Engineer', 'Maintenance Technician'],
    nouns: ['設備預防保養', '治具設計', '自動化改機', '停機排除'],
    risk: { Low: 0.5, Medium: 0.3, High: 0.2 }, reasons: ['Retirement', 'Risk of burnout', 'Compensation Reasons'],
    readiness: { 'Ready Now': 0.08, '1-2 years': 0.27, '3+ years': 0.4, 'Emergency Cover': 0.25 }, tbh: 0.22, critical: 0.6, keyRate: 0.35, notDiscussed: 0.2, eduHeavy: 0.2, mobile: 0.1, tenureYears: [6, 26],
  },
  {
    name: 'Supply Chain & Planning', share: 0.1, titles: ['Production Planner', 'Buyer', 'Logistics Specialist'],
    nouns: ['物料齊套', '需求預測', '供應商交期', '庫存週轉'],
    risk: { Low: 0.45, Medium: 0.4, High: 0.15 }, reasons: ['Hybrid Work', 'Work Environment', 'Career Move'],
    readiness: READY_HEALTHY, tbh: 0.1, critical: 0.35, keyRate: 0.25, notDiscussed: 0.2, eduHeavy: 0.3, mobile: 0.55, tenureYears: [0.4, 9],
  },
  {
    name: 'EHS & Facilities', share: 0.05, titles: ['EHS Engineer', 'Facility Engineer', 'EHS Specialist'],
    nouns: ['化學品管理', '工安巡檢', '能源節約', '消防演練'],
    risk: { Low: 0.7, Medium: 0.2, High: 0.1 }, reasons: ['Work Environment', 'Career Move'],
    readiness: { 'Ready Now': 0.2, '1-2 years': 0.35, '3+ years': 0.25, 'Emergency Cover': 0.2 }, tbh: 0.25, critical: 0.5, keyRate: 0.3, notDiscussed: 0.15, eduHeavy: 0.35, mobile: 0.15, tenureYears: [1, 14],
  },
  {
    name: 'Finance & IT', share: 0.06, titles: ['Cost Accountant', 'Financial Analyst', 'IT Engineer'],
    nouns: ['成本分析', '月結流程', '報表自動化', 'ERP 權限管理'],
    risk: { Low: 0.5, Medium: 0.35, High: 0.15 }, reasons: ['Risk of burnout', 'Hybrid Work', 'Competitive Market'],
    readiness: READY_HEALTHY, tbh: 0.15, critical: 0.4, keyRate: 0.3, notDiscussed: 0.1, eduHeavy: 0.3, mobile: 0.3, tenureYears: [0.5, 11],
  },
  {
    name: 'HR & Admin', share: 0.05, titles: ['HR Specialist', 'Training Specialist', 'Admin Specialist'],
    nouns: ['招募流程', '教育訓練規劃', '員工溝通', '薪資作業'],
    risk: { Low: 0.6, Medium: 0.3, High: 0.1 }, reasons: ['Career Move', 'Compensation Reasons'],
    readiness: READY_HEALTHY, tbh: 0.1, critical: 0.3, keyRate: 0.25, notDiscussed: 0.1, eduHeavy: 0.3, mobile: 0.3, tenureYears: [0.5, 10],
  },
];

const SURNAMES: [string, string][] = [
  ['陳', 'Chen'], ['林', 'Lin'], ['黃', 'Huang'], ['張', 'Chang'], ['李', 'Lee'], ['王', 'Wang'], ['吳', 'Wu'],
  ['劉', 'Liu'], ['蔡', 'Tsai'], ['楊', 'Yang'], ['許', 'Hsu'], ['鄭', 'Cheng'], ['謝', 'Hsieh'], ['郭', 'Kuo'],
  ['洪', 'Hung'], ['曾', 'Tseng'], ['邱', 'Chiu'], ['廖', 'Liao'], ['賴', 'Lai'], ['周', 'Chou'],
];
// Deliberately nature words, so nobody mistakes a demo record for a colleague.
const GIVEN: [string, string][] = [
  ['赤楊', 'Alder'], ['白樺', 'Birch'], ['雪松', 'Cedar'], ['沙丘', 'Dune'], ['餘燼', 'Ember'], ['蕨葉', 'Fern'],
  ['樹林', 'Grove'], ['榛果', 'Hazel'], ['鳶尾', 'Iris'], ['杜松', 'Juniper'], ['紅隼', 'Kestrel'], ['椴樹', 'Linden'],
  ['楓葉', 'Maple'], ['新星', 'Nova'], ['橡木', 'Oak'], ['青松', 'Pine'], ['羽筆', 'Quill'], ['春雨', 'Rain'],
  ['鼠尾', 'Sage'], ['潮汐', 'Tide'], ['赭石', 'Umber'], ['山谷', 'Vale'], ['垂柳', 'Willow'], ['蓍草', 'Yarrow'],
  ['西風', 'Zephyr'], ['白楊', 'Aspen'], ['溪流', 'Brook'], ['三葉', 'Clover'], ['三角', 'Delta'], ['榆木', 'Elm'],
  ['燧石', 'Flint'], ['林地', 'Glade'], ['石楠', 'Heath'], ['常春', 'Ivy'], ['翠玉', 'Jade'], ['雲雀', 'Lark'],
  ['青苔', 'Moss'], ['花蜜', 'Nectar'], ['蛋白', 'Opal'], ['蘆葦', 'Reed'],
];

const RESULTS = [
  (r: Rng) => `三週內將不良率從 ${(1.5 + r.next() * 2).toFixed(1)}% 降到 ${(0.3 + r.next() * 0.6).toFixed(1)}%`,
  (r: Rng) => `每月節省約 ${r.int(8, 60)} 萬元`,
  (r: Rng) => `交期達成率提升到 ${r.int(94, 99)}%`,
  (r: Rng) => `處理時間縮短 ${r.int(20, 55)}%`,
  () => '客戶稽核零缺失',
  () => '試產一次通過',
];
const VERBS = ['主導', '獨立完成', '帶領小組推動', '跨部門協調', '建立標準化流程於'];

const PBM_STRENGTH: Record<string, string[]> = {
  Integrity: ['主動揭露量測數據異常，不等到稽核才說明', '對客戶如實說明交期風險，並提出替代方案'],
  'Stewardship & Compliance': ['確實執行變更管理流程，文件完整可追溯', '在成本壓力下仍堅持安規與品質標準'],
  'Principled Entrepreneurship': ['主動提出改善提案並推動落地，為客戶與公司創造價值', '發現報廢料可再利用，提出並完成評估'],
  Transformation: ['帶頭導入新系統並協助同事上手', '主動把手工報表改成自動化'],
  Knowledge: ['異常處理後整理 one-page lesson 分享全組', '主動向資深同仁請教並建立知識庫'],
  Humility: ['主動承認判斷錯誤並調整做法', '願意接受資淺同仁的回饋並修正方案'],
  Respect: ['先聽完現場意見再提方案，現場配合度高', '跨部門會議中確保每個人都有發言機會'],
  'Self-Actualize': ['自主進修相關證照並應用在工作上', '主動爭取挑戰性任務，持續擴展能力'],
};
const PBM_IMPROVE: Record<string, string[]> = {
  Integrity: ['回報進度時傾向只講好消息；若能及早揭露風險，主管可以更早介入'],
  'Stewardship & Compliance': ['趕工時會略過文件更新；若能同步維護，可降低稽核風險'],
  'Principled Entrepreneurship': ['多等待指示才行動；若能主動提出改善想法，可放大影響力'],
  Transformation: ['面對新系統傾向沿用舊的 Excel 流程；若能主動試用並回饋，可帶動數位化'],
  Knowledge: ['經驗多留在個人身上；若能整理成文件分享，團隊可降低對單一人員的依賴'],
  Humility: ['在技術討論中較難接受不同意見；若能先理解對方觀點，合作會更順暢'],
  Respect: ['壓力大時溝通語氣較急；若能先確認對方狀況，跨部門配合度會更高'],
  'Self-Actualize': ['較少主動規劃自己的學習；若能設定年度發展目標，成長會更有方向'],
};
const VALUES = Object.keys(PBM_STRENGTH);

const DEV_AREAS = [
  '帶領跨部門專案的經驗', '用數據向主管簡報與爭取資源', '英文簡報與客戶溝通', '授權與培養部屬',
  '成本概念與財務影響評估', '衝突處理與協商', '系統性問題分析（DOE、根因分析）', '新產品導入流程的完整經驗',
  '供應商管理經驗', '數位工具與自動化應用', '跨廠區協作經驗', '專案時程與風險管理',
];
const VAGUE_AREAS = ['加強管理能力', '提升溝通能力', '多學習新技術'];
const ASPIRATIONS = [
  '希望 2–3 年內往技術專家發展，暫時不考慮管理職',
  '希望 3 年內帶領小組，想先累積帶人的經驗',
  '有興趣參與海外客戶的專案，願意短期派駐',
  '希望輪調到新產品開發，接觸更上游的工作',
  '希望維持目前職務並深化專業，對調動興趣不高',
  '想朝跨部門的專案管理方向發展',
];
const LOCATIONS = ['Lisle, USA', 'Dongguan, China', 'Penang, Malaysia', 'Chengdu, China', 'Nogales, Mexico', 'Bangalore, India', 'Yamato, Japan'];
const EXTERNAL_SUCCESSORS = ['Rivera, Jordan (Koch)', 'Nakamura, Ken (Molex Japan)', 'Ong, Mei (Molex Penang)', 'Park, Min (Molex Korea)'];
const SUPPORTS = ['主管擔任 sponsor', '外訓預算：專案管理課程 1 堂', '安排資深同仁擔任導師', '每月 30 分鐘一對一回饋', '參與跨廠區專案會議'];
const ACTIONS: Record<string, string[]> = {
  'Experience (70%)': ['擔任改善專案 PM，負責時程與跨部門協調', '每兩週主持專案會議並向主管報告進度', '負責一條新產線的導入與驗收', '代理主管出席週會並做決策'],
  'Exposure (20%)': ['每月與資深經理進行 30 分鐘導師對談', '跟隨主管參加客戶會議兩次並整理紀錄', '到其他廠區進行一週的影子學習', '在部門會議分享一次學習心得'],
  'Education (10%)': ['完成內部專案管理基礎課程', '取得相關專業證照', '完成線上數據分析課程', '參加外部研討會並回部門分享'],
};

const DEV_TYPES = Object.keys(ACTIONS);

class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(list: readonly T[]): T { return list[Math.floor(this.next() * list.length)]; }
  pickN<T>(list: readonly T[], n: number): T[] {
    const copy = [...list];
    const out: T[] = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(this.next() * copy.length), 1)[0]);
    return out;
  }
  weighted(dist: Dist): string {
    let x = this.next() * Object.values(dist).reduce((a, b) => a + b, 0);
    for (const [k, w] of Object.entries(dist)) {
      x -= w;
      if (x <= 0) return k;
    }
    return Object.keys(dist)[0];
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};

function nextTitle(position: string, dept: string): string {
  if (position.startsWith('Sr. ')) return `Section Manager, ${dept}`;
  if (position.includes('Technician') || position.includes('Inspector') || position.includes('Leader')) return position.replace(/Technician|Inspector|Line Leader/, 'Engineer');
  if (position.startsWith('Section Manager') || position.startsWith('Supervisor')) return `Department Manager, ${dept}`;
  if (position.startsWith('Department Manager')) return 'Plant Operations Director';
  return `Sr. ${position}`;
}

/** Builds a fictional plant with `size` employees, every review filled in according to its team's status. */
export function generateOrg({ size, seed = 20261111, today = new Date(), cycleId = 'demo-cycle' }: GenerateOptions): MockOrg {
  const rng = new Rng(seed);
  const people: MockPerson[] = [];
  const names = rng.pickN(SURNAMES.flatMap((s) => GIVEN.map((g) => [s, g] as const)), SURNAMES.length * GIVEN.length);
  let nameIdx = 0;
  let nextId = 900001;
  const add = (supervisor: number, position: string, dept: string, years: [number, number]): MockPerson => {
    const [[zhS, enS], [zhG, enG]] = names[nameIdx++ % names.length];
    const months = Math.round((years[0] + rng.next() * (years[1] - years[0])) * 12);
    const p: MockPerson = {
      employeeId: nextId++, supervisor, position, dept, fullName: `${enS}, ${enG}`, localName: `${zhS}${zhG}`,
      startDate: iso(addMonths(today, -months)), gender: rng.chance(0.42) ? 'F' : 'M',
    };
    people.push(p);
    return p;
  };

  const gm = add(0, 'Plant General Manager', 'Plant Management', [8, 20]);
  const staffBudget = Math.max(size - 1, DEPTS.length * 4);
  const deptPeople = new Map<string, MockPerson[]>();
  for (const d of DEPTS) {
    const count = Math.max(4, Math.round(staffBudget * d.share));
    const head = add(gm.employeeId, `Department Manager, ${d.name}`, d.name, [Math.max(3, d.tenureYears[0]), d.tenureYears[1] + 4]);
    const sectionCount = Math.max(1, Math.round((count - 1) / 14));
    const sections = Array.from({ length: sectionCount }, () => add(head.employeeId, `Section Manager, ${d.name}`, d.name, [Math.max(2, d.tenureYears[0]), d.tenureYears[1] + 2]));
    const members = [head, ...sections];
    const staff = count - 1 - sectionCount;
    for (let i = 0; i < staff; i++) {
      // A couple of specialists report straight to the department head.
      const boss = i < 2 ? head : sections[i % sections.length];
      members.push(add(boss.employeeId, rng.pick(d.titles), d.name, d.tenureYears));
    }
    deptPeople.set(d.name, members);
  }

  const reviewers = [...new Set(people.map((p) => p.supervisor).filter((s) => s !== 0))];
  const profileOf = (dept: string) => DEPTS.find((d) => d.name === dept) ?? DEPTS[0];
  const monthsIn = (p: MockPerson) => (today.getTime() - new Date(p.startDate).getTime()) / (30.44 * 864e5);

  // One trusted Quality engineer gets named as successor across many roles: concentration risk.
  const qa = deptPeople.get('Quality Assurance')!;
  const qaStar = qa.find((p) => p.position.startsWith('Sr.')) ?? qa[qa.length - 1];

  const teams: Record<number, TeamSubmission> = {};
  const reviews: Review[] = [];
  const comments: ReviewComment[] = [];
  const TEAM_STATES: Dist = { locked: 0.15, confirmed: 0.2, submitted: 0.3, returned: 0.08, draft: 0.27 };

  for (const reviewerId of reviewers) {
    const directs = people.filter((p) => p.supervisor === reviewerId);
    const state = reviewerId === gm.employeeId ? 'submitted' : rng.weighted(TEAM_STATES) as TeamSubmission['status'];
    const reopen = state === 'submitted' && rng.chance(0.12);
    const discussion: TeamSubmission['discussion_status'] = state === 'locked' || state === 'confirmed' ? 'done'
      : state === 'submitted' && rng.chance(0.5) ? 'scheduled' : 'not_scheduled';
    teams[reviewerId] = {
      status: state,
      submitted_at: state === 'draft' ? null : addDays(today, -rng.int(1, 9)).toISOString(),
      reopen_requested_at: reopen ? today.toISOString() : null,
      reopen_reason: reopen ? '討論後發現一位關鍵人才的接班人需要調整' : null,
      hr_comment: null,
      discussion_status: discussion,
      discussion_date: discussion === 'done' ? iso(addDays(today, -rng.int(3, 20))) : discussion === 'scheduled' ? iso(addDays(today, rng.int(1, 14))) : null,
    };

    let keyCount = 0;
    const teamReviews: Review[] = [];
    directs.forEach((p, i) => {
      const prof = profileOf(p.dept);
      const isLeader = p.position.startsWith('Section') || p.position.startsWith('Department');
      const keyed = rng.chance(isLeader ? 0.65 : prof.keyRate) || (i === directs.length - 1 && keyCount === 0 && directs.length > 3);
      if (!keyed) return;
      keyCount++;
      const review = buildReview(rng, p, reviewerId, prof, today, cycleId, monthsIn(p) < 6, people, deptPeople.get(p.dept) ?? [], qaStar);
      review.status = state === 'returned' ? 'submitted' : (state as ReviewStatus);
      if (state === 'draft') truncate(rng, review);
      teamReviews.push(review);
    });
    if (state === 'returned' && teamReviews.length) {
      // HR sends back one person; the rest of the team stays submitted.
      const back = rng.pick(teamReviews);
      back.status = 'returned';
      comments.push({ id: `c-${back.id}`, review_id: back.id, body: '發展計畫的評核機制請補上由誰確認、何時檢視。', created_at: today.toISOString() });
    }
    reviews.push(...teamReviews);
  }

  // Make sure at least one reviewer is in each visible state with a returned review.
  if (!reviews.some((r) => r.status === 'returned')) {
    const r = reviews.find((x) => x.status === 'submitted');
    if (r) {
      r.status = 'returned';
      teams[r.reviewer_id].status = 'returned';
      comments.push({ id: `c-${r.id}`, review_id: r.id, body: '發展計畫的評核機制請補上由誰確認、何時檢視。', created_at: today.toISOString() });
    }
  }
  return { gm: gm.employeeId, people, reviewers, reviews, teams, comments };
}

function buildReview(
  rng: Rng, p: MockPerson, reviewerId: number, prof: DeptProfile, today: Date, cycleId: string, tntr: boolean,
  everyone: MockPerson[], deptMembers: MockPerson[], qaStar: MockPerson,
): Review {
  const critical = rng.chance(prof.critical);
  const reasons = new Set<string>();
  if (critical) reasons.add('Critical Role Holder');
  reasons.add(rng.pick(['Strong Performance Impact', 'Scarce or Hard-to-Replace Skill', 'Successor Candidate', 'High Growth Potential']));
  const risk = rng.weighted(prof.risk);
  if (risk === 'High' && rng.chance(0.6)) reasons.add('High-Impact Retention Concern');

  const [n1, n2] = rng.pickN(prof.nouns, 2);
  const strengths = `1. ${n1}：${rng.pick(VERBS)}${n1}相關工作，${rng.pick(RESULTS)(rng)}。\n2. ${n2}：${rng.pick(VERBS)}${n2}，${rng.pick(RESULTS)(rng)}。`;

  const pbm = (pool: Record<string, string[]>, n: number): PbmEntry[] =>
    rng.pickN(VALUES, n).map((v) => ({ principle: v, evidence: rng.pick(pool[v]) }));

  const areaCount = rng.int(1, 3);
  const vague = rng.chance(prof.eduHeavy * 0.4);
  const areaTexts = rng.pickN(DEV_AREAS, areaCount).map((t, i) => (vague && i === 0 ? rng.pick(VAGUE_AREAS) : t));
  const development_areas = areaTexts.map((text, i) => ({ idx: i + 1, text }));

  const readiness = (): string => (tntr ? 'Too New to Rate (TNTR)' : rng.weighted(prof.readiness));
  const next_roles: NextRole[] = [{ rank: 1, role_title: nextTitle(p.position, p.dept), readiness: readiness() }];
  if (rng.chance(0.35)) next_roles.push({ rank: 2, role_title: `${p.dept} 跨部門專案職`, readiness: rng.weighted({ '1-2 years': 0.5, '3+ years': 0.5 }) });

  const successors: Successor[] = [];
  const candidates = deptMembers.filter((x) => x.employeeId !== p.employeeId && x.employeeId !== reviewerId);
  const successorCount = rng.int(1, 2);
  for (let rank = 1; rank <= successorCount; rank++) {
    const starTurn = p.dept === 'Quality Assurance' && p.employeeId !== qaStar.employeeId && rank === 1;
    if (rank === 1 && !starTurn && rng.chance(prof.tbh)) {
      successors.push({ rank, successor_type: 'tbh', successor_employee_id: null, external_name: null, readiness: null });
      continue;
    }
    if (!starTurn && rng.chance(0.06)) {
      successors.push({ rank, successor_type: 'external', successor_employee_id: null, external_name: rng.pick(EXTERNAL_SUCCESSORS), readiness: rng.weighted(prof.readiness) });
      continue;
    }
    const useStar = p.dept === 'Quality Assurance' && p.employeeId !== qaStar.employeeId && rank === 1 && rng.chance(0.6);
    const s = useStar ? qaStar : candidates.length ? rng.pick(candidates) : null;
    if (!s) {
      successors.push({ rank, successor_type: 'tbh', successor_employee_id: null, external_name: null, readiness: null });
      continue;
    }
    if (successors.some((x) => x.successor_employee_id === s.employeeId)) continue;
    successors.push({
      rank, successor_type: 'internal', successor_employee_id: s.employeeId, external_name: null,
      readiness: useStar ? 'Ready Now' : rng.weighted(prof.readiness), display_name: s.fullName,
    });
  }
  successors.forEach((s, i) => { s.rank = i + 1; });

  const mobile = rng.chance(prof.mobile);
  const mobility = mobile ? rng.weighted({ Now: 0.25, '1-2 years': 0.45, '3+ years': 0.3 }) : 'Not Now';
  const notDiscussed = rng.chance(prof.notDiscussed);
  const reviewerName = everyone.find((x) => x.employeeId === reviewerId)?.fullName ?? '';

  const dev_plan: DevPlanItem[] = development_areas.map((a) => {
    const type = rng.chance(prof.eduHeavy) ? 'Education (10%)' : rng.weighted({ 'Experience (70%)': 0.6, 'Exposure (20%)': 0.3, 'Education (10%)': 0.1 });
    const start = addMonths(today, rng.int(0, 1));
    const target = addMonths(today, rng.pick([4, 4, 7, 7, 7, 10]));
    const actions = rng.pickN(ACTIONS[type], 2);
    if (type !== 'Education (10%)' || rng.chance(0.3)) actions.push(rng.pick(ACTIONS[rng.pick(DEV_TYPES)]));
    return {
      area_idx: a.idx,
      goal: `${iso(target).slice(0, 7).replace('-', '/')} 前在「${a.text}」上完成一項可驗證的成果`,
      dev_type: type,
      actions: [...new Set(actions)].join('\n'),
      support: rng.pick(SUPPORTS),
      owner: rng.chance(0.85) ? '員工本人' : reviewerName,
      start_date: iso(start),
      target_date: iso(target),
      checkpoint: rng.chance(0.15) ? '看表現' : `${iso(addMonths(today, 3)).slice(0, 7).replace('-', '/')} 期中檢視，到期以成果報告確認，由主管確認`,
      status: rng.weighted({ 'Not Started': 0.55, 'On Track': 0.35, 'At Risk': 0.1 }),
      progress_notes: '',
    };
  });

  return {
    id: `mock-${p.employeeId}`,
    cycle_id: cycleId,
    employee_id: p.employeeId,
    reviewer_id: reviewerId,
    status: 'draft',
    is_key_talent: true,
    key_talent_reasons: [...reasons],
    key_talent_note: null,
    is_critical_role: critical,
    performance_strengths: strengths,
    pbm_strengths: pbm(PBM_STRENGTH, rng.int(1, 3)),
    pbm_improvements: pbm(PBM_IMPROVE, rng.int(1, 2)),
    development_areas,
    personal_aspirations: notDiscussed ? null : rng.pick(ASPIRATIONS),
    aspirations_not_discussed: notDiscussed,
    retention_risk: risk,
    retention_reasons: risk === 'Low' ? [] : rng.pickN(prof.reasons, rng.int(1, 2)),
    mobility_status: mobility,
    desired_locations: mobility === 'Not Now' ? null : rng.pickN(LOCATIONS, rng.int(1, 2)).join('; '),
    additional_comments: rng.chance(0.2) ? '已提出調薪評估申請，需要 HR 協助確認市場行情。' : null,
    completed_steps: [...STEP_KEYS],
    version: rng.int(2, 9),
    rev: rng.int(5, 40),
    updated_at: addDays(today, -rng.next() * 10).toISOString(),
    next_roles,
    successors,
    dev_plan,
  };
}

/** Drafts stop partway: later questions are still empty, like a manager who has not finished. */
function truncate(rng: Rng, r: Review) {
  if (rng.chance(0.35)) return;
  const answered = rng.int(1, STEP_KEYS.length - 2);
  const keep = new Set(STEP_KEYS.slice(0, answered));
  if (!keep.has('PERF_STRENGTHS')) r.performance_strengths = null;
  if (!keep.has('PBM_STRENGTHS')) r.pbm_strengths = [];
  if (!keep.has('PBM_IMPROVE')) r.pbm_improvements = [];
  if (!keep.has('DEV_AREAS')) r.development_areas = [];
  if (!keep.has('ASPIRATIONS')) { r.personal_aspirations = null; r.aspirations_not_discussed = false; }
  if (!keep.has('NEXT_ROLES')) r.next_roles = [];
  if (!keep.has('MOBILITY')) { r.mobility_status = null; r.desired_locations = null; }
  if (!keep.has('RETENTION')) { r.retention_risk = null; r.retention_reasons = []; }
  if (!keep.has('SUCCESSORS')) r.successors = [];
  if (!keep.has('DEV_PLAN') || !keep.has('DEV_AREAS')) r.dev_plan = [];
  r.completed_steps = [...keep];
}
