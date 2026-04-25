-- Private DMs and agent threads: allow inserts for conversation members sending as themselves.
-- The previous policy also required message.create (used for the legacy public messages stream);
-- many signed-in users lacked that permission, so inserts failed with RLS and the client showed Retry.

DROP POLICY IF EXISTS "Participants can send private messages as self" ON public.private_messages;

CREATE POLICY "Participants can send private messages as self"
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
  );

NOTIFY pgrst, 'reload schema';
