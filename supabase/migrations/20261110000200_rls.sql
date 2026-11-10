-- Permission isolation (SPEC sections 0.1 and 3). Enforced here, never only in the UI.

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------
create function public.my_employee_id() returns bigint
language sql stable security definer set search_path = ''
as $$
  select employee_id from public.app_users where user_id = auth.uid() and is_active;
$$;

create function public.is_hr() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role = 'hr' from public.app_users where user_id = auth.uid() and is_active),
    false
  );
$$;

-- Everyone the current user may see, per cycle, as 'direct' (editable) or 'line' (read-only).
-- Always excludes the current user. A single uncorrelated call keeps policies fast at 5,000 people.
create function public.my_scope()
returns table (cycle_id uuid, employee_id bigint, scope text)
language sql stable security definer set search_path = ''
as $$
  with recursive me as (
    select public.my_employee_id() as id
  ),
  chain (cycle_id, employee_id) as (
    select p.cycle_id, p.employee_id
    from public.cycle_population p, me
    where me.id is not null and p.supervisor_id = me.id
    union
    select p.cycle_id, p.employee_id
    from public.cycle_population p
    join chain c on c.cycle_id = p.cycle_id and p.supervisor_id = c.employee_id
  )
  select p.cycle_id,
         p.employee_id,
         case when p.supervisor_id = (select id from me) then 'direct' else 'line' end
  from chain c
  join public.cycle_population p on p.cycle_id = c.cycle_id and p.employee_id = c.employee_id
  where p.in_scope and p.employee_id <> (select id from me);
$$;

create function public.direct_scope(p_cycle_id uuid) returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select s.employee_id from public.my_scope() s where s.cycle_id = p_cycle_id and s.scope = 'direct';
$$;

create function public.line_scope(p_cycle_id uuid) returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select s.employee_id from public.my_scope() s where s.cycle_id = p_cycle_id and s.scope = 'line';
$$;

-- Reviews the current user may read, labelled by access level. The single source of truth
-- for reviews and all child tables. No one, HR included, gets the review written about them.
create function public.my_readable_reviews()
returns table (review_id uuid, access text)
language sql stable security definer set search_path = ''
as $$
  select r.id,
         case when public.is_hr() then 'hr' else s.scope end
  from public.reviews r
  left join public.my_scope() s on s.cycle_id = r.cycle_id and s.employee_id = r.employee_id
  where r.employee_id is distinct from public.my_employee_id()
    and (
      public.is_hr()
      or s.scope = 'direct'
      or (s.scope = 'line' and r.status in ('submitted', 'confirmed', 'locked'))
    );
$$;

-- Reviews the current user may change right now.
create function public.my_editable_reviews() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select r.review_id
  from public.my_readable_reviews() r
  join public.reviews rv on rv.id = r.review_id
  join public.cycles c on c.id = rv.cycle_id
  where r.access = 'hr'
     or (r.access = 'direct'
         and rv.status in ('not_selected', 'draft', 'returned')
         and c.status = 'open');
$$;

-- ---------------------------------------------------------------------------
-- Baseline privileges. RLS decides rows; grants decide verbs.
-- TRUNCATE ignores RLS, so it is never granted.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

-- Users may only change their own display preferences, never role or employee link.
revoke insert, update, delete on public.app_users from authenticated;
grant update (locale, font_scale) on public.app_users to authenticated;

-- Written only by the server (service role or security definer functions).
revoke all on public.login_attempts from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.review_versions from authenticated;
revoke insert, update, delete on public.ai_outputs from authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy app_users_select on public.app_users for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_hr()));
create policy app_users_update_own on public.app_users for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy cycles_select on public.cycles for select to authenticated using (true);
create policy cycles_hr_write on public.cycles for all to authenticated
  using ((select public.is_hr())) with check ((select public.is_hr()));

create policy employees_select on public.employees for select to authenticated
  using (
    (select public.is_hr())
    or employee_id = (select public.my_employee_id())
    or employee_id in (select s.employee_id from public.my_scope() s)
  );
create policy employees_hr_write on public.employees for all to authenticated
  using ((select public.is_hr())) with check ((select public.is_hr()));

create policy population_select on public.cycle_population for select to authenticated
  using (
    (select public.is_hr())
    or (cycle_id, employee_id) in (select s.cycle_id, s.employee_id from public.my_scope() s)
  );
