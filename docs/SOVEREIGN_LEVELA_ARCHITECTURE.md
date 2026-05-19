# Sovereign Levela Architecture

## Overview

Sovereign Levela is a fully self-sustaining, peer-to-peer platform where:
- **Users own their identity** (Self-Sovereign Identity via DIDs)
- **Data is distributed** (P2P sync + IPFS, no central database)
- **Code evolves democratically** (Governance-driven upgrades)
- **Development is staged** (Dev → Test → Prod workflow)
- **Zero external dependencies** (No third-party services required)

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Apps (Levela)                      │
│  (iOS/Android via Expo React Native)                        │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│  - Trust & Contribution Scoring                             │
│  - Governance & Voting                                       │
│  - Evidence Management                                       │
├─────────────────────────────────────────────────────────────┤
│                    Protocol Layer                            │
│  - Self-Sovereign Identity (DIDs)                           │
│  - P2P Sync (Gun.js / Yjs)                                  │
│  - IPFS Integration                                          │
│  - Smart Contracts (Local Consensus)                        │
├─────────────────────────────────────────────────────────────┤
│                    Network Layer                             │
│  - Peer Discovery (mDNS / DHT)                              │
│  - Message Relay (libp2p)                                    │
│  - Data Replication                                          │
├─────────────────────────────────────────────────────────────┤
│                    Storage Layer                             │
│  - Local SQLite (Device)                                     │
│  - IPFS Nodes (Distributed)                                 │
│  - Secure Enclave (Keys)                                     │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Self-Sovereign Identity (SSI)

### Current State (Centralized)
```
User → Supabase Auth → JWT Token → App
```

### Target State (Decentralized)
```
User → Generate DID locally → Sign with Private Key → App
```

### Implementation Details

#### 1.1 DID Generation
Each user generates a **Decentralized Identifier (DID)** on their device:
- Format: `did:key:z6Mk...` (using Ed25519 keys)
- Stored in **Secure Enclave** (iOS) / **Keystore** (Android)
- Private key never leaves the device
- Public key is shared to the network

#### 1.2 Local Key Management
```typescript
// Pseudo-code for DID generation
interface LocalIdentity {
  did: string;                    // did:key:z6Mk...
  publicKey: string;              // Base58-encoded public key
  privateKey: string;             // Encrypted in Secure Enclave
  username: string;               // User-chosen identifier
  createdAt: number;              // Timestamp
}
```

#### 1.3 Authentication Flow
1. User opens app → Check if DID exists locally
2. If not, generate new DID and store in Secure Enclave
3. User creates username (checked against P2P network for uniqueness)
4. Sign a "registration claim" with private key
5. Broadcast claim to P2P network → Other peers verify signature
6. User is now authenticated locally and known to the network

#### 1.4 Replacing Supabase Auth
- Remove dependency on `@supabase/supabase-js`
- Implement local auth context using DIDs
- All API calls signed with user's private key
- Verification done by peers, not a central server

### Files to Create/Modify

1. `src/lib/identity/did-manager.ts` - Generate and manage DIDs
2. `src/lib/identity/key-storage.ts` - Secure key storage (Secure Enclave)
3. `src/lib/identity/signature.ts` - Sign and verify messages
4. `src/contexts/IdentityContext.tsx` - Replace AuthContext
5. `src/lib/identity/identity.test.ts` - Unit tests

---

## Phase 2: P2P Data Sync & IPFS Storage

### Current State (Centralized)
```
App → Supabase → PostgreSQL
```

### Target State (Distributed)
```
App ↔ Gun.js / Yjs ↔ IPFS ↔ Other Peers
```

### Implementation Details

#### 2.1 Real-Time Data Sync (Gun.js)
Gun.js is a decentralized, real-time database that syncs data between peers:

```typescript
// Pseudo-code for Gun.js integration
import Gun from 'gun';

const gun = Gun({
  peers: ['http://localhost:8765/gun'],  // Can be other peer IPs
  localStorage: true,                     // Persist locally
});

// Store user profile
gun.get('users').get(userDID).put({
  username: 'alice',
  score: 85,
  pillars: { education: 90, ethics: 80 },
});

// Real-time sync
gun.get('users').get(userDID).on((data) => {
  console.log('Profile updated:', data);
});
```

#### 2.2 File Storage (IPFS)
Evidence files (images, documents) are stored on IPFS:

