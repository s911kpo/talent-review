-- State machines (SPEC section 4) and server-side operations that RLS alone cannot express.

create function public.guard_review_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not (old.status || '>' || new.status) = any (array[
       'not_selected>draft', 'draft>not_selected', 'draft>submitted',
       'submitted>returned', 'submitted>confirmed', 'submitted>draft',
       'returned>draft', 'returned>submitted',
       'confirmed>locked', 'confirmed>draft',
       'locked>confirmed', 'locked>draft'
     ]) then
    raise exception 'illegal_status_transition: % -> %', old.status, new.status using errcode = 'P0001';
  end if;

  -- current_user is 'authenticated' only for direct client writes. Security definer
  -- functions run as their owner, so submit and review actions pass through them.
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

create trigger guard_review_update before update on public.reviews
  for each row execute function public.guard_review_update();

create function public.guard_team_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not (old.status || '>' || new.status) = any (array[
       'draft>submitted',
       'submitted>returned', 'submitted>confirmed', 'submitted>draft',
       'returned>draft', 'returned>submitted',
       'confirmed>locked', 'confirmed>draft',
       'locked>confirmed', 'locked>draft'
     ]) then
    raise exception 'illegal_status_transition: % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guard_team_update before update on public.team_submissions
  for each row execute function public.guard_team_update();

