-- Section 14 step 3: tie execution readiness to client-verifiable distribution signatures
-- when trust-minimized relay quorum is required by policy.

CREATE OR REPLACE FUNCTION public.governance_proposal_meets_guardian_relay_distribution_gate(
  target_proposal_id uuid
)
RETURNS boolean AS $$
WITH relay_policy AS (
  SELECT coalesce(relay_policy.require_trust_minimized_quorum, false) AS require_trust_minimized_quorum
  FROM public.governance_guardian_relay_policies AS relay_policy
  WHERE relay_policy.policy_key = 'guardian_relay_default'
  ORDER BY relay_policy.updated_at DESC, relay_policy.created_at DESC, relay_policy.id DESC
  LIMIT 1
),
fallback_policy AS (
  SELECT false AS require_trust_minimized_quorum
  WHERE NOT EXISTS (SELECT 1 FROM relay_policy)
),
effective_policy AS (
  SELECT * FROM relay_policy
  UNION ALL
  SELECT * FROM fallback_policy
),
distribution_summary AS (
  SELECT coalesce(summary.distribution_ready, false) AS distribution_ready
  FROM public.governance_proposal_guardian_relay_client_verification_distribution_summary(target_proposal_id) AS summary
  LIMIT 1
)
SELECT CASE
  WHEN coalesce((SELECT require_trust_minimized_quorum FROM effective_policy LIMIT 1), false) = false THEN true
  ELSE coalesce((SELECT distribution_ready FROM distribution_summary LIMIT 1), false)
END;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.governance_proposal_meets_guardian_relay_distribution_gate(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.governance_proposal_is_execution_ready(
  target_proposal_id uuid
)
RETURNS boolean AS $$
  SELECT coalesce(
    EXISTS (
      SELECT 1
      FROM public.governance_proposals AS proposal
      WHERE proposal.id = target_proposal_id
        AND proposal.status = 'approved'::public.governance_proposal_status
        AND public.governance_proposal_meets_execution_threshold(proposal.id)
        AND public.governance_proposal_meets_guardian_signoff(proposal.id)
        AND public.governance_proposal_meets_verifier_federation_distribution_gate(proposal.id)
        AND public.governance_proposal_meets_guardian_relay_distribution_gate(proposal.id)
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;
