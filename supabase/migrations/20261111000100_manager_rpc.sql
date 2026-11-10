-- Manager workflow (SPEC 4, 6): optimistic saves, key talent selection, snapshots, team submission.

-- `version` counts snapshots shown to people; `rev` counts every write and drives optimistic locking.
alter table public.reviews add column rev integer not null default 0;

create or replace function public.guard_review_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rev := old.rev + 1;

  if new.status is distinct from old.status
     and not (old.status || '>' || new.status) = any (array[
       'not_selected>draft', 'draft>not_selected', 'draft>submitted',
       'submitted>returned', 'submitted>confirmed', 'submitted>draft',
       'returned>draft', 'returned>submitted', 'returned>not_selected',
       'confirmed>locked', 'confirmed>draft',
       'locked>confirmed', 'locked>draft'
     ]) then
    raise exception 'illegal_status_transition: % -> %', old.status, new.status using errcode = 'P0001';
  end if;

  if current_user = 'authenticated' and not public.is_hr() then
    if old.status not in ('not_selected', 'draft', 'returned')
       or new.status not in ('not_selected', 'draft', 'returned') then
      raise exception 'review_not_editable' using errcode = 'P0001';
    end if;
    if new.cycle_id is distinct from old.cycle_id
       or new.employee_id is distinct from old.employee_id
       or new.reviewer_id is distinct from old.reviewer_id
       or new.version is distinct from old.version
       or new.submitted_at is distinct from old.submitted_at
       or new.confirmed_at is distinct from old.confirmed_at
       or new.locked_at is distinct from old.locked_at then
      raise exception 'protected_review_field' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Which required questions are still unanswered. Mirrors src/lib/review/steps.ts;
