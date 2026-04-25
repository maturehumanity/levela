-- Let Nela (system assistant profile) participate in governance discussions and advisory voting.

create or replace function public.nela_governance_participation_comment(
  proposal_title text,
  proposal_summary text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  return format(
    'Nela advisory note: this proposal ("%s") is logged for transparent civic review. Members should evaluate the summary, evidence, and implementation impact before final decisions.',
    coalesce(nullif(trim(proposal_title), ''), left(coalesce(proposal_summary, 'Untitled proposal'), 80))
  );
end;
$$;

create or replace function public.ensure_nela_governance_participation(
  target_proposal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nela_profile_id constant uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  proposal_record public.governance_proposals%rowtype;
  advisory_comment text;
begin
  select * into proposal_record
  from public.governance_proposals
  where id = target_proposal_id;

  if proposal_record.id is null then
    return;
  end if;

  advisory_comment := public.nela_governance_participation_comment(
    proposal_record.title,
    proposal_record.summary
  );

  insert into public.governance_proposal_votes (
    proposal_id,
    voter_id,
    choice,
    weight,
    rationale,
    snapshot
  )
  values (
    proposal_record.id,
    nela_profile_id,
    'abstain'::public.governance_vote_choice,
    0,
    'Nela advisory abstention: members should decide through civic governance.',
    jsonb_build_object(
      'source', 'nela_governance_participation',
      'advisory', true
    )
  )
  on conflict (proposal_id, voter_id) do nothing;

  insert into public.governance_proposal_events (
    proposal_id,
    actor_id,
    event_type,
    payload
  )
  values (
    proposal_record.id,
    nela_profile_id,
    'discussion.nela',
    jsonb_build_object(
      'comment', advisory_comment,
      'advisory', true,
      'vote_choice', 'abstain'
    )
  );
end;
$$;

create or replace function public.on_governance_proposal_created_nela_participation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_nela_governance_participation(new.id);
  return new;
end;
$$;

drop trigger if exists governance_proposals_nela_participation on public.governance_proposals;
create trigger governance_proposals_nela_participation
after insert on public.governance_proposals
for each row
execute function public.on_governance_proposal_created_nela_participation();

-- Backfill existing proposals that do not yet include Nela participation.
do $$
declare
  proposal_row record;
begin
  for proposal_row in
    select id
    from public.governance_proposals
  loop
    perform public.ensure_nela_governance_participation(proposal_row.id);
  end loop;
end;
$$;