```typescript
// Pseudo-code for IPFS integration
import { create } from 'ipfs-http-client';

const ipfs = await create();

// Upload evidence file
const result = await ipfs.add({
  path: 'evidence/photo.jpg',
  content: fileBuffer,
});

const cid = result.cid.toString();  // Content Identifier
// Store CID in Gun.js, not the file itself
```

#### 2.3 Data Models in Gun.js

```typescript
// User Profile
gun.get('users').get(userDID).put({
  did: 'did:key:z6Mk...',
  username: 'alice',
  profile: {
    fullName: 'Alice Smith',
    bio: 'Civic tech enthusiast',
    avatar: 'QmXxxx...',  // IPFS CID
  },
  scores: {
    overall: 85,
    pillars: { education: 90, ethics: 80, ... },
  },
  endorsements: ['did:key:z6Mk...', ...],
  createdAt: 1234567890,
});

// Governance Proposals
gun.get('governance').get('proposals').get(proposalId).put({
  id: proposalId,
  title: 'Increase voting threshold',
  description: 'Proposal to raise quorum to 60%',
  creator: 'did:key:z6Mk...',
  votes: {
    'did:key:z6Mk...': 'yes',
    'did:key:z6Mk...': 'no',
  },
  status: 'active',
  createdAt: 1234567890,
  endsAt: 1234567890 + 7 * 24 * 60 * 60,  // 7 days
});

// Evidence
gun.get('evidence').get(evidenceId).put({
  id: evidenceId,
  owner: 'did:key:z6Mk...',
  pillar: 'education',
  title: 'University Degree',
  description: 'Bachelor of Science in Computer Science',
  files: [
    { name: 'diploma.pdf', cid: 'QmXxxx...' },
    { name: 'transcript.pdf', cid: 'QmYyyy...' },
  ],
  createdAt: 1234567890,
});
```

#### 2.4 Peer Discovery
Peers find each other via:
- **mDNS** (Local network discovery)
- **DHT** (Distributed Hash Table for internet-wide discovery)
- **Manual peer addition** (User can add known peers)

### Files to Create/Modify

1. `src/lib/p2p/gun-client.ts` - Initialize and manage Gun.js
2. `src/lib/p2p/ipfs-client.ts` - Initialize and manage IPFS
3. `src/lib/p2p/peer-discovery.ts` - Discover and connect to peers
4. `src/lib/storage/data-sync.ts` - Sync logic for profiles, proposals, evidence
5. `src/lib/storage/storage.test.ts` - Unit tests

---

## Phase 3: Protocol Governance for Code Upgrades

### Current State (Centralized)
```
Developer → Push to main → Deploy to server → All users get update
```

### Target State (Decentralized)
```
Developer → Create PR → Stewards test → Vote to approve → All apps sync new code
```

### Implementation Details

#### 3.1 Protocol Versioning
Each app version has a **protocol version** stored on the network:

```typescript
interface ProtocolVersion {
  version: '1.0.0';
  releaseDate: number;
  features: {
    'identity-v1': true,
    'p2p-sync-v1': true,
    'governance-v1': true,
  };
  requiredMinVersion: '1.0.0';
  deprecatedFeatures: [];
  hash: 'sha256:abc123...';  // Hash of app code for verification
}
```

#### 3.2 Staged Rollout
```
┌─────────────────────────────────────────────────────┐
│                  Development                        │
│  (Local dev environment, feature branches)          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│                  Staging Network                    │
│  (Separate P2P network for testers)                 │
│  Only users with "Tester" role can join             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              Governance Vote                        │
│  Stewards vote: "Is this version ready?"            │
│  Requires 66% approval                              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              Production Network                     │
│  (Main P2P network, all users)                      │
│  New protocol version becomes active                │
└─────────────────────────────────────────────────────┘
```

#### 3.3 Smart Contracts for Governance
Instead of SQL RPCs, governance logic is encoded in **local smart contracts**:

