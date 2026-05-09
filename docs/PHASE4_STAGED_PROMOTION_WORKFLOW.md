# Phase 4: Establish Staged Promotion Workflow (Dev → Test → Prod)

## Overview

Phase 4 implements a professional, multi-stage deployment workflow that allows features to be developed, tested by authorized roles, and safely promoted to production. This ensures that only thoroughly vetted features reach end users, maintaining platform stability and quality.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│           Staged Promotion Workflow System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Environment      │  │ Testing          │  │ Approval     │  │
│  │ Manager          │  │ Framework        │  │ Workflow     │  │
│  │                  │  │                  │  │              │  │
│  │ Dev/Test/Prod    │  │ Test Cases       │  │ Multi-stage  │  │
│  │ Configs          │  │ Campaigns        │  │ Approvals    │  │
│  │ Transitions      │  │ Testers          │  │ Gates        │  │
│  │ Metrics          │  │ Issues           │  │ Conditions   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│           │                     │                    │           │
│           └─────────────────────┴────────────────────┘           │
│                          │                                       │
│                          ↓                                       │
│           ┌──────────────────────────────┐                      │
│           │  Promotion Pipeline          │                      │
│           │  Dev → Test → Prod           │                      │
│           └──────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Environment Manager (`src/lib/deployment/environment-manager.ts`)

Manages three deployment environments with distinct configurations.

**Environments:**

| Environment | Purpose | Access | Approval | Rollout |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | Feature development | Developers | Not required | 100% |
| **Staging** | Testing & validation | Testers, Stewards | Required | 50% |
| **Production** | Live platform | All users | Required | 100% |

**Key Features:**
- Environment configuration management
- Transition requests and approvals
- Health monitoring and metrics
- Backup and rollback capabilities
- Rate limiting and access control

**Usage:**

```typescript
import { getEnvironmentManager } from './src/lib/deployment/environment-manager';

const envManager = getEnvironmentManager();

// Request transition from dev to staging
const transition = envManager.requestTransition(
  'development',
  'staging',
  'proposal-1',
  'Feature ready for testing',
  'did:key:developer'
);

// Approve transition
envManager.approveTransition(transition.id, 'did:key:steward');

// Execute transition
await envManager.executeTransition(transition.id);

// Monitor metrics
const metrics = envManager.getMetrics('staging');
console.log('Uptime:', metrics?.uptime + '%');
console.log('Error rate:', metrics?.errorRate + '%');
```

### 2. Testing Framework (`src/lib/deployment/testing-framework.ts`)

Manages test cases, campaigns, and authorized testers.

**Key Features:**
- Tester registration and certification
- Test case creation and management
- Test campaign orchestration
- Issue tracking and severity classification
- Test result collection and analysis
- Campaign approval workflow

**Test Severity Levels:**
- **Critical**: System-breaking issues
- **High**: Major functionality broken
- **Medium**: Significant feature degradation
- **Low**: Minor issues or cosmetic problems

**Usage:**

```typescript
import { getTestingFramework } from './src/lib/deployment/testing-framework';

const testFramework = getTestingFramework();

// Register tester
testFramework.registerTester({
  did: 'did:key:alice-tester',
  name: 'Alice',
  role: 'qa-lead',
  certifications: ['QA-101', 'Security-101'],
  testsConducted: 0,
  successRate: 100,
  isActive: true,
  joinedAt: Date.now(),
});

// Create test case
const testCase = testFramework.createTestCase(
  'User Registration',
  'Test new user registration flow',
  'e2e',
  'high',
  'user-registration',
  [
    {
      order: 1,
      action: 'Open app',
      expectedBehavior: 'Registration screen appears',
    },
    {
      order: 2,
      action: 'Fill form with valid data',
      expectedBehavior: 'Form accepts input',
    },
    {
      order: 3,
      action: 'Submit form',
      expectedBehavior: 'User created successfully',
    },
  ],
  'User account created and verified'
);

// Create test campaign
const campaign = testFramework.createCampaign(
  'User Registration Testing',
  'Comprehensive testing of new registration feature',
  'proposal-1',
  ['user-registration'],
  [testCase.id],
  ['did:key:alice-tester', 'did:key:bob-tester'],
  7  // 7-day campaign
);

// Start campaign
testFramework.startCampaign(campaign.id);

// Submit test result
const result = testFramework.submitTestResult(
  testCase.id,
  campaign.id,
  'did:key:alice-tester',
  'passed',
  'All steps completed successfully',
  [
    {
      type: 'screenshot',
      data: 'base64-encoded-screenshot',
      timestamp: Date.now(),
    },
  ]
);

// Report issue if found
const issue = testFramework.reportIssue(
  'medium',
  'Form validation error',
  'Email field accepts invalid format',
  ['Fill email field with invalid email', 'Submit form'],
  true,
  'always'
);

// Complete campaign
testFramework.completeCampaign(campaign.id);

// Approve campaign for promotion
const approval = testFramework.approveCampaign(
  campaign.id,
  'did:key:qa-manager',
  'All tests passed, ready for production'
);
```

