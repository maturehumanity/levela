# Phase 3: Protocol Governance for Code Upgrades

## Overview

Phase 3 implements a decentralized governance system for managing protocol upgrades. This allows the Levela community to vote on and approve changes to the platform's code and features, ensuring that no single entity can unilaterally modify the system.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│            Protocol Governance System                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │ Protocol Versioning  │      │ Consensus Manager    │    │
│  │ (Versions, Features) │      │ (Weighted Voting)    │    │
│  └──────────────────────┘      └──────────────────────┘    │
│           │                              │                 │
│           ↓                              ↓                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Protocol Executor                            │  │
│  │  (Timelock, Rollout, Rollback)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│           │                                                 │
│           ↓                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Active Protocol Version                      │  │
│  │  (Features, Rules, Permissions)                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Protocol Versioning (`src/lib/protocol/protocol-versioning.ts`)

Manages protocol versions and feature flags.

**Key Features:**
- Semantic versioning (1.0.0, 2.0.0, etc.)
- Feature flags with rollout percentages
- Immutable version history
- Content hashing for integrity

**Usage:**

```typescript
import { getProtocolManager } from './src/lib/protocol/protocol-versioning';

const protocolManager = getProtocolManager();

// Create a new protocol version
const newVersion = protocolManager.createVersion(
  '2.0.0',
  'Levela v2',
  'Second protocol version with enhanced governance',
  'Added proposal templates and delegation',
  [
    {
      name: 'proposal-templates',
      description: 'Pre-defined proposal templates',
      version: '2.0.0',
      enabled: true,
      rolloutPercentage: 0,  // Start at 0%, gradually increase
      dependencies: ['governance-proposals'],
    },
    {
      name: 'vote-delegation',
      description: 'Allow users to delegate their votes',
      version: '2.0.0',
      enabled: true,
      rolloutPercentage: 0,
      dependencies: ['governance-proposals'],
    },
  ]
);

// Propose the upgrade
const proposal = protocolManager.proposeUpgrade(
  newVersion,
  'did:key:proposer',
  7 * 24 * 60 * 60  // 7-day voting period
);

// Cast votes
protocolManager.castVote(proposal.id, 'did:key:voter1', 'yes');
protocolManager.castVote(proposal.id, 'did:key:voter2', 'yes');
protocolManager.castVote(proposal.id, 'did:key:voter3', 'no');

// Finalize voting after voting period ends
protocolManager.finalizeVoting(proposal.id);

// Check if feature is enabled
const isEnabled = protocolManager.isFeatureEnabled('proposal-templates');
const isEnabledForUser = protocolManager.isFeatureEnabled(
  'proposal-templates',
  'did:key:user'
);

// Get protocol statistics
const stats = protocolManager.getStats();
console.log('Active version:', stats.activeVersion);
console.log('Total proposals:', stats.totalProposals);
console.log('Enabled features:', stats.enabledFeatures);
```

### 2. Consensus Manager (`src/lib/protocol/protocol-consensus.ts`)

Implements weighted voting based on user reputation.

**Key Features:**
- Weighted voting (based on Trust & Contribution score)
- Role-based vote multipliers
- Quorum requirements
- Approval thresholds

**Usage:**

```typescript
import { getConsensusManager } from './src/lib/protocol/protocol-consensus';

const consensusManager = getConsensusManager();

// Register voters with weights
consensusManager.registerVoter({
  did: 'did:key:alice',
  weight: 1.5,  // Based on Trust & Contribution score
  role: 'steward',
  canVote: true,
});

consensusManager.registerVoter({
  did: 'did:key:bob',
  weight: 1.0,
  role: 'citizen',
  canVote: true,
});

// Update voter weight (when score changes)
consensusManager.updateVoterWeight('did:key:alice', 90, 'steward');

// Cast weighted votes
await consensusManager.castVote(
  'proposal-1',
  'did:key:alice',
  'yes',
  privateKey
);

await consensusManager.castVote(
  'proposal-1',
  'did:key:bob',
  'yes',
  privateKey
);

// Calculate consensus result
const result = consensusManager.calculateConsensus('proposal-1');
console.log('Yes votes:', result.yesWeight);
console.log('No votes:', result.noWeight);
console.log('Quorum met:', result.quorumMet);
console.log('Approved:', result.approved);

// Get consensus statistics
const stats = consensusManager.getStats();
console.log('Total voters:', stats.totalVoters);
console.log('Eligible voters:', stats.eligibleVoters);
console.log('Quorum:', stats.quorumPercentage + '%');
console.log('Approval threshold:', stats.approvalThreshold + '%');
```

