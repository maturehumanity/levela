-- Fix "infinite recursion detected in policy for relation private_conversation_members".
-- The SELECT policy scanned private_conversation_members again inside its own USING check,
-- so any policy that read members (e.g. private_messages INSERT) recursed forever.

CREATE OR REPLACE FUNCTION public.private_conversation_includes_profile(
  p_conversation_id uuid,
  p_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.private_conversation_members m
    WHERE m.conversation_id = p_conversation_id
      AND m.profile_id = p_profile_id
  );
$$;

REVOKE ALL ON FUNCTION public.private_conversation_includes_profile(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_conversation_includes_profile(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can read conversation membership" ON public.private_conversation_members;

CREATE POLICY "Members can read conversation membership"
  ON public.private_conversation_members
  FOR SELECT
  USING (
    (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1) IS NOT NULL
    AND public.private_conversation_includes_profile(
      private_conversation_members.conversation_id,
      (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
    )
  );

NOTIFY pgrst, 'reload schema';
