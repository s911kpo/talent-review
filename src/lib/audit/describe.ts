// Turns raw audit_log rows into plain sentences for HR: who did what, to whom, and what changed.
// Pure function: names come in through `names`, wording through `t` (i18n), so it is easy to test.

export interface AuditEntry {
  id: string;
  actor: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: unknown;
  created_at: string;
}

export interface AuditNames {
  /** auth user id → display name (HR and supervisor logins). */
  users: Map<string, string>;
  /** employee id → full name. */
  employees: Map<number, string>;
  /** cycle id → code, e.g. Q4-2026. */
  cycles: Map<string, string>;
}

export interface AuditLine { who: string; what: string; target: string; change: string; group: AuditGroup }
export type AuditGroup = 'deadline' | 'review' | 'account' | 'namelist' | 'ai' | 'other';

type T = (key: string, vars?: Record<string, unknown>) => string;

const GROUP: Record<string, AuditGroup> = {
  cycle_due_changed: 'deadline',
  reviews_returned: 'review', team_confirmed: 'review', team_locked: 'review', team_unlocked: 'review',
  reopen_approved: 'review', reopen_rejected: 'review',
  account_created: 'account', pin_reset: 'account', account_enabled: 'account', account_disabled: 'account',
  hr_account_created: 'account',
  review_reassigned: 'namelist',
  ai_generated: 'ai',
};

export const AUDIT_GROUPS: AuditGroup[] = ['deadline', 'review', 'account', 'namelist', 'ai'];

const obj = (d: unknown): Record<string, unknown> => (d && typeof d === 'object' ? d as Record<string, unknown> : {});
const num = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));

export function describeAudit(row: AuditEntry, names: AuditNames, t: T, formatDate: (iso: string) => string): AuditLine {
  const d = obj(row.detail);
  const person = (id: unknown) => {
    const n = num(id);
    return Number.isFinite(n) ? `${names.employees.get(n) ?? t('aud.unknownPerson')} (${n})` : t('aud.unknownPerson');
  };
  const who = row.actor ? names.users.get(row.actor) ?? t('aud.unknownUser') : t('aud.system');
  const group = GROUP[row.action] ?? 'other';
  const known = group !== 'other';
  const what = known ? t(`aud.do.${row.action}`) : row.action;
  const count = typeof d.count === 'number' ? d.count : num(d.count);

  let target = '';
  let change = '';
  switch (row.action) {
    case 'cycle_due_changed': {
      target = t('aud.cycle', { code: names.cycles.get(row.entity_id ?? '') ?? '' });
      const from = typeof d.from === 'string' ? formatDate(d.from) : t('aud.notSet');
      const to = typeof d.to === 'string' ? formatDate(d.to) : t('aud.notSet');
      change = t('aud.fromTo', { from, to });
      break;
    }
    case 'reviews_returned': case 'team_confirmed': case 'team_locked': case 'reopen_approved': case 'reopen_rejected':
      target = t('aud.team', { name: person(row.entity_id) });
      change = Number.isFinite(count) ? t('aud.people', { count }) : '';
      break;
    case 'team_unlocked':
      target = t('aud.team', { name: person(row.entity_id) });
      change = [Number.isFinite(count) ? t('aud.people', { count }) : '', d.target ? t('aud.backTo', { status: t(`aud.status.${String(d.target)}`) }) : '']
        .filter(Boolean).join(t('aud.sep'));
      break;
    case 'account_created': case 'pin_reset':
      target = person(row.entity_id);
      break;
    case 'account_enabled': case 'account_disabled':
      target = names.users.get(row.entity_id ?? '') ?? t('aud.unknownUser');
      break;
    case 'hr_account_created':
      target = typeof d.email === 'string' ? d.email : names.users.get(row.entity_id ?? '') ?? t('aud.unknownUser');
      break;
    case 'review_reassigned':
      target = person(d.employee_id);
      change = t('aud.fromTo', { from: person(d.from), to: person(d.to) });
      break;
    case 'ai_generated':
      change = Number.isFinite(num(d.people)) ? t('aud.people', { count: num(d.people) }) : '';
      break;
    default:
      target = [row.entity, row.entity_id].filter(Boolean).join(' ');
      change = row.detail ? JSON.stringify(row.detail) : '';
  }
  return { who, what, target, change, group };
}
