create table if not exists public.specialist_discussion_sessions (
  id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Specialist discussion',
  turns_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists specialist_discussion_sessions_profile_updated_idx
  on public.specialist_discussion_sessions (profile_id, updated_at desc);

alter table public.specialist_discussion_sessions enable row level security;

drop policy if exists "Users can read their specialist discussions"
  on public.specialist_discussion_sessions;
create policy "Users can read their specialist discussions"
  on public.specialist_discussion_sessions
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = specialist_discussion_sessions.profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their specialist discussions"
  on public.specialist_discussion_sessions;
create policy "Users can insert their specialist discussions"
  on public.specialist_discussion_sessions
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = specialist_discussion_sessions.profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their specialist discussions"
  on public.specialist_discussion_sessions;
create policy "Users can update their specialist discussions"
  on public.specialist_discussion_sessions
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = specialist_discussion_sessions.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = specialist_discussion_sessions.profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their specialist discussions"
  on public.specialist_discussion_sessions;
create policy "Users can delete their specialist discussions"
  on public.specialist_discussion_sessions
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = specialist_discussion_sessions.profile_id
        and p.user_id = auth.uid()
    )
  );
