INSERT INTO public.law_sources (
  slug, track, jurisdiction, domain, instrument, title, summary, source_url, sort_order, is_published
)
VALUES
  (
    'cerd',
    'civil',
    'United Nations',
    'Equality and racial non-discrimination',
    'International Convention on the Elimination of All Forms of Racial Discrimination',
    'International Convention on the Elimination of All Forms of Racial Discrimination',
    'A core anti-discrimination treaty requiring states to eliminate racial discrimination and promote equality before the law.',
    'https://www.ohchr.org/Documents/ProfessionalInterest/cerd.pdf',
    90,
    true
  ),
  (
    'crpd',
    'civil',
    'United Nations',
    'Disability rights',
    'Convention on the Rights of Persons with Disabilities',
    'Convention on the Rights of Persons with Disabilities',
    'A disability-rights convention clarifying equality, accessibility, legal capacity, inclusion, and participation duties.',
    'https://www.un.org/disabilities/documents/convention/convoptprot-e.pdf',
    100,
    true
  ),
  (
    'icpped',
    'criminal',
    'United Nations',
    'Enforced disappearance accountability',
    'International Convention for the Protection of All Persons from Enforced Disappearance',
    'International Convention for the Protection of All Persons from Enforced Disappearance',
    'A treaty prohibiting enforced disappearance and requiring prevention, investigation, victim protection, and truth-related obligations.',
    'https://www.ohchr.org/sites/default/files/disappearance-convention.pdf',
    110,
    true
  ),
  (
    'refugee-convention',
    'civil',
    'United Nations',
    'Refugee protection',
    'Convention relating to the Status of Refugees',
    'Convention relating to the Status of Refugees',
    'A foundational refugee-protection treaty defining refugee status and key civil, social, and non-refoulement protections.',
    'https://www.ohchr.org/sites/default/files/refugees.pdf',
    120,
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
SELECT law_sources.id, 'definitions-equality-obligations', 'Definitions, equality, and obligations', 'Foundational provisions defining discrimination and requiring anti-discrimination action.', 10
FROM public.law_sources
WHERE law_sources.slug = 'cerd'
ON CONFLICT (source_id, slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'rights-remedies-hate-prohibition', 'Rights, remedies, and hate prohibition', 'Protections for equality before the law together with action against racist propaganda and organizations.', 20
FROM public.law_sources
WHERE law_sources.slug = 'cerd'
ON CONFLICT (source_id, slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'general-principles-equality', 'General principles and equality', 'Foundational provisions on equality, non-discrimination, and disability-inclusive interpretation.', 10
FROM public.law_sources
WHERE law_sources.slug = 'crpd'
ON CONFLICT (source_id, slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'capacity-accessibility-participation', 'Capacity, accessibility, and participation', 'Core protections for legal capacity, accessibility, independent living, and public participation.', 20
FROM public.law_sources
WHERE law_sources.slug = 'crpd'
ON CONFLICT (source_id, slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'prohibition-and-definition', 'Prohibition and definition', 'Core provisions prohibiting enforced disappearance and defining the conduct.', 10
FROM public.law_sources
WHERE law_sources.slug = 'icpped'
ON CONFLICT (source_id, slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'search-truth-remedy', 'Search, truth, and remedy', 'Provisions on investigation, locating disappeared persons, victim rights, and redress.', 20
FROM public.law_sources
WHERE law_sources.slug = 'icpped'
ON CONFLICT (source_id, slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'status-definition-non-refoulement', 'Status, definition, and non-refoulement', 'Core provisions defining refugee status and protection against return to persecution.', 10
FROM public.law_sources
WHERE law_sources.slug = 'refugee-convention'
ON CONFLICT (source_id, slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_sections (source_id, slug, title, summary, sort_order)
SELECT law_sources.id, 'rights-work-courts-welfare', 'Rights to work, courts, and welfare', 'Key protections for legal standing, employment, public relief, and education.', 20
FROM public.law_sources
WHERE law_sources.slug = 'refugee-convention'
ON CONFLICT (source_id, slug) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-1', 'Article 1', 'Defines racial discrimination for the purposes of the convention.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cerd' AND public.law_sections.slug = 'definitions-equality-obligations'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-2', 'Article 2', 'Requires states to condemn and eliminate racial discrimination through policy and law.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cerd' AND public.law_sections.slug = 'definitions-equality-obligations'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-5', 'Article 5', 'Protects equality before the law across civil, political, economic, social, and cultural rights.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cerd' AND public.law_sections.slug = 'rights-remedies-hate-prohibition'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-4', 'Article 4', 'Requires action against racist propaganda and organizations.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'cerd' AND public.law_sections.slug = 'rights-remedies-hate-prohibition'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-1', 'Article 1', 'States the convention''s purpose of promoting equal enjoyment of rights by persons with disabilities.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crpd' AND public.law_sections.slug = 'general-principles-equality'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-3', 'Article 3', 'Sets out the convention''s general principles, including dignity, autonomy, and participation.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crpd' AND public.law_sections.slug = 'general-principles-equality'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-5', 'Article 5', 'Protects equality and non-discrimination on the basis of disability.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crpd' AND public.law_sections.slug = 'general-principles-equality'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-9', 'Article 9', 'Requires accessibility across the physical environment, transportation, information, and services.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crpd' AND public.law_sections.slug = 'capacity-accessibility-participation'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-12', 'Article 12', 'Recognizes equal legal capacity for persons with disabilities.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crpd' AND public.law_sections.slug = 'capacity-accessibility-participation'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-19', 'Article 19', 'Protects independent living and inclusion in the community.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'crpd' AND public.law_sections.slug = 'capacity-accessibility-participation'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-1', 'Article 1', 'Absolutely prohibits enforced disappearance.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icpped' AND public.law_sections.slug = 'prohibition-and-definition'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-2', 'Article 2', 'Defines enforced disappearance for the purposes of the convention.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icpped' AND public.law_sections.slug = 'prohibition-and-definition'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-24', 'Article 24', 'Defines victims and protects rights to truth, reparation, and organization.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icpped' AND public.law_sections.slug = 'search-truth-remedy'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-25', 'Article 25', 'Addresses the wrongful removal of children linked to enforced disappearance.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'icpped' AND public.law_sections.slug = 'search-truth-remedy'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-1', 'Article 1', 'Defines who qualifies as a refugee under the convention.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'refugee-convention' AND public.law_sections.slug = 'status-definition-non-refoulement'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-33', 'Article 33', 'Protects against expulsion or return to territories where life or freedom would be threatened.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'refugee-convention' AND public.law_sections.slug = 'status-definition-non-refoulement'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-16', 'Article 16', 'Protects access to courts.', 10
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'refugee-convention' AND public.law_sections.slug = 'rights-work-courts-welfare'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-17', 'Article 17', 'Protects wage-earning employment rights under the convention framework.', 20
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'refugee-convention' AND public.law_sections.slug = 'rights-work-courts-welfare'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();

INSERT INTO public.law_articles (section_id, slug, label, summary, sort_order)
SELECT law_sections.id, 'article-22', 'Article 22', 'Protects access to public education.', 30
FROM public.law_sections
JOIN public.law_sources ON public.law_sources.id = public.law_sections.source_id
WHERE public.law_sources.slug = 'refugee-convention' AND public.law_sections.slug = 'rights-work-courts-welfare'
ON CONFLICT (section_id, slug) DO UPDATE SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, updated_at = now();
