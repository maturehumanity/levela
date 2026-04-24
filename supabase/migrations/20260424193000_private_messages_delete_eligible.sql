-- Allow members to delete their own messages, and to delete Nela assistant rows in agent threads.

DROP POLICY IF EXISTS "Members can delete eligible private messages" ON public.private_messages;

CREATE POLICY "Members can delete eligible private messages"
  ON public.private_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.private_conversation_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE m.conversation_id = private_messages.conversation_id
        AND p.user_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles me
        WHERE me.user_id = auth.uid()
          AND me.id = private_messages.sender_id
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.private_conversations c
          WHERE c.id = private_messages.conversation_id
            AND c.kind = 'agent'
        )
        AND private_messages.sender_id = 'a0000000-0000-4000-8000-000000000001'::uuid
      )
    )
  );