```typescript
// Pseudo-code for a governance smart contract
interface GovernanceContract {
  // Voting
  castVote(proposalId: string, choice: 'yes' | 'no' | 'abstain'): void;
  getProposalResults(proposalId: string): { yes: number; no: number; abstain: number };
  
  // Proposal Management
  createProposal(title: string, description: string): string;
  activateProposal(proposalId: string): void;
  closeProposal(proposalId: string): void;
  
  // Protocol Upgrades
  proposeProtocolUpgrade(version: string, hash: string): string;
  approveProtocolUpgrade(upgradeId: string): void;
  activateProtocolUpgrade(upgradeId: string): void;
  
  // Verification
  verifyVoteSignature(vote: Vote): boolean;
  verifyProposalHash(proposalId: string, hash: string): boolean;
}
```

#### 3.4 Consensus Mechanism
- **Voting-based consensus**: Proposals pass with 66% approval
- **Weighted voting**: Voting power based on Trust & Contribution score
- **Timelock**: Approved upgrades wait 7 days before activation (allows users to opt-out)

### Files to Create/Modify

1. `src/lib/protocol/protocol-version.ts` - Define protocol versions
2. `src/lib/protocol/smart-contract.ts` - Implement governance contracts
3. `src/lib/protocol/consensus.ts` - Implement voting and consensus
4. `src/lib/protocol/upgrade-manager.ts` - Manage protocol upgrades
5. `src/lib/protocol/protocol.test.ts` - Unit tests

---

## Phase 4: Staged Promotion Workflow (Dev → Test → Prod)

### Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Developer creates feature in local environment           │
│    - Feature branch: feat/new-feature                       │
│    - Tests pass locally                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Create Pull Request with staging environment config      │
│    - PR description includes test plan                      │
│    - Staging network config included                        │
│    - Feature flag: STAGING_ONLY = true                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Authorized Testers download staging build                │
│    - Build includes feature with flag enabled               │
│    - Testers connect to staging P2P network                 │
│    - Testers verify functionality                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Testers submit feedback via Steward Console              │
│    - Create "Test Report" proposal                          │
│    - Include: feature name, issues found, approval status   │
│    - Sign report with their DID                             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Stewards vote on "Protocol Upgrade" proposal             │
│    - Vote: "Approve feature for production?"                │
│    - Requires 66% approval                                  │
│    - 7-day voting period                                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. If approved, feature is promoted to production           │
│    - Feature flag: STAGING_ONLY = false                     │
│    - New protocol version created                           │
│    - All users auto-sync to new version                     │
│    - 7-day timelock before mandatory activation             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Users can opt-in/opt-out during timelock period          │
│    - Users see notification: "New version available"        │
│    - Can update now or wait                                 │
│    - After 7 days, version becomes mandatory                │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Management

#### 4.1 Environment Config
```typescript
// src/config/environments.ts
export const ENVIRONMENTS = {
  development: {
    name: 'development',
    p2pNetwork: 'localhost:8765',
    ipfsGateway: 'http://localhost:5001',
    featureFlags: {
      STAGING_ONLY: true,
      PROTOCOL_UPGRADES: false,
    },
  },
  staging: {
    name: 'staging',
    p2pNetwork: 'staging.levela.local',
    ipfsGateway: 'http://staging-ipfs.levela.local:5001',
    featureFlags: {
      STAGING_ONLY: true,
      PROTOCOL_UPGRADES: false,
    },
  },
  production: {
    name: 'production',
    p2pNetwork: 'auto-discover',  // Uses DHT
    ipfsGateway: 'auto-discover',
    featureFlags: {
      STAGING_ONLY: false,
      PROTOCOL_UPGRADES: true,
    },
  },
};
```

#### 4.2 Feature Flags
```typescript
// src/lib/feature-flags.ts
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  environment: 'development' | 'staging' | 'production';
  requiredRole?: 'admin' | 'steward' | 'tester' | 'user';
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    name: 'NEW_GOVERNANCE_UI',
    enabled: true,
    environment: 'staging',
    requiredRole: 'tester',
  },
  {
    name: 'IPFS_STORAGE',
    enabled: false,
    environment: 'production',
  },
];

export function isFeatureEnabled(flagName: string): boolean {
  const flag = FEATURE_FLAGS.find((f) => f.name === flagName);
  if (!flag) return false;
  
  const currentEnv = getCurrentEnvironment();
  const userRole = getCurrentUserRole();
  
  return (
    flag.enabled &&
    flag.environment === currentEnv &&
    (!flag.requiredRole || userRole === flag.requiredRole)
  );
}
```

#### 4.3 Build Variants
```bash
# Development build (local testing)
npm run build:dev

# Staging build (for testers)
npm run build:staging

# Production build (for all users)
npm run build:prod
```

