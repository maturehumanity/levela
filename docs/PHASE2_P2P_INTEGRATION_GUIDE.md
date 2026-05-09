# Phase 2: P2P Data Sync & IPFS Storage Integration Guide

## Overview

Phase 2 replaces the centralized Supabase database with a fully decentralized P2P architecture using Gun.js for data synchronization and IPFS for distributed file storage.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Levela Mobile App                        │
├─────────────────────────────────────────────────────────────┤
│                    Data Sync Manager                        │
│  (Handles all data operations)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │   Gun.js Client      │      │   IPFS Client        │    │
│  │  (Real-time Sync)    │      │  (File Storage)      │    │
│  └──────────────────────┘      └──────────────────────┘    │
│           │                              │                 │
│           ↓                              ↓                 │
├─────────────────────────────────────────────────────────────┤
│                    Peer Discovery                           │
│  (mDNS, DHT, Manual Peer Addition)                         │
├─────────────────────────────────────────────────────────────┤
│                    P2P Network                              │
│  (Gun.js Peers + IPFS Nodes)                               │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Gun Client (`src/lib/p2p/gun-client.ts`)

Gun.js is a decentralized, real-time database that syncs data between peers.

**Key Features:**
- Real-time data synchronization
- Automatic conflict resolution
- Local persistence
- DHT-based peer discovery

**Usage:**

```typescript
import { getGunClient } from './src/lib/p2p/gun-client';

const gunClient = getGunClient();

// Store data
await gunClient.put('users/alice', {
  name: 'Alice',
  score: 85,
  pillars: { education: 90, ethics: 80 },
});

// Retrieve data
const profile = await gunClient.get('users/alice');

// Subscribe to real-time updates
const unsubscribe = gunClient.subscribe('users/alice', (data) => {
  console.log('Profile updated:', data);
});

// Search data
const results = await gunClient.search('users', (item) => item.score > 80);

// List keys
const keys = await gunClient.keys('users');
```

### 2. IPFS Client (`src/lib/p2p/ipfs-client.ts`)

IPFS provides distributed, content-addressed file storage.

**Key Features:**
- Content-addressed storage (CID)
- Distributed file replication
- Automatic garbage collection
- File pinning for persistence

**Usage:**

```typescript
import { getIPFSClient } from './src/lib/p2p/ipfs-client';

const ipfsClient = getIPFSClient();

// Upload file
const fileBuffer = Buffer.from('File content');
const result = await ipfsClient.uploadFile(
  fileBuffer,
  'document.pdf',
  userDID
);

console.log('CID:', result.cid);
console.log('Gateway URL:', ipfsClient.getGatewayUrl(result.cid));

// Retrieve file
const content = await ipfsClient.getFile(result.cid);

// Pin file (ensure it's retained)
await ipfsClient.pinFile(result.cid);

// Upload directory
const results = await ipfsClient.uploadDirectory(
  [
    { name: 'file1.txt', content: Buffer.from('Content 1') },
    { name: 'file2.txt', content: Buffer.from('Content 2') },
  ],
  userDID
);
```

### 3. Peer Discovery (`src/lib/p2p/peer-discovery.ts`)

Discovers and manages peers on the network.

**Key Features:**
- mDNS for local network discovery
- DHT for internet-wide discovery
- Peer reputation system
- Automatic peer cleanup

**Usage:**

```typescript
import { getPeerDiscoveryManager, startPeerDiscovery } from './src/lib/p2p/peer-discovery';

const peerDiscovery = getPeerDiscoveryManager();

// Start discovery
await startPeerDiscovery();

// Manually add peer
peerDiscovery.addPeer({
  id: 'peer-1',
  addresses: ['http://peer1.levela.local:8765'],
  lastSeen: Date.now(),
  reputation: 50,
  type: 'gun',
});

// Get all peers
const peers = peerDiscovery.getPeers();

// Get trusted peers (reputation > threshold)
const trustedPeers = peerDiscovery.getTrustedPeers();

// Update peer reputation
peerDiscovery.updatePeerReputation('peer-1', 10);  // Increase by 10

// Get network stats
const stats = peerDiscovery.getNetworkStats();
console.log('Total peers:', stats.totalPeers);
console.log('Trusted peers:', stats.trustedPeers);
console.log('Average reputation:', stats.averageReputation);
```

### 4. Data Sync Manager (`src/lib/p2p/data-sync.ts`)

High-level API for syncing all Levela data types.

**Key Features:**
- Automatic sync queue processing
- Integrity proof verification
- Support for all data types
- Real-time subscription support

