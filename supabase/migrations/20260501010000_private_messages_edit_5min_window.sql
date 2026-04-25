-- Allow WhatsApp-style self-edit for recent private messages (5-minute window).

DROP POLICY IF EXISTS "Participants can edit own recent private messages" ON public.private_messages;

CREATE POLICY "Participants can edit own recent private messages"
  ON public.private_messages
  FOR UPDATE
  USING (
    public.has_permission('message.create'::public.app_permission)
    AND private_messages.created_at >= now() - interval '5 minutes'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = private_messages.sender_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_permission('message.create'::public.app_permission)
    AND private_messages.created_at >= now() - interval '5 minutes'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = private_messages.sender_id
        AND p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.private_messages_before_update_edit_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Keep immutable message identity fields stable during edit operations.
  NEW.id = OLD.id;
  NEW.conversation_id = OLD.conversation_id;
  NEW.sender_id = OLD.sender_id;
  NEW.created_at = OLD.created_at;
  NEW.message_kind = OLD.message_kind;
  NEW.cipher_nonce = OLD.cipher_nonce;
  NEW.cipher_text = OLD.cipher_text;

  IF coalesce(NEW.content, '') IS DISTINCT FROM coalesce(OLD.content, '') THEN
    NEW.is_edited = true;
    NEW.edited_at = now();
  ELSE
    NEW.is_edited = OLD.is_edited;
    NEW.edited_at = OLD.edited_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_private_messages_before_update_edit_guard ON public.private_messages;
CREATE TRIGGER trg_private_messages_before_update_edit_guard
BEFORE UPDATE ON public.private_messages
FOR EACH ROW
EXECUTE FUNCTION public.private_messages_before_update_edit_guard();
