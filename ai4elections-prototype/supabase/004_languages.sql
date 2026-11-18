-- AI Voter Desk: accept questions, ratings and flags in Yoruba, Igbo, Hausa and Tiv.
-- Run AFTER 003_team.sql: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once. Without it, logging in those languages is rejected.

drop policy if exists "public can log questions" on public.questions;
create policy "public can log questions"
  on public.questions for insert
  to anon
  with check (
    char_length(question) between 1 and 600
    and lang in ('en', 'pcm', 'yo', 'ig', 'ha', 'tiv')
    and type in ('answer', 'not_covered', 'refused')
    and (basis is null or basis in ('act', 'guidance'))
    and (citations is null or jsonb_array_length(citations) <= 10)
  );

drop policy if exists "public can rate answers" on public.feedback;
create policy "public can rate answers"
  on public.feedback for insert
  to anon
  with check (
    rating in (-1, 1)
    and char_length(coalesce(question, '')) <= 600
    and (lang is null or lang in ('en', 'pcm', 'yo', 'ig', 'ha', 'tiv'))
    and (type is null or type in ('answer', 'not_covered', 'refused'))
  );

drop policy if exists "public can submit flags" on public.flags;
create policy "public can submit flags"
  on public.flags for insert
  to anon
  with check (
    status = 'open'
    and reviewer is null
    and resolution is null
    and char_length(question) between 1 and 600
    and char_length(coalesce(note, '')) <= 1000
    and char_length(coalesce(answer, '')) <= 4000
    and lang in ('en', 'pcm', 'yo', 'ig', 'ha', 'tiv')
    and type in ('answer', 'not_covered', 'refused')
  );