### 3. Protocol Executor (`src/lib/protocol/protocol-executor.ts`)

Safely executes upgrades with timelock and rollback capabilities.

**Key Features:**
- Timelock mechanism (prevents immediate execution)
- Gradual feature rollout (0% → 100%)
- Checkpoint creation before execution
- Rollback capability

**Usage:**

```typescript
import { getProtocolExecutor } from './src/lib/protocol/protocol-executor';

const executor = getProtocolExecutor();

// Check if upgrade is ready
const isReady = executor.isUpgradeReady('proposal-1');

// Get time until execution
const timeRemaining = executor.getTimeUntilExecution('proposal-1');
console.log(`Upgrade ready in ${timeRemaining / 1000} seconds`);

// Execute upgrade when ready
try {
  await executor.executeUpgrade(
    'proposal-1',
    currentAppState,
    (stage) => console.log(`Upgrade stage: ${stage}`)
  );
  console.log('Upgrade completed successfully');
} catch (error) {
  console.error('Upgrade failed:', error);
}

// Gradually increase feature rollout
await executor.increaseFeatureRollout('proposal-templates', 100);

// Register rollback handler
executor.registerRollbackHandler('proposal-1', async () => {
  // Custom rollback logic
  console.log('Rolling back upgrade');
});

// Rollback if needed
await executor.rollbackUpgrade('proposal-1', 'Critical bug detected');

// Get execution logs
const logs = executor.getExecutionLogs('proposal-1');
console.log('Execution history:', logs);

// Get executor statistics
const stats = executor.getStats();
console.log('Completed executions:', stats.completedExecutions);
console.log('Failed executions:', stats.failedExecutions);
console.log('Active upgrades:', stats.activeUpgrades);
```

## Governance Workflow

### Step 1: Development
```
Developer creates new feature
    ↓
Feature tested locally
    ↓
Code committed to development branch
```

### Step 2: Proposal
```
Developer proposes protocol upgrade
    ↓
New version created with feature flag
    ↓
Proposal published to network
    ↓
Voting period begins (7 days)
```

### Step 3: Voting
```
Community members vote (weighted by reputation)
    ↓
Quorum must be met (40% of eligible voters)
    ↓
Approval threshold must be reached (66% yes votes)
```

### Step 4: Timelock
```
If approved, upgrade enters timelock
    ↓
Timelock duration: 7 days
    ↓
During timelock, community can raise concerns
    ↓
Rollback can be triggered if critical issues found
```

### Step 5: Activation
```
Timelock period expires
    ↓
Executor activates upgrade
    ↓
Feature flag set to 0% rollout
    ↓
Gradual rollout: 10% → 20% → ... → 100%
```

### Step 6: Monitoring
```
Monitor feature performance
    ↓
If issues detected, trigger rollback
    ↓
If stable, increase rollout percentage
```

## Integration Steps

### Step 1: Initialize Protocol Manager on App Start

```typescript
// src/App.tsx
import { useEffect } from 'react';
import { getProtocolManager } from './lib/protocol/protocol-versioning';
import { getConsensusManager } from './lib/protocol/protocol-consensus';
import { getProtocolExecutor } from './lib/protocol/protocol-executor';

export function App() {
  useEffect(() => {
    const initializeProtocol = async () => {
      // Initialize protocol manager
      const protocolManager = getProtocolManager();
      
      // Initialize consensus manager
      const consensusManager = getConsensusManager();
      
      // Initialize executor
      const executor = getProtocolExecutor();
      
      // Subscribe to protocol events
      protocolManager.subscribe((event) => {
        console.log('Protocol event:', event);
      });
      
      console.log('Protocol governance initialized');
    };

    initializeProtocol();
  }, []);

  return <YourApp />;
}
```

### Step 2: Create Governance UI Components

