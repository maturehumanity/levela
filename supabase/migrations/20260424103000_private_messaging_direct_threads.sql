-- Private 1:1 messaging (WhatsApp-style) + per-user agent thread.
-- Legacy public.messages is no longer readable by normal clients (moderators may read).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Agent profile (no auth.users row; appears like any other contact)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_system_agent boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_agent_consistency;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_agent_consistency CHECK (
    (is_system_agent = true AND user_id IS NULL)
    OR (is_system_agent = false AND user_id IS NOT NULL)
  );

COMMENT ON COLUMN public.profiles.is_system_agent IS 'True for built-in app agents (no linked auth user).';

-- Stable agent identity (referenced by RPCs and app)
INSERT INTO public.profiles (
  id,
  user_id,
  username,
  full_name,
  role,
  is_system_agent,
  is_verified
)
VALUES (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  NULL,
  'levela_guide',
  'Levela Guide',
  'system'::public.app_role,
  true,
  false
)
ON CONFLICT (id) DO UPDATE SET
  username = excluded.username,
  full_name = excluded.full_name,
  role = excluded.role,
  is_system_agent = excluded.is_system_agent,
  user_id = NULL,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Private conversations + messages
-- ---------------------------------------------------------------------------

CREATE TABLE public.private_conversations (
  id uuid NOT NULL PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('direct', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.private_conversations IS 'Private chat threads (1:1 direct or user+app agent).';

CREATE TABLE public.private_conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.private_conversations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, profile_id)
);

CREATE INDEX idx_private_conversation_members_profile
  ON public.private_conversation_members (profile_id);

CREATE TABLE public.private_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.private_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_edited boolean DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_messages_content_length CHECK (char_length(content) <= 5000)
);

CREATE INDEX idx_private_messages_conversation_created
  ON public.private_messages (conversation_id, created_at);

CREATE OR REPLACE FUNCTION public.touch_private_conversation_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.private_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS private_messages_touch_conversation ON public.private_messages;
CREATE TRIGGER private_messages_touch_conversation
  AFTER INSERT ON public.private_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_private_conversation_from_message();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.private_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their private conversations"
  ON public.private_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.private_conversation_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.conversation_id = private_conversations.id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can read conversation membership"
  ON public.private_conversation_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.private_conversation_members self
      JOIN public.profiles p ON p.id = self.profile_id
      WHERE self.conversation_id = private_conversation_members.conversation_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can read private messages"
  ON public.private_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.private_conversation_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.conversation_id = private_messages.conversation_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can send private messages as self"
  ON public.private_messages
  FOR INSERT
  WITH CHECK (
    public.has_permission('message.create'::public.app_permission)
    AND EXISTS (
      SELECT 1
      FROM public.private_conversation_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.conversation_id = private_messages.conversation_id
        AND p.user_id = auth.uid()
        AND m.profile_id = private_messages.sender_id
    )
  );

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER): open or create threads with deterministic ids
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.private_get_or_create_direct_conversation(p_other_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  my_profile_id uuid;
  agent_id uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO my_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF my_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_other_profile_id = my_profile_id THEN
    RAISE EXCEPTION 'Invalid peer';
  END IF;

  IF p_other_profile_id = agent_id THEN
    RAISE EXCEPTION 'Use agent conversation for the guide';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other_profile_id) THEN
    RAISE EXCEPTION 'Peer not found';
  END IF;

  conv_id := uuid_generate_v5(
    '6ba7b814-9dad-11d1-80b4-00c04fd430c8'::uuid,
    'levela-dm:' || LEAST(my_profile_id, p_other_profile_id)::text || ':' ||
      GREATEST(my_profile_id, p_other_profile_id)::text
  );

  INSERT INTO public.private_conversations (id, kind)
  VALUES (conv_id, 'direct')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.private_conversation_members (conversation_id, profile_id)
  VALUES (conv_id, my_profile_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.private_conversation_members (conversation_id, profile_id)
  VALUES (conv_id, p_other_profile_id)
  ON CONFLICT DO NOTHING;

  RETURN conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.private_get_or_create_agent_conversation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  my_profile_id uuid;
  agent_id uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO my_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF my_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  conv_id := uuid_generate_v5(
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
    'levela-agent:' || my_profile_id::text
  );

  INSERT INTO public.private_conversations (id, kind)
  VALUES (conv_id, 'agent')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.private_conversation_members (conversation_id, profile_id)
  VALUES (conv_id, my_profile_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.private_conversation_members (conversation_id, profile_id)
  VALUES (conv_id, agent_id)
  ON CONFLICT DO NOTHING;

  RETURN conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.private_list_my_conversations()
RETURNS TABLE (
  conversation_id uuid,
  kind text,
  peer_profile_id uuid,
  peer_username text,
  peer_full_name text,
  peer_avatar_url text,
  last_content text,
  last_at timestamptz
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
      pm.content AS last_content,
      pm.created_at AS last_at
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
    last_msg.last_at
  FROM peers
  LEFT JOIN last_msg ON last_msg.conversation_id = peers.conversation_id
  ORDER BY
    CASE WHEN peers.kind = 'agent' THEN 0 ELSE 1 END,
    last_msg.last_at DESC NULLS LAST,
    peers.conversation_id DESC;
$$;

REVOKE ALL ON FUNCTION public.private_get_or_create_direct_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_get_or_create_direct_conversation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.private_get_or_create_agent_conversation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_get_or_create_agent_conversation() TO authenticated;

REVOKE ALL ON FUNCTION public.private_list_my_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_list_my_conversations() TO authenticated;

-- ---------------------------------------------------------------------------
-- Legacy public channel: not exposed to clients (moderation may still read)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Messages are viewable by everyone" ON public.messages;

CREATE POLICY "Legacy messages readable by moderators only"
  ON public.messages
  FOR SELECT
  USING (public.has_permission('message.moderate'::public.app_permission));

-- ---------------------------------------------------------------------------
-- Content governance sync for private_messages (direct_message)
-- ---------------------------------------------------------------------------

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

DROP TRIGGER IF EXISTS sync_private_message_content_item ON public.private_messages;
CREATE TRIGGER sync_private_message_content_item
  AFTER INSERT OR UPDATE OR DELETE ON public.private_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_private_message_content_item();

-- ---------------------------------------------------------------------------
-- Realtime (Supabase): allow filtered postgres_changes subscriptions
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
