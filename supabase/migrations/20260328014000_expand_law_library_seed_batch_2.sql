INSERT INTO public.law_sources (
  slug, track, jurisdiction, domain, instrument, title, summary, source_url, sort_order, is_published
)
VALUES
  (
    'icescr',
    'civil',
    'United Nations',
    'Economic, social and cultural rights',
    'International Covenant on Economic, Social and Cultural Rights',
    'International Covenant on Economic, Social and Cultural Rights',
    'A core human-rights covenant covering work, social protection, health, education, culture, and progressive realization duties.',
    'https://2covenants.ohchr.org/About-ICESCR.html',
    50,
    true
  ),
  (
    'cedaw',
    'civil',
    'United Nations',
    'Equality and non-discrimination',
    'Convention on the Elimination of All Forms of Discrimination against Women',
    'Convention on the Elimination of All Forms of Discrimination against Women',
    'A central women''s-rights convention defining discrimination and setting state duties across public, social, and family life.',
    'https://www.ohchr.org/en/instruments-mechanisms/instruments/convention-elimination-all-forms-discrimination-against-women',
    60,
    true
  ),
  (
    'crc',
    'civil',
    'United Nations',
    'Children''s rights',
    'Convention on the Rights of the Child',
    'Convention on the Rights of the Child',
    'A core children''s-rights convention organizing protection, development, participation, and best-interest principles.',
    'https://www.ohchr.org/en/instruments-mechanisms/instruments/convention-rights-child',
    70,
    true
  ),
  (
    'cat',
    'criminal',
    'United Nations',
    'Torture prohibition and accountability',
    'Convention against Torture and Other Cruel, Inhuman or Degrading Treatment or Punishment',
    'Convention against Torture and Other Cruel, Inhuman or Degrading Treatment or Punishment',
    'A treaty prohibiting torture and requiring prevention, investigation, prosecution, and remedies.',
    'https://www.ohchr.org/sites/default/files/cat.pdf',
    80,
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
SELECT law_sources.id, 'progressive-realization-core-duties', 'Progressive realization and core duties', 'Foundational duties requiring states to take steps, avoid discrimination, and advance rights over time.', 10
FROM public.law_sources
WHERE law_sources.slug = 'icescr'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'livelihood-wellbeing-culture', 'Livelihood, wellbeing, and culture', 'Substantive protections for work, living standards, health, education, and cultural participation.', 20
FROM public.law_sources
WHERE law_sources.slug = 'icescr'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'definitions-state-measures', 'Definitions and state measures', 'Core provisions defining discrimination and requiring active state measures for equality.', 10
FROM public.law_sources
WHERE law_sources.slug = 'cedaw'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'public-social-family-equality', 'Public, social, and family equality', 'Provisions on participation, education, employment, health, legal equality, and family life.', 20
FROM public.law_sources
WHERE law_sources.slug = 'cedaw'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'general-principles', 'General principles', 'Foundational articles on non-discrimination, best interests, survival, development, and participation.', 10
FROM public.law_sources
WHERE law_sources.slug = 'crc'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'protection-development-participation', 'Protection, development, and participation', 'Protections against harm together with rights to health, education, and cultural life.', 20
FROM public.law_sources
WHERE law_sources.slug = 'crc'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'definition-and-prevention', 'Definition and prevention', 'Core provisions defining torture and requiring prevention through law and administration.', 10
FROM public.law_sources
WHERE law_sources.slug = 'cat'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'investigation-remedy-accountability', 'Investigation, remedy, and accountability', 'Provisions covering investigation, complaints, redress, and exclusion of tainted evidence.', 20
FROM public.law_sources
WHERE law_sources.slug = 'cat'
ON CONFLICT (source_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-2', 'Article 2', 'Requires states to take steps toward realizing covenant rights and guarantee non-discrimination.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icescr' AND public.law_sections.slug = 'progressive-realization-core-duties'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-3', 'Article 3', 'Requires equal rights of men and women to enjoy covenant protections.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icescr' AND public.law_sections.slug = 'progressive-realization-core-duties'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-6', 'Article 6', 'Recognizes the right to work and steps supporting full employment.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icescr' AND public.law_sections.slug = 'livelihood-wellbeing-culture'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-11', 'Article 11', 'Recognizes an adequate standard of living, including food, clothing, and housing.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icescr' AND public.law_sections.slug = 'livelihood-wellbeing-culture'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-12', 'Article 12', 'Recognizes the right to the highest attainable standard of physical and mental health.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icescr' AND public.law_sections.slug = 'livelihood-wellbeing-culture'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-1', 'Article 1', 'Defines discrimination against women for the purposes of the convention.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cedaw' AND public.law_sections.slug = 'definitions-state-measures'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-2', 'Article 2', 'Requires states to condemn discrimination and pursue policy and legal measures against it.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cedaw' AND public.law_sections.slug = 'definitions-state-measures'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-3', 'Article 3', 'Requires measures ensuring women''s full development and advancement.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cedaw' AND public.law_sections.slug = 'definitions-state-measures'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-7', 'Article 7', 'Protects women''s rights to political and public participation.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cedaw' AND public.law_sections.slug = 'public-social-family-equality'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-10', 'Article 10', 'Protects equality in education.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cedaw' AND public.law_sections.slug = 'public-social-family-equality'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-16', 'Article 16', 'Protects equality in marriage and family relations.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cedaw' AND public.law_sections.slug = 'public-social-family-equality'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-2', 'Article 2', 'Requires non-discrimination in the enjoyment of children''s rights.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crc' AND public.law_sections.slug = 'general-principles'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-3', 'Article 3', 'Establishes the best interests of the child as a primary consideration.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crc' AND public.law_sections.slug = 'general-principles'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-12', 'Article 12', 'Protects the child''s right to be heard in matters affecting them.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crc' AND public.law_sections.slug = 'general-principles'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-19', 'Article 19', 'Requires protection from abuse, neglect, and violence.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crc' AND public.law_sections.slug = 'protection-development-participation'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-24', 'Article 24', 'Recognizes the child''s right to health and health services.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crc' AND public.law_sections.slug = 'protection-development-participation'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-28', 'Article 28', 'Recognizes the child''s right to education.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crc' AND public.law_sections.slug = 'protection-development-participation'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-1', 'Article 1', 'Defines torture for the purposes of the convention.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cat' AND public.law_sections.slug = 'definition-and-prevention'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-2', 'Article 2', 'Requires effective legislative, administrative, judicial, and other measures to prevent torture.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cat' AND public.law_sections.slug = 'definition-and-prevention'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-4', 'Article 4', 'Requires torture offenses to be criminalized under domestic law.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cat' AND public.law_sections.slug = 'definition-and-prevention'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-12', 'Article 12', 'Requires prompt and impartial investigation where torture is reasonably suspected.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cat' AND public.law_sections.slug = 'investigation-remedy-accountability'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-14', 'Article 14', 'Requires redress and enforceable compensation for victims of torture.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cat' AND public.law_sections.slug = 'investigation-remedy-accountability'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-15', 'Article 15', 'Excludes statements made through torture from evidence, except against a person accused of torture.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cat' AND public.law_sections.slug = 'investigation-remedy-accountability'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();
