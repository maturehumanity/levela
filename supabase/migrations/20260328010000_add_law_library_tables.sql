DO $$
BEGIN
  ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'law.read';
  ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'law.contribute';
  ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'law.review';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.law_track AS ENUM ('civil', 'criminal');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.law_contribution_type AS ENUM ('source', 'structure', 'summary');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.law_contribution_status AS ENUM ('pending', 'approved', 'changes_requested', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.law_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  track public.law_track NOT NULL,
  jurisdiction text NOT NULL,
  domain text NOT NULL,
  instrument text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  source_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.law_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.law_sources(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, slug)
);

CREATE TABLE IF NOT EXISTS public.law_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.law_sections(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  summary text NOT NULL,
  body text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, slug)
);

CREATE TABLE IF NOT EXISTS public.law_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.law_sources(id) ON DELETE SET NULL,
  track public.law_track NOT NULL,
  contribution_type public.law_contribution_type NOT NULL,
  title text NOT NULL,
  source_reference text,
  note text NOT NULL,
  status public.law_contribution_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_law_sources_track ON public.law_sources(track);
CREATE INDEX IF NOT EXISTS idx_law_sources_sort_order ON public.law_sources(sort_order);
CREATE INDEX IF NOT EXISTS idx_law_sections_source_id ON public.law_sections(source_id);
CREATE INDEX IF NOT EXISTS idx_law_sections_sort_order ON public.law_sections(sort_order);
CREATE INDEX IF NOT EXISTS idx_law_articles_section_id ON public.law_articles(section_id);
CREATE INDEX IF NOT EXISTS idx_law_articles_sort_order ON public.law_articles(sort_order);
CREATE INDEX IF NOT EXISTS idx_law_contributions_author_id ON public.law_contributions(author_id);
CREATE INDEX IF NOT EXISTS idx_law_contributions_status ON public.law_contributions(status);
CREATE INDEX IF NOT EXISTS idx_law_contributions_source_id ON public.law_contributions(source_id);

DO $$
BEGIN
  CREATE TRIGGER update_law_sources_updated_at
    BEFORE UPDATE ON public.law_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_law_sections_updated_at
    BEFORE UPDATE ON public.law_sections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_law_articles_updated_at
    BEFORE UPDATE ON public.law_articles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_law_contributions_updated_at
    BEFORE UPDATE ON public.law_contributions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.law_sources TO anon, authenticated;
GRANT SELECT ON public.law_sections TO anon, authenticated;
GRANT SELECT ON public.law_articles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.law_contributions TO authenticated;

ALTER TABLE public.law_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published law sources are viewable" ON public.law_sources;
CREATE POLICY "Published law sources are viewable" ON public.law_sources
  FOR SELECT USING (
    is_published = true
    OR public.has_permission('law.review'::public.app_permission)
  );

DROP POLICY IF EXISTS "Published law sections are viewable" ON public.law_sections;
CREATE POLICY "Published law sections are viewable" ON public.law_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.law_sources
      WHERE law_sources.id = law_sections.source_id
        AND (
          law_sources.is_published = true
          OR public.has_permission('law.review'::public.app_permission)
        )
    )
  );

DROP POLICY IF EXISTS "Published law articles are viewable" ON public.law_articles;
CREATE POLICY "Published law articles are viewable" ON public.law_articles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.law_sections
      JOIN public.law_sources ON law_sources.id = law_sections.source_id
      WHERE law_sections.id = law_articles.section_id
        AND (
          law_sources.is_published = true
          OR public.has_permission('law.review'::public.app_permission)
        )
    )
  );

DROP POLICY IF EXISTS "Users can view permitted law contributions" ON public.law_contributions;
CREATE POLICY "Users can view permitted law contributions" ON public.law_contributions
  FOR SELECT USING (
    author_id = public.current_profile_id()
    OR public.has_permission('law.review'::public.app_permission)
  );

