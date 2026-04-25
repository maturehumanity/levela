import { describe, expect, it } from 'vitest';

import { runSpecialistCouncil } from '@/lib/specialist-orchestration';

describe('runSpecialistCouncil', () => {
  it('routes legal/governance prompts to governance specialist', () => {
    const result = runSpecialistCouncil('I need legal advice for governance policy compliance.');
    expect(result.leadSpecialist.id).toBe('governance-specialist');
    expect(result.classifier.mode).toBe('study');
    expect(result.classifier.riskLevel).toBe('high');
  });

  it('routes issue-solving prompts into resolveIssues mode', () => {
    const result = runSpecialistCouncil('We have a security issue and need to fix the system quickly.');
    expect(result.classifier.mode).toBe('resolveIssues');
    expect(result.matchedSpecialists.some((specialist) => specialist.id === 'it-specialist')).toBe(true);
  });

  it('supports multi-specialist collaboration for cross-domain prompts', () => {
    const result = runSpecialistCouncil('Improve public health campaign strategy and community engagement.');
    expect(result.classifier.mode).toBe('improve');
    expect(result.matchedSpecialists.length).toBeGreaterThan(1);
    expect(result.finalSuggestion.toLowerCase()).toContain('incorporate input');
  });
});
