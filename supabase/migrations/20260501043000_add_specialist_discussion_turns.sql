create table if not exists public.specialist_discussion_turns (
  id text primary key,
  session_id text not null references public.specialist_discussion_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  turn_created_at timestamptz not null,
  request_text text not null,
  mode text not null,
  risk_level text not null,
  urgency text not null,
  confidence double precision not null,
  lead_specialist_id text not null,
  matched_specialist_ids text[] not null default '{}',
  matched_keywords text[] not null default '{}',
  final_suggestion text not null,
  opinion_summaries jsonb not null default '[]'::jsonb,
  turn_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists specialist_discussion_turns_profile_created_idx
  on public.specialist_discussion_turns (profile_id, turn_created_at desc);

create index if not exists specialist_discussion_turns_session_created_idx
  on public.specialist_discussion_turns (session_id, turn_created_at asc);

create index if not exists specialist_discussion_turns_mode_risk_idx
  on public.specialist_discussion_turns (mode, risk_level);

create index if not exists specialist_discussion_turns_lead_specialist_idx
  on public.specialist_discussion_turns (lead_specialist_id);

alter table public.specialist_discussion_turns enable row level security;

drop policy if exists "Users can read their specialist discussion turns"
  on public.specialist_discussion_turns;
create policy "Users can read their specialist discussion turns"
  on public.specialist_discussion_turns
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = specialist_discussion_turns.profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their specialist discussion turns"
  on public.specialist_discussion_turns;
create policy "Users can insert their specialist discussion turns"
  on public.specialist_discussion_turns
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = specialist_discussion_turns.profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their specialist discussion turns"
  on public.specialist_discussion_turns;
create policy "Users can delete their specialist discussion turns"
  on public.specialist_discussion_turns
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = specialist_discussion_turns.profile_id
        and p.user_id = auth.uid()
    )
  );
