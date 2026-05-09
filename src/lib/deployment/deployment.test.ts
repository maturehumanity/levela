import { getEnvironmentManager } from './environment-manager';
import { getTestingFramework } from './testing-framework';
import { getApprovalWorkflow } from './approval-workflow';

describe('Deployment System Tests', () => {
  describe('EnvironmentManager', () => {
    it('should initialize with default environments', () => {
      const manager = getEnvironmentManager();
      const envs = manager.getAllEnvironments();

      expect(envs).toHaveLength(3);
      expect(envs.map((e) => e.type)).toContain('development');
      expect(envs.map((e) => e.type)).toContain('staging');
      expect(envs.map((e) => e.type)).toContain('production');
    });

    it('should get current environment', () => {
      const manager = getEnvironmentManager();
      const current = manager.getCurrentEnvironment();

      expect(current).toBe('development');
    });

    it('should request environment transition', () => {
      const manager = getEnvironmentManager();

      const transition = manager.requestTransition(
        'development',
        'staging',
        'proposal-1',
        'Ready for testing',
        'did:key:developer'
      );

      expect(transition.status).toBe('pending');
      expect(transition.fromEnvironment).toBe('development');
      expect(transition.toEnvironment).toBe('staging');
    });

    it('should approve environment transition', () => {
      const manager = getEnvironmentManager();

      const transition = manager.requestTransition(
        'development',
        'staging',
        'proposal-1',
        'Ready for testing',
        'did:key:developer'
      );

      manager.approveTransition(transition.id, 'did:key:steward');

      expect(transition.status).toBe('approved');
      expect(transition.approvedBy).toBe('did:key:steward');
    });

    it('should get environment metrics', () => {
      const manager = getEnvironmentManager();

      const metrics = manager.getMetrics('development');

      expect(metrics).toBeDefined();
      expect(metrics?.uptime).toBe(100);
      expect(metrics?.errorRate).toBe(0);
    });

    it('should update environment metrics', () => {
      const manager = getEnvironmentManager();

      manager.updateMetrics('staging', {
        uptime: 99.5,
        errorRate: 0.5,
        averageLatency: 150,
        activeUsers: 50,
      });

      const metrics = manager.getMetrics('staging');
      expect(metrics?.uptime).toBe(99.5);
      expect(metrics?.errorRate).toBe(0.5);
    });

    it('should get environment statistics', () => {
      const manager = getEnvironmentManager();

      const stats = manager.getStats();

      expect(stats.currentEnvironment).toBe('development');
      expect(stats.totalEnvironments).toBe(3);
    });
  });

  describe('TestingFramework', () => {
    it('should register tester', () => {
      const framework = getTestingFramework();

      framework.registerTester({
        did: 'did:key:tester1',
        name: 'Alice Tester',
        role: 'tester',
        certifications: ['QA-101', 'Security-101'],
        testsConducted: 0,
        successRate: 100,
        isActive: true,
        joinedAt: Date.now(),
      });

      const tester = framework.getTester('did:key:tester1');
      expect(tester?.name).toBe('Alice Tester');
    });

    it('should create test case', () => {
      const framework = getTestingFramework();

      const testCase = framework.createTestCase(
        'Login Flow',
        'Test user login functionality',
        'e2e',
        'high',
        'authentication',
        [
          {
            order: 1,
            action: 'Open app',
            expectedBehavior: 'Login screen appears',
          },
          {
            order: 2,
            action: 'Enter credentials',
            expectedBehavior: 'Credentials accepted',
          },
        ],
        'User successfully logged in'
      );

      expect(testCase.name).toBe('Login Flow');
      expect(testCase.steps).toHaveLength(2);
    });

    it('should create test campaign', () => {
      const framework = getTestingFramework();

      framework.registerTester({
        did: 'did:key:tester1',
        name: 'Alice',
        role: 'tester',
        certifications: [],
        testsConducted: 0,
        successRate: 100,
        isActive: true,
        joinedAt: Date.now(),
      });

      const testCase = framework.createTestCase(
        'Test 1',
        'Test',
        'unit',
        'medium',
        'feature-1',
        [],
        'Pass'
      );

      const campaign = framework.createCampaign(
        'Feature 1 Testing',
        'Test new feature',
        'proposal-1',
        ['feature-1'],
        [testCase.id],
        ['did:key:tester1'],
        7
      );

      expect(campaign.name).toBe('Feature 1 Testing');
      expect(campaign.status).toBe('planned');
    });

    it('should start and complete campaign', () => {
      const framework = getTestingFramework();

      framework.registerTester({
        did: 'did:key:tester1',
        name: 'Alice',
        role: 'tester',
        certifications: [],
        testsConducted: 0,
        successRate: 100,
        isActive: true,
        joinedAt: Date.now(),
      });

      const testCase = framework.createTestCase(
        'Test 1',
        'Test',
        'unit',
        'medium',
        'feature-1',
        [],
        'Pass'
      );

      const campaign = framework.createCampaign(
        'Feature 1 Testing',
        'Test new feature',
        'proposal-1',
        ['feature-1'],
        [testCase.id],
        ['did:key:tester1'],
        7
      );

      framework.startCampaign(campaign.id);
      expect(campaign.status).toBe('active');

      framework.completeCampaign(campaign.id);
      expect(campaign.status).toBe('completed');
    });

    it('should submit test result', () => {
      const framework = getTestingFramework();

      framework.registerTester({
        did: 'did:key:tester1',
        name: 'Alice',
        role: 'tester',
        certifications: [],
        testsConducted: 0,
        successRate: 100,
        isActive: true,
        joinedAt: Date.now(),
      });

      const testCase = framework.createTestCase(
        'Test 1',
        'Test',
        'unit',
        'medium',
        'feature-1',
        [],
        'Pass'
      );

      const campaign = framework.createCampaign(
        'Feature 1 Testing',
        'Test new feature',
        'proposal-1',
        ['feature-1'],
        [testCase.id],
        ['did:key:tester1'],
        7
      );

      framework.startCampaign(campaign.id);

      const result = framework.submitTestResult(
        testCase.id,
        campaign.id,
        'did:key:tester1',
        'passed',
        'Test passed successfully',
        []
      );

      expect(result.status).toBe('passed');
      expect(campaign.passedTests).toBe(1);
    });

    it('should report and track issues', () => {
      const framework = getTestingFramework();

      const issue = framework.reportIssue(
        'critical',
        'Login fails',
        'User cannot login with valid credentials',
        ['Open app', 'Enter credentials', 'Click login'],
        true,
        'always'
      );

      expect(issue.severity).toBe('critical');
      expect(issue.status).toBe('open');

      framework.updateIssueStatus(issue.id, 'acknowledged', 'did:key:developer');

      const updated = framework.getIssue(issue.id);
      expect(updated?.status).toBe('acknowledged');
    });

    it('should approve campaign', () => {
      const framework = getTestingFramework();

      framework.registerTester({
        did: 'did:key:tester1',
        name: 'Alice',
        role: 'tester',
        certifications: [],
        testsConducted: 0,
        successRate: 100,
        isActive: true,
        joinedAt: Date.now(),
      });

      const testCase = framework.createTestCase(
        'Test 1',
        'Test',
        'unit',
        'medium',
        'feature-1',
        [],
        'Pass'
      );

      const campaign = framework.createCampaign(
        'Feature 1 Testing',
        'Test new feature',
        'proposal-1',
        ['feature-1'],
        [testCase.id],
        ['did:key:tester1'],
        7
      );

      const approval = framework.approveCampaign(
        campaign.id,
        'did:key:qa-lead',
        'All tests passed'
      );

      expect(approval.status).toBe('approved');
    });

    it('should get testing statistics', () => {
      const framework = getTestingFramework();

      const stats = framework.getStats();

      expect(stats).toHaveProperty('totalTestCases');
      expect(stats).toHaveProperty('totalCampaigns');
      expect(stats).toHaveProperty('totalTesters');
      expect(stats).toHaveProperty('totalIssues');
    });
  });

  describe('ApprovalWorkflow', () => {
    it('should create approval request', () => {
      const workflow = getApprovalWorkflow();

      const request = workflow.createApprovalRequest(
        'proposal-1',
        'feature-1',
        'development',
        'staging',
        'did:key:developer',
        'Ready for testing',
        'Added new feature'
      );

      expect(request.status).toBe('pending');
      expect(request.stages).toContain('dev-review');
      expect(request.stages).toContain('qa-approval');
    });

    it('should submit stage approval', () => {
      const workflow = getApprovalWorkflow();

      const request = workflow.createApprovalRequest(
        'proposal-1',
        'feature-1',
        'development',
        'staging',
        'did:key:developer',
        'Ready for testing',
        'Added new feature'
      );

      workflow.submitStageApproval(
        request.id,
        'dev-review',
        'did:key:developer',
        'approved',
        'Code looks good'
      );

      const approval = workflow.getStageApproval(request.id, 'dev-review');
      expect(approval?.decision).toBe('approved');
    });

    it('should advance through approval stages', () => {
      const workflow = getApprovalWorkflow();

      const request = workflow.createApprovalRequest(
        'proposal-1',
        'feature-1',
        'development',
        'staging',
        'did:key:developer',
        'Ready for testing',
        'Added new feature'
      );

      workflow.submitStageApproval(
        request.id,
        'dev-review',
        'did:key:developer',
        'approved',
        'Code looks good'
      );

      expect(request.currentStage).toBe('qa-approval');
    });

    it('should reject approval request', () => {
      const workflow = getApprovalWorkflow();

      const request = workflow.createApprovalRequest(
        'proposal-1',
        'feature-1',
        'development',
        'staging',
        'did:key:developer',
        'Ready for testing',
        'Added new feature'
      );

      workflow.rejectApprovalRequest(
        request.id,
        'dev-review',
        'Code quality issues',
        'did:key:reviewer'
      );

      expect(request.status).toBe('rejected');
    });

    it('should get approval progress', () => {
      const workflow = getApprovalWorkflow();

      const request = workflow.createApprovalRequest(
        'proposal-1',
        'feature-1',
        'development',
        'staging',
        'did:key:developer',
        'Ready for testing',
        'Added new feature'
      );

      const progress = workflow.getApprovalProgress(request.id);

      expect(progress?.totalStages).toBe(2);
      expect(progress?.completedStages).toBe(0);
    });

    it('should get approval gates', () => {
      const workflow = getApprovalWorkflow();

      const gates = workflow.getAllApprovalGates();

      expect(gates).toHaveLength(4);
      expect(gates.map((g) => g.stage)).toContain('dev-review');
      expect(gates.map((g) => g.stage)).toContain('qa-approval');
      expect(gates.map((g) => g.stage)).toContain('steward-review');
      expect(gates.map((g) => g.stage)).toContain('final-approval');
    });

    it('should get workflow statistics', () => {
      const workflow = getApprovalWorkflow();

      const stats = workflow.getStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('pendingRequests');
      expect(stats).toHaveProperty('approvedRequests');
      expect(stats).toHaveProperty('rejectedRequests');
    });
  });
});