### 3. Approval Workflow (`src/lib/deployment/approval-workflow.ts`)

Implements multi-stage approval gates for feature promotion.

**Approval Stages:**

| Stage | Role | Signatures | Timeout | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Dev Review** | Developer | 1 | 24h | Code quality & documentation |
| **QA Approval** | QA Lead | 2 | 72h | Functionality & regression testing |
| **Steward Review** | Steward | 3 | 7d | Governance & security implications |
| **Final Approval** | Admin | 1 | 24h | Final sign-off for production |

**Dev → Staging Workflow:**
```
Dev Review → QA Approval → Ready for Staging
```

**Staging → Production Workflow:**
```
QA Approval → Steward Review → Final Approval → Ready for Production
```

**Usage:**

```typescript
import { getApprovalWorkflow } from './src/lib/deployment/approval-workflow';

const workflow = getApprovalWorkflow();

// Create approval request for dev → staging
const request = workflow.createApprovalRequest(
  'proposal-1',
  'user-registration',
  'development',
  'staging',
  'did:key:developer',
  'New user registration feature',
  'Added email verification, password strength validation'
);

// Submit stage approvals
workflow.submitStageApproval(
  request.id,
  'dev-review',
  'did:key:developer',
  'approved',
  'Code follows standards, well documented'
);

// Advance to next stage (automatic)
// Now at: qa-approval

// QA Lead 1 approves
workflow.submitStageApproval(
  request.id,
  'qa-approval',
  'did:key:qa-lead-1',
  'approved',
  'Functionality tests passed'
);

// QA Lead 2 approves (2 signatures required)
workflow.submitStageApproval(
  request.id,
  'qa-approval',
  'did:key:qa-lead-2',
  'approved',
  'Regression tests passed'
);

// Automatically advances to production workflow
// Now at: steward-review

// Get approval progress
const progress = workflow.getApprovalProgress(request.id);
console.log(`Progress: ${progress?.progress}%`);
console.log(`Current stage: ${progress?.currentStage}`);

// Get workflow statistics
const stats = workflow.getStats();
console.log('Total requests:', stats.totalRequests);
console.log('Approved:', stats.approvedRequests);
console.log('Average approval time:', stats.averageApprovalTime + ' hours');
```

## Deployment Workflow

### Phase 1: Development
```
Developer creates feature
    ↓
Code committed to development branch
    ↓
Feature tested locally
    ↓
Ready for staging
```

### Phase 2: Staging (Testing)
```
Request transition: dev → staging
    ↓
Dev Review approval
    ↓
QA Approval (2 signatures required)
    ↓
Feature deployed to staging
    ↓
Authorized testers run test campaigns
    ↓
Issues tracked and resolved
    ↓
Campaign approved by QA Manager
```

### Phase 3: Production
```
Request transition: staging → production
    ↓
QA Approval (2 signatures required)
    ↓
Steward Review (3 signatures required)
    ↓
Final Approval by Admin
    ↓
Feature deployed to production
    ↓
Gradual rollout: 10% → 100%
    ↓
Monitor for issues
```

### Phase 4: Monitoring
```
Monitor metrics (uptime, error rate, latency)
    ↓
If issues detected: Rollback
    ↓
If stable: Increase rollout percentage
```

## Role-Based Access Control

| Role | Dev | Staging | Prod | Actions |
| :--- | :--- | :--- | :--- | :--- |
| **Developer** | ✓ | - | - | Create features, submit for review |
| **QA Tester** | - | ✓ | - | Run tests, report issues |
| **QA Lead** | - | ✓ | - | Approve QA stage (2 required) |
| **QA Manager** | - | ✓ | - | Approve test campaigns |
| **Steward** | - | - | ✓ | Review governance implications (3 required) |
| **Admin** | ✓ | ✓ | ✓ | Final approval, emergency actions |

## Integration Steps

### Step 1: Initialize Deployment System on App Start

