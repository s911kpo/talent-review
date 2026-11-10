import type { ExistingPopulation, PopulationRow } from '../lib/namelist/namelist';
import { isDemoMode, supabase } from './client';
import { demo } from './demo';
import type { Cycle } from './team';

export async function listCycles(): Promise<Cycle[]> {
  if (isDemoMode) return [demo.cycle];
  const { data, error } = await supabase()
    .from('cycles')
    .select('id, code, quarter_label, status, due_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCycle(input: { code: string; quarter_label: string; due_at: string | null }): Promise<void> {
  const { error } = await supabase().from('cycles').insert({ ...input, status: 'setup' });
  if (error) throw error;
}

export async function setCycleStatus(id: string, status: Cycle['status']): Promise<void> {
  const patch = status === 'open' ? { status, open_at: new Date().toISOString() } : { status };
  const { error } = await supabase().from('cycles').update(patch).eq('id', id);
  if (error) throw error;
}

export async function listPopulation(cycleId: string): Promise<ExistingPopulation[]> {
  if (isDemoMode) return demo.population();
  const pageSize = 1000;
  const out: ExistingPopulation[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase()
      .from('cycle_population')
      .select('employee_id, in_scope, supervisor_id')
      .eq('cycle_id', cycleId)
      .order('employee_id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) return out;
  }
}

export interface ImportResult {
  rows: number;
  departed: number;
  reviews_transferred: number;
}

export async function importNamelist(cycleId: string, rows: PopulationRow[]): Promise<ImportResult> {
  const { data, error } = await supabase().rpc('import_namelist', { p_cycle_id: cycleId, p_rows: rows });
  if (error) throw error;
  return data as ImportResult;
}

export interface ExpectedReviewer {
  employee_id: number;
  full_name: string;
  local_name: string;
  team_size: number;
  has_account: boolean;
  account_active: boolean;
}

export async function listExpectedReviewers(cycleId: string): Promise<ExpectedReviewer[]> {
  if (isDemoMode) return [];
  const { data, error } = await supabase().rpc('expected_reviewers', { p_cycle_id: cycleId });
  if (error) throw error;
  return data ?? [];
}

export interface AppUserRow {
  user_id: string;
  employee_id: number | null;
  role: 'manager' | 'hr';
  display_name: string | null;
  is_active: boolean;
}

export async function listAppUsers(): Promise<AppUserRow[]> {
  if (isDemoMode) return [];
  const { data, error } = await supabase()
    .from('app_users')
    .select('user_id, employee_id, role, display_name, is_active')
    .order('display_name');
  if (error) throw error;
  return data ?? [];
}

async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke('admin-users', { body });
  if (error) throw error;
  return data as T;
}

export interface ProvisionResult {
  results: { employeeId: number; name: string; pin: string; created: boolean }[];
  failures: { employeeId: number; code: string }[];
}

export const provisionPins = (employeeIds: number[]) =>
  callAdmin<ProvisionResult>({ action: 'provision', employeeIds });

export const setAccountActive = (userId: string, active: boolean) =>
  callAdmin<{ ok: boolean }>({ action: 'set_active', userId, active });

export const createHrAccount = (input: { email: string; displayName: string; employeeId: number | null }) =>
  callAdmin<{ email: string; password: string }>({ action: 'create_hr', ...input });
