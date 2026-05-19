import { getGunClient } from './gun-client';
import { getIPFSClient } from './ipfs-client';
import { createIntegrityProof, verifyIntegrityProof } from '../identity/did-manager';

/**
 * Data Synchronization Module
 * 
 * Handles synchronization of all Levela data types across the P2P network:
 * - User profiles
 * - Governance proposals
 * - Evidence files
 * - Endorsements
 * - Voting records
 */

export interface SyncConfig {
  autoSync?: boolean;
  syncInterval?: number;
  debug?: boolean;
}

export interface SyncableData {
  id: string;
  type: 'profile' | 'proposal' | 'evidence' | 'endorsement' | 'vote';
  owner: string;                  // User's DID
  data: any;
  timestamp: number;
  signature: string;              // Integrity proof signature
}

/**
 * Data Synchronization Manager
 */
export class DataSyncManager {
  private config: SyncConfig;
  private syncQueue: SyncableData[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: SyncConfig = {}) {
    this.config = {
      autoSync: config.autoSync !== false,
      syncInterval: config.syncInterval || 5000,  // 5 seconds
      debug: config.debug || false,
    };

    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Start automatic synchronization
   */
  private startAutoSync(): void {
    this.syncInterval = setInterval(() => {
      this.processSyncQueue().catch((error) => {
        console.error('[DataSync] Sync error:', error);
      });
    }, this.config.syncInterval);

    if (this.config.debug) {
      console.log('[DataSync] Started auto-sync');
    }
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.config.debug) {
      console.log('[DataSync] Stopped auto-sync');
    }
  }

  /**
   * Sync user profile
   */
  async syncProfile(
    userDID: string,
    profileData: any,
    privateKey: Uint8Array
  ): Promise<void> {
    try {
      // Create integrity proof
      const proof = createIntegrityProof(profileData, userDID, privateKey);

      const syncData: SyncableData = {
        id: `profile:${userDID}`,
        type: 'profile',
        owner: userDID,
        data: profileData,
        timestamp: Date.now(),
        signature: proof.signature,
      };

      // Add to sync queue
      this.syncQueue.push(syncData);

      // Immediately sync to Gun
      await this.syncToGun(syncData);

      if (this.config.debug) {
        console.log('[DataSync] Queued profile sync for:', userDID);
      }
    } catch (error) {
      console.error('[DataSync] Error syncing profile:', error);
      throw error;
    }
  }

  /**
   * Sync governance proposal
   */
  async syncProposal(
    proposalId: string,
    proposalData: any,
    creatorDID: string,
    privateKey: Uint8Array
  ): Promise<void> {
    try {
      // Create integrity proof
      const proof = createIntegrityProof(proposalData, creatorDID, privateKey);

      const syncData: SyncableData = {
        id: `proposal:${proposalId}`,
        type: 'proposal',
        owner: creatorDID,
        data: proposalData,
        timestamp: Date.now(),
        signature: proof.signature,
      };

      // Add to sync queue
      this.syncQueue.push(syncData);

      // Immediately sync to Gun
      await this.syncToGun(syncData);

      if (this.config.debug) {
        console.log('[DataSync] Queued proposal sync:', proposalId);
      }
    } catch (error) {
      console.error('[DataSync] Error syncing proposal:', error);
      throw error;
    }
  }

  /**
   * Sync evidence
   */
  async syncEvidence(
    evidenceId: string,
    evidenceData: any,
    fileBuffer: Buffer,
    ownerDID: string,
    privateKey: Uint8Array
  ): Promise<void> {
    try {
      // Upload file to IPFS
      const ipfsClient = getIPFSClient();
      const uploadResult = await ipfsClient.uploadFile(
        fileBuffer,
        evidenceData.fileName,
        ownerDID
      );

      // Create evidence record with IPFS CID
      const evidenceRecord = {
        ...evidenceData,
        ipfsCID: uploadResult.cid,
        fileSize: uploadResult.size,
      };

      // Create integrity proof
      const proof = createIntegrityProof(evidenceRecord, ownerDID, privateKey);

      const syncData: SyncableData = {
        id: `evidence:${evidenceId}`,
        type: 'evidence',
        owner: ownerDID,
        data: evidenceRecord,
        timestamp: Date.now(),
        signature: proof.signature,
      };

      // Add to sync queue
      this.syncQueue.push(syncData);

      // Immediately sync to Gun
      await this.syncToGun(syncData);

      if (this.config.debug) {
        console.log('[DataSync] Queued evidence sync:', evidenceId);
      }
    } catch (error) {
      console.error('[DataSync] Error syncing evidence:', error);
      throw error;
    }
  }