**Usage:**

```typescript
import { getDataSyncManager } from './src/lib/p2p/data-sync';

const dataSync = getDataSyncManager();

// Sync profile
await dataSync.syncProfile(
  userDID,
  {
    name: 'Alice',
    bio: 'Civic tech enthusiast',
    score: 85,
  },
  privateKey
);

// Sync proposal
await dataSync.syncProposal(
  'proposal-1',
  {
    title: 'Increase voting threshold',
    description: 'Proposal to raise quorum to 60%',
    status: 'active',
  },
  creatorDID,
  privateKey
);

// Sync evidence
await dataSync.syncEvidence(
  'evidence-1',
  {
    title: 'University Degree',
    pillar: 'education',
    description: 'Bachelor of Science',
  },
  fileBuffer,
  ownerDID,
  privateKey
);

// Sync endorsement
await dataSync.syncEndorsement(
  'endorsement-1',
  {
    targetDID: 'did:key:target',
    pillar: 'education',
    stars: 5,
  },
  endorserDID,
  privateKey
);

// Sync vote
await dataSync.syncVote(
  'vote-1',
  {
    proposalId: 'proposal-1',
    choice: 'yes',
  },
  voterDID,
  privateKey
);

// Subscribe to profile changes
const unsubscribe = dataSync.subscribe('profile', (data) => {
  console.log('Profile updated:', data);
});

// Get sync status
const status = dataSync.getSyncStatus();
console.log('Queue length:', status.queueLength);
console.log('Auto-syncing:', status.isAutoSyncing);
```

## Data Models

### User Profile
```typescript
{
  did: 'did:key:z6Mk...',
  username: 'alice',
  profile: {
    fullName: 'Alice Smith',
    bio: 'Civic tech enthusiast',
    avatar: 'QmXxxx...',  // IPFS CID
  },
  scores: {
    overall: 85,
    pillars: {
      education: 90,
      ethics: 80,
      responsibility: 85,
      environment: 75,
      economy: 80,
    },
  },
  endorsements: ['did:key:z6Mk...', ...],
  createdAt: 1234567890,
}
```

### Governance Proposal
```typescript
{
  id: 'proposal-1',
  title: 'Increase voting threshold',
  description: 'Proposal to raise quorum to 60%',
  creator: 'did:key:z6Mk...',
  votes: {
    'did:key:z6Mk...': 'yes',
    'did:key:z6Mk...': 'no',
  },
  status: 'active',
  createdAt: 1234567890,
  endsAt: 1234567890 + 7 * 24 * 60 * 60,
}
```

### Evidence
```typescript
{
  id: 'evidence-1',
  owner: 'did:key:z6Mk...',
  pillar: 'education',
  title: 'University Degree',
  description: 'Bachelor of Science in Computer Science',
  files: [
    {
      name: 'diploma.pdf',
      cid: 'QmXxxx...',
      size: 1024000,
    },
  ],
  createdAt: 1234567890,
}
```

## Integration Steps

### Step 1: Initialize P2P Network on App Start

```typescript
// src/App.tsx
import { useEffect } from 'react';
import { getGunClient } from './lib/p2p/gun-client';
import { getIPFSClient } from './lib/p2p/ipfs-client';
import { startPeerDiscovery } from './lib/p2p/peer-discovery';
import { getDataSyncManager } from './lib/p2p/data-sync';

export function App() {
  useEffect(() => {
    const initializeP2P = async () => {
      // Initialize Gun client
      const gunClient = getGunClient();
      
      // Initialize IPFS client
      const ipfsClient = getIPFSClient();
      
      // Start peer discovery
      await startPeerDiscovery();
      
      // Initialize data sync
      const dataSync = getDataSyncManager();
      
      console.log('P2P network initialized');
    };

    initializeP2P();

    return () => {
      // Cleanup on unmount
    };
  }, []);

  return <YourApp />;
}
```

### Step 2: Replace Supabase Auth with SSI

```typescript
// src/contexts/IdentityContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { generateDID, LocalIdentity } from '../lib/identity/did-manager';
import { getKeyStorageManager } from '../lib/identity/key-storage';

interface IdentityContextType {
  identity: LocalIdentity | null;
  isLoading: boolean;
  error: Error | null;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeIdentity = async () => {
      try {
        const keyStorage = getKeyStorageManager();
        const keys = await keyStorage.getAllKeys();

        if (keys.length > 0) {
          // Load existing identity
          const existingIdentity = await loadIdentity(keys[0]);
          setIdentity(existingIdentity);
        } else {
          // Create new identity
          const newIdentity = generateDID();
          await keyStorage.generateAndStoreKey(newIdentity.did);
          setIdentity(newIdentity);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    initializeIdentity();
  }, []);

  return (
    <IdentityContext.Provider value={{ identity, isLoading, error }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error('useIdentity must be used within IdentityProvider');
  }
  return context;
}
```

