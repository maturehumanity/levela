-- Optional client-side E2EE for user-to-user private DMs (not used for agent threads).
-- Call audio/video remains WebRTC SRTP between peers; signaling is still server-mediated.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS messaging_x25519_public_key text;

COMMENT ON COLUMN public.profiles.messaging_x25519_public_key IS
  'Curve25519 public key (base64, 32 raw bytes). Private key is stored only on the user device (IndexedDB), not in this database.';

ALTER TABLE public.private_messages
  DROP CONSTRAINT IF EXISTS private_messages_content_length;

ALTER TABLE public.private_messages
  ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'plaintext';

ALTER TABLE public.private_messages
  DROP CONSTRAINT IF EXISTS private_messages_message_kind_check;

ALTER TABLE public.private_messages
  ADD CONSTRAINT private_messages_message_kind_check
  CHECK (message_kind IN ('plaintext', 'e2ee_v1'));

ALTER TABLE public.private_messages
  ADD COLUMN IF NOT EXISTS cipher_nonce text,
  ADD COLUMN IF NOT EXISTS cipher_text text;

ALTER TABLE public.private_messages
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.private_messages
  DROP CONSTRAINT IF EXISTS private_messages_body_kind_check;

ALTER TABLE public.private_messages
  ADD CONSTRAINT private_messages_body_kind_check CHECK (
    (
      message_kind = 'plaintext'
      AND content IS NOT NULL
      AND char_length(content) <= 5000
      AND cipher_nonce IS NULL
      AND cipher_text IS NULL
    )
    OR (
      message_kind = 'e2ee_v1'
      AND content IS NULL
      AND cipher_nonce IS NOT NULL
      AND cipher_text IS NOT NULL
      AND char_length(cipher_nonce) <= 128
      AND char_length(cipher_text) <= 16000
    )
  );

COMMENT ON COLUMN public.private_messages.message_kind IS 'plaintext = server-readable body in content; e2ee_v1 = ciphertext only.';

-- Do not register ciphertext into content governance (no plaintext to classify).
CREATE OR REPLACE FUNCTION public.sync_private_message_content_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.delete_content_item_from_source('private_messages', OLD.id);
    RETURN OLD;
  END IF;

  IF NEW.message_kind = 'e2ee_v1' THEN
    RETURN NEW;
  END IF;

  PERFORM public.upsert_content_item_from_source(
    'private_messages',
    NEW.id,
    NEW.sender_id,
    'direct_message',
    NULL,
    NEW.content,
    'none',
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'is_edited', coalesce(NEW.is_edited, false),
      'edited_at', NEW.edited_at
    )
  );

  RETURN NEW;
END;
$$;

-- OUT parameter set changed; replace requires drop first on upgrade paths.
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