-- tests/rls/manager.test.ts asserts the two agree.
create function public.review_missing_steps(p_review_id uuid) returns text[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.reviews;
  missing text[] := '{}';
  v_area record;
begin
  select * into r from public.reviews where id = p_review_id;

  if r.is_critical_role is null then missing := array_append(missing, 'CRITICAL_ROLE'); end if;
  if coalesce(btrim(r.performance_strengths), '') = '' then missing := array_append(missing, 'PERF_STRENGTHS'); end if;

  if not exists (
    select 1 from jsonb_array_elements(r.pbm_strengths) e
    where coalesce(e->>'principle', '') <> '' and btrim(coalesce(e->>'evidence', '')) <> ''
  ) then missing := array_append(missing, 'PBM_STRENGTHS'); end if;

  if not exists (
    select 1 from jsonb_array_elements(r.pbm_improvements) e
    where coalesce(e->>'principle', '') <> '' and btrim(coalesce(e->>'evidence', '')) <> ''
  ) then missing := array_append(missing, 'PBM_IMPROVE'); end if;

  if not exists (
    select 1 from jsonb_array_elements(r.development_areas) e where btrim(coalesce(e->>'text', '')) <> ''
  ) then missing := array_append(missing, 'DEV_AREAS'); end if;

  if not r.aspirations_not_discussed and coalesce(btrim(r.personal_aspirations), '') = '' then
    missing := array_append(missing, 'ASPIRATIONS');
  end if;

  if not exists (
    select 1 from public.next_roles n
    where n.review_id = r.id and btrim(coalesce(n.role_title, '')) <> '' and coalesce(n.readiness, '') <> ''
  ) then missing := array_append(missing, 'NEXT_ROLES'); end if;

  if coalesce(r.mobility_status, '') = '' then missing := array_append(missing, 'MOBILITY'); end if;

  if coalesce(r.retention_risk, '') = ''
     or (r.retention_risk in ('Medium', 'High') and coalesce(array_length(r.retention_reasons, 1), 0) = 0) then
    missing := array_append(missing, 'RETENTION');
  end if;

  if not exists (
    select 1 from public.successors s
    where s.review_id = r.id and (
      s.successor_type = 'tbh'
      or (s.successor_type = 'internal' and s.successor_employee_id is not null and coalesce(s.readiness, '') <> '')
      or (s.successor_type = 'external' and btrim(coalesce(s.external_name, '')) <> '' and coalesce(s.readiness, '') <> '')
    )
  ) then missing := array_append(missing, 'SUCCESSORS'); end if;

  for v_area in
    select (e->>'idx')::int as idx from jsonb_array_elements(r.development_areas) e
    where btrim(coalesce(e->>'text', '')) <> ''
  loop
    if not exists (
      select 1 from public.dev_plan_items d
      where d.review_id = r.id and d.area_idx = v_area.idx
        and btrim(coalesce(d.goal, '')) <> '' and coalesce(d.dev_type, '') <> ''
        and btrim(coalesce(d.actions, '')) <> '' and btrim(coalesce(d.owner, '')) <> ''
        and d.start_date is not null and d.target_date is not null
        and btrim(coalesce(d.checkpoint, '')) <> ''
    ) then
      missing := array_append(missing, 'DEV_PLAN');
      exit;
    end if;
  end loop;

  return missing;
end;
$$;

create function public.review_snapshot_json(p_review_id uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(r)
    || jsonb_build_object(
      'next_roles', coalesce((select jsonb_agg(to_jsonb(n) order by n.rank) from public.next_roles n where n.review_id = r.id), '[]'),
      'successors', coalesce((select jsonb_agg(to_jsonb(s) order by s.rank) from public.successors s where s.review_id = r.id), '[]'),
      'dev_plan', coalesce((select jsonb_agg(to_jsonb(d) order by d.area_idx) from public.dev_plan_items d where d.review_id = r.id), '[]')
    )
  from public.reviews r where r.id = p_review_id;
$$;

-- Runs as the caller so RLS and the guard trigger still decide what is allowed.
create function public.save_review(
  p_review_id uuid,
  p_expected_rev integer,
  p_fields jsonb,
  p_next_roles jsonb default null,
  p_successors jsonb default null,
  p_dev_plan jsonb default null
)
returns table (rev integer, version integer, updated_at timestamptz)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.reviews r set
    is_critical_role = case when p_fields ? 'is_critical_role' then (p_fields->>'is_critical_role')::boolean else r.is_critical_role end,
    performance_strengths = case when p_fields ? 'performance_strengths' then p_fields->>'performance_strengths' else r.performance_strengths end,
    pbm_strengths = case when p_fields ? 'pbm_strengths' then p_fields->'pbm_strengths' else r.pbm_strengths end,
    pbm_improvements = case when p_fields ? 'pbm_improvements' then p_fields->'pbm_improvements' else r.pbm_improvements end,
    development_areas = case when p_fields ? 'development_areas' then p_fields->'development_areas' else r.development_areas end,
    personal_aspirations = case when p_fields ? 'personal_aspirations' then p_fields->>'personal_aspirations' else r.personal_aspirations end,
    aspirations_not_discussed = case when p_fields ? 'aspirations_not_discussed' then (p_fields->>'aspirations_not_discussed')::boolean else r.aspirations_not_discussed end,
    retention_risk = case when p_fields ? 'retention_risk' then p_fields->>'retention_risk' else r.retention_risk end,
    retention_reasons = case when p_fields ? 'retention_reasons'
      then coalesce((select array_agg(x) from jsonb_array_elements_text(p_fields->'retention_reasons') x), '{}')
      else r.retention_reasons end,
    mobility_status = case when p_fields ? 'mobility_status' then p_fields->>'mobility_status' else r.mobility_status end,
    desired_locations = case when p_fields ? 'desired_locations' then p_fields->>'desired_locations' else r.desired_locations end,
    additional_comments = case when p_fields ? 'additional_comments' then p_fields->>'additional_comments' else r.additional_comments end,
    completed_steps = case when p_fields ? 'completed_steps'
      then coalesce((select array_agg(x) from jsonb_array_elements_text(p_fields->'completed_steps') x), '{}')
      else r.completed_steps end
  where r.id = p_review_id and r.rev = p_expected_rev;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    if exists (select 1 from public.reviews r where r.id = p_review_id and r.id in (select public.my_editable_reviews())) then
      raise exception 'version_conflict' using errcode = 'P0001';
    end if;
    raise exception 'review_not_editable' using errcode = 'P0001';
  end if;

  if p_next_roles is not null then
    delete from public.next_roles n where n.review_id = p_review_id;
    insert into public.next_roles (review_id, rank, role_title, readiness)
    select p_review_id, x.rank, x.role_title, x.readiness
    from jsonb_to_recordset(p_next_roles) as x(rank integer, role_title text, readiness text);
  end if;

  if p_successors is not null then
    delete from public.successors s where s.review_id = p_review_id;
    insert into public.successors (review_id, rank, successor_type, successor_employee_id, external_name, readiness)
    select p_review_id, x.rank, x.successor_type, x.successor_employee_id, x.external_name, x.readiness
    from jsonb_to_recordset(p_successors)
      as x(rank integer, successor_type text, successor_employee_id bigint, external_name text, readiness text);
  end if;

  if p_dev_plan is not null then
    delete from public.dev_plan_items d where d.review_id = p_review_id;
    insert into public.dev_plan_items
      (review_id, area_idx, goal, dev_type, actions, support, owner, start_date, target_date, checkpoint, status, progress_notes)
    select p_review_id, x.area_idx, x.goal, x.dev_type, x.actions, x.support, x.owner, x.start_date, x.target_date,
           x.checkpoint, coalesce(x.status, 'Not Started'), x.progress_notes
    from jsonb_to_recordset(p_dev_plan) as x(
      area_idx integer, goal text, dev_type text, actions text, support text, owner text,
      start_date date, target_date date, checkpoint text, status text, progress_notes text
    );
  end if;

  return query select r.rev, r.version, r.updated_at from public.reviews r where r.id = p_review_id;
end;
$$;

-- Runs as the caller: RLS limits it to the caller's own direct reports.
create function public.set_key_talent(
  p_cycle_id uuid, p_employee_id bigint, p_selected boolean, p_reasons text[], p_note text
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.reviews (cycle_id, employee_id, reviewer_id, status, is_key_talent, key_talent_reasons, key_talent_note)
  values (
    p_cycle_id, p_employee_id, public.my_employee_id(),
    case when p_selected then 'draft' else 'not_selected' end,
    p_selected, coalesce(p_reasons, '{}'), p_note
  )
  on conflict (cycle_id, employee_id) do update set
    is_key_talent = excluded.is_key_talent,
    key_talent_reasons = excluded.key_talent_reasons,
    key_talent_note = excluded.key_talent_note,
    status = case
      when not excluded.is_key_talent then 'not_selected'
      when reviews.status = 'not_selected' then 'draft'
      else reviews.status
    end
  returning id into v_id;
  return v_id;
end;
$$;

-- Records a version when the manager leaves an employee (SPEC 4).
create function public.snapshot_review(p_review_id uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_version integer;
begin
  if p_review_id not in (select public.my_editable_reviews()) then
    raise exception 'review_not_editable' using errcode = 'P0001';
  end if;
  update public.reviews set version = version + 1 where id = p_review_id returning version into v_version;
  insert into public.review_versions (review_id, version, action, snapshot, actor)
  values (p_review_id, v_version, 'save', public.review_snapshot_json(p_review_id), auth.uid());
  return v_version;
end;
$$;

create function public.ensure_team_row(p_cycle_id uuid, p_reviewer_id bigint) returns void
language sql security definer set search_path = ''
as $$
  insert into public.team_submissions (cycle_id, reviewer_id) values (p_cycle_id, p_reviewer_id)
  on conflict (cycle_id, reviewer_id) do nothing;
$$;

create function public.set_no_key_talent(p_cycle_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare me bigint := public.my_employee_id();
begin
  if me is null or coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  perform public.ensure_team_row(p_cycle_id, me);
  update public.team_submissions
     set hr_comment = '[NO_KEY_TALENT] ' || btrim(p_reason)
   where cycle_id = p_cycle_id and reviewer_id = me and status in ('draft', 'returned');
end;
$$;

create function public.submit_team(p_cycle_id uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  me bigint := public.my_employee_id();
  v_team public.team_submissions;
  v_rec record;
  v_incomplete jsonb := '[]';
  v_submitted integer := 0;
  v_key_count integer;
begin
  if me is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.cycles where id = p_cycle_id and status = 'open') then
    raise exception 'cycle_not_open' using errcode = 'P0001';
  end if;

  perform public.ensure_team_row(p_cycle_id, me);
  select * into v_team from public.team_submissions
   where cycle_id = p_cycle_id and reviewer_id = me for update;
  if v_team.status not in ('draft', 'returned') then
    raise exception 'team_not_editable' using errcode = 'P0001';
  end if;

  select count(*) into v_key_count from public.reviews
   where cycle_id = p_cycle_id and reviewer_id = me and is_key_talent;
  if v_key_count = 0 and coalesce(v_team.hr_comment, '') not like '[NO_KEY_TALENT]%' then
    raise exception 'no_key_talent_reason_required' using errcode = 'P0001';
  end if;

  for v_rec in
    select id, employee_id from public.reviews
    where cycle_id = p_cycle_id and reviewer_id = me and is_key_talent and status in ('draft', 'returned')
  loop
    if coalesce(array_length(public.review_missing_steps(v_rec.id), 1), 0) > 0 then
      v_incomplete := v_incomplete || to_jsonb(v_rec.employee_id);
    end if;
  end loop;
  if jsonb_array_length(v_incomplete) > 0 then
    raise exception 'incomplete_reviews' using errcode = 'P0001', detail = v_incomplete::text;
  end if;

  for v_rec in
    select id from public.reviews
    where cycle_id = p_cycle_id and reviewer_id = me and is_key_talent and status in ('draft', 'returned')
  loop
    update public.reviews
       set status = 'submitted', submitted_at = now(), version = version + 1
     where id = v_rec.id;
    insert into public.review_versions (review_id, version, action, snapshot, actor)
    select v_rec.id, r.version, 'submit', public.review_snapshot_json(v_rec.id), auth.uid()
    from public.reviews r where r.id = v_rec.id;
    v_submitted := v_submitted + 1;
  end loop;

  update public.team_submissions
     set status = 'submitted', submitted_at = now()
   where cycle_id = p_cycle_id and reviewer_id = me;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (auth.uid(), 'team_submitted', 'team', me::text,
          jsonb_build_object('cycle_id', p_cycle_id, 'reviews', v_submitted));
  return v_submitted;
end;
$$;

create function public.request_reopen(p_cycle_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare me bigint := public.my_employee_id();
begin
  if me is null or coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  update public.team_submissions
     set reopen_requested_at = now(), reopen_reason = btrim(p_reason)
   where cycle_id = p_cycle_id and reviewer_id = me and status in ('submitted', 'confirmed');
  if not found then raise exception 'team_not_submitted' using errcode = 'P0001'; end if;
end;
$$;

create function public.set_discussion(p_cycle_id uuid, p_date date) returns void
language plpgsql security definer set search_path = ''
as $$
declare me bigint := public.my_employee_id();
begin
  update public.team_submissions
     set discussion_status = 'scheduled', discussion_date = p_date
   where cycle_id = p_cycle_id and reviewer_id = me;
  if not found then raise exception 'team_not_found' using errcode = 'P0001'; end if;
end;
$$;

-- Status of each manager below the caller, without their comments or reasons.
create function public.line_team_status(p_cycle_id uuid)
returns table (reviewer_id bigint, full_name text, local_name text, status text, member_count bigint)
language sql stable security definer set search_path = ''
as $$
  select p.supervisor_id, e.full_name, e.local_name, coalesce(t.status, 'draft'), count(*)
  from public.cycle_population p
  join public.my_scope() s on s.cycle_id = p.cycle_id and s.employee_id = p.employee_id and s.scope = 'line'
  join public.employees e on e.employee_id = p.supervisor_id
  left join public.team_submissions t on t.cycle_id = p.cycle_id and t.reviewer_id = p.supervisor_id
  where p.cycle_id = p_cycle_id
  group by p.supervisor_id, e.full_name, e.local_name, t.status
  order by e.full_name;
$$;

-- Display names for internal successors on reviews the caller can already read.
create function public.successor_names(p_ids bigint[])
returns table (employee_id bigint, full_name text)
language sql stable security definer set search_path = ''
as $$
  select e.employee_id, e.full_name from public.employees e
  where e.employee_id = any (p_ids)
    and exists (select 1 from public.app_users u where u.user_id = auth.uid() and u.is_active);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'save_review(uuid, integer, jsonb, jsonb, jsonb, jsonb)',
    'set_key_talent(uuid, bigint, boolean, text[], text)',
    'snapshot_review(uuid)', 'set_no_key_talent(uuid, text)', 'submit_team(uuid)',
    'request_reopen(uuid, text)', 'set_discussion(uuid, date)', 'line_team_status(uuid)',
    'successor_names(bigint[])'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  foreach f in array array['review_missing_steps(uuid)', 'review_snapshot_json(uuid)', 'ensure_team_row(uuid, bigint)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
