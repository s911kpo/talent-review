// Shared by the backup, restore and their test. Tables are listed in foreign-key order.
// login_attempts is left out on purpose: it is a short-lived security log, not business data.
export const TABLES = [
  { name: 'app_users', key: ['user_id'] },
  { name: 'cycles', key: ['id'] },
  { name: 'employees', key: ['employee_id'] },
  { name: 'cycle_population', key: ['cycle_id', 'employee_id'] },
  { name: 'reviews', key: ['id'] },
  { name: 'next_roles', key: ['id'] },
  { name: 'successors', key: ['id'] },
  { name: 'dev_plan_items', key: ['id'] },
  { name: 'review_versions', key: ['id'] },
  { name: 'team_submissions', key: ['cycle_id', 'reviewer_id'] },
  { name: 'review_comments', key: ['id'] },
  { name: 'option_lists', key: ['id'] },
  { name: 'question_bank', key: ['key'] },
  { name: 'ai_outputs', key: ['id'] },
  { name: 'audit_log', key: ['id'] },
];

const TAG = '$tr_backup$';

/**
 * Builds SQL that replaces the listed tables with the backup contents in one transaction.
 * Triggers (state machine guards, updated_at stamps, foreign-key checks) are paused so rows come
 * back exactly as saved. Accounts are restored only for sign-in users that still exist.
 */
export function buildRestoreSql(data) {
  const names = TABLES.map((t) => `public.${t.name}`).join(', ');
  const lines = [
    '-- Talent Review restore. Replaces all business data with this backup.',
    'begin;',
    'set local session_replication_role = replica;',
    `truncate ${names};`,
  ];
  for (const { name } of TABLES) {
    const rows = data[name];
    if (!Array.isArray(rows)) throw new Error(`Backup is missing table ${name}`);
    if (rows.length === 0) continue;
    const json = JSON.stringify(rows);
    if (json.includes(TAG)) throw new Error(`Table ${name} contains the quoting tag`);
    const filter = name === 'app_users' ? '\nwhere r.user_id in (select id from auth.users)' : '';
    lines.push(`insert into public.${name}\nselect r.* from jsonb_populate_recordset(null::public.${name}, ${TAG}${json}${TAG}::jsonb) r${filter};`);
  }
  lines.push('commit;', '');
  return lines.join('\n');
}
