/**
 * Approval Workflow
 * 
 * Manages multi-stage approval workflows for promoting features
 * from Dev -> Test -> Prod environments.
 */

export type ApprovalStage = 'dev-review' | 'qa-approval' | 'steward-review' | 'final-approval';
export type ApprovalDecision = 'approved' | 'rejected' | 'pending' | 'conditional';

export interface ApprovalRequest {
  id: string;
  proposalId: string;
  featureName: string;
  fromEnvironment: 'development' | 'staging' | 'production';
  toEnvironment: 'development' | 'staging' | 'production';
  requestedBy: string;
  requestedAt: number;
  description: string;
  changeLog: string;
  stages: ApprovalStage[];
  currentStage: ApprovalStage;
  status: 'pending' | 'in-progress' | 'approved' | 'rejected' | 'cancelled';
}

export interface StageApproval {
  stage: ApprovalStage;
  approver: string;
  decision: ApprovalDecision;
  approvedAt?: number;
  comments: string;
  conditions?: string[];              // For conditional approvals
  requiredSignatures: number;
  receivedSignatures: number;
}

export interface ApprovalGate {
  stage: ApprovalStage;
  name: string;
  description: string;
  requiredRole: string;
  requiredSignatures: number;
  timeoutHours: number;
  autoApproveIfNoIssues: boolean;
}

export interface ApprovalChain {
  requestId: string;
  stages: Map<ApprovalStage, StageApproval>;
  completedAt?: number;
  status: 'active' | 'completed' | 'failed';
}

/**
 * Approval Workflow Manager
 */
export class ApprovalWorkflow {
  private requests: Map<string, ApprovalRequest> = new Map();
  private chains: Map<string, ApprovalChain> = new Map();
  private gates: Map<ApprovalStage, ApprovalGate> = new Map();
  private listeners: Set<(event: ApprovalEvent) => void> = new Set();

  constructor() {
    this.initializeApprovalGates();
  }

  /**
   * Initialize approval gates for each stage
   */
  private initializeApprovalGates(): void {
    // Dev Review Gate
    this.gates.set('dev-review', {
      stage: 'dev-review',
      name: 'Developer Review',
      description: 'Developer reviews code quality and documentation',
      requiredRole: 'developer',
      requiredSignatures: 1,
      timeoutHours: 24,
      autoApproveIfNoIssues: true,
    });

    // QA Approval Gate
    this.gates.set('qa-approval', {
      stage: 'qa-approval',
      name: 'QA Approval',
      description: 'QA team validates feature functionality',
      requiredRole: 'qa-lead',
      requiredSignatures: 2,
      timeoutHours: 72,
      autoApproveIfNoIssues: false,
    });

    // Steward Review Gate
    this.gates.set('steward-review', {
      stage: 'steward-review',
      name: 'Steward Review',
      description: 'Stewards review governance and security implications',
      requiredRole: 'steward',
      requiredSignatures: 3,
      timeoutHours: 168,  // 1 week
      autoApproveIfNoIssues: false,
    });

    // Final Approval Gate
    this.gates.set('final-approval', {
      stage: 'final-approval',
      name: 'Final Approval',
      description: 'Admin provides final approval for production',
      requiredRole: 'admin',
      requiredSignatures: 1,
      timeoutHours: 24,
      autoApproveIfNoIssues: true,
    });
  }

  /**
   * Create approval request
   */
  createApprovalRequest(
    proposalId: string,
    featureName: string,
    fromEnvironment: 'development' | 'staging' | 'production',
    toEnvironment: 'development' | 'staging' | 'production',
    requestedBy: string,
    description: string,
    changeLog: string
  ): ApprovalRequest {
    // Determine stages based on environment transition
    const stages = this.determineApprovalStages(fromEnvironment, toEnvironment);

    const request: ApprovalRequest = {
      id: `approval-${Date.now()}`,
      proposalId,
      featureName,
      fromEnvironment,
      toEnvironment,
      requestedBy,
      requestedAt: Date.now(),
      description,
      changeLog,
      stages,
      currentStage: stages[0],
      status: 'pending',
    };

    this.requests.set(request.id, request);

    // Create approval chain
    const chain: ApprovalChain = {
      requestId: request.id,
      stages: new Map(),
      status: 'active',
    };

    // Initialize stage approvals
    for (const stage of stages) {
      const gate = this.gates.get(stage);
      if (gate) {
        chain.stages.set(stage, {
          stage,
          approver: '',
          decision: 'pending',
          comments: '',
          requiredSignatures: gate.requiredSignatures,
          receivedSignatures: 0,
        });
      }
    }

    this.chains.set(request.id, chain);

    this.emit({
      type: 'approval-request-created',
      request,
    });

    return request;
  }

