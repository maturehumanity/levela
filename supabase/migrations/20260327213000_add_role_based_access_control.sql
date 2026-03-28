DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'guest',
    'member',
    'verified_member',
    'moderator',
    'market_manager',
    'admin',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'profile.read',
    'profile.update_self',
    'profile.update_any',
    'post.create',
    'post.edit_self',
    'post.delete_self',
    'post.moderate',
    'comment.create',
    'comment.edit_self',
    'comment.delete_self',
    'comment.moderate',
    'message.create',
    'message.edit_self',
    'message.moderate',
    'endorsement.create',
    'endorsement.review',
    'endorsement.moderate',
    'report.create',
    'report.review',
    'market.manage',
    'role.assign',
    'settings.manage',
    'like.create',
    'like.delete_self'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS custom_permissions public.app_permission[] NOT NULL DEFAULT '{}'::public.app_permission[];

UPDATE public.profiles
SET role = CASE
  WHEN is_admin = true THEN 'admin'::public.app_role
  ELSE 'member'::public.app_role
END
WHERE role IS NULL OR role = 'member'::public.app_role;

CREATE OR REPLACE FUNCTION public.sync_legacy_admin_flag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_admin = NEW.role IN ('admin', 'system');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_profiles_admin_flag ON public.profiles;
CREATE TRIGGER sync_profiles_admin_flag
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_legacy_admin_flag();

UPDATE public.profiles
SET is_admin = role IN ('admin', 'system');

