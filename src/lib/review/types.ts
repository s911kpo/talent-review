// Field names match the database so saved data needs no translation layer.

export type ReviewStatus = 'not_selected' | 'draft' | 'submitted' | 'returned' | 'confirmed' | 'locked';

export interface PbmEntry { principle: string; evidence: string; }
export interface DevArea { idx: number; text: string; }
export interface NextRole { rank: number; role_title: string; readiness: string; }

export interface Successor {
  rank: number;
  successor_type: 'internal' | 'external' | 'tbh';
  successor_employee_id: number | null;
  external_name: string | null;
  readiness: string | null;
  display_name?: string;
}

export interface DevPlanItem {
  area_idx: number;
  goal: string;
  dev_type: string;
  actions: string;
  support: string;
  owner: string;
  start_date: string | null;
  target_date: string | null;
  checkpoint: string;
  status: string;
  progress_notes: string;
}

export interface Review {
  id: string;
  cycle_id: string;
  employee_id: number;
  reviewer_id: number;
  status: ReviewStatus;
  is_key_talent: boolean;
  key_talent_reasons: string[];
  key_talent_note: string | null;
  is_critical_role: boolean | null;
  performance_strengths: string | null;
  pbm_strengths: PbmEntry[];
  pbm_improvements: PbmEntry[];
  development_areas: DevArea[];
  personal_aspirations: string | null;
  aspirations_not_discussed: boolean;
  retention_risk: string | null;
  retention_reasons: string[];
  mobility_status: string | null;
  desired_locations: string | null;
  additional_comments: string | null;
  completed_steps: string[];
  version: number;
  rev: number;
  updated_at: string;
  next_roles: NextRole[];
  successors: Successor[];
  dev_plan: DevPlanItem[];
}

export interface TeamSubmission {
  status: 'draft' | 'submitted' | 'returned' | 'confirmed' | 'locked';
  submitted_at: string | null;
  reopen_requested_at: string | null;
  reopen_reason: string | null;
  hr_comment: string | null;
  discussion_status: 'not_scheduled' | 'scheduled' | 'done';
  discussion_date: string | null;
}

export interface ReviewComment { id: string; review_id: string; body: string; created_at: string; }

export interface OptionItem { list_key: string; value: string; label_zh: string; label_en: string; sort: number; }

export interface Question {
  key: string;
  step_order: number;
  section: string | null;
  field_ref: string | null;
  input_type: string;
  list_key: string | null;
  required: boolean;
  title_zh: string; title_en: string;
  question_zh: string | null; question_en: string | null;
  hint_zh: string | null; hint_en: string | null;
  guide_zh: string | null; guide_en: string | null;
  good_example_zh: string | null; good_example_en: string | null;
  weak_example_zh: string | null; weak_example_en: string | null;
  pitfalls_zh: string | null; pitfalls_en: string | null;
}

export interface DirectoryEntry {
  employee_id: number;
  local_name: string;
  full_name: string;
  position: string;
  dept: string;
}

export interface LineTeam {
  reviewer_id: number;
  full_name: string;
  local_name: string;
  status: TeamSubmission['status'];
  member_count: number;
}
