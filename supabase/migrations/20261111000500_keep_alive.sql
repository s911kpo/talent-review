-- Lets the scheduled keep-alive job (GitHub Actions, anon key) run a real database query on the
-- free plan without exposing any data: it returns only the current time.
create function public.keep_alive() returns timestamptz
language sql stable set search_path = ''
as $$ select now() $$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;
