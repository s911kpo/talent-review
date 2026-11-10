-- Site-wide averages for the manager dashboard (SPEC 8.3): numbers only, submitted work only.
create function public.plant_averages(p_cycle_id uuid)
returns table (
  key_pct numeric, med_high_pct numeric, coverage_pct numeric, plan_complete_pct numeric, not_discussed_pct numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.app_users u where u.user_id = auth.uid() and u.is_active) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    with done as (
      select r.* from public.reviews r
      where r.cycle_id = p_cycle_id and r.is_key_talent and r.status in ('submitted', 'confirmed', 'locked')
    ),
    scope_n as (
      select count(*)::numeric as n from public.cycle_population p where p.cycle_id = p_cycle_id and p.in_scope
    ),
    flags as (
      select
        d.is_critical_role as critical,
        d.retention_risk in ('Medium', 'High') as med_high,
        d.aspirations_not_discussed as not_discussed,
        exists (select 1 from public.successors s where s.review_id = d.id and s.readiness = 'Ready Now') as ready_now,
        jsonb_array_length(d.development_areas) > 0
          and not ('DEV_PLAN' = any (public.review_missing_steps(d.id))) as plan_complete
      from done d
    )
    select
      case when (select n from scope_n) = 0 then null
           else (select count(*) from flags) * 100 / (select n from scope_n) end,
      case when (select count(*) from flags) = 0 then null
           else (select count(*) filter (where med_high) from flags) * 100.0 / (select count(*) from flags) end,
      case when (select count(*) filter (where critical) from flags) = 0 then null
           else (select count(*) filter (where critical and ready_now) from flags) * 100.0
                / (select count(*) filter (where critical) from flags) end,
      case when (select count(*) from flags) = 0 then null
           else (select count(*) filter (where plan_complete) from flags) * 100.0 / (select count(*) from flags) end,
      case when (select count(*) from flags) = 0 then null
           else (select count(*) filter (where not_discussed) from flags) * 100.0 / (select count(*) from flags) end;
end;
$$;

revoke all on function public.plant_averages(uuid) from public, anon;
grant execute on function public.plant_averages(uuid) to authenticated, service_role;