DROP POLICY IF EXISTS "Users can create law contributions" ON public.law_contributions;
CREATE POLICY "Users can create law contributions" ON public.law_contributions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.has_permission('law.contribute'::public.app_permission)
    AND author_id = public.current_profile_id()
  );

DROP POLICY IF EXISTS "Reviewers can update law contributions" ON public.law_contributions;
CREATE POLICY "Reviewers can update law contributions" ON public.law_contributions
  FOR UPDATE USING (
    public.has_permission('law.review'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('law.review'::public.app_permission)
  );

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('member', 'law.read'),
  ('member', 'law.contribute'),
  ('verified_member', 'law.read'),
  ('verified_member', 'law.contribute'),
  ('moderator', 'law.read'),
  ('moderator', 'law.contribute'),
  ('moderator', 'law.review'),
  ('market_manager', 'law.read'),
  ('market_manager', 'law.contribute'),
  ('admin', 'law.read'),
  ('admin', 'law.contribute'),
  ('admin', 'law.review'),
  ('system', 'law.read'),
  ('system', 'law.contribute'),
  ('system', 'law.review')
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO public.law_sources (
  slug, track, jurisdiction, domain, instrument, title, summary, source_url, sort_order, is_published
)
VALUES
  (
    'udhr',
    'civil',
    'United Nations',
    'Human rights',
    'Universal Declaration of Human Rights',
    'Universal Declaration of Human Rights',
    'A foundational human-rights instrument organizing civil, political, social, and cultural rights into article-level principles.',
    'https://www.un.org/en/about-us/universal-declaration-of-human-rights',
    10,
    true
  ),
  (
    'iccpr',
    'civil',
    'United Nations',
    'Civil and political rights',
    'International Covenant on Civil and Political Rights',
    'International Covenant on Civil and Political Rights',
    'A binding international covenant detailing civil and political protections, state duties, and limits on interference.',
    'https://www.ohchr.org/en/instruments-mechanisms/instruments/international-covenant-civil-and-political-rights',
    20,
    true
  ),
  (
    'rome-statute',
    'criminal',
    'International Criminal Court',
    'International criminal justice',
    'Rome Statute of the International Criminal Court',
    'Rome Statute of the International Criminal Court',
    'The core statute governing the ICC, including jurisdiction, crimes, procedure, and responsibilities of participants.',
    'https://www.icc-cpi.int/resource-library/documents/rs-eng.pdf',
    30,
    true
  ),
  (
    'genocide-convention',
    'criminal',
    'United Nations',
    'Mass atrocity crimes',
    'Convention on the Prevention and Punishment of the Crime of Genocide',
    'Genocide Convention',
    'A treaty defining genocide and establishing state obligations to prevent and punish the crime.',
    'https://www.un.org/en/genocideprevention/genocide-convention.shtml',
    40,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  track = EXCLUDED.track,
  jurisdiction = EXCLUDED.jurisdiction,
  domain = EXCLUDED.domain,
  instrument = EXCLUDED.instrument,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  source_url = EXCLUDED.source_url,
  sort_order = EXCLUDED.sort_order,
  is_published = EXCLUDED.is_published,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'foundational-dignity-equality', 'Foundational dignity and equality', 'Core principles that frame rights as universal, equal, and grounded in human dignity.', 10
FROM public.law_sources
WHERE law_sources.slug = 'udhr'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'civil-political-liberties', 'Civil and political liberties', 'Rights relating to life, liberty, security, participation, and legal protection.', 20
FROM public.law_sources
WHERE law_sources.slug = 'udhr'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'state-obligations', 'State obligations', 'Articles describing how states must respect and ensure protected rights.', 10
FROM public.law_sources
WHERE law_sources.slug = 'iccpr'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'liberties-remedies', 'Liberties and remedies', 'Articles dealing with liberty, due process, expression, and effective remedies.', 20
FROM public.law_sources
WHERE law_sources.slug = 'iccpr'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'jurisdiction-admissibility', 'Jurisdiction and admissibility', 'Rules defining the Court''s reach and the cases it may hear.', 10
FROM public.law_sources
WHERE law_sources.slug = 'rome-statute'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'core-international-crimes', 'Core international crimes', 'Definitions and scope of genocide, crimes against humanity, war crimes, and aggression.', 20
FROM public.law_sources
WHERE law_sources.slug = 'rome-statute'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'definition-punishable-acts', 'Definition and punishable acts', 'Core treaty provisions describing genocide and related punishable conduct.', 10
FROM public.law_sources
WHERE law_sources.slug = 'genocide-convention'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'prevention-enforcement', 'Prevention and enforcement', 'Treaty provisions dealing with domestic action, prosecution, and international responsibility.', 20
FROM public.law_sources
WHERE law_sources.slug = 'genocide-convention'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-1', 'Article 1', 'Affirms freedom, dignity, and equality for all people.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'udhr' AND public.law_sections.slug = 'foundational-dignity-equality'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-2', 'Article 2', 'Protects equal enjoyment of rights without discrimination.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'udhr' AND public.law_sections.slug = 'foundational-dignity-equality'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-3', 'Article 3', 'Recognizes the right to life, liberty, and security of person.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'udhr' AND public.law_sections.slug = 'civil-political-liberties'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-10', 'Article 10', 'Guarantees a fair and public hearing by an independent tribunal.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'udhr' AND public.law_sections.slug = 'civil-political-liberties'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-21', 'Article 21', 'Protects participation in government and equal access to public service.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'udhr' AND public.law_sections.slug = 'civil-political-liberties'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-2', 'Article 2', 'Requires states to respect and ensure covenant rights and provide remedies.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'iccpr' AND public.law_sections.slug = 'state-obligations'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-4', 'Article 4', 'Defines the limits of derogation during emergencies.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'iccpr' AND public.law_sections.slug = 'state-obligations'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-9', 'Article 9', 'Protects liberty and security of person and guards against arbitrary detention.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'iccpr' AND public.law_sections.slug = 'liberties-remedies'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-14', 'Article 14', 'Sets out fair-trial rights in criminal and civil proceedings.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'iccpr' AND public.law_sections.slug = 'liberties-remedies'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-19', 'Article 19', 'Protects freedom of expression with narrowly framed limits.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'iccpr' AND public.law_sections.slug = 'liberties-remedies'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-5', 'Article 5', 'Lists the crimes within the jurisdiction of the Court.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'rome-statute' AND public.law_sections.slug = 'jurisdiction-admissibility'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-12', 'Article 12', 'Explains preconditions to the Court''s exercise of jurisdiction.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'rome-statute' AND public.law_sections.slug = 'jurisdiction-admissibility'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-17', 'Article 17', 'Defines admissibility and the complementarity principle.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'rome-statute' AND public.law_sections.slug = 'jurisdiction-admissibility'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-6', 'Article 6', 'Defines genocide.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'rome-statute' AND public.law_sections.slug = 'core-international-crimes'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-7', 'Article 7', 'Defines crimes against humanity.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'rome-statute' AND public.law_sections.slug = 'core-international-crimes'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-8', 'Article 8', 'Defines war crimes.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'rome-statute' AND public.law_sections.slug = 'core-international-crimes'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-ii', 'Article II', 'Defines genocide through protected groups and prohibited acts.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'genocide-convention' AND public.law_sections.slug = 'definition-punishable-acts'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-iii', 'Article III', 'Lists genocide, conspiracy, incitement, attempt, and complicity as punishable.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'genocide-convention' AND public.law_sections.slug = 'definition-punishable-acts'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-v', 'Article V', 'Requires states to enact legislation and provide penalties.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'genocide-convention' AND public.law_sections.slug = 'prevention-enforcement'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-vi', 'Article VI', 'Addresses prosecution before competent tribunals.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'genocide-convention' AND public.law_sections.slug = 'prevention-enforcement'
ON CONFLICT (section_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
