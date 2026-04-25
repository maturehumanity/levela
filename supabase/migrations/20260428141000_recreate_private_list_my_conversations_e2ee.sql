-- Postgres cannot CREATE OR REPLACE when OUT parameters change; prior partial apply of
-- 20260425143000 left an older signature. Drop and recreate with last_is_e2ee.

DROP FUNCTION IF EXISTS public.private_list_my_conversations();

CREATE FUNCTION public.private_list_my_conversations()
RETURNS TABLE (
  conversation_id uuid,
  kind text,
  peer_profile_id uuid,
  peer_username text,
  peer_full_name text,
  peer_avatar_url text,
  last_content text,
  last_at timestamptz,
  last_is_e2ee boolean
)
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
  ),
  my_conversations AS (
    SELECT c.id, c.kind, c.updated_at
    FROM public.private_conversations c
    JOIN public.private_conversation_members m ON m.conversation_id = c.id
    JOIN me ON m.profile_id = me.profile_id
  ),
  peers AS (
    SELECT
      mc.id AS conversation_id,
      mc.kind,
      p.id AS peer_profile_id,
      p.username AS peer_username,
      p.full_name AS peer_full_name,
      p.avatar_url AS peer_avatar_url
    FROM my_conversations mc
    JOIN public.private_conversation_members other
      ON other.conversation_id = mc.id
    JOIN me ON true
    JOIN public.profiles p ON p.id = other.profile_id
    WHERE other.profile_id <> me.profile_id
  ),
  last_msg AS (
    SELECT DISTINCT ON (pm.conversation_id)
      pm.conversation_id,
      CASE WHEN pm.message_kind = 'e2ee_v1' THEN NULL ELSE pm.content END AS last_content,
      pm.created_at AS last_at,
      (pm.message_kind = 'e2ee_v1') AS last_is_e2ee
    FROM public.private_messages pm
    JOIN my_conversations mc ON mc.id = pm.conversation_id
    ORDER BY pm.conversation_id, pm.created_at DESC
  )
  SELECT
    peers.conversation_id,
    peers.kind,
    peers.peer_profile_id,
    peers.peer_username,
    peers.peer_full_name,
    peers.peer_avatar_url,
    last_msg.last_content,
    last_msg.last_at,
    coalesce(last_msg.last_is_e2ee, false) AS last_is_e2ee
  FROM peers
  LEFT JOIN last_msg ON last_msg.conversation_id = peers.conversation_id
  ORDER BY
    CASE WHEN peers.kind = 'agent' THEN 0 ELSE 1 END,
    last_msg.last_at DESC NULLS LAST,
    peers.conversation_id DESC;
$$;

REVOKE ALL ON FUNCTION public.private_list_my_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_list_my_conversations() TO authenticated;

NOTIFY pgrst, 'reload schema';
