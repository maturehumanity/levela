-- PostgreSQL truncates unquoted identifiers to 63 bytes. The prior migration defined
-- function names longer than 63 characters, so the catalog stored truncated spellings
-- that did not match PostgREST RPC paths used by the app. Rename to explicit short names.

ALTER FUNCTION public.governance_public_audit_verifier_federation_package_with_digest(uuid, text)
  RENAME TO governance_public_audit_verifier_federation_pkg_digest_text;

ALTER FUNCTION public.governance_public_audit_verifier_federation_distribution_packag(uuid, integer)
  RENAME TO governance_public_audit_verifier_federation_dist_pkg_history;

GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_pkg_digest_text(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_dist_pkg_history(uuid, integer) TO authenticated;
