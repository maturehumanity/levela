import { describe, expect, it } from 'vitest';

import {
  buildStudyAiExplanation,
  deriveFoundationCertificationStatus,
  filterStudyDocumentsByQuery,
  getFoundationMaterialsForDomain,
  FOUNDATION_STUDY_DOCUMENT_KEYS,
  getFoundationCompletionMetrics,
  STUDY_PROPOSALS,
  STUDY_DOCUMENTS,
} from '@/lib/study';

describe('study module', () => {
  it('calculates foundational completion metrics from progress values', () => {
    const metrics = getFoundationCompletionMetrics({
      constitution: 100,
      laws: 100,
      citizenship: 0,
      economy: 100,
    });

    expect(metrics.completed).toBe(3);
    expect(metrics.total).toBe(FOUNDATION_STUDY_DOCUMENT_KEYS.length);
    expect(metrics.percent).toBe(75);
    expect(metrics.isComplete).toBe(false);
  });

  it('derives certification status with earned state treated as sticky', () => {
    const completeProgress = {
      constitution: 100,
      laws: 100,
      citizenship: 100,
      economy: 100,
    };

    expect(deriveFoundationCertificationStatus(completeProgress, 'pending')).toBe('eligible');
    expect(deriveFoundationCertificationStatus({ constitution: 100 }, 'pending')).toBe('pending');
    expect(deriveFoundationCertificationStatus({ constitution: 0 }, 'earned')).toBe('earned');
  });

  it('filters study documents using titles, summaries, and keyword metadata', () => {
    const byKeyword = filterStudyDocumentsByQuery(
      STUDY_DOCUMENTS,
      'monetary',
      (document) => document.titleKey,
      (document) => document.summaryKey,
    );
    const byDomain = filterStudyDocumentsByQuery(
      STUDY_DOCUMENTS,
      'citizenship',
      (document) => document.titleKey,
      (document) => document.summaryKey,
    );

    expect(byKeyword.some((document) => document.key === 'economy')).toBe(true);
    expect(byDomain.some((document) => document.key === 'citizenship')).toBe(true);
  });

  it('builds an AI explanation sentence with key learning context', () => {
    const explanation = buildStudyAiExplanation({
      title: 'Constitution',
      summary: 'Foundational civic principles and constitutional framework.',
      domainLabel: 'Constitution',
      estimatedMinutes: 18,
    });

    expect(explanation).toContain('Constitution belongs to the Constitution learning domain.');
    expect(explanation).toContain('about 18 minutes');
  });

  it('returns foundational materials for each primary domain', () => {
    const constitutionMaterials = getFoundationMaterialsForDomain('constitution');
    const economyMaterials = getFoundationMaterialsForDomain('economy');

    expect(constitutionMaterials.length).toBeGreaterThan(0);
    expect(economyMaterials.length).toBeGreaterThan(0);
    expect(constitutionMaterials.every((material) => material.domainId === 'constitution')).toBe(true);
  });

  it('includes proposal archive entries with routed destinations', () => {
    expect(STUDY_PROPOSALS.length).toBeGreaterThan(0);
    expect(STUDY_PROPOSALS.every((proposal) => proposal.route.startsWith('/'))).toBe(true);
  });
});
