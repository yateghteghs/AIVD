-- AI Voter Desk: reviewer dashboard, anonymous question log, answer feedback.
-- Run AFTER schema.sql: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.
--
-- Security model
--   * The public app (anon key) can only INSERT into questions, feedback and flags.
--     It can never read, change or delete anything.
--   * Reviewers sign in on /admin with an emailed link. A signed-in user can read
--     and triage data only if their account is listed in public.reviewers.
--   * Nothing here stores names, accounts, phone numbers or IP addresses of voters.

-- ---------------------------------------------------------------------------
-- Reviewers (who may use the dashboard)
-- ---------------------------------------------------------------------------
create table if not exists public.reviewers (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  email     text not null,
  added_at  timestamptz not null default now()
);
alter table public.reviewers enable row level security;
revoke all on public.reviewers from anon, authenticated;
grant select on public.reviewers to authenticated;

-- security definer so policies can check membership without exposing the table
create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.reviewers r where r.user_id = auth.uid());
$$;
revoke all on function public.is_reviewer() from public;
grant execute on function public.is_reviewer() to anon, authenticated;

drop policy if exists "reviewers see themselves" on public.reviewers;
create policy "reviewers see themselves"
  on public.reviewers for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Anonymous question log
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  question    text not null,
  lang        text,
  type        text,
  basis       text,
  reason      text,
  citations   jsonb,
  corpus      text
);
alter table public.questions enable row level security;

drop policy if exists "public can log questions" on public.questions;
create policy "public can log questions"
  on public.questions for insert
  to anon
  with check (
    char_length(question) between 1 and 600
    and lang in ('en', 'pcm')
    and type in ('answer', 'not_covered', 'refused')
    and (basis is null or basis in ('act', 'guidance'))
    and (citations is null or jsonb_array_length(citations) <= 10)
  );

drop policy if exists "reviewers read questions" on public.questions;
create policy "reviewers read questions"
  on public.questions for select
  to authenticated
  using (public.is_reviewer());

revoke all on public.questions from anon, authenticated;
grant insert on public.questions to anon;
grant select on public.questions to authenticated;
create index if not exists questions_created_at_idx on public.questions (created_at desc);

-- ---------------------------------------------------------------------------
-- Thumbs up / down on answers
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  question_id  uuid,               -- matches questions.id when the question was logged
  rating       smallint not null,
  question     text,
  lang         text,
  type         text
);
alter table public.feedback enable row level security;

drop policy if exists "public can rate answers" on public.feedback;
create policy "public can rate answers"
  on public.feedback for insert
  to anon
  with check (
    rating in (-1, 1)
    and char_length(coalesce(question, '')) <= 600
    and (lang is null or lang in ('en', 'pcm'))
    and (type is null or type in ('answer', 'not_covered', 'refused'))
  );

drop policy if exists "reviewers read feedback" on public.feedback;
create policy "reviewers read feedback"
  on public.feedback for select
  to authenticated
  using (public.is_reviewer());

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon;
grant select on public.feedback to authenticated;
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- ---------------------------------------------------------------------------
-- Flags: reviewers can read and triage
-- ---------------------------------------------------------------------------
alter table public.flags add column if not exists reviewed_at timestamptz;

drop policy if exists "reviewers read flags" on public.flags;
create policy "reviewers read flags"
  on public.flags for select
  to authenticated
  using (public.is_reviewer());

drop policy if exists "reviewers triage flags" on public.flags;
create policy "reviewers triage flags"
  on public.flags for update
  to authenticated
  using (public.is_reviewer())
  with check (public.is_reviewer() and status in ('open', 'resolved', 'wont_fix', 'needs_test'));

revoke all on public.flags from authenticated;
grant select on public.flags to authenticated;
-- reviewers may change only the triage columns, never what the voter submitted
grant update (status, reviewer, resolution, reviewed_at) on public.flags to authenticated;

-- ---------------------------------------------------------------------------
-- Adding a reviewer (run after inviting them in Authentication -> Users):
--   insert into public.reviewers (user_id, email)
--   select id, email from auth.users where email = 'reviewer@example.org'
--   on conflict do nothing;
-- ---------------------------------------------------------------------------
