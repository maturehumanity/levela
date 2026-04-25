import { describe, expect, it } from 'vitest';

import { buildGovernanceProposalExecutionMetadata, emptyGovernanceExecutionDraft } from '@/lib/governance-execution';

import {
  GOVERNANCE_EXECUTION_UNIT_KEYS,
  buildGovernanceImplementationQueue,
  buildGovernanceImplementationSummary,
  determineGovernanceExecutionUnitKeys,
  getGovernanceImplementationStatusClassName,
  getGovernanceImplementationStatusLabelKey,
  getGovernanceUnitLabelKey,
} from './governance-implementation';
import type { GovernanceImplementationStatus } from './governance-implementation';

describe('governance-implementation', () => {
  it('maps constitutional proposals to the constitutional council', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'constitutional',
        proposalType: 'citizen_proposal',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.constitutionalCouncil]);
  });

  it('maps ordinary proposals to civic operations by default', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'citizen_proposal',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.civicOperations]);
  });

  it('honors an explicit requested execution unit in proposal metadata', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'citizen_proposal',
        metadata: { requested_unit_key: 'custom_unit' },
      }),
    ).toEqual(['custom_unit']);
  });

  it('ignores non-string requested_unit_key values and falls back to proposal routing', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'citizen_proposal',
        metadata: { requested_unit_key: 123 as unknown as string },
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.civicOperations]);
  });

  it('routes treasury and monetary proposals to treasury finance', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'annual_treasury_review',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.treasuryFinance]);
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'monetary_policy_update',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.treasuryFinance]);
  });

  it('routes identity and verification proposals to identity verification', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'identity_access_controls',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.identityVerification]);
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'verification_workflow',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.identityVerification]);
  });

  it('routes security proposals to security response', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'security_patch_rollout',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.securityResponse]);
  });

  it('routes technical, system, and build proposals to technical stewardship', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'technical_debt_paydown',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.technicalStewardship]);
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'system_upgrade_window',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.technicalStewardship]);
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'ordinary',
        proposalType: 'build_pipeline_change',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.technicalStewardship]);
  });

  it('maps elevated proposals to policy and legal when no higher-priority routing applies', () => {
    expect(
      determineGovernanceExecutionUnitKeys({
        decisionClass: 'elevated',
        proposalType: 'citizen_proposal',
      }),
    ).toEqual([GOVERNANCE_EXECUTION_UNIT_KEYS.policyLegal]);
  });

  it('builds a human summary from title and summary for manual follow-through executions', () => {
    expect(
      buildGovernanceImplementationSummary({
        title: 'Park hours',
        summary: 'Extend evening access',
        decision_class: 'ordinary',
        metadata: {},
      }),
    ).toBe('Park hours: Extend evening access');
  });

  it('prefers execution descriptions when metadata includes an auto-executable action', () => {
    const metadata = buildGovernanceProposalExecutionMetadata({
      ...emptyGovernanceExecutionDraft,
      actionType: 'grant_role_permission',
      targetRole: 'moderator',
      targetPermission: 'law.review',
    });

    const summary = buildGovernanceImplementationSummary({
      title: 'Permission matrix',
      summary: 'This summary is not shown for auto executions',
      decision_class: 'ordinary',
      metadata,
    });

    expect(summary.startsWith('Permission matrix:')).toBe(true);
    expect(summary).toContain('Grant');
    expect(summary).toContain('law.review');
  });

  it('exposes stable translation keys and Tailwind classes for implementation statuses', () => {
    expect(getGovernanceImplementationStatusLabelKey('queued')).toBe('governanceHub.implementationStatuses.queued');
    expect(getGovernanceImplementationStatusLabelKey('in_progress')).toBe(
      'governanceHub.implementationStatuses.in_progress',
    );
    expect(getGovernanceImplementationStatusLabelKey('completed')).toBe('governanceHub.implementationStatuses.completed');
    expect(getGovernanceImplementationStatusLabelKey('blocked')).toBe('governanceHub.implementationStatuses.blocked');
    expect(getGovernanceImplementationStatusLabelKey('cancelled')).toBe('governanceHub.implementationStatuses.cancelled');

    expect(getGovernanceImplementationStatusClassName('queued')).toContain('amber');
    expect(getGovernanceImplementationStatusClassName('in_progress')).toContain('sky');
    expect(getGovernanceImplementationStatusClassName('completed')).toContain('emerald');
    expect(getGovernanceImplementationStatusClassName('blocked')).toContain('destructive');
    expect(getGovernanceImplementationStatusClassName('cancelled')).toContain('muted');

    expect(getGovernanceImplementationStatusLabelKey('unknown_status' as GovernanceImplementationStatus)).toBe(
      'governanceHub.implementationStatuses.queued',
    );
    expect(getGovernanceImplementationStatusClassName('unknown_status' as GovernanceImplementationStatus)).toContain('amber');
  });

  it('prefixes execution unit keys for translation lookup', () => {
    expect(getGovernanceUnitLabelKey(GOVERNANCE_EXECUTION_UNIT_KEYS.civicOperations)).toBe(
      'governanceHub.units.civic_operations',
    );
  });

  it('builds implementation queue entries from available units', () => {
    const queue = buildGovernanceImplementationQueue({
      createdBy: 'profile-1',
      proposal: {
        id: 'proposal-1',
        title: 'Update proposal flow',
        summary: 'Move proposal approval into execution queue',
        decision_class: 'elevated',
        proposal_type: 'policy_update',
        metadata: {},
      },
      unitsByKey: {
        [GOVERNANCE_EXECUTION_UNIT_KEYS.policyLegal]: {
          id: 'unit-1',
          unit_key: GOVERNANCE_EXECUTION_UNIT_KEYS.policyLegal,
          name: 'Policy and Legal Unit',
          description: '',
          domain_key: 'policy_legal',
          is_system_unit: true,
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      },
    });

    expect(queue).toEqual([
      {
        proposal_id: 'proposal-1',
        unit_id: 'unit-1',
        status: 'queued',
        implementation_summary: 'Update proposal flow: Move proposal approval into execution queue',
        created_by: 'profile-1',
        metadata: {
          unit_key: GOVERNANCE_EXECUTION_UNIT_KEYS.policyLegal,
          unit_domain_key: 'policy_legal',
          decision_class: 'elevated',
        },
      },
    ]);
  });

  it('returns an empty queue when resolved execution units are not present locally', () => {
    expect(
      buildGovernanceImplementationQueue({
        createdBy: 'profile-1',
        proposal: {
          id: 'proposal-1',
          title: 'T',
          summary: 'S',
          decision_class: 'elevated',
          proposal_type: 'policy_update',
          metadata: {},
        },
        unitsByKey: {},
      }),
    ).toEqual([]);
  });
});
