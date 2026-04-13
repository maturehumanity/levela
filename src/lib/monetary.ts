export const LUMA_CURRENCY = {
  name: 'Luma',
  ticker: 'LUMA',
  symbol: 'LU',
  subunitName: 'Lumen',
  subunitsPerUnit: 100,
} as const;

export const CIVIC_BASKET_BASELINE_INDEX = 100;

export const SUPPLY_BUCKETS = [
  'circulating',
  'reserve',
  'development',
  'emergency',
] as const;

export const ISSUANCE_CATEGORIES = [
  'citizen_compensation',
  'public_infrastructure',
  'innovation_education_grants',
  'reserve_asset_conversion',
  'emergency_stabilization',
] as const;

export const POLICY_EXECUTION_MODES = [
  'advisory',
  'guardrail',
  'monitoring',
  'operational',
] as const;

export const DECISION_CLASSES = [
  'ordinary',
  'elevated',
  'constitutional',
] as const;

export const DEFAULT_ISSUANCE_BUCKET_BY_CATEGORY: Record<IssuanceCategory, SupplyBucket> = {
  citizen_compensation: 'circulating',
  public_infrastructure: 'development',
  innovation_education_grants: 'development',
  reserve_asset_conversion: 'reserve',
  emergency_stabilization: 'emergency',
};

export type SupplyBucket = (typeof SUPPLY_BUCKETS)[number];
export type IssuanceCategory = (typeof ISSUANCE_CATEGORIES)[number];
export type PolicyExecutionMode = (typeof POLICY_EXECUTION_MODES)[number];
export type MonetaryDecisionClass = (typeof DECISION_CLASSES)[number];
export type ApprovalClass = 'none' | 'ordinary' | 'elevated' | 'emergency';

export type SupplyState = {
  circulating: number;
  reserve: number;
  development: number;
  emergency: number;
  updatedAt: string;
};

export type MonetaryPolicy = {
  version: string;
  activeCitizens: number;
  civicLiquidityBaseline: number;
  outputLiquidityRatio: number;
  approvedPublicBudget: number;
  inflationTarget: number;
  stabilityDampeningMultiplier: number;
  maxInflationRisk: number;
  autoApprovalLimit: number;
  affordabilityAlertThreshold: number;
  minReserveCoverageRatio: number;
  maxIdleLiquidityRatio: number;
  inflationTransmissionFactor: number;
  affordabilityTransmissionFactor: number;
  allowedIssuanceCategories: readonly IssuanceCategory[];
  approvalQuorum: {
    ordinary: number;
    elevated: number;
    emergency: number;
  };
};

export type MonetarySystemMetrics = {
  inflationRate: number;
  verifiedOutputValue: number;
  reserveCoverageRatio: number;
  idleLiquidityRatio: number;
  affordabilityPressure: number;
  civicBasketIndex: number;
};

export type ApprovalState = {
  ordinary: string[];
  elevated: string[];
  emergency: string[];
};

export type IssuanceRequest = {
  id: string;
  amount: number;
  category: IssuanceCategory;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  decisionClass: MonetaryDecisionClass;
  intent: 'simulate' | 'execute';
  targetBucket?: SupplyBucket;
};

export type IssuanceImpactProjection = {
  projectedSupplyState: SupplyState;
  projectedTotalSupply: number;
  supplyGrowthRate: number;
  projectedInflationRate: number;
  inflationRisk: number;
  projectedAffordabilityPressure: number;
  projectedCivicBasketIndex: number;
  projectedReserveCoverageRatio: number;
};

export type MonetaryAlert = {
  code: 'inflation' | 'affordability' | 'reserve' | 'idle_liquidity';
  severity: 'warning' | 'critical';
  message: string;
  correctiveOptions: string[];
};

export type StabilitySnapshot = {
  status: 'stable' | 'warning' | 'critical';
  alerts: MonetaryAlert[];
  generatedAt: string;
};

export type AuditEventType =
  | 'issuance_request_validated'
  | 'issuance_request_requires_human_approval'
  | 'issuance_request_rejected'
  | 'issuance_executed';

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  requestId: string;
  timestamp: string;
  details: Record<string, unknown>;
};

export type IssuanceEvaluationStatus =
  | 'approve_for_execution'
  | 'require_human_approval'
  | 'reject_or_escalate';

