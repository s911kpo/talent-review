import type { Dataset, Person, ThemeTag } from '../lib/metrics';
import type { Review } from '../lib/review/types';
import { isDemoMode, supabase } from './client';
import { demo } from './demo';
import { hydrate, SELECT_REVIEW, type ReviewRow } from './review';

export interface PlantAverages {
  key_pct: number | null;
  med_high_pct: number | null;
  coverage_pct: number | null;
  plan_complete_pct: number | null;
  not_discussed_pct: number | null;
}

export interface DashboardData extends Dataset {
  reviewerNames: Map<number, string>;
}

const PAGE = 1000;

async function allPages<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

interface PopRow {
  employee_id: number;
  dept: string | null;
  supervisor_id: number;
  employees: { full_name: string; start_date: string | null; gender: string | null };
}

/** RLS decides what comes back: HR sees everyone, managers their own team and line. */
export async function fetchDashboard(cycleId: string): Promise<DashboardData> {
  if (isDemoMode) return demo.dashboard();

  const [population, reviewRows] = await Promise.all([
    allPages<PopRow>((from, to) => supabase().from('cycle_population')
      .select('employee_id, dept, supervisor_id, employees(full_name, start_date, gender)')
      .eq('cycle_id', cycleId).eq('in_scope', true).order('employee_id').range(from, to)),
    allPages<ReviewRow>((from, to) => supabase().from('reviews').select(SELECT_REVIEW)
      .eq('cycle_id', cycleId).eq('is_key_talent', true).order('employee_id').range(from, to)),
  ]);

  const people: Person[] = population.map((p) => ({
    employee_id: p.employee_id,
    name: p.employees.full_name,
    dept: p.dept ?? '',
    reviewer_id: p.supervisor_id,
    start_date: p.employees.start_date,
    gender: p.employees.gender,
  }));
  const reviews: Review[] = await hydrate(reviewRows);

  const reviewerIds = [...new Set(people.map((p) => p.reviewer_id))];
  const reviewerNames = new Map<number, string>();
  if (reviewerIds.length > 0) {
    const { data, error } = await supabase().rpc('successor_names', { p_ids: reviewerIds });
    if (error) throw error;
    for (const n of data ?? []) reviewerNames.set(n.employee_id, n.full_name);
  }
  return { people, reviews, reviewerNames };
}

export async function fetchPlantAverages(cycleId: string): Promise<PlantAverages | null> {
  if (isDemoMode) return demo.plantAverages();
  const { data, error } = await supabase().rpc('plant_averages', { p_cycle_id: cycleId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchThemeTags(cycleId: string): Promise<ThemeTag[] | null> {
  if (isDemoMode) return null;
  const { data, error } = await supabase().from('ai_outputs').select('content_md')
    .eq('cycle_id', cycleId).eq('output_type', 'dev_theme_tagging')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.content_md) return null;
  try {
    return (JSON.parse(data.content_md) as { tags: ThemeTag[] }).tags;
  } catch {
    return null;
  }
}
