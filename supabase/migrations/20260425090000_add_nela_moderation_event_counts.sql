create table if not exists public.nela_moderation_event_counts (
  event_date date not null default ((now() at time zone 'utc')::date),
  category text not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamp with time zone not null default now(),
  constraint nela_moderation_event_counts_category_check check (
    category in (
      'off_topic',
      'greeting',
      'policy_levela_summary',
      'policy_safety',
      'policy_governance',
      'policy_marketplace',
      'policy_privacy',
      'abuse_illegal',
      'abuse_violence',
      'abuse_self_harm',
      'abuse_security_abuse',
      'abuse_harassment',
      'abuse_sexual_minors'
    )
  ),
  constraint nela_moderation_event_counts_pkey primary key (event_date, category)
);

alter table public.nela_moderation_event_counts enable row level security;

create or replace function public.set_nela_moderation_event_counts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nela_moderation_event_counts_updated_at on public.nela_moderation_event_counts;
create trigger trg_nela_moderation_event_counts_updated_at
before update on public.nela_moderation_event_counts
for each row
execute function public.set_nela_moderation_event_counts_updated_at();

create or replace function public.increment_nela_moderation_event_count(target_category text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nela_moderation_event_counts (event_date, category, count)
  values (((now() at time zone 'utc')::date), target_category, 1)
  on conflict (event_date, category)
  do update set count = public.nela_moderation_event_counts.count + 1;
end;
$$;
