-- AI Voter Desk: roles for the Review Desk team (reviewer / super admin).
-- Run AFTER 002_dashboard.sql: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.
--
-- Super admins manage the team from the Review Desk's Team panel. That panel talks
-- to a Vercel server function (/api/team), which holds the Supabase secret key on
-- the server; browsers never see it.

alter table public.reviewers add column if not exists role text not null default 'reviewer';
alter table public.reviewers drop constraint if exists reviewers_role_check;
alter table public.reviewers add constraint reviewers_role_check check (role in ('reviewer', 'super_admin'));
alter table public.reviewers add column if not exists invited_by text;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.reviewers r where r.user_id = auth.uid() and r.role = 'super_admin');
$$;
revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- Used only by the server function (secret key) to find an existing account by email.
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function public.user_id_by_email(text) from public;
revoke all on function public.user_id_by_email(text) from anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.user_id_by_email(text) to service_role';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Make yourself the first super admin (once), with your own email:
--   update public.reviewers set role = 'super_admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------------