CREATE OR REPLACE FUNCTION public.app_role_permissions(target_role public.app_role)
RETURNS public.app_permission[] AS $$
  SELECT CASE target_role
    WHEN 'guest' THEN ARRAY[
      'profile.read'::public.app_permission
    ]
    WHEN 'member' THEN ARRAY[
      'profile.read'::public.app_permission,
      'profile.update_self'::public.app_permission,
      'post.create'::public.app_permission,
      'post.edit_self'::public.app_permission,
      'post.delete_self'::public.app_permission,
      'comment.create'::public.app_permission,
      'comment.edit_self'::public.app_permission,
      'comment.delete_self'::public.app_permission,
      'message.create'::public.app_permission,
      'message.edit_self'::public.app_permission,
      'endorsement.create'::public.app_permission,
      'report.create'::public.app_permission,
      'like.create'::public.app_permission,
      'like.delete_self'::public.app_permission
    ]
    WHEN 'verified_member' THEN ARRAY[
      'profile.read'::public.app_permission,
      'profile.update_self'::public.app_permission,
      'post.create'::public.app_permission,
      'post.edit_self'::public.app_permission,
      'post.delete_self'::public.app_permission,
      'comment.create'::public.app_permission,
      'comment.edit_self'::public.app_permission,
      'comment.delete_self'::public.app_permission,
      'message.create'::public.app_permission,
      'message.edit_self'::public.app_permission,
      'endorsement.create'::public.app_permission,
      'report.create'::public.app_permission,
      'like.create'::public.app_permission,
      'like.delete_self'::public.app_permission
    ]
    WHEN 'moderator' THEN ARRAY[
      'profile.read'::public.app_permission,
      'profile.update_self'::public.app_permission,
      'post.create'::public.app_permission,
      'post.edit_self'::public.app_permission,
      'post.delete_self'::public.app_permission,
      'post.moderate'::public.app_permission,
      'comment.create'::public.app_permission,
      'comment.edit_self'::public.app_permission,
      'comment.delete_self'::public.app_permission,
      'comment.moderate'::public.app_permission,
      'message.create'::public.app_permission,
      'message.edit_self'::public.app_permission,
      'message.moderate'::public.app_permission,
      'endorsement.create'::public.app_permission,
      'endorsement.review'::public.app_permission,
      'endorsement.moderate'::public.app_permission,
      'report.create'::public.app_permission,
      'report.review'::public.app_permission,
      'like.create'::public.app_permission,
      'like.delete_self'::public.app_permission
    ]
    WHEN 'market_manager' THEN ARRAY[
      'profile.read'::public.app_permission,
      'profile.update_self'::public.app_permission,
      'post.create'::public.app_permission,
      'post.edit_self'::public.app_permission,
      'post.delete_self'::public.app_permission,
      'comment.create'::public.app_permission,
      'comment.edit_self'::public.app_permission,
      'comment.delete_self'::public.app_permission,
      'message.create'::public.app_permission,
      'message.edit_self'::public.app_permission,
      'endorsement.create'::public.app_permission,
      'report.create'::public.app_permission,
      'market.manage'::public.app_permission,
      'like.create'::public.app_permission,
      'like.delete_self'::public.app_permission
    ]
    WHEN 'admin' THEN ARRAY[
      'profile.read'::public.app_permission,
      'profile.update_self'::public.app_permission,
      'profile.update_any'::public.app_permission,
      'post.create'::public.app_permission,
      'post.edit_self'::public.app_permission,
      'post.delete_self'::public.app_permission,
      'post.moderate'::public.app_permission,
      'comment.create'::public.app_permission,
      'comment.edit_self'::public.app_permission,
      'comment.delete_self'::public.app_permission,
      'comment.moderate'::public.app_permission,
      'message.create'::public.app_permission,
      'message.edit_self'::public.app_permission,
      'message.moderate'::public.app_permission,
      'endorsement.create'::public.app_permission,
      'endorsement.review'::public.app_permission,
      'endorsement.moderate'::public.app_permission,
      'report.create'::public.app_permission,
      'report.review'::public.app_permission,
      'market.manage'::public.app_permission,
      'role.assign'::public.app_permission,
      'settings.manage'::public.app_permission,
      'like.create'::public.app_permission,
      'like.delete_self'::public.app_permission
    ]
    WHEN 'system' THEN enum_range(NULL::public.app_permission)
    ELSE ARRAY[]::public.app_permission[]
  END;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID AS $$
  SELECT id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role AS $$
  SELECT COALESCE(
    (
      SELECT role
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    ),
    'guest'::public.app_role
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_app_permissions()
RETURNS public.app_permission[] AS $$
  SELECT COALESCE(
    (
      SELECT ARRAY(
        SELECT DISTINCT permission
        FROM unnest(
          public.app_role_permissions(role) || COALESCE(custom_permissions, '{}'::public.app_permission[])
        ) AS permission
      )
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    ),
    public.app_role_permissions('guest'::public.app_role)
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_permission(requested public.app_permission)
RETURNS BOOLEAN AS $$
  SELECT requested = ANY(public.current_app_permissions());
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update permitted profiles" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = user_id OR public.has_permission('profile.update_any'::public.app_permission)
  )
  WITH CHECK (
    auth.uid() = user_id OR public.has_permission('profile.update_any'::public.app_permission)
  );

DROP POLICY IF EXISTS "Non-hidden endorsements are viewable by everyone" ON public.endorsements;
CREATE POLICY "Non-hidden endorsements are viewable by everyone" ON public.endorsements
  FOR SELECT USING (
    is_hidden = false OR public.has_permission('endorsement.moderate'::public.app_permission)
  );

DROP POLICY IF EXISTS "Authenticated users can create endorsements" ON public.endorsements;
CREATE POLICY "Authenticated users can create endorsements" ON public.endorsements
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.has_permission('endorsement.create'::public.app_permission)
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = endorser_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update endorsements" ON public.endorsements;
CREATE POLICY "Moderators can update endorsements" ON public.endorsements
  FOR UPDATE USING (
    public.has_permission('endorsement.moderate'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('endorsement.moderate'::public.app_permission)
  );

DROP POLICY IF EXISTS "Evidence is viewable with its endorsement" ON public.evidence;
CREATE POLICY "Evidence is viewable with its endorsement" ON public.evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.endorsements e
      WHERE e.id = endorsement_id
        AND (
          e.is_hidden = false
          OR public.has_permission('endorsement.moderate'::public.app_permission)
        )
    )
  );

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (
    public.has_permission('report.create'::public.app_permission)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = reporter_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = reporter_id AND user_id = auth.uid())
    OR public.has_permission('report.review'::public.app_permission)
  );

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Staff can update reports" ON public.reports
  FOR UPDATE USING (
    public.has_permission('report.review'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('report.review'::public.app_permission)
  );

DROP POLICY IF EXISTS "Authenticated users can create messages" ON public.messages;
CREATE POLICY "Authenticated users can create messages" ON public.messages
  FOR INSERT WITH CHECK (
    public.has_permission('message.create'::public.app_permission)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = sender_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can edit their own messages" ON public.messages;
CREATE POLICY "Users can update permitted messages" ON public.messages
  FOR UPDATE USING (
    (
      public.has_permission('message.edit_self'::public.app_permission)
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = sender_id AND user_id = auth.uid())
    )
    OR public.has_permission('message.moderate'::public.app_permission)
  )
  WITH CHECK (
    (
      public.has_permission('message.edit_self'::public.app_permission)
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = sender_id AND user_id = auth.uid())
    )
    OR public.has_permission('message.moderate'::public.app_permission)
  );

DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts" ON public.posts
  FOR INSERT WITH CHECK (
    public.has_permission('post.create'::public.app_permission)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = author_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can edit their own posts" ON public.posts;
CREATE POLICY "Users can update permitted posts" ON public.posts
  FOR UPDATE USING (
    (
      public.has_permission('post.edit_self'::public.app_permission)
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = author_id AND user_id = auth.uid())
    )
    OR public.has_permission('post.moderate'::public.app_permission)
  )
  WITH CHECK (
    (
      public.has_permission('post.edit_self'::public.app_permission)
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = author_id AND user_id = auth.uid())
    )
    OR public.has_permission('post.moderate'::public.app_permission)
  );

CREATE POLICY "Users can delete permitted posts" ON public.posts
  FOR DELETE USING (
    (
      public.has_permission('post.delete_self'::public.app_permission)
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = author_id AND user_id = auth.uid())
    )
    OR public.has_permission('post.moderate'::public.app_permission)
  );

DROP POLICY IF EXISTS "Authenticated users can create post likes" ON public.post_likes;
CREATE POLICY "Authenticated users can create post likes" ON public.post_likes
  FOR INSERT WITH CHECK (
    public.has_permission('like.create'::public.app_permission)
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = user_id AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can remove their own post likes" ON public.post_likes;
CREATE POLICY "Users can remove their own post likes" ON public.post_likes
  FOR DELETE USING (
    public.has_permission('like.delete_self'::public.app_permission)
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = user_id AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create post comments" ON public.post_comments;
CREATE POLICY "Authenticated users can create post comments" ON public.post_comments
  FOR INSERT WITH CHECK (
    public.has_permission('comment.create'::public.app_permission)
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = author_id AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can edit their own post comments" ON public.post_comments;
CREATE POLICY "Users can update permitted post comments" ON public.post_comments
  FOR UPDATE USING (
    (
      public.has_permission('comment.edit_self'::public.app_permission)
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = author_id AND profiles.user_id = auth.uid()
      )
    )
    OR public.has_permission('comment.moderate'::public.app_permission)
  )
  WITH CHECK (
    (
      public.has_permission('comment.edit_self'::public.app_permission)
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = author_id AND profiles.user_id = auth.uid()
      )
    )
    OR public.has_permission('comment.moderate'::public.app_permission)
  );

DROP POLICY IF EXISTS "Users can delete their own post comments" ON public.post_comments;
CREATE POLICY "Users can delete permitted post comments" ON public.post_comments
  FOR DELETE USING (
    (
      public.has_permission('comment.delete_self'::public.app_permission)
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = author_id AND profiles.user_id = auth.uid()
      )
    )
    OR public.has_permission('comment.moderate'::public.app_permission)
  );

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
