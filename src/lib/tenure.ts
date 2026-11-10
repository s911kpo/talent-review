export interface Tenure {
  years: number;
  months: number;
  totalMonths: number;
}

/** Complete months between start date (yyyy-mm-dd) and today. Null for missing or future dates. */
export function tenure(startDate: string | null | undefined, today: Date = new Date()): Tenure | null {
  if (!startDate) return null;
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  let total = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) total -= 1;
  if (total < 0) return null;
  return { years: Math.floor(total / 12), months: total % 12, totalMonths: total };
}

export const isUnderSixMonths = (startDate: string | null | undefined, today: Date = new Date()): boolean => {
  const t = tenure(startDate, today);
  return t !== null && t.totalMonths < 6;
};
