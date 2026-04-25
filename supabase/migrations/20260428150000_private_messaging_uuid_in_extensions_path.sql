-- uuid_generate_v5 lives in schema "extensions" (uuid-ossp). These RPCs used search_path = public only.

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

REVOKE ALL ON FUNCTION public.private_get_or_create_direct_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_get_or_create_direct_conversation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.private_get_or_create_agent_conversation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_get_or_create_agent_conversation() TO authenticated;

NOTIFY pgrst, 'reload schema';