```typescript
// src/components/governance/ProtocolUpgradeProposal.tsx
import { getProtocolManager } from '../../lib/protocol/protocol-versioning';
import { getConsensusManager } from '../../lib/protocol/protocol-consensus';

export function ProtocolUpgradeProposal({ proposalId }: { proposalId: string }) {
  const protocolManager = getProtocolManager();
  const consensusManager = getConsensusManager();
  
  const proposal = protocolManager.getProposal(proposalId);
  const consensus = consensusManager.calculateConsensus(proposalId);

  if (!proposal) {
    return <div>Proposal not found</div>;
  }

  return (
    <div>
      <h2>{proposal.version.name}</h2>
      <p>{proposal.version.description}</p>
      
      <div>
        <h3>Voting Results</h3>
        <p>Yes: {consensus.yesPercentage.toFixed(1)}%</p>
        <p>No: {consensus.noPercentage.toFixed(1)}%</p>
        <p>Quorum: {consensus.quorumMet ? 'Met' : 'Not met'}</p>
        <p>Status: {proposal.status}</p>
      </div>
      
      <div>
        <h3>Features</h3>
        {proposal.version.features.map((feature) => (
          <div key={feature.name}>
            <p>{feature.name}: {feature.enabled ? 'Enabled' : 'Disabled'}</p>
            <p>Rollout: {feature.rolloutPercentage}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 3: Update User Profile with Voting Weight

```typescript
// src/lib/profile-manager.ts
import { getConsensusManager } from './protocol/protocol-consensus';

export async function updateUserVotingWeight(userDID: string, score: number, role: string) {
  const consensusManager = getConsensusManager();
  consensusManager.updateVoterWeight(userDID, score, role);
}
```

### Step 4: Add Feature Flag Checks

```typescript
// src/components/ProposalTemplates.tsx
import { getProtocolManager } from '../lib/protocol/protocol-versioning';
import { useIdentity } from '../contexts/IdentityContext';

export function ProposalTemplates() {
  const { identity } = useIdentity();
  const protocolManager = getProtocolManager();
  
  const isEnabled = protocolManager.isFeatureEnabled(
    'proposal-templates',
    identity?.did
  );

  if (!isEnabled) {
    return <div>This feature is not yet available</div>;
  }

  return <div>Proposal Templates Component</div>;
}
```

## Voting Parameters

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **Voting Period** | 7 days | Time for community to vote |
| **Quorum** | 40% | Minimum participation required |
| **Approval Threshold** | 66% | Minimum yes votes needed |
| **Timelock Duration** | 7 days | Waiting period before activation |
| **Initial Rollout** | 10% | Starting percentage for new features |

## Feature Rollout Strategy

Features are rolled out gradually to minimize risk:

```
Day 1: 10% of users
Day 2: 20% of users
Day 3: 30% of users
Day 4: 40% of users
Day 5: 50% of users
Day 6: 75% of users
Day 7: 100% of users
```

If issues are detected at any stage, the feature can be rolled back.

## Rollback Procedure

1. **Detection**: Community or stewards detect critical issue
2. **Alert**: Issue reported to governance system
3. **Vote**: Emergency vote to rollback (lower quorum: 20%)
4. **Execution**: Rollback handler restores previous version
5. **Investigation**: Root cause analysis
6. **Fix**: Developer fixes issue
7. **Resubmit**: New proposal with fix

## Security Considerations

1. **Timelock**: 7-day delay prevents immediate exploitation
2. **Quorum**: Requires broad participation
3. **Approval Threshold**: Supermajority prevents narrow decisions
4. **Checkpoints**: State snapshots enable safe rollback
5. **Gradual Rollout**: Limits blast radius of bugs
6. **Signature Verification**: All votes are cryptographically signed

## Monitoring

Monitor protocol health with:

```typescript
const stats = protocolManager.getStats();
const executorStats = executor.getStats();
const consensusStats = consensusManager.getStats();

console.log('Protocol:', stats);
console.log('Executor:', executorStats);
console.log('Consensus:', consensusStats);
```

## Next Steps

Phase 4 will establish the Staged Promotion Workflow (Dev → Test → Prod), implementing the complete development lifecycle with authorized testing roles and production deployment procedures.