  /**
   * Sync endorsement
   */
  async syncEndorsement(
    endorsementId: string,
    endorsementData: any,
    endorserDID: string,
    privateKey: Uint8Array
  ): Promise<void> {
    try {
      // Create integrity proof
      const proof = createIntegrityProof(endorsementData, endorserDID, privateKey);

      const syncData: SyncableData = {
        id: `endorsement:${endorsementId}`,
        type: 'endorsement',
        owner: endorserDID,
        data: endorsementData,
        timestamp: Date.now(),
        signature: proof.signature,
      };

      // Add to sync queue
      this.syncQueue.push(syncData);

      // Immediately sync to Gun
      await this.syncToGun(syncData);

      if (this.config.debug) {
        console.log('[DataSync] Queued endorsement sync:', endorsementId);
      }
    } catch (error) {
      console.error('[DataSync] Error syncing endorsement:', error);
      throw error;
    }
  }

  /**
   * Sync vote
   */
  async syncVote(
    voteId: string,
    voteData: any,
    voterDID: string,
    privateKey: Uint8Array
  ): Promise<void> {
    try {
      // Create integrity proof
      const proof = createIntegrityProof(voteData, voterDID, privateKey);

      const syncData: SyncableData = {
        id: `vote:${voteId}`,
        type: 'vote',
        owner: voterDID,
        data: voteData,
        timestamp: Date.now(),
        signature: proof.signature,
      };

      // Add to sync queue
      this.syncQueue.push(syncData);

      // Immediately sync to Gun
      await this.syncToGun(syncData);

      if (this.config.debug) {
        console.log('[DataSync] Queued vote sync:', voteId);
      }
    } catch (error) {
      console.error('[DataSync] Error syncing vote:', error);
      throw error;
    }
  }

  /**
   * Sync data to Gun.js
   */
  private async syncToGun(syncData: SyncableData): Promise<void> {
    try {
      const gunClient = getGunClient();
      const path = `${syncData.type}s/${syncData.id}`;

      await gunClient.put(path, {
        ...syncData,
        syncedAt: Date.now(),
      });

      if (this.config.debug) {
        console.log('[DataSync] Synced to Gun:', path);
      }
    } catch (error) {
      console.error('[DataSync] Error syncing to Gun:', error);
      throw error;
    }
  }

  /**
   * Process the sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      return;
    }

    try {
      const batch = this.syncQueue.splice(0, 10);  // Process 10 at a time

      for (const item of batch) {
        await this.syncToGun(item);
      }

      if (this.config.debug) {
        console.log('[DataSync] Processed', batch.length, 'items from sync queue');
      }
    } catch (error) {
      console.error('[DataSync] Error processing sync queue:', error);
      // Re-add items to queue on error
      this.syncQueue.unshift(...batch);
    }
  }

  /**
   * Retrieve data from Gun
   */
  async retrieveData(dataType: string, dataId: string): Promise<SyncableData | null> {
    try {
      const gunClient = getGunClient();
      const path = `${dataType}s/${dataType}:${dataId}`;

      const data = await gunClient.get(path);

      if (data) {
        // Verify integrity proof
        const isValid = verifyIntegrityProof(data.data, {
          signature: data.signature,
          did: data.owner,
          timestamp: data.timestamp,
          message: JSON.stringify(data.data),
        });

        if (!isValid) {
          console.warn('[DataSync] Integrity check failed for:', path);
          return null;
        }

        return data as SyncableData;
      }

      return null;
    } catch (error) {
      console.error('[DataSync] Error retrieving data:', error);
      return null;
    }
  }

  /**
   * Subscribe to data changes
   */
  subscribe(dataType: string, callback: (data: any) => void): () => void {
    try {
      const gunClient = getGunClient();
      const path = `${dataType}s`;

      const unsubscribe = gunClient.subscribe(path, (data) => {
        callback(data);
      });

      // Store listener for cleanup
      if (!this.listeners.has(dataType)) {
        this.listeners.set(dataType, new Set());
      }
      this.listeners.get(dataType)!.add(callback);

      return () => {
        unsubscribe();
        const listeners = this.listeners.get(dataType);
        if (listeners) {
          listeners.delete(callback);
        }
      };
    } catch (error) {
      console.error('[DataSync] Error subscribing:', error);
      return () => {};
    }
  }

  /**
   * Get sync queue status
   */
  getSyncStatus(): {
    queueLength: number;
    isAutoSyncing: boolean;
  } {
    return {
      queueLength: this.syncQueue.length,
      isAutoSyncing: this.syncInterval !== null,
    };
  }
}

// Global data sync instance
let globalDataSync: DataSyncManager | null = null;

/**
 * Get the global data sync manager
 */
export function getDataSyncManager(config?: SyncConfig): DataSyncManager {
  if (!globalDataSync) {
    globalDataSync = new DataSyncManager(config);
  }
  return globalDataSync;
}

/**
 * Stop the global data sync
 */
export function stopDataSync(): void {
  if (globalDataSync) {
    globalDataSync.stopAutoSync();
    globalDataSync = null;
  }
}
