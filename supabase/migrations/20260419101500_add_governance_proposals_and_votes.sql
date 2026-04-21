DO $$
BEGIN
  CREATE TYPE public.governance_decision_class AS ENUM (
    'ordinary',
    'elevated',
    'constitutional'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.governance_proposal_status AS ENUM (
    'open',
    'approved',
    'rejected',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.governance_vote_choice AS ENUM (
    'approve',
    'reject',
    'abstain'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  proposal_type text NOT NULL DEFAULT 'general',
  decision_class public.governance_decision_class NOT NULL DEFAULT 'ordinary',
  status public.governance_proposal_status NOT NULL DEFAULT 'open',
  proposer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  eligible_voter_count_snapshot integer NOT NULL DEFAULT 0 CHECK (eligible_voter_count_snapshot >= 0),
  required_quorum integer NOT NULL DEFAULT 1 CHECK (required_quorum >= 1),
  approval_threshold numeric(5,2) NOT NULL DEFAULT 0.50 CHECK (approval_threshold >= 0 AND approval_threshold <= 1),
  bootstrap_mode boolean NOT NULL DEFAULT false,
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  final_decision_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_proposals_window_check CHECK (closes_at >= opens_at)
);

CREATE TABLE IF NOT EXISTS public.governance_proposal_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  choice public.governance_vote_choice NOT NULL,
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 0),
  rationale text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, voter_id)
);

CREATE TABLE IF NOT EXISTS public.governance_proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_proposals_status
  ON public.governance_proposals (status, decision_class, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposals_proposer
  ON public.governance_proposals (proposer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_votes_proposal
  ON public.governance_proposal_votes (proposal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_events_proposal
  ON public.governance_proposal_events (proposal_id, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposals_updated_at
    BEFORE UPDATE ON public.governance_proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposal_votes_updated_at
    BEFORE UPDATE ON public.governance_proposal_votes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.governance_proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_proposal_votes TO authenticated;
GRANT SELECT, INSERT ON public.governance_proposal_events TO authenticated;

ALTER TABLE public.governance_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance proposals are readable by authenticated users" ON public.governance_proposals;
CREATE POLICY "Governance proposals are readable by authenticated users" ON public.governance_proposals
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance proposals are insertable by current profile" ON public.governance_proposals;
CREATE POLICY "Governance proposals are insertable by current profile" ON public.governance_proposals
  FOR INSERT WITH CHECK (proposer_id = public.current_profile_id());

DROP POLICY IF EXISTS "Governance proposals are updatable by proposer or admins" ON public.governance_proposals;
CREATE POLICY "Governance proposals are updatable by proposer or admins" ON public.governance_proposals
  FOR UPDATE USING (
    proposer_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    proposer_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Governance votes are readable by authenticated users" ON public.governance_proposal_votes;
CREATE POLICY "Governance votes are readable by authenticated users" ON public.governance_proposal_votes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance votes are insertable by voter" ON public.governance_proposal_votes;
CREATE POLICY "Governance votes are insertable by voter" ON public.governance_proposal_votes
  FOR INSERT WITH CHECK (voter_id = public.current_profile_id());

DROP POLICY IF EXISTS "Governance votes are updatable by voter" ON public.governance_proposal_votes;
CREATE POLICY "Governance votes are updatable by voter" ON public.governance_proposal_votes
  FOR UPDATE USING (voter_id = public.current_profile_id())
  WITH CHECK (voter_id = public.current_profile_id());

DROP POLICY IF EXISTS "Governance events are readable by authenticated users" ON public.governance_proposal_events;
CREATE POLICY "Governance events are readable by authenticated users" ON public.governance_proposal_events
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance events are insertable by actor" ON public.governance_proposal_events;
CREATE POLICY "Governance events are insertable by actor" ON public.governance_proposal_events
  FOR INSERT WITH CHECK (
    actor_id = public.current_profile_id()
    OR (
      actor_id IS NULL
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
      )
    )
  );
