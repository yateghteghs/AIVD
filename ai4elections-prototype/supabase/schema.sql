-- AI Voter Desk: shared review queue for "Flag for review".
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Security model: the public web app (anon key) may only INSERT flags.
-- It cannot read, change or delete them. Reviewers read flags in the
-- Supabase dashboard (Table Editor -> flags), where they can also export CSV.

create table if not exists public.flags (
  id          text primary key,
  created_at  timestamptz not null default now(),
  flagged_at  timestamptz,
  category    text,
  note        text,
  question    text not null,
  lang        text,
  type        text,
  reason      text,
  answer      text,
  citations   jsonb,
  corpus      text,
  status      text not null default 'open',
  reviewer    text,
  resolution  text
);

alter table public.flags enable row level security;

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
    and lang in ('en', 'pcm')
    and type in ('answer', 'not_covered', 'refused')
  );

revoke all on public.flags from anon;
grant insert on public.flags to anon;

create index if not exists flags_created_at_idx on public.flags (created_at desc);
create index if not exists flags_status_idx on public.flags (status);
