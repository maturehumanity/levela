import frontMatter from '../../docs/study/constitution/00_front_matter.md?raw';
import preamble from '../../docs/study/constitution/01_preamble.md?raw';
import articleI from '../../docs/study/constitution/02_article_i_foundational_principles.md?raw';
import articleII from '../../docs/study/constitution/03_article_ii_fundamental_rights.md?raw';
import articleIII from '../../docs/study/constitution/04_article_iii_civic_duties.md?raw';
import articleIV from '../../docs/study/constitution/05_article_iv_constitutional_governance.md?raw';
import articleV from '../../docs/study/constitution/06_article_v_rule_of_law_and_justice.md?raw';
import articleVI from '../../docs/study/constitution/07_article_vi_economic_order_and_public_value.md?raw';
import articleVII from '../../docs/study/constitution/08_article_vii_technology_data_and_ai.md?raw';
import articleVIII from '../../docs/study/constitution/09_article_viii_environment_and_intergenerational_stewardship.md?raw';
import articleIX from '../../docs/study/constitution/10_article_ix_peace_security_and_emergency_powers.md?raw';
import articleX from '../../docs/study/constitution/11_article_x_constitutional_institutions.md?raw';
import articleXI from '../../docs/study/constitution/12_article_xi_amendment_and_constitutional_protection.md?raw';
import articleXII from '../../docs/study/constitution/13_article_xii_ratification_and_transition.md?raw';
import draftingNotes from '../../docs/study/constitution/14_drafting_notes_for_next_iteration.md?raw';

export type ConstitutionSectionKind = 'frontMatter' | 'preamble' | 'article' | 'notes';
export const OPEN_ARTICLE_STORAGE_KEY = 'levela-study-constitution-open-article-id-v1';
export const CONSTITUTION_ARTICLE_BOOKMARK_PREFIX = 'constitution-article:';

export type ConstitutionStudySection = {
  id: string;
  kind: ConstitutionSectionKind;
  markdown: string;
};

export const CONSTITUTION_STUDY_SECTIONS: ConstitutionStudySection[] = [
  {
    id: 'front-matter',
    kind: 'frontMatter',
    markdown: frontMatter,
  },
  {
    id: 'preamble',
    kind: 'preamble',
    markdown: preamble,
  },
  {
    id: 'article-i',
    kind: 'article',
    markdown: articleI,
  },
  {
    id: 'article-ii',
    kind: 'article',
    markdown: articleII,
  },
  {
    id: 'article-iii',
    kind: 'article',
    markdown: articleIII,
  },
  {
    id: 'article-iv',
    kind: 'article',
    markdown: articleIV,
  },
  {
    id: 'article-v',
    kind: 'article',
    markdown: articleV,
  },
  {
    id: 'article-vi',
    kind: 'article',
    markdown: articleVI,
  },
  {
    id: 'article-vii',
    kind: 'article',
    markdown: articleVII,
  },
  {
    id: 'article-viii',
    kind: 'article',
    markdown: articleVIII,
  },
  {
    id: 'article-ix',
    kind: 'article',
    markdown: articleIX,
  },
  {
    id: 'article-x',
    kind: 'article',
    markdown: articleX,
  },
  {
    id: 'article-xi',
    kind: 'article',
    markdown: articleXI,
  },
  {
    id: 'article-xii',
    kind: 'article',
    markdown: articleXII,
  },
  {
    id: 'drafting-notes',
    kind: 'notes',
    markdown: draftingNotes,
  },
];