```typescript
// src/App.tsx
import { useEffect } from 'react';
import { getEnvironmentManager } from './lib/deployment/environment-manager';
import { getTestingFramework } from './lib/deployment/testing-framework';
import { getApprovalWorkflow } from './lib/deployment/approval-workflow';

export function App() {
  useEffect(() => {
    const initializeDeployment = async () => {
      // Initialize managers
      const envManager = getEnvironmentManager();
      const testFramework = getTestingFramework();
      const workflow = getApprovalWorkflow();

      // Subscribe to events
      envManager.subscribe((event) => {
        console.log('Environment event:', event);
      });

      testFramework.subscribe((event) => {
        console.log('Testing event:', event);
      });

      workflow.subscribe((event) => {
        console.log('Approval event:', event);
      });

      console.log('Deployment system initialized');
    };

    initializeDeployment();
  }, []);

  return <YourApp />;
}
```

### Step 2: Create Deployment UI Components

```typescript
// src/components/deployment/EnvironmentTransitionRequest.tsx
import { getEnvironmentManager } from '../../lib/deployment/environment-manager';

export function EnvironmentTransitionRequest() {
  const envManager = getEnvironmentManager();

  const handleRequestTransition = async () => {
    const transition = envManager.requestTransition(
      'development',
      'staging',
      'proposal-1',
      'Feature ready for testing',
      'did:key:current-user'
    );

    console.log('Transition requested:', transition.id);
  };

  return (
    <button onClick={handleRequestTransition}>
      Request Staging Deployment
    </button>
  );
}
```

### Step 3: Create Test Campaign UI

```typescript
// src/components/deployment/TestCampaignDashboard.tsx
import { getTestingFramework } from '../../lib/deployment/testing-framework';

export function TestCampaignDashboard() {
  const testFramework = getTestingFramework();

  const campaigns = testFramework.getActiveCampaigns();

  return (
    <div>
      <h2>Active Test Campaigns</h2>
      {campaigns.map((campaign) => (
        <div key={campaign.id}>
          <h3>{campaign.name}</h3>
          <p>Pass Rate: {campaign.passRate.toFixed(1)}%</p>
          <p>Tests: {campaign.passedTests}/{campaign.totalTests}</p>
        </div>
      ))}
    </div>
  );
}
```

### Step 4: Create Approval Workflow UI

```typescript
// src/components/deployment/ApprovalDashboard.tsx
import { getApprovalWorkflow } from '../../lib/deployment/approval-workflow';

export function ApprovalDashboard() {
  const workflow = getApprovalWorkflow();

  const requests = workflow.getAllApprovalRequests();

  return (
    <div>
      <h2>Approval Requests</h2>
      {requests.map((request) => {
        const progress = workflow.getApprovalProgress(request.id);
        return (
          <div key={request.id}>
            <h3>{request.featureName}</h3>
            <p>Status: {request.status}</p>
            <p>Progress: {progress?.progress.toFixed(0)}%</p>
            <p>Current Stage: {progress?.currentStage}</p>
          </div>
        );
      })}
    </div>
  );
}
```

## Deployment Checklist

Before promoting a feature to production:

- [ ] Code reviewed and approved
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Test campaign completed
- [ ] No critical or high-severity issues
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] QA approval obtained
- [ ] Steward review completed
- [ ] Admin final approval obtained

## Monitoring & Observability

Monitor deployments with:

```typescript
// Get environment metrics
const metrics = envManager.getMetrics('production');
console.log('Uptime:', metrics?.uptime + '%');
console.log('Error rate:', metrics?.errorRate + '%');
console.log('Active users:', metrics?.activeUsers);

// Get testing statistics
const testStats = testFramework.getStats();
console.log('Open issues:', testStats.openIssues);
console.log('Critical issues:', testStats.criticalIssues);

// Get approval statistics
const approvalStats = workflow.getStats();
console.log('Average approval time:', approvalStats.averageApprovalTime + ' hours');
```

## Rollback Procedure

If critical issues are detected in production:

1. **Alert**: Monitoring detects issue
2. **Decision**: Stewards vote to rollback
3. **Execution**: Environment manager restores from backup
4. **Verification**: Health checks confirm rollback success
5. **Investigation**: Root cause analysis
6. **Fix**: Developer fixes issue
7. **Resubmit**: New approval request with fix

## Next Steps

Phase 5 will provide final verification and comprehensive documentation of the complete Sovereign Levela ecosystem, ensuring all components work together seamlessly.
