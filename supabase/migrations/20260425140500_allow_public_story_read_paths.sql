DROP POLICY IF EXISTS "Development stories are visible to anonymous users" ON public.development_stories;
CREATE POLICY "Development stories are visible to anonymous users"
  ON public.development_stories
  FOR SELECT
  TO anon
  USING (status = 'published' AND visibility = 'public');

GRANT SELECT ON TABLE public.development_stories TO anon;
GRANT EXECUTE ON FUNCTION public.list_published_development_stories() TO anon;
