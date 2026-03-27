-- Messages table for community chat
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages policies
CREATE POLICY "Messages are viewable by everyone" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = sender_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can edit their own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = sender_id AND user_id = auth.uid())
  );

-- Create index for better performance on message queries
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);