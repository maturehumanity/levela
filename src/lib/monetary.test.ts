import { describe, expect, it } from 'vitest';

import {
  calculateInflationDampeningAdjustment,
  calculateQuarterlyIssuanceCeiling,
  createMonetaryPolicy,
  createSupplyState,
  evaluateIssuanceRequest,
  executeApprovedIssuance,
  triggerAffordabilityAlert,
  type ApprovalState,
  type IssuanceRequest,
  type MonetarySystemMetrics,
} from '@/lib/monetary';

function createMetrics(overrides: Partial<MonetarySystemMetrics> = {}): MonetarySystemMetrics {
  return {
    inflationRate: 0.025,
    verifiedOutputValue: 50_000,
    reserveCoverageRatio: 0.3,
    idleLiquidityRatio: 0.2,
    affordabilityPressure: 0.04,
    civicBasketIndex: 104,
    ...overrides,
  };
}

function createApprovals(overrides: Partial<ApprovalState> = {}): ApprovalState {
  return {
    ordinary: [],
    elevated: [],
    emergency: [],
    ...overrides,
  };
}

function createRequest(overrides: Partial<IssuanceRequest> = {}): IssuanceRequest {
  return {
    id: 'req-1',
    amount: 5_000,
    category: 'citizen_compensation',
    reason: 'Quarterly compensation allocation',
    requestedBy: 'treasury-operator-1',
    requestedAt: '2026-04-12T00:00:00Z',
    decisionClass: 'ordinary',
    intent: 'execute',
    ...overrides,
  };
}

