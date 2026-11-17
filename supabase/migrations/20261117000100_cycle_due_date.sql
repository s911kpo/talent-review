-- HR can move a cycle's due date at any time (reviews sometimes need more time).
-- Only HR may call it; each change is written to the audit log with the old and new date.

create function public.hr_set_cycle_due(p_cycle_id uuid, p_due_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_old timestamptz;
begin
  perform public.require_hr();
  select due_at into v_old from public.cycles where id = p_cycle_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.cycles set due_at = p_due_at where id = p_cycle_id;
  perform public.record_audit('cycle_due_changed', 'cycle', p_cycle_id::text,
    jsonb_build_object('from', v_old, 'to', p_due_at));
end;
$$;

revoke all on function public.hr_set_cycle_due(uuid, timestamptz) from public, anon;
grant execute on function public.hr_set_cycle_due(uuid, timestamptz) to authenticated, service_role;
