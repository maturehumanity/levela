-- Persistent private-message blocking with RLS-enforced visibility/sending rules.

CREATE TABLE IF NOT EXISTS public.private_message_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_message_blocks_no_self CHECK (blocker_id <> blocked_id),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_private_message_blocks_blocked
  ON public.private_message_blocks (blocked_id);

ALTER TABLE public.private_message_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own private blocks" ON public.private_message_blocks;
CREATE POLICY "Users can read own private blocks"
  ON public.private_message_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = private_message_blocks.blocker_id
        AND me.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own private blocks" ON public.private_message_blocks;
CREATE POLICY "Users can insert own private blocks"
  ON public.private_message_blocks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = private_message_blocks.blocker_id
        AND me.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own private blocks" ON public.private_message_blocks;
CREATE POLICY "Users can delete own private blocks"
  ON public.private_message_blocks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = private_message_blocks.blocker_id
        AND me.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.private_is_blocked_pair(profile_a uuid, profile_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.private_message_blocks b
    WHERE (b.blocker_id = profile_a AND b.blocked_id = profile_b)
       OR (b.blocker_id = profile_b AND b.blocked_id = profile_a)
  );
$$;

CREATE OR REPLACE FUNCTION public.private_list_my_blocked_profiles()
RETURNS TABLE (blocked_profile_id uuid, blocked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.id AS profile_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  SELECT b.blocked_id AS blocked_profile_id, b.created_at AS blocked_at
  FROM public.private_message_blocks b
  JOIN me ON me.profile_id = b.blocker_id
  ORDER BY b.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.private_block_profile(target_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.id INTO my_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF my_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF target_profile_id IS NULL OR target_profile_id = my_profile_id THEN
    RAISE EXCEPTION 'Invalid target';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = target_profile_id) THEN
    RAISE EXCEPTION 'Target not found';
  END IF;

  INSERT INTO public.private_message_blocks (blocker_id, blocked_id)
  VALUES (my_profile_id, target_profile_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.private_unblock_profile(target_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.id INTO my_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF my_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  DELETE FROM public.private_message_blocks
  WHERE blocker_id = my_profile_id
    AND blocked_id = target_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.private_list_my_blocked_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_list_my_blocked_profiles() TO authenticated;

REVOKE ALL ON FUNCTION public.private_block_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_block_profile(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.private_unblock_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_unblock_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "Participants can read private messages" ON public.private_messages;
CREATE POLICY "Participants can read private messages"
  ON public.private_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.private_conversation_members mine
      JOIN public.profiles me ON me.id = mine.profile_id
      WHERE mine.conversation_id = private_messages.conversation_id
        AND me.user_id = auth.uid()
        AND NOT public.private_is_blocked_pair(mine.profile_id, private_messages.sender_id)
    )
  );

DROP POLICY IF EXISTS "Participants can send private messages as self" ON public.private_messages;
DROP POLICY IF EXISTS "Participants can send private messages as self (member-only)" ON public.private_messages;
CREATE POLICY "Participants can send private messages as self (member-only)"
  ON public.private_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.private_conversation_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.conversation_id = private_messages.conversation_id
        AND p.user_id = auth.uid()
        AND m.profile_id = private_messages.sender_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.private_conversation_members other
      WHERE other.conversation_id = private_messages.conversation_id
        AND other.profile_id <> private_messages.sender_id
        AND public.private_is_blocked_pair(other.profile_id, private_messages.sender_id)
    )
  );
