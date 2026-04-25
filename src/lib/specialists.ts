export type SpecialistMode = 'study' | 'improve' | 'resolveIssues';

export type SpecialistDomainId =
  | 'sociology'
  | 'economics'
  | 'technology'
  | 'marketing'
  | 'healthcare'
  | 'politics'
  | 'ethics'
  | 'legal-governance';

export type SpecialistProfile = {
  id: string;
  name: string;
  domainId: SpecialistDomainId;
  domain: string;
  modes: SpecialistMode[];
  marketEligible: boolean;
  knowledgeAreas: string[];
  skills: string[];
  triggerKeywords: string[];
};

export const specialistProfiles: SpecialistProfile[] = [
  {
    id: 'sociologist',
    name: 'Sociologist',
    domainId: 'sociology',
    domain: 'Civic and Social',
    modes: ['study', 'improve', 'resolveIssues'],
    marketEligible: true,
    knowledgeAreas: ['social systems', 'community behavior', 'institutions', 'group dynamics'],
    skills: ['social diagnosis', 'community intervention design', 'conflict context mapping'],
    triggerKeywords: ['society', 'community', 'culture', 'social', 'conflict', 'inclusion'],
  },
  {
    id: 'economist',
    name: 'Economist',
    domainId: 'economics',
    domain: 'Economic and Financial',
    modes: ['study', 'improve', 'resolveIssues'],
    marketEligible: true,
    knowledgeAreas: ['microeconomics', 'macroeconomics', 'public value', 'labor and markets'],
    skills: ['tradeoff analysis', 'incentive design', 'resource allocation planning'],
    triggerKeywords: ['economy', 'inflation', 'price', 'cost', 'budget', 'market', 'finance'],
  },
  {
    id: 'it-specialist',
    name: 'IT Specialist',
    domainId: 'technology',
    domain: 'Technology and Engineering',
    modes: ['study', 'improve', 'resolveIssues'],
    marketEligible: true,
    knowledgeAreas: ['software systems', 'cloud operations', 'security basics', 'data lifecycle'],
    skills: ['technical troubleshooting', 'architecture guidance', 'automation planning'],
    triggerKeywords: ['it', 'software', 'app', 'bug', 'server', 'database', 'security', 'ai'],
  },
  {
    id: 'marketing-specialist',
    name: 'Marketing Specialist',
    domainId: 'marketing',
    domain: 'Business and Market Growth',
    modes: ['study', 'improve', 'resolveIssues'],
    marketEligible: true,
    knowledgeAreas: ['positioning', 'audience research', 'campaign strategy', 'brand narrative'],
    skills: ['go-to-market planning', 'message testing', 'channel optimization'],
    triggerKeywords: ['marketing', 'brand', 'audience', 'campaign', 'growth', 'engagement'],
  },
  {
    id: 'healthcare-specialist',
    name: 'Health Care Specialist',
    domainId: 'healthcare',
    domain: 'Health and Wellbeing',
    modes: ['study', 'improve', 'resolveIssues'],
    marketEligible: true,
    knowledgeAreas: ['public health', 'preventive care', 'care pathways', 'health literacy'],
    skills: ['risk triage', 'health education framing', 'care navigation support'],
    triggerKeywords: ['health', 'medical', 'wellness', 'symptom', 'care', 'clinic', 'hospital'],
  },
  {
    id: 'politics-specialist',
    name: 'Politics Specialist',
    domainId: 'politics',
    domain: 'Politics and International Affairs',
    modes: ['study', 'improve', 'resolveIssues'],
    marketEligible: false,
    knowledgeAreas: ['public administration', 'institutions', 'policy cycles', 'comparative systems'],
    skills: ['stakeholder mapping', 'policy framing', 'governance process analysis'],
    triggerKeywords: ['politics', 'policy', 'election', 'government', 'public administration'],
  },
  {
    id: 'ethics-specialist',
    name: 'Ethics Specialist',
    domainId: 'ethics',
    domain: 'Ethics and Philosophy',
    modes: ['study', 'improve', 'resolveIssues'],
    marketEligible: false,
    knowledgeAreas: ['ethical reasoning', 'rights and duties', 'fairness', 'harm minimization'],
    skills: ['ethical tradeoff analysis', 'value clarification', 'principle-based review'],
    triggerKeywords: ['ethics', 'moral', 'fairness', 'harm', 'rights', 'justice', 'bias'],
  },
  {
    id: 'governance-specialist',
    name: 'Governance Policy Specialist',
    domainId: 'legal-governance',
    domain: 'Governance, Policy, and Law',
    modes: ['study', 'improve', 'resolveIssues'],
    marketEligible: false,
    knowledgeAreas: ['constitutional governance', 'policy drafting', 'legal literacy', 'compliance framing'],
    skills: ['policy interpretation', 'risk-aware guidance', 'governance process alignment'],
    triggerKeywords: ['law', 'legal', 'governance', 'regulation', 'compliance', 'constitution'],
  },
];

export const specialistModes: SpecialistMode[] = ['study', 'improve', 'resolveIssues'];
