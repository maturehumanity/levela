/**
 * Testing Framework
 * 
 * Manages testing campaigns, test cases, and tester authorization.
 * Allows authorized testers to validate features before production.
 */

export type TestStatus = 'pending' | 'in-progress' | 'passed' | 'failed' | 'blocked';
export type TestSeverity = 'critical' | 'high' | 'medium' | 'low';
export type TestType = 'unit' | 'integration' | 'e2e' | 'performance' | 'security';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: TestType;
  severity: TestSeverity;
  featureName: string;
  steps: TestStep[];
  expectedResult: string;
  actualResult?: string;
  status: TestStatus;
  createdAt: number;
  updatedAt: number;
}

export interface TestStep {
  order: number;
  action: string;
  expectedBehavior: string;
  actualBehavior?: string;
  passed?: boolean;
}

export interface TestCampaign {
  id: string;
  name: string;
  description: string;
  proposalId: string;
  featuresToTest: string[];
  testCases: string[];                // Test case IDs
  assignedTesters: string[];          // Tester DIDs
  startDate: number;
  endDate: number;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  passRate: number;                   // Percentage
  totalTests: number;
  passedTests: number;
  failedTests: number;
  blockedTests: number;
}

export interface TesterProfile {
  did: string;
  name: string;
  role: 'tester' | 'qa-lead' | 'qa-manager';
  certifications: string[];
  testsConducted: number;
  successRate: number;                // Percentage
  isActive: boolean;
  joinedAt: number;
  lastTestDate?: number;
}

export interface TestResult {
  id: string;
  testCaseId: string;
  campaignId: string;
  tester: string;
  status: TestStatus;
  startTime: number;
  endTime?: number;
  duration?: number;                  // Milliseconds
  notes: string;
  evidence: TestEvidence[];
  issuesFound: TestIssue[];
}

export interface TestEvidence {
  type: 'screenshot' | 'log' | 'video' | 'note';
  data: string;                       // Base64 or text
  timestamp: number;
}

export interface TestIssue {
  id: string;
  severity: TestSeverity;
  title: string;
  description: string;
  steps: string[];
  reproducible: boolean;
  frequency: 'always' | 'intermittent' | 'rare';
  status: 'open' | 'acknowledged' | 'fixed' | 'wont-fix';
  assignedTo?: string;
}

export interface TestApproval {
  campaignId: string;
  approver: string;
  approvedAt: number;
  status: 'approved' | 'rejected';
  comments: string;
  criticalIssuesFound: number;
  highIssuesFound: number;
}

/**
 * Testing Framework
 */
export class TestingFramework {
  private testCases: Map<string, TestCase> = new Map();
  private campaigns: Map<string, TestCampaign> = new Map();
  private testers: Map<string, TesterProfile> = new Map();
  private results: Map<string, TestResult> = new Map();
  private issues: Map<string, TestIssue> = new Map();
  private approvals: Map<string, TestApproval> = new Map();
  private listeners: Set<(event: TestingEvent) => void> = new Set();

  /**
   * Register a tester
   */
  registerTester(testerProfile: TesterProfile): void {
    if (this.testers.has(testerProfile.did)) {
      throw new Error(`Tester ${testerProfile.did} already registered`);
    }

    this.testers.set(testerProfile.did, testerProfile);

    this.emit({
      type: 'tester-registered',
      tester: testerProfile,
    });
  }

  /**
   * Get tester profile
   */
  getTester(did: string): TesterProfile | null {
    return this.testers.get(did) || null;
  }

  /**
   * Get all testers
   */
  getAllTesters(): TesterProfile[] {
    return Array.from(this.testers.values());
  }

  /**
   * Get active testers
   */
  getActiveTesters(): TesterProfile[] {
    return Array.from(this.testers.values()).filter((t) => t.isActive);
  }