  /**
   * Determine approval stages based on environment transition
   */
  private determineApprovalStages(
    from: 'development' | 'staging' | 'production',
    to: 'development' | 'staging' | 'production'
  ): ApprovalStage[] {
    if (from === 'development' && to === 'staging') {
      return ['dev-review', 'qa-approval'];
    } else if (from === 'staging' && to === 'production') {
      return ['qa-approval', 'steward-review', 'final-approval'];
    } else if (from === 'production' && to === 'staging') {
      return ['steward-review'];
    }
    return ['dev-review'];
  }

  /**
   * Submit stage approval
   */
  submitStageApproval(
    requestId: string,
    stage: ApprovalStage,
    approver: string,
    decision: ApprovalDecision,
    comments: string,
    conditions?: string[]
  ): void {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    const chain = this.chains.get(requestId);
    if (!chain) {
      throw new Error(`Approval chain for ${requestId} not found`);
    }

    const stageApproval = chain.stages.get(stage);
    if (!stageApproval) {
      throw new Error(`Stage ${stage} not found in approval chain`);
    }

    // Update stage approval
    stageApproval.approver = approver;
    stageApproval.decision = decision;
    stageApproval.approvedAt = Date.now();
    stageApproval.comments = comments;
    if (conditions) {
      stageApproval.conditions = conditions;
    }

    if (decision !== 'pending') {
      stageApproval.receivedSignatures++;
    }

    this.emit({
      type: 'stage-approval-submitted',
      requestId,
      stage,
      decision,
      approver,
    });

    // Check if stage is complete
    if (this.isStageComplete(stageApproval)) {
      if (decision === 'approved') {
        this.advanceToNextStage(requestId);
      } else if (decision === 'rejected') {
        request.status = 'rejected';
        chain.status = 'failed';

        this.emit({
          type: 'approval-request-rejected',
          request,
          stage,
          reason: comments,
        });
      }
    }
  }

  /**
   * Check if stage approval is complete
   */
  private isStageComplete(approval: StageApproval): boolean {
    return approval.receivedSignatures >= approval.requiredSignatures;
  }

  /**
   * Advance to next stage
   */
  private advanceToNextStage(requestId: string): void {
    const request = this.requests.get(requestId);
    if (!request) {
      return;
    }

    const currentIndex = request.stages.indexOf(request.currentStage);
    if (currentIndex < request.stages.length - 1) {
      request.currentStage = request.stages[currentIndex + 1];
      request.status = 'in-progress';

      this.emit({
        type: 'approval-stage-advanced',
        requestId,
        stage: request.currentStage,
      });
    } else {
      // All stages complete
      request.status = 'approved';

      const chain = this.chains.get(requestId);
      if (chain) {
        chain.status = 'completed';
        chain.completedAt = Date.now();
      }

      this.emit({
        type: 'approval-request-approved',
        request,
      });
    }
  }

  /**
   * Reject approval request
   */
  rejectApprovalRequest(
    requestId: string,
    stage: ApprovalStage,
    reason: string,
    rejector: string
  ): void {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    request.status = 'rejected';

    const chain = this.chains.get(requestId);
    if (chain) {
      chain.status = 'failed';
    }

    this.emit({
      type: 'approval-request-rejected',
      request,
      stage,
      reason,
      rejector,
    });
  }

  /**
   * Get approval request
   */
  getApprovalRequest(id: string): ApprovalRequest | null {
    return this.requests.get(id) || null;
  }