export type IssuanceEvaluation = {
  status: IssuanceEvaluationStatus;
  reasons: string[];
  requiredApprovalClass: ApprovalClass;
  requiredApprovalCount: number;
  providedApprovalCount: number;
  projected: IssuanceImpactProjection;
  issueableSupplyCeiling: number;
  remainingQuarterlyCeiling: number;
  alerts: MonetaryAlert[];
  auditEvent: AuditEvent;
};

export type IssuanceRecord = {
  id: string;
  requestId: string;
  category: IssuanceCategory;
  targetBucket: SupplyBucket;
  amount: number;
  requestedBy: string;
  executedAt: string;
  approvalClass: ApprovalClass;
};

export type IssuanceExecutionResult = {
  updatedSupplyState: SupplyState;
  issuanceRecord: IssuanceRecord;
  stability: StabilitySnapshot;
  auditEvents: AuditEvent[];
};

export type CivicBasketComponent = {
  key: string;
  weight: number;
  baselinePrice: number;
  currentPrice: number;
};

const DEFAULT_NOW = () => new Date().toISOString();

function round(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function createAuditEvent(
  type: AuditEventType,
  requestId: string,
  details: Record<string, unknown>,
  timestamp = DEFAULT_NOW(),
): AuditEvent {
  return Object.freeze({
    id: `${requestId}:${type}:${timestamp}`,
    type,
    requestId,
    timestamp,
    details: Object.freeze({ ...details }),
  });
}

function getRequiredApprovalClass(
  request: IssuanceRequest,
  policy: MonetaryPolicy,
): ApprovalClass {
  if (request.category === 'emergency_stabilization') return 'emergency';
  if (request.decisionClass === 'elevated') return 'elevated';
  if (request.amount > policy.autoApprovalLimit) return 'ordinary';
  return 'none';
}

function getRequiredApprovalCount(
  requiredApprovalClass: ApprovalClass,
  policy: MonetaryPolicy,
) {
  if (requiredApprovalClass === 'none') return 0;
  // Enforce "no single-person issuance authority" even if policy config is lower.
  return Math.max(2, policy.approvalQuorum[requiredApprovalClass]);
}

function getUniqueApproverCount(values: string[]) {
  return new Set(values).size;
}

export const FOUNDATIONAL_MONETARY_POLICY: MonetaryPolicy = {
  version: '1.0.0-foundational',
  activeCitizens: 0,
  civicLiquidityBaseline: 0,
  outputLiquidityRatio: 0.12,
  approvedPublicBudget: 0,
  inflationTarget: 0.03,
  stabilityDampeningMultiplier: 100_000,
  maxInflationRisk: 0.015,
  autoApprovalLimit: 25_000,
  affordabilityAlertThreshold: 0.08,
  minReserveCoverageRatio: 0.2,
  maxIdleLiquidityRatio: 0.35,
  inflationTransmissionFactor: 0.5,
  affordabilityTransmissionFactor: 0.65,
  allowedIssuanceCategories: [...ISSUANCE_CATEGORIES],
  approvalQuorum: {
    ordinary: 2,
    elevated: 3,
    emergency: 4,
  },
};

export function createMonetaryPolicy(overrides: Partial<MonetaryPolicy> = {}): MonetaryPolicy {
  return {
    ...FOUNDATIONAL_MONETARY_POLICY,
    ...overrides,
    allowedIssuanceCategories:
      overrides.allowedIssuanceCategories ?? FOUNDATIONAL_MONETARY_POLICY.allowedIssuanceCategories,
    approvalQuorum: {
      ...FOUNDATIONAL_MONETARY_POLICY.approvalQuorum,
      ...(overrides.approvalQuorum ?? {}),
    },
  };
}

export function createSupplyState(
  values: Partial<Omit<SupplyState, 'updatedAt'>> = {},
  updatedAt = DEFAULT_NOW(),
): SupplyState {
  return {
    circulating: values.circulating ?? 0,
    reserve: values.reserve ?? 0,
    development: values.development ?? 0,
    emergency: values.emergency ?? 0,
    updatedAt,
  };
}

export function sumSupplyBuckets(state: SupplyState) {
  return state.circulating + state.reserve + state.development + state.emergency;
}

export function toLumens(lumaAmount: number) {
  return Math.round(lumaAmount * LUMA_CURRENCY.subunitsPerUnit);
}

export function fromLumens(lumenAmount: number) {
  return lumenAmount / LUMA_CURRENCY.subunitsPerUnit;
}

export function calculateInflationDampeningAdjustment(
  inflationRate: number,
  inflationTarget: number,
  stabilityDampeningMultiplier: number,
) {
  return round(Math.max(0, (inflationRate - inflationTarget) * stabilityDampeningMultiplier), 8);
}

export function calculateQuarterlyIssuanceCeiling(
  policy: MonetaryPolicy,
  metrics: Pick<MonetarySystemMetrics, 'inflationRate' | 'verifiedOutputValue'>,
) {
  const inflationDampeningAdjustment = calculateInflationDampeningAdjustment(
    metrics.inflationRate,
    policy.inflationTarget,
    policy.stabilityDampeningMultiplier,
  );

  const ceiling =
    policy.activeCitizens * policy.civicLiquidityBaseline
    + metrics.verifiedOutputValue * policy.outputLiquidityRatio
    + policy.approvedPublicBudget
    - inflationDampeningAdjustment;

  return Math.max(0, round(ceiling, 2));
}

export function calculateCivicBasketIndex(components: CivicBasketComponent[]) {
  if (components.length === 0) return CIVIC_BASKET_BASELINE_INDEX;

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  if (totalWeight <= 0) return CIVIC_BASKET_BASELINE_INDEX;

  const weightedRatio = components.reduce((sum, component) => {
    if (component.baselinePrice <= 0) return sum;
    return sum + (component.weight / totalWeight) * (component.currentPrice / component.baselinePrice);
  }, 0);

  return round(weightedRatio * CIVIC_BASKET_BASELINE_INDEX, 4);
}

export function evaluateInflationPressure(metrics: MonetarySystemMetrics, policy: MonetaryPolicy) {
  const delta = metrics.inflationRate - policy.inflationTarget;
  if (delta > 0.005) return 'above_target';
  if (delta < -0.005) return 'below_target';
  return 'on_target';
}

export function triggerAffordabilityAlert(
  metrics: MonetarySystemMetrics,
  policy: MonetaryPolicy,
): MonetaryAlert | null {
  if (metrics.affordabilityPressure <= policy.affordabilityAlertThreshold) {
    return null;
  }

  return {
    code: 'affordability',
    severity: 'critical',
    message: 'Civic essentials are becoming less affordable than policy allows.',
    correctiveOptions: [
      'Investigate supply-side shortages in essential goods and services.',
      'Prioritize targeted affordability support over broad untargeted issuance.',
      'Review reserve strength and anti-abuse controls in affected sectors.',
    ],
  };
}

export function evaluatePolicySignals(
  metrics: MonetarySystemMetrics,
  policy: MonetaryPolicy,
  now = DEFAULT_NOW(),
): StabilitySnapshot {
  const alerts: MonetaryAlert[] = [];

  if (metrics.inflationRate > policy.inflationTarget) {
    alerts.push({
      code: 'inflation',
      severity: 'warning',
      message: 'Inflation is above target and requires stability-first response.',
      correctiveOptions: [
        'Reduce near-term issuance ceilings.',
        'Increase reserve retention.',
        'Slow non-essential public distributions until inflation normalizes.',
      ],
    });
  }

  const affordabilityAlert = triggerAffordabilityAlert(metrics, policy);
  if (affordabilityAlert) {
    alerts.push(affordabilityAlert);
  }

  if (metrics.reserveCoverageRatio < policy.minReserveCoverageRatio) {
    alerts.push({
      code: 'reserve',
      severity: 'warning',
      message: 'Reserve coverage is below the minimum safety threshold.',
      correctiveOptions: [
        'Rebuild reserve allocation before expanding non-essential issuance.',
        'Rebalance reserve assets toward lower-volatility holdings.',
      ],
    });
  }

  if (metrics.idleLiquidityRatio > policy.maxIdleLiquidityRatio) {
    alerts.push({
      code: 'idle_liquidity',
      severity: 'warning',
      message: 'Idle liquidity is elevated and can weaken monetary efficiency.',
      correctiveOptions: [
        'Strengthen savings incentives and productive allocation programs.',
        'Tune fees or allocation windows to discourage inactive hoarding.',
      ],
    });
  }

  const hasCriticalAlert = alerts.some((alert) => alert.severity === 'critical');
  const status = hasCriticalAlert ? 'critical' : alerts.length > 0 ? 'warning' : 'stable';

  return {
    status,
    alerts,
    generatedAt: now,
  };
}

export function simulateIssuanceImpact(
  request: Pick<IssuanceRequest, 'amount' | 'category' | 'targetBucket'>,
  supplyState: SupplyState,
  metrics: MonetarySystemMetrics,
  policy: MonetaryPolicy,
): IssuanceImpactProjection {
  const targetBucket = request.targetBucket ?? DEFAULT_ISSUANCE_BUCKET_BY_CATEGORY[request.category];
  const projectedSupplyState: SupplyState = {
    ...supplyState,
    [targetBucket]: round(supplyState[targetBucket] + request.amount, 2),
  };

  const currentTotalSupply = Math.max(1, sumSupplyBuckets(supplyState));
  const projectedTotalSupply = sumSupplyBuckets(projectedSupplyState);
  const supplyGrowthRate = request.amount / currentTotalSupply;

  const projectedInflationRate = metrics.inflationRate + supplyGrowthRate * policy.inflationTransmissionFactor;
  const inflationRisk = Math.max(0, projectedInflationRate - policy.inflationTarget);
  const projectedAffordabilityPressure = Math.max(
    0,
    metrics.affordabilityPressure + inflationRisk * policy.affordabilityTransmissionFactor,
  );
  const projectedReserveCoverageRatio = projectedSupplyState.reserve / Math.max(1, projectedSupplyState.circulating);
  const projectedCivicBasketIndex = round(
    CIVIC_BASKET_BASELINE_INDEX * (1 + projectedAffordabilityPressure),
    4,
  );

  return {
    projectedSupplyState,
    projectedTotalSupply: round(projectedTotalSupply, 2),
    supplyGrowthRate: round(supplyGrowthRate, 8),
    projectedInflationRate: round(projectedInflationRate, 8),
    inflationRisk: round(inflationRisk, 8),
    projectedAffordabilityPressure: round(projectedAffordabilityPressure, 8),
    projectedCivicBasketIndex,
    projectedReserveCoverageRatio: round(projectedReserveCoverageRatio, 8),
  };
}

export function evaluateIssuanceRequest(input: {
  request: IssuanceRequest;
  policy: MonetaryPolicy;
  metrics: MonetarySystemMetrics;
  supplyState: SupplyState;
  issuedThisQuarter: number;
  approvals?: ApprovalState;
  hasSimulationEvidence: boolean;
  now?: string;
}): IssuanceEvaluation {
  const { request, policy, metrics, supplyState } = input;
  const now = input.now ?? DEFAULT_NOW();
  const approvals = input.approvals ?? { ordinary: [], elevated: [], emergency: [] };

  const reasons: string[] = [];

  if (request.amount <= 0) {
    reasons.push('Issuance amount must be greater than zero.');
  }

  if (!policy.allowedIssuanceCategories.includes(request.category)) {
    reasons.push('Issuance category is not allowed by the active policy.');
  }

  if (request.decisionClass === 'constitutional') {
    reasons.push('Constitutional monetary actions cannot be self-executed by the AI module.');
  }

  if (request.intent === 'execute' && !input.hasSimulationEvidence) {
    reasons.push('Execution mode requires prior simulation evidence.');
  }

  const issueableSupplyCeiling = calculateQuarterlyIssuanceCeiling(policy, metrics);
  const remainingQuarterlyCeiling = Math.max(0, round(issueableSupplyCeiling - input.issuedThisQuarter, 2));

  if (request.amount > remainingQuarterlyCeiling) {
    reasons.push('Requested amount exceeds the remaining quarterly issuance ceiling.');
  }

  const projected = simulateIssuanceImpact(request, supplyState, metrics, policy);

  if (projected.inflationRisk > policy.maxInflationRisk) {
    reasons.push('Projected inflation risk exceeds policy threshold.');
  }

  const requiredApprovalClass = getRequiredApprovalClass(request, policy);
  const requiredApprovalCount = getRequiredApprovalCount(requiredApprovalClass, policy);
  const providedApprovalCount = requiredApprovalClass === 'none'
    ? 0
    : getUniqueApproverCount(approvals[requiredApprovalClass]);

  let status: IssuanceEvaluationStatus = 'approve_for_execution';

  if (reasons.length > 0) {
    status = 'reject_or_escalate';
  } else if (requiredApprovalClass !== 'none' && providedApprovalCount < requiredApprovalCount) {
    status = 'require_human_approval';
    reasons.push(
      `Requires ${requiredApprovalCount} distinct ${requiredApprovalClass} approvals; ${providedApprovalCount} provided.`,
    );
  }

  const projectedSignals = evaluatePolicySignals(
    {
      ...metrics,
      inflationRate: projected.projectedInflationRate,
      affordabilityPressure: projected.projectedAffordabilityPressure,
      civicBasketIndex: projected.projectedCivicBasketIndex,
      reserveCoverageRatio: projected.projectedReserveCoverageRatio,
    },
    policy,
    now,
  );

  const auditEventType: AuditEventType =
    status === 'approve_for_execution'
      ? 'issuance_request_validated'
      : status === 'require_human_approval'
        ? 'issuance_request_requires_human_approval'
        : 'issuance_request_rejected';

  const auditEvent = createAuditEvent(
    auditEventType,
    request.id,
    {
      status,
      amount: request.amount,
      category: request.category,
      requiredApprovalClass,
      requiredApprovalCount,
      providedApprovalCount,
      issueableSupplyCeiling,
      remainingQuarterlyCeiling,
      projectedInflationRate: projected.projectedInflationRate,
      projectedAffordabilityPressure: projected.projectedAffordabilityPressure,
    },
    now,
  );

  return {
    status,
    reasons,
    requiredApprovalClass,
    requiredApprovalCount,
    providedApprovalCount,
    projected,
    issueableSupplyCeiling,
    remainingQuarterlyCeiling,
    alerts: projectedSignals.alerts,
    auditEvent,
  };
}

export function executeApprovedIssuance(input: {
  request: IssuanceRequest;
  evaluation: IssuanceEvaluation;
  policy: MonetaryPolicy;
  metrics: MonetarySystemMetrics;
  currentSupplyState: SupplyState;
  now?: string;
}): IssuanceExecutionResult {
  const { request, evaluation, policy, metrics, currentSupplyState } = input;
  const now = input.now ?? DEFAULT_NOW();

  if (request.intent !== 'execute') {
    throw new Error('Only execute-intent requests can be executed.');
  }

  if (evaluation.status !== 'approve_for_execution') {
    throw new Error('Issuance must be approved before execution.');
  }

  const targetBucket = request.targetBucket ?? DEFAULT_ISSUANCE_BUCKET_BY_CATEGORY[request.category];
  const updatedSupplyState: SupplyState = {
    ...currentSupplyState,
    [targetBucket]: round(currentSupplyState[targetBucket] + request.amount, 2),
    updatedAt: now,
  };

  const issuanceRecord: IssuanceRecord = {
    id: `${request.id}:issuance`,
    requestId: request.id,
    category: request.category,
    targetBucket,
    amount: round(request.amount, 2),
    requestedBy: request.requestedBy,
    executedAt: now,
    approvalClass: evaluation.requiredApprovalClass,
  };

  const stability = evaluatePolicySignals(
    {
      ...metrics,
      inflationRate: evaluation.projected.projectedInflationRate,
      affordabilityPressure: evaluation.projected.projectedAffordabilityPressure,
      civicBasketIndex: evaluation.projected.projectedCivicBasketIndex,
      reserveCoverageRatio: updatedSupplyState.reserve / Math.max(1, updatedSupplyState.circulating),
    },
    policy,
    now,
  );

  const executionAudit = createAuditEvent(
    'issuance_executed',
    request.id,
    {
      amount: issuanceRecord.amount,
      category: issuanceRecord.category,
      targetBucket: issuanceRecord.targetBucket,
      approvalClass: issuanceRecord.approvalClass,
      totalSupplyAfterExecution: sumSupplyBuckets(updatedSupplyState),
      stabilityStatus: stability.status,
    },
    now,
  );

  return {
    updatedSupplyState,
    issuanceRecord,
    stability,
    auditEvents: [evaluation.auditEvent, executionAudit],
  };
}
