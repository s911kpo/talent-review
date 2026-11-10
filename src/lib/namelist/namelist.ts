// Namelist rules (SPEC section 11). Pure functions; no I/O.

export type RawRow = Record<NamelistField, string>;

export type NamelistField =
  | 'talentReview' | 'id' | 'localName' | 'fullName' | 'supervisorId'
  | 'supervisor' | 'dept' | 'deptNo' | 'position' | 'gender' | 'startDate';

/** Birth month is deliberately absent: its column is never read (SPEC 0.7). */
export const COLUMN_MAP: Record<string, NamelistField> = {
  'talent review': 'talentReview',
  id: 'id',
  localname: 'localName',
  'full name': 'fullName',
  'supervisor id': 'supervisorId',
  supervisor: 'supervisor',
  'dept.': 'dept',
  'dept. no.': 'deptNo',
  position: 'position',
  gender: 'gender',
  'start date': 'startDate',
};

export const normalizeHeader = (h: string): string => h.replace(/\s+/g, ' ').trim().toLowerCase();

export function missingColumns(headers: string[]): string[] {
  const present = new Set(headers.map(normalizeHeader));
  return Object.keys(COLUMN_MAP).filter((c) => !present.has(c));
}

export interface PopulationRow {
  employee_id: number;
  local_name: string;
  full_name: string;
  gender: string;
  start_date: string | null;
  in_scope: boolean;
  supervisor_id: number;
  supervisor_name_raw: string;
  dept: string;
  dept_no: string;
  position: string;
}

export type IssueCode =
  | 'invalid_id' | 'duplicate_id' | 'unknown_supervisor' | 'in_scope_without_supervisor'
  | 'supervisor_cycle' | 'self_supervisor' | 'invalid_start_date'
  | 'name_whitespace' | 'possible_title_typo' | 'dept_no_not_numeric';

export interface Issue {
  level: 'error' | 'warning';
  code: IssueCode;
  rowNumber?: number;
  employeeId?: number;
  detail?: string;
}

export interface NamelistAnalysis {
  rows: PopulationRow[];
  issues: Issue[];
  reviewerIds: number[];
  inScopeCount: number;
  hasErrors: boolean;
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = temp;
    }
  }
  return prev[b.length];
}

function findTitleTypos(rows: PopulationRow[]): Issue[] {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.position) counts.set(r.position, (counts.get(r.position) ?? 0) + 1);
  const titles = [...counts.keys()];
  const issues: Issue[] = [];
  for (const rare of titles) {
    if (counts.get(rare) !== 1 || rare.length < 6) continue;
    const match = titles.find(
      (t) => t !== rare && (counts.get(t) ?? 0) >= 3
        && editDistance(rare.toLowerCase(), t.toLowerCase()) <= 2,
    );
    if (match) {
      const row = rows.find((r) => r.position === rare);
      issues.push({ level: 'warning', code: 'possible_title_typo', employeeId: row?.employee_id, detail: `${rare} / ${match}` });
    }
  }
  return issues;
}

/** Reports each supervisor loop once, walking up from every person. */
function findCycles(rows: PopulationRow[]): Issue[] {
  const supervisorOf = new Map(rows.map((r) => [r.employee_id, r.supervisor_id]));
  const reported = new Set<string>();
  const issues: Issue[] = [];
  for (const start of supervisorOf.keys()) {
    const path: number[] = [];
    let current: number | undefined = start;
    while (current !== undefined && current !== 0) {
      const at = path.indexOf(current);
      if (at >= 0) {
        const loop = path.slice(at).sort((a, b) => a - b);
        const key = loop.join(',');
        if (loop.length > 1 && !reported.has(key)) {
          reported.add(key);
          issues.push({ level: 'error', code: 'supervisor_cycle', employeeId: loop[0], detail: key });
        }
        break;
      }
      path.push(current);
      current = supervisorOf.get(current);
    }
  }
  return issues;
}

