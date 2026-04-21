ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS citizen_signing_public_key text,
  ADD COLUMN IF NOT EXISTS citizen_signing_key_algorithm text,
  ADD COLUMN IF NOT EXISTS citizen_signing_key_registered_at timestamptz;

CREATE TABLE IF NOT EXISTS public.governance_action_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_scope text NOT NULL,
  target_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL,
  signature text NOT NULL,
  public_key text NOT NULL,
  key_algorithm text NOT NULL,
  client_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_action_intents_actor
  ON public.governance_action_intents (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_action_intents_scope
  ON public.governance_action_intents (action_scope, created_at DESC);

GRANT SELECT, INSERT ON public.governance_action_intents TO authenticated;

ALTER TABLE public.governance_action_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance action intents are readable by authenticated users" ON public.governance_action_intents;
CREATE POLICY "Governance action intents are readable by authenticated users" ON public.governance_action_intents
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance action intents are insertable by actor" ON public.governance_action_intents;
CREATE POLICY "Governance action intents are insertable by actor" ON public.governance_action_intents
  FOR INSERT WITH CHECK (actor_id = public.current_profile_id());
