import { isDemoMode, supabase } from './client';
import { demo } from './demo';

export interface Cycle {
  id: string;
  code: string;
  quarter_label: string;
  status: 'setup' | 'open' | 'closed';
  due_at: string | null;
}

export interface TeamMember {
  employeeId: number;
  localName: string;
  fullName: string;
  position: string;
  dept: string;
  startDate: string | null;
}

export async function getOpenCycle(): Promise<Cycle | null> {
  if (isDemoMode) return demo.cycle;
  const { data, error } = await supabase()
    .from('cycles')
    .select('id, code, quarter_label, status, due_at')
    .eq('status', 'open')
    .order('open_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Row access is enforced by RLS; the supervisor filter only separates a team from the wider line view. */
export async function listTeam(cycleId: string, managerId: number): Promise<TeamMember[]> {
  if (isDemoMode) return demo.team(managerId);
  const { data, error } = await supabase()
    .from('cycle_population')
    .select('employee_id, position, dept, employees(local_name, full_name, start_date)')
    .eq('cycle_id', cycleId)
    .eq('supervisor_id', managerId)
    .eq('in_scope', true);
  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const e = row.employees as unknown as { local_name: string; full_name: string; start_date: string | null };
      return {
        employeeId: row.employee_id,
        localName: e.local_name,
        fullName: e.full_name,
        position: row.position ?? '',
        dept: row.dept ?? '',
        startDate: e.start_date,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
