CREATE OR REPLACE FUNCTION public.upsert_content_item_from_source(
  target_source_table text,
  target_source_id uuid,
  target_author_id uuid,
  target_content_type text,
  target_title text DEFAULT NULL,
  target_body_preview text DEFAULT NULL,
  target_professional_domain text DEFAULT NULL,
  target_metadata jsonb DEFAULT '{}'::jsonb,
  target_review_status public.content_review_status DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  inferred_category_id text;
  inferred_lane public.content_moderation_lane;
  inferred_policy text;
  resolved_review_status public.content_review_status;
BEGIN
  IF target_source_table IS NULL OR target_source_id IS NULL THEN
    RETURN;
  END IF;

  inferred_category_id := public.classify_content_category(
    target_source_table,
    target_content_type,
    target_title,
    target_body_preview
  );

  SELECT default_moderation_lane, contribution_policy
  INTO inferred_lane, inferred_policy
  FROM public.content_categories
  WHERE id = inferred_category_id;

  resolved_review_status := COALESCE(
    target_review_status,
    CASE
      WHEN inferred_lane = 'unmoderated'::public.content_moderation_lane THEN 'approved'::public.content_review_status
      ELSE 'proposed'::public.content_review_status
    END
  );

  INSERT INTO public.content_items (
    category_id,
    moderation_lane,
    content_type,
    professional_domain,
    contribution_policy,
    review_status,
    title,
    body_preview,
    source_table,
    source_id,
    author_id,
    classification_method,
    classification_confidence,
    classification_reasons,
    metadata,
    submitted_at,
    reviewed_at
  )
  VALUES (
    inferred_category_id,
    inferred_lane,
    target_content_type,
    COALESCE(target_professional_domain, 'none'),
    inferred_policy,
    resolved_review_status,
    target_title,
    target_body_preview,
    target_source_table,
    target_source_id,
    target_author_id,
    'source_sync',
    0.995,
    jsonb_build_array(
      format('Synced from %s', target_source_table),
      format('Classified as %s', inferred_category_id)
    ),
    COALESCE(target_metadata, '{}'::jsonb),
    CASE
      WHEN resolved_review_status IN ('proposed', 'in_review', 'changes_requested') THEN now()
      ELSE NULL
    END,
    CASE
      WHEN resolved_review_status = 'approved' THEN now()
      ELSE NULL
    END
  )
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    moderation_lane = EXCLUDED.moderation_lane,
    content_type = EXCLUDED.content_type,
    professional_domain = EXCLUDED.professional_domain,
    contribution_policy = EXCLUDED.contribution_policy,
    review_status = EXCLUDED.review_status,
    title = EXCLUDED.title,
    body_preview = EXCLUDED.body_preview,
    author_id = EXCLUDED.author_id,
    classification_method = EXCLUDED.classification_method,
    classification_confidence = EXCLUDED.classification_confidence,
    classification_reasons = EXCLUDED.classification_reasons,
    metadata = EXCLUDED.metadata,
    submitted_at = EXCLUDED.submitted_at,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.delete_content_item_from_source(
  target_source_table text,
  target_source_id uuid
)
RETURNS void AS $$
BEGIN
  DELETE FROM public.content_items
  WHERE source_table = target_source_table
    AND source_id = target_source_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_post_content_item()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.delete_content_item_from_source('posts', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.upsert_content_item_from_source(
    'posts',
    NEW.id,
    NEW.author_id,
    'social_post',
    NULL,
    NEW.content,
    'none',
    jsonb_build_object(
      'is_edited', coalesce(NEW.is_edited, false),
      'edited_at', NEW.edited_at
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_post_comment_content_item()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.delete_content_item_from_source('post_comments', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.upsert_content_item_from_source(
    'post_comments',
    NEW.id,
    NEW.author_id,
    'comment',
    NULL,
    NEW.content,
    'none',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'is_edited', coalesce(NEW.is_edited, false),
      'edited_at', NEW.edited_at
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_message_content_item()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.delete_content_item_from_source('messages', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.upsert_content_item_from_source(
    'messages',
    NEW.id,
    NEW.sender_id,
    'chat_message',
    NULL,
    NEW.content,
    'none',
    jsonb_build_object(
      'is_edited', coalesce(NEW.is_edited, false),
      'edited_at', NEW.edited_at
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_law_contribution_content_item()
RETURNS TRIGGER AS $$
DECLARE
  mapped_review_status public.content_review_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.delete_content_item_from_source('law_contributions', OLD.id);
    RETURN OLD;
  END IF;

  mapped_review_status := CASE NEW.status
    WHEN 'approved'::public.law_contribution_status THEN 'approved'::public.content_review_status
    WHEN 'changes_requested'::public.law_contribution_status THEN 'changes_requested'::public.content_review_status
    WHEN 'rejected'::public.law_contribution_status THEN 'rejected'::public.content_review_status
    ELSE 'proposed'::public.content_review_status
  END;

  PERFORM public.upsert_content_item_from_source(
    'law_contributions',
    NEW.id,
    NEW.author_id,
    'legal_reference',
    NEW.title,
    NEW.note,
    'law',
    jsonb_build_object(
      'track', NEW.track,
      'contribution_type', NEW.contribution_type,
      'status', NEW.status,
      'source_reference', NEW.source_reference,
      'reviewer_id', NEW.reviewer_id,
      'reviewed_at', NEW.reviewed_at
    ),
    mapped_review_status
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_monetary_policy_content_item()
RETURNS TRIGGER AS $$
DECLARE
  mapped_review_status public.content_review_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.delete_content_item_from_source('monetary_policy_profiles', OLD.id);
    RETURN OLD;
  END IF;

  mapped_review_status := CASE
    WHEN coalesce(NEW.is_active, false) THEN 'approved'::public.content_review_status
    ELSE 'proposed'::public.content_review_status
  END;

  PERFORM public.upsert_content_item_from_source(
    'monetary_policy_profiles',
    NEW.id,
    NEW.created_by,
    'policy_document',
    NEW.policy_name,
    concat('Policy version ', NEW.version),
    'governance',
    jsonb_build_object(
      'version', NEW.version,
      'is_active', NEW.is_active
    ),
    mapped_review_status
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_post_content_item ON public.posts;
CREATE TRIGGER sync_post_content_item
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_post_content_item();

DROP TRIGGER IF EXISTS sync_post_comment_content_item ON public.post_comments;
CREATE TRIGGER sync_post_comment_content_item
  AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_post_comment_content_item();

DROP TRIGGER IF EXISTS sync_message_content_item ON public.messages;
CREATE TRIGGER sync_message_content_item
  AFTER INSERT OR UPDATE OR DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_message_content_item();

DROP TRIGGER IF EXISTS sync_law_contribution_content_item ON public.law_contributions;
CREATE TRIGGER sync_law_contribution_content_item
  AFTER INSERT OR UPDATE OR DELETE ON public.law_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_law_contribution_content_item();

DROP TRIGGER IF EXISTS sync_monetary_policy_content_item ON public.monetary_policy_profiles;
CREATE TRIGGER sync_monetary_policy_content_item
  AFTER INSERT OR UPDATE OR DELETE ON public.monetary_policy_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_monetary_policy_content_item();

SELECT public.upsert_content_item_from_source(
  'posts',
  post.id,
  post.author_id,
  'social_post',
  NULL,
  post.content,
  'none',
  jsonb_build_object('is_edited', coalesce(post.is_edited, false), 'edited_at', post.edited_at)
)
FROM public.posts post;

SELECT public.upsert_content_item_from_source(
  'post_comments',
  comment.id,
  comment.author_id,
  'comment',
  NULL,
  comment.content,
  'none',
  jsonb_build_object('post_id', comment.post_id, 'is_edited', coalesce(comment.is_edited, false), 'edited_at', comment.edited_at)
)
FROM public.post_comments comment;

SELECT public.upsert_content_item_from_source(
  'messages',
  message.id,
  message.sender_id,
  'chat_message',
  NULL,
  message.content,
  'none',
  jsonb_build_object('is_edited', coalesce(message.is_edited, false), 'edited_at', message.edited_at)
)
FROM public.messages message;

SELECT public.upsert_content_item_from_source(
  'law_contributions',
  contribution.id,
  contribution.author_id,
  'legal_reference',
  contribution.title,
  contribution.note,
  'law',
  jsonb_build_object(
    'track', contribution.track,
    'contribution_type', contribution.contribution_type,
    'status', contribution.status,
    'source_reference', contribution.source_reference,
    'reviewer_id', contribution.reviewer_id,
    'reviewed_at', contribution.reviewed_at
  ),
  CASE contribution.status
    WHEN 'approved'::public.law_contribution_status THEN 'approved'::public.content_review_status
    WHEN 'changes_requested'::public.law_contribution_status THEN 'changes_requested'::public.content_review_status
    WHEN 'rejected'::public.law_contribution_status THEN 'rejected'::public.content_review_status
    ELSE 'proposed'::public.content_review_status
  END
)
FROM public.law_contributions contribution;

SELECT public.upsert_content_item_from_source(
  'monetary_policy_profiles',
  policy.id,
  policy.created_by,
  'policy_document',
  policy.policy_name,
  concat('Policy version ', policy.version),
  'governance',
  jsonb_build_object('version', policy.version, 'is_active', policy.is_active),
  CASE
    WHEN coalesce(policy.is_active, false) THEN 'approved'::public.content_review_status
    ELSE 'proposed'::public.content_review_status
  END
)
FROM public.monetary_policy_profiles policy;
