-- Post likes for feed interactions
CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post likes are viewable by everyone" ON public.post_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create post likes" ON public.post_likes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = user_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their own post likes" ON public.post_likes
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = user_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE INDEX idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON public.post_likes(user_id);

-- Post comments for feed interactions
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post comments are viewable by everyone" ON public.post_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create post comments" ON public.post_comments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = author_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit their own post comments" ON public.post_comments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = author_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own post comments" ON public.post_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = author_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE INDEX idx_post_comments_post_created ON public.post_comments(post_id, created_at DESC);
CREATE INDEX idx_post_comments_author_id ON public.post_comments(author_id);