-- Name, title and department only; used by the successor picker (SPEC 6.4).
create function public.employee_directory(p_cycle_id uuid, p_query text, p_limit integer default 20)
returns table (employee_id bigint, local_name text, full_name text, "position" text, dept text)
language sql stable security definer set search_path = ''
as $$
  select e.employee_id, e.local_name, e.full_name, p.position, p.dept
  from public.cycle_population p
  join public.employees e on e.employee_id = p.employee_id
  where p.cycle_id = p_cycle_id
    and exists (select 1 from public.app_users u where u.user_id = auth.uid() and u.is_active)
    and (
      coalesce(p_query, '') = ''
      or e.full_name ilike '%' || p_query || '%'
      or e.local_name ilike '%' || p_query || '%'
      or p.position ilike '%' || p_query || '%'
      or p.dept ilike '%' || p_query || '%'
    )
  order by e.full_name
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- Who should have a reviewer account this cycle (SPEC 7.6, 11).
create function public.expected_reviewers(p_cycle_id uuid)
returns table (
  employee_id bigint, full_name text, local_name text, team_size bigint,
  has_account boolean, account_active boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_hr() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select e.employee_id, e.full_name, e.local_name, count(*),
           bool_or(u.user_id is not null), coalesce(bool_or(u.is_active), false)
    from public.cycle_population p
    join public.employees e on e.employee_id = p.supervisor_id
    left join public.app_users u on u.employee_id = e.employee_id
    where p.cycle_id = p_cycle_id and p.in_scope and p.supervisor_id <> 0
    group by e.employee_id, e.full_name, e.local_name
    order by e.full_name;
end;
$$;

-- Applies a validated namelist as this cycle's snapshot. The client validates first and
-- discards Birth month; this function re-checks what must hold regardless of the client.
create function public.import_namelist(p_cycle_id uuid, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_transferred integer := 0;
  v_departed integer := 0;
  v_total integer;
  v_rec record;
begin
  if not public.is_hr() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cycles where id = p_cycle_id) then
    raise exception 'cycle_not_found' using errcode = 'P0001';
  end if;

  -- SPEC 0.7: birth month is never stored, even if a client sends it.
  if exists (
    select 1 from jsonb_array_elements(p_rows) r, jsonb_object_keys(r) k
    where lower(k) like '%birth%'
  ) then
    raise exception 'birth_month_rejected' using errcode = 'P0001';
  end if;

  drop table if exists pg_temp.incoming;
  create temporary table incoming on commit drop as
    select (r->>'employee_id')::bigint as employee_id,
           r->>'local_name' as local_name,
           r->>'full_name' as full_name,
           r->>'gender' as gender,
           (r->>'start_date')::date as start_date,
           coalesce((r->>'in_scope')::boolean, false) as in_scope,
           coalesce((r->>'supervisor_id')::bigint, 0) as supervisor_id,
           r->>'supervisor_name_raw' as supervisor_name_raw,
           r->>'dept' as dept,
           r->>'dept_no' as dept_no,
           r->>'position' as position
    from jsonb_array_elements(p_rows) r;

  select count(*) into v_total from incoming;
  if v_total = 0 then
    raise exception 'empty_namelist' using errcode = 'P0001';
  end if;
  if (select count(distinct employee_id) from incoming) <> v_total then
    raise exception 'duplicate_employee_id' using errcode = 'P0001';
  end if;
  if exists (select 1 from incoming where supervisor_id = employee_id) then
    raise exception 'self_supervisor' using errcode = 'P0001';
  end if;
  if exists (select 1 from incoming where in_scope and supervisor_id = 0) then
    raise exception 'in_scope_without_supervisor' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from incoming i
    where i.supervisor_id <> 0
      and not exists (select 1 from incoming s where s.employee_id = i.supervisor_id)
  ) then
    raise exception 'unknown_supervisor' using errcode = 'P0001';
  end if;
  if exists (
    with recursive walk (origin, current_id, path, is_cycle) as (
      select employee_id, supervisor_id, array[employee_id], false
      from incoming where supervisor_id <> 0
      union all
      select w.origin, i.supervisor_id, w.path || i.employee_id, i.employee_id = any (w.path)
      from walk w join incoming i on i.employee_id = w.current_id
      where not w.is_cycle and i.supervisor_id <> 0
    )
    select 1 from walk where is_cycle or current_id = origin
  ) then
    raise exception 'supervisor_cycle' using errcode = 'P0001';
  end if;

  insert into public.employees (employee_id, local_name, full_name, gender, start_date, is_active)
  select employee_id, local_name, full_name, gender, start_date, true from incoming
  on conflict (employee_id) do update
    set local_name = excluded.local_name,
        full_name = excluded.full_name,
        gender = excluded.gender,
        start_date = excluded.start_date,
        is_active = true;

  -- People no longer on the list stay in history but leave scope.
  with departed as (
    update public.cycle_population p
       set in_scope = false
     where p.cycle_id = p_cycle_id
       and p.employee_id not in (select employee_id from incoming)
       and p.in_scope
    returning p.employee_id
  )
  select count(*) into v_departed from departed;

  update public.employees e
     set is_active = false
   where e.employee_id in (select p.employee_id from public.cycle_population p where p.cycle_id = p_cycle_id)
     and e.employee_id not in (select employee_id from incoming);

  insert into public.cycle_population
    (cycle_id, employee_id, in_scope, supervisor_id, supervisor_name_raw, dept, dept_no, position)
  select p_cycle_id, employee_id, in_scope, supervisor_id, supervisor_name_raw, dept, dept_no, position
  from incoming
  on conflict (cycle_id, employee_id) do update
    set in_scope = excluded.in_scope,
        supervisor_id = excluded.supervisor_id,
        supervisor_name_raw = excluded.supervisor_name_raw,
        dept = excluded.dept,
        dept_no = excluded.dept_no,
        position = excluded.position;

  -- A changed supervisor takes over the existing review (SPEC 11).
  for v_rec in
    select r.id, r.employee_id, r.reviewer_id as old_reviewer, i.supervisor_id as new_reviewer
    from public.reviews r
    join incoming i on i.employee_id = r.employee_id
    where r.cycle_id = p_cycle_id and i.in_scope and i.supervisor_id <> r.reviewer_id
  loop
    update public.reviews set reviewer_id = v_rec.new_reviewer where id = v_rec.id;
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'review_reassigned', 'review', v_rec.id::text,
            jsonb_build_object('employee_id', v_rec.employee_id,
                               'from', v_rec.old_reviewer, 'to', v_rec.new_reviewer));
    v_transferred := v_transferred + 1;
  end loop;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (auth.uid(), 'namelist_imported', 'cycle', p_cycle_id::text,
          jsonb_build_object('rows', v_total, 'departed', v_departed, 'reviews_transferred', v_transferred));

  return jsonb_build_object('rows', v_total, 'departed', v_departed, 'reviews_transferred', v_transferred);
end;
$$;

revoke all on function public.guard_review_update() from public, anon, authenticated;
revoke all on function public.guard_team_update() from public, anon, authenticated;
revoke all on function public.employee_directory(uuid, text, integer) from public, anon;
grant execute on function public.employee_directory(uuid, text, integer) to authenticated, service_role;
revoke all on function public.expected_reviewers(uuid) from public, anon;
grant execute on function public.expected_reviewers(uuid) to authenticated, service_role;
revoke all on function public.import_namelist(uuid, jsonb) from public, anon;
grant execute on function public.import_namelist(uuid, jsonb) to authenticated, service_role;