  /**
   * Create test case
   */
  createTestCase(
    name: string,
    description: string,
    type: TestType,
    severity: TestSeverity,
    featureName: string,
    steps: TestStep[],
    expectedResult: string
  ): TestCase {
    const testCase: TestCase = {
      id: `test-${Date.now()}`,
      name,
      description,
      type,
      severity,
      featureName,
      steps,
      expectedResult,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.testCases.set(testCase.id, testCase);

    this.emit({
      type: 'test-case-created',
      testCase,
    });

    return testCase;
  }

  /**
   * Get test case
   */
  getTestCase(id: string): TestCase | null {
    return this.testCases.get(id) || null;
  }

  /**
   * Get all test cases
   */
  getAllTestCases(): TestCase[] {
    return Array.from(this.testCases.values());
  }

  /**
   * Get test cases by feature
   */
  getTestCasesByFeature(featureName: string): TestCase[] {
    return Array.from(this.testCases.values()).filter(
      (t) => t.featureName === featureName
    );
  }

  /**
   * Create test campaign
   */
  createCampaign(
    name: string,
    description: string,
    proposalId: string,
    featuresToTest: string[],
    testCaseIds: string[],
    assignedTesters: string[],
    duration: number  // Days
  ): TestCampaign {
    const campaign: TestCampaign = {
      id: `campaign-${Date.now()}`,
      name,
      description,
      proposalId,
      featuresToTest,
      testCases: testCaseIds,
      assignedTesters,
      startDate: Date.now(),
      endDate: Date.now() + duration * 24 * 60 * 60 * 1000,
      status: 'planned',
      passRate: 0,
      totalTests: testCaseIds.length,
      passedTests: 0,
      failedTests: 0,
      blockedTests: 0,
    };

    this.campaigns.set(campaign.id, campaign);

    this.emit({
      type: 'campaign-created',
      campaign,
    });

    return campaign;
  }

  /**
   * Get campaign
   */
  getCampaign(id: string): TestCampaign | null {
    return this.campaigns.get(id) || null;
  }

  /**
   * Get all campaigns
   */
  getAllCampaigns(): TestCampaign[] {
    return Array.from(this.campaigns.values());
  }

  /**
   * Get active campaigns
   */
  getActiveCampaigns(): TestCampaign[] {
    return Array.from(this.campaigns.values()).filter((c) => c.status === 'active');
  }

  /**
   * Start campaign
   */
  startCampaign(campaignId: string): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'planned') {
      throw new Error(`Campaign is already ${campaign.status}`);
    }

    campaign.status = 'active';
    campaign.startDate = Date.now();

