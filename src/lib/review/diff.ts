// Field-level comparison of two review snapshots for the HR version history (SPEC 4).

const IGNORED = new Set(['version', 'rev', 'updated_at', 'updated_by', 'created_at', 'status', 'submitted_at', 'confirmed_at', 'locked_at', 'id', 'review_id']);

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !IGNORED.has(k))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value ?? null;
}

const show = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
};

export function diffSnapshots(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !IGNORED.has(k)).sort();
  const changes: FieldChange[] = [];
  for (const field of keys) {
    const a = canonical(before[field]);
    const b = canonical(after[field]);
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ field, before: show(a), after: show(b) });
  }
  return changes;
}
