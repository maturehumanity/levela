import { describe, expect, it } from 'vitest';

import {
  canContributeToContent,
  canReviewContent,
  classifyContent,
  CONTENT_CATEGORY_MAP,
} from '@/lib/content-governance';
import { rolePermissionMap } from '@/lib/access-control';

describe('content governance', () => {
  it('classifies ordinary chat as unmoderated intercommunication', () => {
    const classification = classifyContent({
      source: 'chat',
      body: 'Are you joining the study group later?',
    });

    expect(classification.categoryId).toBe('intercommunication');
    expect(classification.lane).toBe('unmoderated');
    expect(classification.contentType).toBe('chat_message');
  });

  it('classifies study books as moderated academic material', () => {
    const classification = classifyContent({
      title: 'Study Book for Algebra',
      body: 'This curriculum includes lessons, exams, and workbook practice.',
    });

    expect(classification.categoryId).toBe('academic_material');
    expect(classification.lane).toBe('moderated');
    expect(classification.professionalDomain).toBe('education');
  });

  it('classifies legal and policy material into stricter moderated categories', () => {
    const legal = classifyContent({
      title: 'Universal Constitution',
      body: 'Foundational rights, legal responsibilities, and institutional authority.',
    });
    const policy = classifyContent({
      contentType: 'policy_document',
      title: 'Monetary Policy Operating Rules',
    });

    expect(legal.categoryId).toBe('legal_content');
    expect(legal.lane).toBe('moderated');
    expect(policy.categoryId).toBe('policy');
    expect(policy.lane).toBe('moderated');
  });

  it('allows members to contribute open unmoderated content', () => {
    const decision = canContributeToContent({
      role: 'member',
      permissions: rolePermissionMap.member,
      classification: {
        categoryId: 'intercommunication',
        lane: 'unmoderated',
      },
    });

    expect(decision.allowed).toBe(true);
  });

  it('requires a matching approved profession for certified moderated contribution', () => {
    const classification = {
      categoryId: 'legal_content' as const,
      lane: CONTENT_CATEGORY_MAP.legal_content.defaultLane,
    };
    const withoutProfession = canContributeToContent({
      role: 'certified',
      permissions: rolePermissionMap.certified,
      professions: [{ profession: 'education', status: 'approved' }],
      classification,
    });
    const withProfession = canContributeToContent({
      role: 'certified',
      permissions: rolePermissionMap.certified,
      professions: [{ profession: 'law', status: 'approved' }],
      classification,
    });

    expect(withoutProfession.allowed).toBe(false);
    expect(withProfession.allowed).toBe(true);
  });

  it('keeps professional review scoped to approved professions', () => {
    const decision = canReviewContent({
      role: 'certified',
      permissions: rolePermissionMap.certified,
      professions: [{ profession: 'technology', status: 'approved' }],
      classification: {
        categoryId: 'academic_material',
      },
    });

    expect(decision.allowed).toBe(true);
  });
});
