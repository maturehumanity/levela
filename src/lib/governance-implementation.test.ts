import { describe, expect, it } from 'vitest';

import {
  GOVERNANCE_EXECUTION_UNIT_KEYS,
  buildGovernanceImplementationQueue,
  determineGovernanceExecutionUnitKeys,
} from './governance-implementation';

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
});
