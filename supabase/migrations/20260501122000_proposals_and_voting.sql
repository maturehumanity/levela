-- Proposals and voting tables and RPCs
CREATE TABLE IF NOT EXISTS public.governance_proposals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposal_key text NOT NULL UNIQUE);
