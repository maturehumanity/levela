CREATE OR REPLACE FUNCTION public.list_published_development_stories()
RETURNS SETOF public.development_stories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.development_stories
  WHERE status = 'published'
    AND visibility = 'public'
  ORDER BY requested_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_published_development_stories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_published_development_stories() TO authenticated;