create policy population_hr_write on public.cycle_population for all to authenticated
  using ((select public.is_hr())) with check ((select public.is_hr()));

create policy reviews_select on public.reviews for select to authenticated
  using (id in (select r.review_id from public.my_readable_reviews() r));

create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    employee_id is distinct from (select public.my_employee_id())
    and (
      (select public.is_hr())
      or (
        reviewer_id = (select public.my_employee_id())
        and status in ('not_selected', 'draft')
        and (cycle_id, employee_id) in (
          select s.cycle_id, s.employee_id from public.my_scope() s where s.scope = 'direct'
        )
        and cycle_id in (select c.id from public.cycles c where c.status = 'open')
      )
    )
  );

create policy reviews_update on public.reviews for update to authenticated
  using (id in (select public.my_editable_reviews()))
  with check (
    (select public.is_hr())
    or (
      reviewer_id = (select public.my_employee_id())
      and status in ('not_selected', 'draft', 'returned')
    )
  );

create policy reviews_hr_delete on public.reviews for delete to authenticated
  using ((select public.is_hr()) and id in (select r.review_id from public.my_readable_reviews() r));

-- Child tables share one rule set: read follows the review, write needs an editable review.
do $$
declare t text;
begin
  foreach t in array array['next_roles', 'successors', 'dev_plan_items'] loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using (review_id in (select r.review_id from public.my_readable_reviews() r))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check (review_id in (select public.my_editable_reviews()))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using (review_id in (select public.my_editable_reviews()))
         with check (review_id in (select public.my_editable_reviews()))', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated
         using (review_id in (select public.my_editable_reviews()))', t);
  end loop;
end;
$$;

create policy review_versions_hr_select on public.review_versions for select to authenticated
  using (review_id in (select r.review_id from public.my_readable_reviews() r where r.access = 'hr'));

create policy review_comments_select on public.review_comments for select to authenticated
  using (review_id in (select r.review_id from public.my_readable_reviews() r where r.access in ('hr', 'direct')));
create policy review_comments_hr_insert on public.review_comments for insert to authenticated
  with check (review_id in (select r.review_id from public.my_readable_reviews() r where r.access = 'hr'));
create policy review_comments_hr_update on public.review_comments for update to authenticated
  using (review_id in (select r.review_id from public.my_readable_reviews() r where r.access = 'hr'))
  with check (review_id in (select r.review_id from public.my_readable_reviews() r where r.access = 'hr'));
create policy review_comments_hr_delete on public.review_comments for delete to authenticated
  using (review_id in (select r.review_id from public.my_readable_reviews() r where r.access = 'hr'));

create policy team_submissions_select on public.team_submissions for select to authenticated
  using ((select public.is_hr()) or reviewer_id = (select public.my_employee_id()));
create policy team_submissions_insert_own on public.team_submissions for insert to authenticated
  with check (
    (select public.is_hr())
    or (
      reviewer_id = (select public.my_employee_id())
      and status = 'draft'
      and cycle_id in (select c.id from public.cycles c where c.status = 'open')
    )
  );
create policy team_submissions_hr_update on public.team_submissions for update to authenticated
  using ((select public.is_hr())) with check ((select public.is_hr()));
create policy team_submissions_hr_delete on public.team_submissions for delete to authenticated
  using ((select public.is_hr()));

create policy option_lists_select on public.option_lists for select to authenticated using (true);
create policy option_lists_hr_write on public.option_lists for all to authenticated
  using ((select public.is_hr())) with check ((select public.is_hr()));

create policy question_bank_select on public.question_bank for select to authenticated using (true);
create policy question_bank_hr_write on public.question_bank for all to authenticated
  using ((select public.is_hr())) with check ((select public.is_hr()));

create policy ai_outputs_select on public.ai_outputs for select to authenticated
  using ((select public.is_hr()) or created_by = (select auth.uid()));

create policy audit_log_hr_select on public.audit_log for select to authenticated
  using ((select public.is_hr()));

-- login_attempts intentionally has no policy: only the service role touches it.

-- ---------------------------------------------------------------------------
-- Function exposure
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'my_employee_id()', 'is_hr()', 'my_scope()', 'direct_scope(uuid)', 'line_scope(uuid)',
    'my_readable_reviews()', 'my_editable_reviews()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
revoke all on function public.set_row_metadata() from public, anon, authenticated;