  /**
   * Get all approval requests
   */
  getAllApprovalRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Get pending approval requests
   */
  getPendingApprovalRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.status === 'pending');
  }

  /**
   * Get approval chain
   */
  getApprovalChain(requestId: string): ApprovalChain | null {
    return this.chains.get(requestId) || null;
  }

  /**
   * Get stage approval
   */
  getStageApproval(requestId: string, stage: ApprovalStage): StageApproval | null {
    const chain = this.chains.get(requestId);
    if (!chain) {
      return null;
    }

    return chain.stages.get(stage) || null;
  }

  /**
   * Get approval gate
   */
  getApprovalGate(stage: ApprovalStage): ApprovalGate | null {
    return this.gates.get(stage) || null;
  }

  /**
   * Get all approval gates
   */
  getAllApprovalGates(): ApprovalGate[] {
    return Array.from(this.gates.values());
  }

  /**
   * Update approval gate
   */
  updateApprovalGate(stage: ApprovalStage, updates: Partial<ApprovalGate>): void {
    const gate = this.gates.get(stage);
    if (!gate) {
      throw new Error(`Gate ${stage} not found`);
    }

    Object.assign(gate, updates);

    this.emit({
      type: 'approval-gate-updated',
      stage,
      gate,
    });
  }

  /**
   * Get approval progress
   */
  getApprovalProgress(requestId: string): {
    totalStages: number;
    completedStages: number;
    currentStage: ApprovalStage;
    progress: number;  // Percentage
  } | null {
    const request = this.requests.get(requestId);
    if (!request) {
      return null;
    }

    const chain = this.chains.get(requestId);
    if (!chain) {
      return null;
    }

    let completedStages = 0;
    for (const stage of request.stages) {
      const approval = chain.stages.get(stage);
      if (approval && approval.decision !== 'pending') {
        completedStages++;
      }
    }

    return {
      totalStages: request.stages.length,
      completedStages,
      currentStage: request.currentStage,
      progress: (completedStages / request.stages.length) * 100,
    };
  }

  /**
   * Subscribe to approval events
   */
  subscribe(listener: (event: ApprovalEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit approval event
   */
  private emit(event: ApprovalEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in approval event listener:', error);
      }
    }
  }

  /**
   * Get workflow statistics
   */
  getStats(): {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    averageApprovalTime: number;  // Hours
  } {
    let approvedCount = 0;
    let rejectedCount = 0;
    let totalApprovalTime = 0;
    let completedRequests = 0;

    for (const request of this.requests.values()) {
      if (request.status === 'approved') {
        approvedCount++;
        const chain = this.chains.get(request.id);
        if (chain && chain.completedAt) {
          totalApprovalTime += (chain.completedAt - request.requestedAt) / (1000 * 60 * 60);
          completedRequests++;
        }
      } else if (request.status === 'rejected') {
        rejectedCount++;
      }
    }

    const averageApprovalTime =
      completedRequests > 0 ? totalApprovalTime / completedRequests : 0;

    return {
      totalRequests: this.requests.size,
      pendingRequests: this.getPendingApprovalRequests().length,
      approvedRequests: approvedCount,
      rejectedRequests: rejectedCount,
      averageApprovalTime,
    };
  }
}

/**
 * Approval Events
 */
export type ApprovalEvent =
  | {
      type: 'approval-request-created';
      request: ApprovalRequest;
    }
  | {
      type: 'stage-approval-submitted';
      requestId: string;
      stage: ApprovalStage;
      decision: ApprovalDecision;
      approver: string;
    }
  | {
      type: 'approval-stage-advanced';
      requestId: string;
      stage: ApprovalStage;
    }
  | {
      type: 'approval-request-approved';
      request: ApprovalRequest;
    }
  | {
      type: 'approval-request-rejected';
      request: ApprovalRequest;
      stage: ApprovalStage;
      reason: string;
      rejector?: string;
    }
  | {
      type: 'approval-gate-updated';
      stage: ApprovalStage;
      gate: ApprovalGate;
    };

// Global approval workflow instance
let globalApprovalWorkflow: ApprovalWorkflow | null = null;

/**
 * Get the global approval workflow
 */
export function getApprovalWorkflow(): ApprovalWorkflow {
  if (!globalApprovalWorkflow) {
    globalApprovalWorkflow = new ApprovalWorkflow();
  }
  return globalApprovalWorkflow;
}
