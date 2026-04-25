import lumaMonetaryPolicyBaseline from '../../docs/02-moderated/policies/monetary/levela_luma_monetary_policy_and_ai_agent_spec.md?raw';
import constitutionalTokenomicsGovernance from '../../docs/03-governance/levela-constitutional-tokenomics-governance.md?raw';

import type { StudyDomainId } from '@/lib/study';

export type StudyMaterialContent = {
  key: string;
  domainId: StudyDomainId;
  titleKey: string;
  badgeLabel: string;
  markdown: string;
};

const STUDY_MATERIAL_CONTENT: StudyMaterialContent[] = [
  {
    key: 'economy-policy-baseline',
    domainId: 'economy',
    titleKey: 'study.materials.economyPolicyBaseline.title',
    badgeLabel: 'Policy',
    markdown: lumaMonetaryPolicyBaseline,
  },
  {
    key: 'economy-constitutional-tokenomics-governance',
    domainId: 'economy',
    titleKey: 'study.materials.economyConstitutionalTokenomicsGovernance.title',
    badgeLabel: 'Constitutional Governance Draft',
    markdown: constitutionalTokenomicsGovernance,
  },
];

export function getStudyMaterialContentByKey(key: string) {
  return STUDY_MATERIAL_CONTENT.find((material) => material.key === key) ?? null;
}
