-- Private bucket for messaging file / image / short voice uploads (plaintext threads only on client).

INSERT INTO storage.buckets (id, name, public)
VALUES ('messaging-attachments', 'messaging-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Messaging attachments read by conversation members" ON storage.objects;
DROP POLICY IF EXISTS "Messaging attachments insert by conversation members" ON storage.objects;
DROP POLICY IF EXISTS "Messaging attachments delete by conversation members" ON storage.objects;

CREATE POLICY "Messaging attachments read by conversation members"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'messaging-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.private_conversation_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE p.user_id = auth.uid()
        AND (storage.foldername(name))[1] = m.conversation_id::text
    )
  );

CREATE POLICY "Messaging attachments insert by conversation members"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'messaging-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.private_conversation_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE p.user_id = auth.uid()
        AND (storage.foldername(name))[1] = m.conversation_id::text
    )
  );

CREATE POLICY "Messaging attachments delete by conversation members"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'messaging-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.private_conversation_members m
      JOIN public.profiles p ON p.id = m.profile_id
      WHERE p.user_id = auth.uid()
        AND (storage.foldername(name))[1] = m.conversation_id::text
    )
  );
