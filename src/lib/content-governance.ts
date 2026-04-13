import {
  isStaffRole,
  permissionListHas,
  type AppPermission,
  type AppRole,
} from '@/lib/access-control';

export const MODERATION_LANES = ['unmoderated', 'moderated'] as const;
export type ModerationLane = (typeof MODERATION_LANES)[number];

export const USER_PROFESSIONS = [
  'none',
  'education',
  'law',
  'governance',
  'medicine',
  'finance',
  'engineering',
  'technology',
  'environment',
  'economics',
  'arts_culture',
] as const;

export type UserProfession = (typeof USER_PROFESSIONS)[number];
export type ProfessionVerificationStatus = 'pending' | 'approved' | 'suspended' | 'revoked';
export type ContributionPolicy = 'open' | 'verified_only' | 'certified_professionals' | 'staff_only';

export type UserProfessionAssignment = {
  profession: UserProfession;
  status: ProfessionVerificationStatus;
};

export const CONTENT_TYPES = [
  'chat_message',
  'direct_message',
  'comment',
  'social_post',
  'book',
  'leisure_note',
  'study_book',
  'course',
  'lesson',
  'exam',
  'professional_standard',
  'professional_guide',
  'legal_reference',
  'contract',
  'policy_document',
  'governance_proposal',
  'runbook',
  'release_note',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_CATEGORY_IDS = [
  'intercommunication',
  'leisure_reading',
  'community_knowledge',
  'academic_material',
  'professional_material',
  'legal_content',
  'policy',
  'system_operations',
] as const;

export type ContentCategoryId = (typeof CONTENT_CATEGORY_IDS)[number];

export type ContentCategory = {
  id: ContentCategoryId;
  label: string;
  description: string;
  defaultLane: ModerationLane;
  defaultContentTypes: ContentType[];
  contributionPolicy: ContributionPolicy;
  allowedProfessions: UserProfession[];
  requiredContributionPermission: AppPermission;
  requiredReviewPermission: AppPermission;
};

export type ContentClassificationInput = {
  source?: string | null;
  contentType?: string | null;
  title?: string | null;
  body?: string | null;
  tags?: string[];
  intendedUse?: string | null;
  professionalDomain?: UserProfession | null;
};

export type ContentClassification = {
  categoryId: ContentCategoryId;
  lane: ModerationLane;
  contentType: ContentType;
  professionalDomain: UserProfession;
  confidence: number;
  reasons: string[];
};

export type ContributionDecision = {
  allowed: boolean;
  reason: string;
  requiredPermission: AppPermission;
  requiresProfession: boolean;
};

type KeywordRule = {
  categoryId: ContentCategoryId;
  contentType: ContentType;
  profession: UserProfession;
  confidence: number;
  keywords: string[];
};

const STAFF_OVERRIDE_ROLES = new Set<AppRole>(['founder', 'admin', 'system']);
const VERIFIED_CONTENT_ROLES = new Set<AppRole>([
  'citizen',
  'verified_member',
  'certified',
  'moderator',
  'market_manager',
  'founder',
  'admin',
  'system',
]);

export const CONTENT_CATEGORIES: ContentCategory[] = [
  {
    id: 'intercommunication',
    label: 'Intercommunication',
    description: 'Ordinary chat, direct messages, comments, and lightweight social posting.',
    defaultLane: 'unmoderated',
    defaultContentTypes: ['chat_message', 'direct_message', 'comment', 'social_post'],
    contributionPolicy: 'open',
    allowedProfessions: ['none'],
    requiredContributionPermission: 'content.contribute_unmoderated',
    requiredReviewPermission: 'content.moderate',
  },
  {
    id: 'leisure_reading',
    label: 'Leisure reading',
    description: 'Books and notes used for personal enjoyment rather than formal learning.',
    defaultLane: 'unmoderated',
    defaultContentTypes: ['book', 'leisure_note'],
    contributionPolicy: 'open',
    allowedProfessions: ['none', 'arts_culture', 'education'],
    requiredContributionPermission: 'content.contribute_unmoderated',
    requiredReviewPermission: 'content.moderate',
  },
  {
    id: 'community_knowledge',
    label: 'Community knowledge',
    description: 'Informal public-interest knowledge that is not authoritative professional material.',
    defaultLane: 'unmoderated',
    defaultContentTypes: ['social_post', 'lesson'],
    contributionPolicy: 'verified_only',
    allowedProfessions: ['none', 'education', 'governance', 'technology', 'arts_culture'],
    requiredContributionPermission: 'content.contribute_unmoderated',
    requiredReviewPermission: 'content.review',
  },
  {
    id: 'academic_material',
    label: 'Academic material',
    description: 'Study books, courses, lessons, exams, curricula, and formal learning paths.',
    defaultLane: 'moderated',
    defaultContentTypes: ['study_book', 'course', 'lesson', 'exam'],
    contributionPolicy: 'certified_professionals',
    allowedProfessions: ['education', 'law', 'governance', 'technology', 'environment', 'economics'],
    requiredContributionPermission: 'content.contribute_moderated',
    requiredReviewPermission: 'content.review',
  },
  {
    id: 'professional_material',
    label: 'Professional material',
    description: 'Professional standards, certification materials, and discipline-specific guidance.',
    defaultLane: 'moderated',
    defaultContentTypes: ['professional_standard', 'professional_guide'],
    contributionPolicy: 'certified_professionals',
    allowedProfessions: [
      'education',
      'law',
      'governance',
      'medicine',
      'finance',
      'engineering',
      'technology',
      'environment',
      'economics',
    ],
    requiredContributionPermission: 'content.contribute_moderated',
    requiredReviewPermission: 'content.review',
  },
  {
    id: 'legal_content',
    label: 'Legal content',
    description: 'Constitutions, laws, contracts, compliance material, and rights frameworks.',
    defaultLane: 'moderated',
    defaultContentTypes: ['legal_reference', 'contract'],
    contributionPolicy: 'certified_professionals',
    allowedProfessions: ['law', 'governance'],
    requiredContributionPermission: 'content.contribute_moderated',
    requiredReviewPermission: 'content.review',
  },
  {
    id: 'policy',
    label: 'Policy',
    description: 'Platform policy, governance rules, monetary policy, and moderation policy.',
    defaultLane: 'moderated',
    defaultContentTypes: ['policy_document', 'governance_proposal'],
    contributionPolicy: 'staff_only',
    allowedProfessions: ['governance', 'finance', 'economics', 'law'],
    requiredContributionPermission: 'content.contribute_moderated',
    requiredReviewPermission: 'content.review',
  },
  {
    id: 'system_operations',
    label: 'System operations',
    description: 'Developer runbooks, release procedures, infrastructure, security, and database operations.',
    defaultLane: 'moderated',
    defaultContentTypes: ['runbook', 'release_note'],
    contributionPolicy: 'staff_only',
    allowedProfessions: ['technology', 'engineering', 'governance'],
    requiredContributionPermission: 'content.contribute_moderated',
    requiredReviewPermission: 'content.review',
  },
];

export const CONTENT_CATEGORY_MAP = Object.fromEntries(
  CONTENT_CATEGORIES.map((category) => [category.id, category]),
) as Record<ContentCategoryId, ContentCategory>;

const CONTENT_TYPE_CATEGORY_MAP: Partial<Record<ContentType, ContentCategoryId>> = Object.fromEntries(
  CONTENT_CATEGORIES.flatMap((category) =>
    category.defaultContentTypes.map((contentType) => [contentType, category.id]),
  ),
) as Partial<Record<ContentType, ContentCategoryId>>;

const SOURCE_CATEGORY_MAP: Record<string, Pick<ContentClassification, 'categoryId' | 'contentType' | 'professionalDomain'>> = {
  chat: { categoryId: 'intercommunication', contentType: 'chat_message', professionalDomain: 'none' },
  message: { categoryId: 'intercommunication', contentType: 'direct_message', professionalDomain: 'none' },
  direct_message: { categoryId: 'intercommunication', contentType: 'direct_message', professionalDomain: 'none' },
  comment: { categoryId: 'intercommunication', contentType: 'comment', professionalDomain: 'none' },
  post: { categoryId: 'intercommunication', contentType: 'social_post', professionalDomain: 'none' },
  study: { categoryId: 'academic_material', contentType: 'study_book', professionalDomain: 'education' },
  law: { categoryId: 'legal_content', contentType: 'legal_reference', professionalDomain: 'law' },
  policy: { categoryId: 'policy', contentType: 'policy_document', professionalDomain: 'governance' },
  docs: { categoryId: 'system_operations', contentType: 'runbook', professionalDomain: 'technology' },
};

const KEYWORD_RULES: KeywordRule[] = [
  {
    categoryId: 'legal_content',
    contentType: 'legal_reference',
    profession: 'law',
    confidence: 0.92,
    keywords: ['constitution', 'statute', 'law', 'legal', 'contract', 'compliance', 'regulation', 'rights'],
  },
  {
    categoryId: 'policy',
    contentType: 'policy_document',
    profession: 'governance',
    confidence: 0.9,
    keywords: ['policy', 'governance', 'moderation policy', 'monetary policy', 'ratification', 'procedure'],
  },
  {
    categoryId: 'professional_material',
    contentType: 'professional_guide',
    profession: 'education',
    confidence: 0.88,
    keywords: ['certification', 'professional standard', 'practice guide', 'clinical', 'engineering standard', 'accounting'],
  },
  {
    categoryId: 'academic_material',
    contentType: 'study_book',
    profession: 'education',
    confidence: 0.86,
    keywords: ['study', 'course', 'lesson', 'curriculum', 'exam', 'workbook', 'academic', 'training'],
  },
  {
    categoryId: 'system_operations',
    contentType: 'runbook',
    profession: 'technology',
    confidence: 0.84,
    keywords: ['release', 'deployment', 'database', 'runbook', 'security', 'remote access', 'migration'],
  },
  {
    categoryId: 'leisure_reading',
    contentType: 'book',
    profession: 'none',
    confidence: 0.74,
    keywords: ['novel', 'story', 'poem', 'leisure', 'reading for fun', 'fiction'],
  },
  {
    categoryId: 'intercommunication',
    contentType: 'chat_message',
    profession: 'none',
    confidence: 0.7,
    keywords: ['chat', 'message', 'comment', 'conversation', 'reply'],
  },
];

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

function isContentType(value?: string | null): value is ContentType {
  return CONTENT_TYPES.includes(value as ContentType);
}

function getTextInput(input: ContentClassificationInput) {
  return [
    input.source,
    input.contentType,
    input.title,
    input.body,
    input.intendedUse,
    ...(input.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function inferProfessionalDomain(
  categoryId: ContentCategoryId,
  requestedProfession?: UserProfession | null,
): UserProfession {
  if (requestedProfession && USER_PROFESSIONS.includes(requestedProfession)) {
    return requestedProfession;
  }

  const category = CONTENT_CATEGORY_MAP[categoryId];
  return category.allowedProfessions.find((profession) => profession !== 'none') || 'none';
}

export function getContentCategory(categoryId: ContentCategoryId) {
  return CONTENT_CATEGORY_MAP[categoryId];
}

export function classifyContent(input: ContentClassificationInput): ContentClassification {
  const source = normalize(input.source);
  const requestedContentType = normalize(input.contentType);
  const reasons: string[] = [];

  if (isContentType(requestedContentType)) {
    const categoryId = CONTENT_TYPE_CATEGORY_MAP[requestedContentType] || 'community_knowledge';
    const category = CONTENT_CATEGORY_MAP[categoryId];
    reasons.push(`Matched content type "${requestedContentType}" to ${category.id}.`);

    return {
      categoryId,
      lane: category.defaultLane,
      contentType: requestedContentType,
      professionalDomain: inferProfessionalDomain(categoryId, input.professionalDomain),
      confidence: 0.9,
      reasons,
    };
  }

  if (source && SOURCE_CATEGORY_MAP[source]) {
    const sourceMatch = SOURCE_CATEGORY_MAP[source];
    const category = CONTENT_CATEGORY_MAP[sourceMatch.categoryId];
    reasons.push(`Matched source "${source}" to ${category.id}.`);

    return {
      ...sourceMatch,
      professionalDomain: input.professionalDomain || sourceMatch.professionalDomain,
      lane: category.defaultLane,
      confidence: 0.94,
      reasons,
    };
  }

  const text = getTextInput(input);
  const keywordMatch = KEYWORD_RULES.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword)),
  );

  if (keywordMatch) {
    const category = CONTENT_CATEGORY_MAP[keywordMatch.categoryId];
    reasons.push(`Matched keyword signal to ${category.id}.`);

    return {
      categoryId: keywordMatch.categoryId,
      lane: category.defaultLane,
      contentType: keywordMatch.contentType,
      professionalDomain: input.professionalDomain || keywordMatch.profession,
      confidence: keywordMatch.confidence,
      reasons,
    };
  }

  reasons.push('No high-risk content signals found; defaulted to community knowledge.');
  return {
    categoryId: 'community_knowledge',
    lane: 'unmoderated',
    contentType: 'social_post',
    professionalDomain: input.professionalDomain || 'none',
    confidence: 0.55,
    reasons,
  };
}

export function getApprovedProfessions(assignments: UserProfessionAssignment[] = []) {
  return assignments
    .filter((assignment) => assignment.status === 'approved')
    .map((assignment) => assignment.profession);
}

export function hasAllowedProfession(
  assignments: UserProfessionAssignment[] = [],
  allowedProfessions: UserProfession[],
) {
  if (allowedProfessions.includes('none')) return true;
  const approvedProfessions = new Set(getApprovedProfessions(assignments));
  return allowedProfessions.some((profession) => approvedProfessions.has(profession));
}

export function canContributeToContent(args: {
  role: AppRole;
  permissions: AppPermission[];
  professions?: UserProfessionAssignment[];
  classification: Pick<ContentClassification, 'categoryId' | 'lane'>;
}) {
  const category = CONTENT_CATEGORY_MAP[args.classification.categoryId];
  const requiredPermission = category.requiredContributionPermission;
  const hasRequiredPermission = permissionListHas(args.permissions, requiredPermission);
  const hasModerationPermission = permissionListHas(args.permissions, 'content.moderate');
  const isStaffOverride = STAFF_OVERRIDE_ROLES.has(args.role);

  if (!hasRequiredPermission && !hasModerationPermission && !isStaffOverride) {
    return {
      allowed: false,
      reason: `Missing ${requiredPermission}.`,
      requiredPermission,
      requiresProfession: category.contributionPolicy === 'certified_professionals',
    } satisfies ContributionDecision;
  }

  if (category.contributionPolicy === 'open') {
    return {
      allowed: true,
      reason: 'Open category with required permission.',
      requiredPermission,
      requiresProfession: false,
    } satisfies ContributionDecision;
  }

  if (category.contributionPolicy === 'verified_only' && !VERIFIED_CONTENT_ROLES.has(args.role)) {
    return {
      allowed: false,
      reason: 'This category requires a verified or trusted role.',
      requiredPermission,
      requiresProfession: false,
    } satisfies ContributionDecision;
  }

  if (category.contributionPolicy === 'staff_only' && !isStaffRole(args.role)) {
    return {
      allowed: false,
      reason: 'This category is limited to staff roles.',
      requiredPermission,
      requiresProfession: false,
    } satisfies ContributionDecision;
  }

  if (category.contributionPolicy === 'certified_professionals') {
    const professionAllowed = hasAllowedProfession(args.professions, category.allowedProfessions);
    if (!professionAllowed && !isStaffOverride) {
      return {
        allowed: false,
        reason: 'This category requires an approved matching profession.',
        requiredPermission,
        requiresProfession: true,
      } satisfies ContributionDecision;
    }
  }

  return {
    allowed: true,
    reason: 'Role, permission, and profession requirements are satisfied.',
    requiredPermission,
    requiresProfession: category.contributionPolicy === 'certified_professionals',
  } satisfies ContributionDecision;
}

export function canReviewContent(args: {
  role: AppRole;
  permissions: AppPermission[];
  professions?: UserProfessionAssignment[];
  classification: Pick<ContentClassification, 'categoryId'>;
}) {
  const category = CONTENT_CATEGORY_MAP[args.classification.categoryId];
  const requiredPermission = category.requiredReviewPermission;

  if (STAFF_OVERRIDE_ROLES.has(args.role)) {
    return {
      allowed: true,
      reason: 'Staff override role can review this category.',
      requiredPermission,
      requiresProfession: false,
    } satisfies ContributionDecision;
  }

  if (!permissionListHas(args.permissions, requiredPermission)) {
    return {
      allowed: false,
      reason: `Missing ${requiredPermission}.`,
      requiredPermission,
      requiresProfession: category.contributionPolicy === 'certified_professionals',
    } satisfies ContributionDecision;
  }

  if (category.contributionPolicy === 'certified_professionals') {
    const professionAllowed = hasAllowedProfession(args.professions, category.allowedProfessions);
    if (!professionAllowed) {
      return {
        allowed: false,
        reason: 'Review requires an approved matching profession.',
        requiredPermission,
        requiresProfession: true,
      } satisfies ContributionDecision;
    }
  }

  return {
    allowed: true,
    reason: 'Review requirements are satisfied.',
    requiredPermission,
    requiresProfession: category.contributionPolicy === 'certified_professionals',
  } satisfies ContributionDecision;
}
