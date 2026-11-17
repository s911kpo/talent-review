import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import hrZh from '../../src/i18n/hr.zh-TW.json';
import { describeAudit, type AuditEntry, type AuditNames } from '../../src/lib/audit/describe';

const t = i18next.createInstance();
await t.init({ lng: 'zh-TW', resources: { 'zh-TW': { translation: hrZh } }, interpolation: { escapeValue: false } });
const names: AuditNames = {
  users: new Map([['u-hr', 'Tim Hsu'], ['u-mgr', 'Huang, Grove2']]),
  employees: new Map([[900002, 'Huang, Grove2'], [900030, 'Doe, Jane'], [900003, 'Chang, Alder3']]),
  cycles: new Map([['c1', 'Q4-2026']]),
};
const row = (p: Partial<AuditEntry>): AuditEntry => ({ id: '1', actor: 'u-hr', action: '', entity: null, entity_id: null, detail: null, created_at: '2026-11-17T01:00:00Z', ...p });
const date = (iso: string) => iso.slice(0, 10);
const d = (p: Partial<AuditEntry>) => describeAudit(row(p), names, t.t.bind(t) as never, date);

describe('plain-language audit log', () => {
  it('says who changed the due date and from what to what', () => {
    expect(d({ action: 'cycle_due_changed', entity: 'cycle', entity_id: 'c1', detail: { from: '2026-12-31T15:59:59Z', to: '2027-01-15T15:59:59Z' } }))
      .toEqual({ who: 'Tim Hsu', what: '修改截止日', target: '週期 Q4-2026', change: '2026-12-31 → 2027-01-15', group: 'deadline' });
  });

  it('names the supervisor team and the number of people', () => {
    expect(d({ action: 'reviews_returned', entity: 'team', entity_id: '900002', detail: { count: 2 } }))
      .toMatchObject({ what: '退回給主管修改', target: 'Huang, Grove2 (900002) 的團隊', change: '2 人', group: 'review' });
    expect(d({ action: 'team_unlocked', entity: 'team', entity_id: '900002', detail: { count: 3, target: 'draft' } }).change)
      .toBe('3 人，改回「草稿（主管可修改）」');
  });

  it('describes accounts, PIN resets and HR logins', () => {
    expect(d({ action: 'pin_reset', entity: 'account', entity_id: '900002' })).toMatchObject({ what: '重設主管 PIN', target: 'Huang, Grove2 (900002)' });
    expect(d({ action: 'account_disabled', entity: 'account', entity_id: 'u-mgr' }).target).toBe('Huang, Grove2');
    expect(d({ action: 'hr_account_created', entity: 'account', entity_id: 'x', detail: { email: 'diana@example.com' } }).target).toBe('diana@example.com');
  });

  it('explains a supervisor change from a namelist upload, done by the system', () => {
    expect(d({ actor: null, action: 'review_reassigned', entity: 'review', entity_id: 'r1', detail: { employee_id: 900030, from: 900002, to: 900003 } }))
      .toEqual({ who: '系統（名單上傳時自動處理）', what: '換主管：評核轉給新主管', target: 'Doe, Jane (900030)', change: 'Huang, Grove2 (900002) → Chang, Alder3 (900003)', group: 'namelist' });
  });

  it('never hides an unknown action', () => {
    expect(d({ action: 'something_new', entity: 'x', entity_id: '9', detail: { a: 1 } })).toMatchObject({ what: 'something_new', target: 'x 9', change: '{"a":1}', group: 'other' });
  });
});