export function analyzeNamelist(raw: Array<RawRow & { rowNumber: number }>): NamelistAnalysis {
  const issues: Issue[] = [];
  const rows: PopulationRow[] = [];
  const seen = new Set<number>();

  for (const r of raw) {
    const employeeId = Number(r.id.trim());
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
      issues.push({ level: 'error', code: 'invalid_id', rowNumber: r.rowNumber, detail: r.id });
      continue;
    }
    if (seen.has(employeeId)) {
      issues.push({ level: 'error', code: 'duplicate_id', rowNumber: r.rowNumber, employeeId });
      continue;
    }
    seen.add(employeeId);

    if (r.fullName !== r.fullName.trim() || r.localName !== r.localName.trim()) {
      issues.push({ level: 'warning', code: 'name_whitespace', rowNumber: r.rowNumber, employeeId });
    }

    const supervisorRaw = r.supervisorId.trim();
    const supervisorId = supervisorRaw === '' ? 0 : Number(supervisorRaw);

    const startRaw = r.startDate.trim();
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : null;
    if (startRaw !== '' && startDate === null) {
      issues.push({ level: 'error', code: 'invalid_start_date', rowNumber: r.rowNumber, employeeId, detail: startRaw });
    }

    const deptNo = r.deptNo.trim();
    if (deptNo !== '' && !/^\d+$/.test(deptNo)) {
      issues.push({ level: 'warning', code: 'dept_no_not_numeric', rowNumber: r.rowNumber, employeeId, detail: deptNo });
    }

    rows.push({
      employee_id: employeeId,
      local_name: r.localName.trim(),
      full_name: r.fullName.trim(),
      gender: r.gender.trim(),
      start_date: startDate,
      in_scope: r.talentReview.trim().toUpperCase() === 'Y',
      supervisor_id: Number.isSafeInteger(supervisorId) ? supervisorId : -1,
      supervisor_name_raw: r.supervisor.trim(),
      dept: r.dept.trim(),
      dept_no: deptNo,
      position: r.position.trim(),
    });
  }

  const ids = new Set(rows.map((r) => r.employee_id));
  for (const r of rows) {
    if (r.supervisor_id === r.employee_id) {
      issues.push({ level: 'error', code: 'self_supervisor', employeeId: r.employee_id });
    } else if (r.supervisor_id !== 0 && !ids.has(r.supervisor_id)) {
      issues.push({ level: 'error', code: 'unknown_supervisor', employeeId: r.employee_id, detail: String(r.supervisor_id) });
    }
    if (r.in_scope && r.supervisor_id === 0) {
      issues.push({ level: 'error', code: 'in_scope_without_supervisor', employeeId: r.employee_id });
    }
  }

  issues.push(...findCycles(rows), ...findTitleTypos(rows));

  const reviewerIds = [...new Set(rows.filter((r) => r.in_scope && r.supervisor_id > 0).map((r) => r.supervisor_id))]
    .sort((a, b) => a - b);

  return {
    rows,
    issues,
    reviewerIds,
    inScopeCount: rows.filter((r) => r.in_scope).length,
    hasErrors: issues.some((i) => i.level === 'error'),
  };
}

export interface ExistingPopulation {
  employee_id: number;
  in_scope: boolean;
  supervisor_id: number;
}

export interface PopulationDiff {
  added: number[];
  removed: number[];
  supervisorChanged: { employeeId: number; from: number; to: number }[];
  scopeChanged: { employeeId: number; from: boolean; to: boolean }[];
}

export function diffPopulation(next: PopulationRow[], current: ExistingPopulation[]): PopulationDiff {
  const before = new Map(current.map((c) => [c.employee_id, c]));
  const after = new Set(next.map((n) => n.employee_id));
  const diff: PopulationDiff = { added: [], removed: [], supervisorChanged: [], scopeChanged: [] };
  for (const n of next) {
    const c = before.get(n.employee_id);
    if (!c) {
      diff.added.push(n.employee_id);
      continue;
    }
    if (c.supervisor_id !== n.supervisor_id) {
      diff.supervisorChanged.push({ employeeId: n.employee_id, from: c.supervisor_id, to: n.supervisor_id });
    }
    if (c.in_scope !== n.in_scope) {
      diff.scopeChanged.push({ employeeId: n.employee_id, from: c.in_scope, to: n.in_scope });
    }
  }
  for (const c of current) if (!after.has(c.employee_id) && c.in_scope) diff.removed.push(c.employee_id);
  return diff;
}