    this.emit({
      type: 'campaign-started',
      campaign,
    });
  }

  /**
   * Complete campaign
   */
  completeCampaign(campaignId: string): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'active') {
      throw new Error(`Campaign is not active`);
    }

    campaign.status = 'completed';
    campaign.endDate = Date.now();

    // Calculate pass rate
    if (campaign.totalTests > 0) {
      campaign.passRate = (campaign.passedTests / campaign.totalTests) * 100;
    }

    this.emit({
      type: 'campaign-completed',
      campaign,
    });
  }

  /**
   * Submit test result
   */
  submitTestResult(
    testCaseId: string,
    campaignId: string,
    tester: string,
    status: TestStatus,
    notes: string,
    evidence: TestEvidence[] = [],
    issues: TestIssue[] = []
  ): TestResult {
    const testCase = this.testCases.get(testCaseId);
    if (!testCase) {
      throw new Error(`Test case ${testCaseId} not found`);
    }

    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const result: TestResult = {
      id: `result-${Date.now()}`,
      testCaseId,
      campaignId,
      tester,
      status,
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      notes,
      evidence,
      issuesFound: issues,
    };

    this.results.set(result.id, result);

    // Update test case status
    testCase.status = status;
    testCase.actualResult = notes;
    testCase.updatedAt = Date.now();

    // Update campaign statistics
    if (status === 'passed') {
      campaign.passedTests++;
    } else if (status === 'failed') {
      campaign.failedTests++;
    } else if (status === 'blocked') {
      campaign.blockedTests++;
    }

    // Store issues
    for (const issue of issues) {
      issue.id = `issue-${Date.now()}-${Math.random()}`;
      this.issues.set(issue.id, issue);
    }

    // Update tester statistics
    const testerProfile = this.testers.get(tester);
    if (testerProfile) {
      testerProfile.testsConducted++;
      testerProfile.lastTestDate = Date.now();

      if (status === 'passed') {
        testerProfile.successRate =
          ((testerProfile.testsConducted - 1) * testerProfile.successRate +
            100) /
          testerProfile.testsConducted;
      } else if (status === 'failed') {
        testerProfile.successRate =
          ((testerProfile.testsConducted - 1) * testerProfile.successRate +
            0) /
          testerProfile.testsConducted;
      }
    }

    this.emit({
      type: 'test-result-submitted',
      result,
      issuesCount: issues.length,
    });

    return result;
  }

  /**
   * Get test results for campaign
   */
  getCampaignResults(campaignId: string): TestResult[] {
    return Array.from(this.results.values()).filter((r) => r.campaignId === campaignId);
  }

  /**
   * Get test results by tester
   */
  getTesterResults(tester: string): TestResult[] {
    return Array.from(this.results.values()).filter((r) => r.tester === tester);
  }

  /**
   * Report issue
   */
  reportIssue(
    severity: TestSeverity,
    title: string,
    description: string,
    steps: string[],
    reproducible: boolean,
    frequency: 'always' | 'intermittent' | 'rare'
  ): TestIssue {
    const issue: TestIssue = {
      id: `issue-${Date.now()}`,
      severity,
      title,
      description,
      steps,
      reproducible,
      frequency,
      status: 'open',
    };

    this.issues.set(issue.id, issue);

    this.emit({
      type: 'issue-reported',
      issue,
    });

    return issue;
  }

  /**
   * Get issue
   */
  getIssue(id: string): TestIssue | null {
    return this.issues.get(id) || null;
  }

  /**
   * Get all issues
   */
  getAllIssues(): TestIssue[] {
    return Array.from(this.issues.values());
  }

  /**
   * Get open issues
   */
  getOpenIssues(): TestIssue[] {
    return Array.from(this.issues.values()).filter((i) => i.status === 'open');
  }

  /**
   * Get critical issues
   */
  getCriticalIssues(): TestIssue[] {
    return Array.from(this.issues.values()).filter((i) => i.severity === 'critical');
  }

  /**
   * Update issue status
   */
  updateIssueStatus(issueId: string, status: string, assignedTo?: string): void {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    issue.status = status as any;
    if (assignedTo) {
      issue.assignedTo = assignedTo;
    }

    this.emit({
      type: 'issue-updated',
      issue,
    });
  }

  /**
   * Approve campaign for promotion
   */
  approveCampaign(
    campaignId: string,
    approver: string,
    comments: string
  ): TestApproval {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const criticalIssues = Array.from(this.issues.values()).filter(
      (i) => i.severity === 'critical' && i.status === 'open'
    ).length;

    const highIssues = Array.from(this.issues.values()).filter(
      (i) => i.severity === 'high' && i.status === 'open'
    ).length;

    const approval: TestApproval = {
      campaignId,
      approver,
      approvedAt: Date.now(),
      status: criticalIssues > 0 ? 'rejected' : 'approved',
      comments,
      criticalIssuesFound: criticalIssues,
      highIssuesFound: highIssues,
    };

    this.approvals.set(campaignId, approval);

    this.emit({
      type: 'campaign-approved',
      approval,
    });

    return approval;
  }

  /**
   * Get campaign approval
   */
  getCampaignApproval(campaignId: string): TestApproval | null {
    return this.approvals.get(campaignId) || null;
  }

  /**
   * Subscribe to testing events
   */
  subscribe(listener: (event: TestingEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit testing event
   */
  private emit(event: TestingEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in testing event listener:', error);
      }
    }
  }

  /**
   * Get testing statistics
   */
  getStats(): {
    totalTestCases: number;
    totalCampaigns: number;
    activeCampaigns: number;
    totalTesters: number;
    activeTesters: number;
    totalIssues: number;
    openIssues: number;
    criticalIssues: number;
  } {
    return {
      totalTestCases: this.testCases.size,
      totalCampaigns: this.campaigns.size,
      activeCampaigns: this.getActiveCampaigns().length,
      totalTesters: this.testers.size,
      activeTesters: this.getActiveTesters().length,
      totalIssues: this.issues.size,
      openIssues: this.getOpenIssues().length,
      criticalIssues: this.getCriticalIssues().length,
    };
  }
}

/**
 * Testing Events
 */
export type TestingEvent =
  | {
      type: 'tester-registered';
      tester: TesterProfile;
    }
  | {
      type: 'test-case-created';
      testCase: TestCase;
    }
  | {
      type: 'campaign-created';
      campaign: TestCampaign;
    }
  | {
      type: 'campaign-started';
      campaign: TestCampaign;
    }
  | {
      type: 'campaign-completed';
      campaign: TestCampaign;
    }
  | {
      type: 'test-result-submitted';
      result: TestResult;
      issuesCount: number;
    }
  | {
      type: 'issue-reported';
      issue: TestIssue;
    }
  | {
      type: 'issue-updated';
      issue: TestIssue;
    }
  | {
      type: 'campaign-approved';
      approval: TestApproval;
    };

// Global testing framework instance
let globalTestingFramework: TestingFramework | null = null;

/**
 * Get the global testing framework
 */
export function getTestingFramework(): TestingFramework {
  if (!globalTestingFramework) {
    globalTestingFramework = new TestingFramework();
  }
  return globalTestingFramework;
}
