-- HR review actions (SPEC 4, 7). Each writes review_versions and audit_log.

create function public.require_hr() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_hr() then raise exception 'forbidden' using errcode = '42501'; end if;
end;
$$;

create function public.record_version(p_review_id uuid, p_action text, p_comment text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_version integer;
begin
  update public.reviews set version = version + 1 where id = p_review_id returning version into v_version;
  insert into public.review_versions (review_id, version, action, snapshot, actor, comment)
  values (p_review_id, v_version, p_action, public.review_snapshot_json(p_review_id), auth.uid(), p_comment);
end;
$$;

create function public.record_audit(p_action text, p_entity text, p_entity_id text, p_detail jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_detail);
$$;

create function public.hr_team_overview(p_cycle_id uuid)
returns table (
  reviewer_id bigint, full_name text, local_name text, direct_count bigint, key_count bigint, complete_count bigint,
  status text, last_updated timestamptz, discussion_status text, discussion_date date,
  reopen_requested_at timestamptz, reopen_reason text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_hr();
  return query
    with teams as (
      select p.supervisor_id as rid, count(*) as direct_count
      from public.cycle_population p
      where p.cycle_id = p_cycle_id and p.in_scope and p.supervisor_id <> 0
      group by p.supervisor_id
    ),
    keyed as (
      select r.reviewer_id as rid, count(*) as key_count,
             count(*) filter (where coalesce(array_length(public.review_missing_steps(r.id), 1), 0) = 0) as complete_count,
             max(r.updated_at) as last_updated
      from public.reviews r
      where r.cycle_id = p_cycle_id and r.is_key_talent
      group by r.reviewer_id
    )
    select t.rid, e.full_name, e.local_name, t.direct_count,
           coalesce(k.key_count, 0), coalesce(k.complete_count, 0),
           coalesce(s.status, 'draft'), k.last_updated,
           coalesce(s.discussion_status, 'not_scheduled'), s.discussion_date,
           s.reopen_requested_at, s.reopen_reason
    from teams t
    join public.employees e on e.employee_id = t.rid
    left join keyed k on k.rid = t.rid
    left join public.team_submissions s on s.cycle_id = p_cycle_id and s.reviewer_id = t.rid
    order by e.full_name;
end;
$$;

-- Returns chosen people only; everyone else on the team stays submitted (SPEC 4).
create function public.hr_return_reviews(p_cycle_id uuid, p_reviewer_id bigint, p_items jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_item record;
  v_count integer := 0;
begin
  perform public.require_hr();
  for v_item in
    select x.review_id, x.comment from jsonb_to_recordset(p_items) as x(review_id uuid, comment text)
  loop
    if coalesce(btrim(v_item.comment), '') = '' then
      raise exception 'comment_required' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.reviews r
      where r.id = v_item.review_id and r.cycle_id = p_cycle_id and r.reviewer_id = p_reviewer_id and r.status = 'submitted'
        and r.id in (select a.review_id from public.my_readable_reviews() a)
    ) then
      raise exception 'review_not_returnable' using errcode = 'P0001';
    end if;
    update public.reviews set status = 'returned' where id = v_item.review_id;
    insert into public.review_comments (review_id, author, body) values (v_item.review_id, auth.uid(), btrim(v_item.comment));
    perform public.record_version(v_item.review_id, 'return', btrim(v_item.comment));
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'nothing_selected' using errcode = 'P0001'; end if;
  update public.team_submissions set status = 'returned' where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id;
  perform public.record_audit('reviews_returned', 'team', p_reviewer_id::text, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

create function public.hr_confirm_team(p_cycle_id uuid, p_reviewer_id bigint) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_rec record;
  v_count integer := 0;
begin
  perform public.require_hr();
  if not exists (
    select 1 from public.team_submissions
    where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id and status = 'submitted'
  ) then
    raise exception 'team_not_submitted' using errcode = 'P0001';
  end if;
  for v_rec in
    select id from public.reviews where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id and status = 'submitted'
  loop
    update public.reviews set status = 'confirmed', confirmed_at = now() where id = v_rec.id;
    perform public.record_version(v_rec.id, 'confirm');
    v_count := v_count + 1;
  end loop;
  update public.team_submissions set status = 'confirmed' where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id;
  perform public.record_audit('team_confirmed', 'team', p_reviewer_id::text, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

create function public.hr_lock_team(p_cycle_id uuid, p_reviewer_id bigint) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_rec record;
  v_count integer := 0;
begin
  perform public.require_hr();
  if not exists (
    select 1 from public.team_submissions
    where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id and status = 'confirmed'
  ) then
    raise exception 'team_not_confirmed' using errcode = 'P0001';
  end if;
  for v_rec in
    select id from public.reviews where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id and status = 'confirmed'
  loop
    update public.reviews set status = 'locked', locked_at = now() where id = v_rec.id;
    perform public.record_version(v_rec.id, 'lock');
    v_count := v_count + 1;
  end loop;
  update public.team_submissions set status = 'locked', reopen_requested_at = null, reopen_reason = null
   where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id;
  perform public.record_audit('team_locked', 'team', p_reviewer_id::text, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

create function public.hr_unlock_team(p_cycle_id uuid, p_reviewer_id bigint, p_target text) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_rec record;
  v_count integer := 0;
begin
  perform public.require_hr();
  if p_target not in ('confirmed', 'draft') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.team_submissions
    where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id and status = 'locked'
  ) then
    raise exception 'team_not_locked' using errcode = 'P0001';
  end if;
  for v_rec in
    select id from public.reviews where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id and status = 'locked'
  loop
    update public.reviews set status = p_target, locked_at = null where id = v_rec.id;
    perform public.record_version(v_rec.id, 'unlock');
    v_count := v_count + 1;
  end loop;
  update public.team_submissions set status = p_target where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id;
  perform public.record_audit('team_unlocked', 'team', p_reviewer_id::text, jsonb_build_object('count', v_count, 'target', p_target));
  return v_count;
end;
$$;

-- p_employee_ids null reopens the whole team; otherwise only the named people (SPEC 4).
create function public.hr_decide_reopen(
  p_cycle_id uuid, p_reviewer_id bigint, p_approve boolean, p_employee_ids bigint[] default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_rec record;
  v_count integer := 0;
begin
  perform public.require_hr();
  if not exists (
    select 1 from public.team_submissions
    where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id and reopen_requested_at is not null
  ) then
    raise exception 'no_reopen_request' using errcode = 'P0001';
  end if;

  if p_approve then
    for v_rec in
      select id from public.reviews
      where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id and status in ('submitted', 'confirmed')
        and (p_employee_ids is null or employee_id = any (p_employee_ids))
    loop
      update public.reviews set status = 'draft' where id = v_rec.id;
      perform public.record_version(v_rec.id, 'reopen');
      v_count := v_count + 1;
    end loop;
    update public.team_submissions
       set status = 'draft', reopen_requested_at = null, reopen_reason = null
     where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id;
  else
    update public.team_submissions
       set reopen_requested_at = null, reopen_reason = null
     where cycle_id = p_cycle_id and reviewer_id = p_reviewer_id;
  end if;

  perform public.record_audit(
    case when p_approve then 'reopen_approved' else 'reopen_rejected' end,
    'team', p_reviewer_id::text, jsonb_build_object('count', v_count)
  );
  return v_count;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'hr_team_overview(uuid)', 'hr_return_reviews(uuid, bigint, jsonb)', 'hr_confirm_team(uuid, bigint)',
    'hr_lock_team(uuid, bigint)', 'hr_unlock_team(uuid, bigint, text)',
    'hr_decide_reopen(uuid, bigint, boolean, bigint[])'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  foreach f in array array['require_hr()', 'record_version(uuid, text, text)', 'record_audit(text, text, text, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
