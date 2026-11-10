-- Talent Review core schema (SPEC section 4).
-- Column additions beyond the SPEC are recorded in docs/DECISIONS.md.

create table public.app_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  employee_id bigint unique,
  role text not null check (role in ('manager', 'hr')),
  display_name text,
  locale text not null default 'zh-TW' check (locale in ('zh-TW', 'en')),
  font_scale numeric not null default 1 check (font_scale in (0.875, 1, 1.125, 1.25)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  quarter_label text not null,
  site text not null default 'Xindian',
  status text not null default 'setup' check (status in ('setup', 'open', 'closed')),
  open_at timestamptz,
  due_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.employees (
  employee_id bigint primary key check (employee_id > 0),
  local_name text,
  full_name text not null,
  gender text,
  start_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.cycle_population (
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  employee_id bigint not null references public.employees (employee_id),
  in_scope boolean not null default false,
  supervisor_id bigint not null default 0,
  supervisor_name_raw text,
  dept text,
  dept_no text,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (cycle_id, employee_id),
  check (supervisor_id <> employee_id)
);
create index cycle_population_supervisor_idx on public.cycle_population (cycle_id, supervisor_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  employee_id bigint not null references public.employees (employee_id),
  reviewer_id bigint not null references public.employees (employee_id),
  is_key_talent boolean not null default false,
  key_talent_reasons text[] not null default '{}',
  key_talent_note text,
  status text not null default 'not_selected'
    check (status in ('not_selected', 'draft', 'submitted', 'returned', 'confirmed', 'locked')),
  retention_risk text,
  retention_reasons text[] not null default '{}' check (coalesce(array_length(retention_reasons, 1), 0) <= 2),
  mobility_status text,
  desired_locations text,
  pbm_strengths jsonb not null default '[]',
  pbm_improvements jsonb not null default '[]',
  performance_strengths text,
  development_areas jsonb not null default '[]',
  personal_aspirations text,
  aspirations_not_discussed boolean not null default false,
  additional_comments text,
  is_critical_role boolean,
  completed_steps text[] not null default '{}',
  version integer not null default 1,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (cycle_id, employee_id),
  check (employee_id <> reviewer_id)
);
create index reviews_reviewer_idx on public.reviews (cycle_id, reviewer_id);

create table public.next_roles (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  role_title text,
  readiness text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (review_id, rank)
);

create table public.successors (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  successor_type text not null check (successor_type in ('internal', 'external', 'tbh')),
  successor_employee_id bigint references public.employees (employee_id),
  external_name text,
  readiness text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (review_id, rank),
  check (successor_type <> 'tbh' or readiness is null)
);

create table public.dev_plan_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  area_idx integer not null,
  goal text,
  dev_type text,
  actions text,
  support text,
  owner text,
  start_date date,
  target_date date,
  checkpoint text,
  status text not null default 'Not Started',
  progress_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index dev_plan_items_review_idx on public.dev_plan_items (review_id);

create table public.review_versions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  version integer not null,
  action text not null check (action in ('save', 'submit', 'return', 'confirm', 'lock', 'unlock', 'reopen')),
  snapshot jsonb not null,
  actor uuid,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index review_versions_review_idx on public.review_versions (review_id, version);

create table public.team_submissions (
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  reviewer_id bigint not null references public.employees (employee_id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'confirmed', 'locked')),
  submitted_at timestamptz,
  reopen_requested_at timestamptz,
  reopen_reason text,
  hr_comment text,
  discussion_status text not null default 'not_scheduled'
    check (discussion_status in ('not_scheduled', 'scheduled', 'done')),
  discussion_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (cycle_id, reviewer_id)
);

create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  author uuid,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index review_comments_review_idx on public.review_comments (review_id);

create table public.option_lists (
  id uuid primary key default gen_random_uuid(),
  list_key text not null,
  value text not null,
  label_zh text not null,
  label_en text not null,
  sort integer not null default 0,
  is_active boolean not null default true,
  export_column text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (list_key, value)
);

create table public.question_bank (
  key text primary key,
  step_order integer not null,
  section text,
  field_ref text,
  title_zh text, title_en text,
  question_zh text, question_en text,
  hint_zh text, hint_en text,
  guide_zh text, guide_en text,
  good_example_zh text, good_example_en text,
  weak_example_zh text, weak_example_en text,
  pitfalls_zh text, pitfalls_en text,
  input_type text,
  list_key text,
  required boolean not null default true,
  condition jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.cycles (id) on delete cascade,
  scope_type text,
  scope_ref text,
  output_type text not null,
  model text,
  input_hash text,
  content_md text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  entity text,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  employee_id bigint not null,
  success boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index login_attempts_lookup_idx on public.login_attempts (employee_id, created_at desc);

-- Maintains updated_at and updated_by on every table.
create function public.set_row_metadata() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create trigger set_row_metadata before insert or update on public.%I
       for each row execute function public.set_row_metadata()', t);
  end loop;
end;
$$;