### Step 3: Update Profile Management

```typescript
// src/lib/profile-manager.ts
import { getDataSyncManager } from './p2p/data-sync';
import { getKeyStorageManager } from './identity/key-storage';
import { useIdentity } from '../contexts/IdentityContext';

export async function updateProfile(profileData: any) {
  const { identity } = useIdentity();
  const dataSync = getDataSyncManager();
  const keyStorage = getKeyStorageManager();

  if (!identity) throw new Error('Identity not initialized');

  const privateKey = await keyStorage.getKey(identity.did);
  if (!privateKey) throw new Error('Private key not found');

  await dataSync.syncProfile(identity.did, profileData, privateKey);
}

export async function getProfile(userDID: string) {
  const dataSync = getDataSyncManager();
  const profileData = await dataSync.retrieveData('profile', userDID);
  return profileData;
}
```

### Step 4: Update Evidence Management

```typescript
// src/lib/evidence-manager.ts
import { getDataSyncManager } from './p2p/data-sync';
import { getKeyStorageManager } from './identity/key-storage';

export async function uploadEvidence(
  evidenceData: any,
  fileBuffer: Buffer,
  userDID: string
) {
  const dataSync = getDataSyncManager();
  const keyStorage = getKeyStorageManager();

  const privateKey = await keyStorage.getKey(userDID);
  if (!privateKey) throw new Error('Private key not found');

  const evidenceId = `evidence-${Date.now()}`;

  await dataSync.syncEvidence(
    evidenceId,
    evidenceData,
    fileBuffer,
    userDID,
    privateKey
  );

  return evidenceId;
}
```

## Environment Configuration

### Development
```typescript
// .env.development
REACT_APP_GUN_PEERS=http://localhost:8765/gun
REACT_APP_IPFS_API=http://localhost:5001
REACT_APP_IPFS_GATEWAY=http://localhost:8080
REACT_APP_ENVIRONMENT=development
```

### Staging
```typescript
// .env.staging
REACT_APP_GUN_PEERS=http://staging-gun.levela.local:8765/gun
REACT_APP_IPFS_API=http://staging-ipfs.levela.local:5001
REACT_APP_IPFS_GATEWAY=http://staging-ipfs.levela.local:8080
REACT_APP_ENVIRONMENT=staging
```

### Production
```typescript
// .env.production
REACT_APP_GUN_PEERS=
REACT_APP_IPFS_API=
REACT_APP_IPFS_GATEWAY=https://ipfs.io
REACT_APP_ENVIRONMENT=production
```

## Running Local P2P Network (Development)

### Start Gun.js Server
```bash
npm install -g gun-server
gun-server --port 8765
```

### Start IPFS Node
```bash
npm install -g ipfs
ipfs daemon --api /ip4/127.0.0.1/tcp/5001 --gateway /ip4/127.0.0.1/tcp/8080
```

### Run Levela App
```bash
npm run dev
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- src/lib/p2p/p2p.test.ts
```

## Monitoring & Debugging

### Enable Debug Logging

```typescript
const gunClient = getGunClient({ debug: true });
const ipfsClient = getIPFSClient({ debug: true });
const peerDiscovery = getPeerDiscoveryManager({ debug: true });
const dataSync = getDataSyncManager({ debug: true });
```

### Check Network Status

```typescript
import { getGunClient } from './lib/p2p/gun-client';
import { getPeerDiscoveryManager } from './lib/p2p/peer-discovery';

const gunClient = getGunClient();
const peerDiscovery = getPeerDiscoveryManager();

console.log('Gun stats:', gunClient.getNetworkStats());
console.log('Peer stats:', peerDiscovery.getNetworkStats());
```

## Troubleshooting

### Gun.js Connection Issues
- Ensure Gun server is running on the correct port
- Check firewall settings
- Verify peer URLs in configuration

### IPFS Connection Issues
- Ensure IPFS daemon is running
- Check API and gateway URLs
- Verify IPFS node is accessible

### Peer Discovery Issues
- Check network connectivity
- Verify mDNS is enabled (if using local discovery)
- Manually add known peers

## Next Steps

Phase 3 will implement Protocol Governance for code upgrades, allowing the community to vote on and activate new features.