describe('monetary module', () => {
  it('calculates inflation dampening and quarterly issuance ceiling from the policy formula', () => {
    const policy = createMonetaryPolicy({
      activeCitizens: 1_000,
      civicLiquidityBaseline: 20,
      outputLiquidityRatio: 0.1,
      approvedPublicBudget: 5_000,
      inflationTarget: 0.03,
      stabilityDampeningMultiplier: 1_000,
    });

    const inflationDampening = calculateInflationDampeningAdjustment(0.05, 0.03, 1_000);
    const ceiling = calculateQuarterlyIssuanceCeiling(policy, createMetrics({ inflationRate: 0.05, verifiedOutputValue: 40_000 }));

    expect(inflationDampening).toBe(20);
    expect(ceiling).toBe(28_980);
  });

  it('rejects execution requests that do not provide simulation evidence', () => {
    const policy = createMonetaryPolicy({
      activeCitizens: 10_000,
      civicLiquidityBaseline: 25,
      approvedPublicBudget: 100_000,
    });

    const evaluation = evaluateIssuanceRequest({
      request: createRequest(),
      policy,
      metrics: createMetrics(),
      supplyState: createSupplyState({ circulating: 500_000, reserve: 300_000, development: 100_000 }),
      issuedThisQuarter: 50_000,
      approvals: createApprovals(),
      hasSimulationEvidence: false,
    });

    expect(evaluation.status).toBe('reject_or_escalate');
    expect(evaluation.reasons.some((reason) => reason.includes('simulation evidence'))).toBe(true);
  });

  it('requires human approval when the request exceeds auto-approval limits', () => {
    const policy = createMonetaryPolicy({
      activeCitizens: 20_000,
      civicLiquidityBaseline: 50,
      approvedPublicBudget: 150_000,
      autoApprovalLimit: 10_000,
    });

    const evaluation = evaluateIssuanceRequest({
      request: createRequest({ amount: 60_000 }),
      policy,
      metrics: createMetrics({ verifiedOutputValue: 150_000 }),
      supplyState: createSupplyState({ circulating: 1_000_000, reserve: 250_000, development: 300_000 }),
      issuedThisQuarter: 125_000,
      approvals: createApprovals(),
      hasSimulationEvidence: true,
    });

    expect(evaluation.status).toBe('require_human_approval');
    expect(evaluation.requiredApprovalClass).toBe('ordinary');
    expect(evaluation.requiredApprovalCount).toBeGreaterThanOrEqual(2);
  });

  it('enforces enhanced emergency approval thresholds', () => {
    const policy = createMonetaryPolicy({
      activeCitizens: 20_000,
      civicLiquidityBaseline: 50,
      approvedPublicBudget: 200_000,
      approvalQuorum: { ordinary: 2, elevated: 3, emergency: 4 },
      maxInflationRisk: 0.05,
      inflationTransmissionFactor: 0.05,
    });

    const commonInput = {
      request: createRequest({
        id: 'req-emergency',
        category: 'emergency_stabilization',
        amount: 8_000,
      }),
      policy,
      metrics: createMetrics(),
      supplyState: createSupplyState({ circulating: 800_000, reserve: 600_000, development: 120_000, emergency: 10_000 }),
      issuedThisQuarter: 100_000,
      hasSimulationEvidence: true,
    };

    const withoutEmergencyApprovals = evaluateIssuanceRequest({
      ...commonInput,
      approvals: createApprovals({ emergency: ['a-1', 'a-2', 'a-3'] }),
    });

    const withEmergencyApprovals = evaluateIssuanceRequest({
      ...commonInput,
      approvals: createApprovals({ emergency: ['a-1', 'a-2', 'a-3', 'a-4'] }),
    });

    expect(withoutEmergencyApprovals.status).toBe('require_human_approval');
    expect(withoutEmergencyApprovals.requiredApprovalClass).toBe('emergency');
    expect(withEmergencyApprovals.status).toBe('approve_for_execution');
  });

  it('rejects issuance when projected inflation risk breaches policy guardrails', () => {
    const policy = createMonetaryPolicy({
      activeCitizens: 5_000,
      civicLiquidityBaseline: 20,
      approvedPublicBudget: 20_000,
      maxInflationRisk: 0.001,
      inflationTransmissionFactor: 1,
    });

    const evaluation = evaluateIssuanceRequest({
      request: createRequest({ amount: 200_000 }),
      policy,
      metrics: createMetrics({ inflationRate: 0.03 }),
      supplyState: createSupplyState({ circulating: 100_000, reserve: 20_000, development: 5_000 }),
      issuedThisQuarter: 10_000,
      approvals: createApprovals({ ordinary: ['a-1', 'a-2', 'a-3'] }),
      hasSimulationEvidence: true,
    });

    expect(evaluation.status).toBe('reject_or_escalate');
    expect(evaluation.reasons.some((reason) => reason.includes('inflation risk'))).toBe(true);
  });

  it('executes approved issuance and returns updated supply, audit events, and stability snapshot', () => {
    const policy = createMonetaryPolicy({
      activeCitizens: 10_000,
      civicLiquidityBaseline: 30,
      approvedPublicBudget: 50_000,
      maxInflationRisk: 0.1,
      inflationTransmissionFactor: 0.02,
    });

    const request = createRequest({ amount: 7_500 });
    const supplyState = createSupplyState({ circulating: 300_000, reserve: 120_000, development: 25_000 });
    const metrics = createMetrics();

    const evaluation = evaluateIssuanceRequest({
      request,
      policy,
      metrics,
      supplyState,
      issuedThisQuarter: 20_000,
      approvals: createApprovals(),
      hasSimulationEvidence: true,
    });

    expect(evaluation.status).toBe('approve_for_execution');

    const execution = executeApprovedIssuance({
      request,
      evaluation,
      policy,
      metrics,
      currentSupplyState: supplyState,
      now: '2026-04-12T01:00:00Z',
    });

    expect(execution.updatedSupplyState.circulating).toBe(307_500);
    expect(execution.issuanceRecord.amount).toBe(7_500);
    expect(execution.auditEvents).toHaveLength(2);
    expect(execution.auditEvents[1].type).toBe('issuance_executed');
    expect(execution.stability.generatedAt).toBe('2026-04-12T01:00:00Z');
  });

  it('triggers affordability alerts when pressure exceeds threshold', () => {
    const policy = createMonetaryPolicy({ affordabilityAlertThreshold: 0.08 });
    const alert = triggerAffordabilityAlert(
      createMetrics({ affordabilityPressure: 0.15, civicBasketIndex: 115 }),
      policy,
    );

    expect(alert).not.toBeNull();
    expect(alert?.code).toBe('affordability');
    expect(alert?.severity).toBe('critical');
  });
});