### Files to Create/Modify

1. `src/config/environments.ts` - Environment configurations
2. `src/lib/feature-flags.ts` - Feature flag management
3. `src/lib/deployment/build-manager.ts` - Build variant management
4. `src/lib/deployment/rollout-manager.ts` - Manage staged rollouts
5. `docs/DEPLOYMENT_GUIDE.md` - Deployment procedures

---

## Data Flow Example: Creating and Voting on a Proposal

### Step 1: User Creates Proposal (Local)
```
User (Alice) → Generate DID signature → Create proposal object
```

### Step 2: Proposal Broadcast to P2P Network
```
Alice's App → Gun.js → Peers receive proposal → Verify signature
```

### Step 3: Peers Store Proposal (IPFS)
```
Proposal stored in Gun.js (metadata) + IPFS (description/evidence)
```

### Step 4: Other Users Vote
```
Bob's App → Reads proposal from Gun.js → Signs vote → Broadcasts
```

### Step 5: Consensus Check
```
Peers tally votes → Check if 66% threshold reached → Update proposal status
```

### Step 6: Approved Proposal Execution
```
If governance vote: New protocol version activated
If feature vote: Feature flag enabled in all apps
```

---

## Security Considerations

### 1. Key Management
- Private keys stored in **Secure Enclave** (iOS) / **Keystore** (Android)
- Keys never transmitted over network
- Biometric authentication required for sensitive operations

### 2. Signature Verification
- All messages signed with user's private key
- Peers verify signatures before accepting data
- Invalid signatures are rejected

### 3. Consensus Validation
- Votes must be signed by valid DIDs
- Voting power verified against Trust & Contribution score
- Double-voting prevented via nonce system

### 4. Network Security
- P2P communication encrypted (TLS/mTLS)
- IPFS data integrity verified via content hashing
- Peer reputation system prevents malicious nodes

---

## Development Workflow for Developers

### 1. Local Development
```bash
# Clone repo
git clone https://github.com/maturehumanity/levela.git
cd levela

# Install dependencies
npm install

# Start local P2P network (Gun.js + IPFS)
npm run start:p2p

# Start app in dev mode
npm run dev

# Run tests
npm test
```

### 2. Create Feature Branch
```bash
git checkout -b feat/new-feature
# Make changes
git commit -m "feat: add new feature"
```

### 3. Create Staging Build
```bash
# Update feature flag in src/lib/feature-flags.ts
# Set environment: 'staging', requiredRole: 'tester'

npm run build:staging

# This generates a build that:
# - Connects to staging P2P network
# - Enables feature flag for testers only
# - Includes all test data
```

### 4. Create Pull Request
```bash
git push origin feat/new-feature

# Create PR with:
# - Description of feature
# - Test plan for testers
# - Staging build instructions
# - Any breaking changes
```

### 5. Testers Verify
- Download staging build
- Connect to staging network
- Execute test plan
- Submit test report via Steward Console

### 6. Promote to Production
- If tests pass, create "Protocol Upgrade" proposal
- Stewards vote to approve
- Feature promoted to production
- All users auto-sync new version

---

## Monitoring & Observability

### 1. Local Logging
```typescript
// src/lib/logging/logger.ts
export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  data?: any;
}

// Logs stored locally, can be exported for debugging
```

### 2. Network Health Monitoring
```typescript
// src/lib/p2p/network-monitor.ts
export interface NetworkStatus {
  connectedPeers: number;
  ipfsNodes: number;
  dataReplicationHealth: number;  // 0-100%
  averageLatency: number;  // ms
}
```

### 3. Governance Audit Trail
```typescript
// src/lib/governance/audit-log.ts
export interface AuditEntry {
  timestamp: number;
  action: string;  // 'vote_cast', 'proposal_created', etc.
  actor: string;   // DID
  target: string;  // Proposal ID, etc.
  details: any;
}
```

---

## Conclusion

Sovereign Levela is a **fully decentralized, self-sustaining platform** where:
✅ Users own their identity (DIDs in Secure Enclave)
✅ Data is distributed (Gun.js + IPFS)
✅ Code evolves democratically (Governance votes)
✅ Development is professional (Dev → Test → Prod)
✅ Zero external dependencies (No third-party services)

The next sections will implement each phase with code examples and integration guides.
