import { createHash } from 'crypto';

/**
 * Protocol Versioning System
 * 
 * Manages protocol versions, feature flags, and code upgrades.
 * Each version is immutable and identified by a content hash.
 */

export interface ProtocolFeature {
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  rolloutPercentage: number;  // 0-100, for gradual rollout
  dependencies: string[];     // Feature names this depends on
}

export interface ProtocolVersion {
  version: string;            // Semantic version (e.g., "1.0.0")
  name: string;               // Human-readable name
  description: string;
  releaseNotes: string;
  contentHash: string;        // SHA256 of the entire version
  features: ProtocolFeature[];
  timestamp: number;
  previousVersion: string | null;
  approvalThreshold: number;  // % of votes needed to activate
  timelockDuration: number;   // Seconds before activation
  status: 'draft' | 'proposed' | 'approved' | 'active' | 'deprecated';
}

export interface ProtocolUpgradeProposal {
  id: string;
  version: ProtocolVersion;
  proposer: string;           // Proposer's DID
  votes: Map<string, 'yes' | 'no' | 'abstain'>;
  createdAt: number;
  votingEndsAt: number;
  approvedAt: number | null;
  activationTime: number | null;
  status: 'voting' | 'approved' | 'rejected' | 'activated' | 'failed';
}

/**
 * Protocol Manager
 * 
 * Manages protocol versions, feature flags, and upgrade proposals.
 */
export class ProtocolManager {
  private versions: Map<string, ProtocolVersion> = new Map();
  private activeVersion: ProtocolVersion | null = null;
  private proposals: Map<string, ProtocolUpgradeProposal> = new Map();
  private featureFlags: Map<string, ProtocolFeature> = new Map();
  private listeners: Set<(event: ProtocolEvent) => void> = new Set();

  constructor() {
    // Initialize with default version
    this.initializeDefaultVersion();
  }

  /**
   * Initialize with default protocol version
   */
  private initializeDefaultVersion(): void {
    const defaultVersion: ProtocolVersion = {
      version: '1.0.0',
      name: 'Levela Genesis',
      description: 'Initial protocol version with core governance features',
      releaseNotes: 'Initial release with identity, proposals, and voting',
      contentHash: this.computeContentHash({
        version: '1.0.0',
        features: [],
      }),
      features: [
        {
          name: 'identity-verification',
          description: 'Self-sovereign identity and verification',
          version: '1.0.0',
          enabled: true,
          rolloutPercentage: 100,
          dependencies: [],
        },
        {
          name: 'governance-proposals',
          description: 'Create and vote on governance proposals',
          version: '1.0.0',
          enabled: true,
          rolloutPercentage: 100,
          dependencies: ['identity-verification'],
        },
        {
          name: 'evidence-management',
          description: 'Upload and manage evidence for verification',
          version: '1.0.0',
          enabled: true,
          rolloutPercentage: 100,
          dependencies: ['identity-verification'],
        },
        {
          name: 'endorsements',
          description: 'Endorse other users in various pillars',
          version: '1.0.0',
          enabled: true,
          rolloutPercentage: 100,
          dependencies: ['identity-verification'],
        },
      ],
      timestamp: Date.now(),
      previousVersion: null,
      approvalThreshold: 66,
      timelockDuration: 7 * 24 * 60 * 60,  // 7 days
      status: 'active',
    };

    this.versions.set(defaultVersion.version, defaultVersion);
    this.activeVersion = defaultVersion;

    // Initialize feature flags
    for (const feature of defaultVersion.features) {
      this.featureFlags.set(feature.name, feature);
    }
  }

  /**
   * Compute content hash for a version
   */
  private computeContentHash(content: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(content));
    return hash.digest('hex');
  }

  /**
   * Create a new protocol version
   */
  createVersion(
    version: string,
    name: string,
    description: string,
    releaseNotes: string,
    features: ProtocolFeature[]
  ): ProtocolVersion {
    if (this.versions.has(version)) {
      throw new Error(`Version ${version} already exists`);
    }

    const newVersion: ProtocolVersion = {
      version,
      name,
      description,
      releaseNotes,
      contentHash: this.computeContentHash({ version, features }),
      features,
      timestamp: Date.now(),
      previousVersion: this.activeVersion?.version || null,
      approvalThreshold: 66,
      timelockDuration: 7 * 24 * 60 * 60,
      status: 'draft',
    };

    this.versions.set(version, newVersion);
    this.emit({
      type: 'version-created',
      version: newVersion,
    });

    return newVersion;
  }

  /**
   * Propose a version upgrade
   */
  proposeUpgrade(
    version: ProtocolVersion,
    proposer: string,
    votingDuration: number = 7 * 24 * 60 * 60  // 7 days
  ): ProtocolUpgradeProposal {
    const proposal: ProtocolUpgradeProposal = {
      id: `proposal-${Date.now()}`,
      version,
      proposer,
      votes: new Map(),
      createdAt: Date.now(),
      votingEndsAt: Date.now() + votingDuration,
      approvedAt: null,
      activationTime: null,
      status: 'voting',
    };

    this.proposals.set(proposal.id, proposal);

    // Update version status
    version.status = 'proposed';

    this.emit({
      type: 'upgrade-proposed',
      proposal,
    });

    return proposal;
  }

  /**
   * Cast a vote on an upgrade proposal
   */
  castVote(
    proposalId: string,
    voter: string,
    choice: 'yes' | 'no' | 'abstain'
  ): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (Date.now() > proposal.votingEndsAt) {
      throw new Error('Voting period has ended');
    }

    proposal.votes.set(voter, choice);

    this.emit({
      type: 'vote-cast',
      proposal,
      voter,
      choice,
    });
  }

  /**
   * Finalize voting on a proposal
   */
  finalizeVoting(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (Date.now() <= proposal.votingEndsAt) {
      throw new Error('Voting period has not ended yet');
    }

    // Calculate vote results
    let yesVotes = 0;
    let noVotes = 0;
    let totalVotes = 0;

    for (const vote of proposal.votes.values()) {
      if (vote !== 'abstain') {
        totalVotes++;
        if (vote === 'yes') {
          yesVotes++;
        } else {
          noVotes++;
        }
      }
    }

    const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;

    if (yesPercentage >= proposal.version.approvalThreshold) {
      // Approved
      proposal.status = 'approved';
      proposal.approvedAt = Date.now();
      proposal.activationTime = Date.now() + proposal.version.timelockDuration;
      proposal.version.status = 'approved';

      this.emit({
        type: 'upgrade-approved',
        proposal,
      });
    } else {
      // Rejected
      proposal.status = 'rejected';
      proposal.version.status = 'draft';

      this.emit({
        type: 'upgrade-rejected',
        proposal,
      });
    }
  }

  /**
   * Activate an approved upgrade
   */
  activateUpgrade(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'approved') {
      throw new Error('Proposal has not been approved');
    }

    if (Date.now() < proposal.activationTime!) {
      throw new Error(
        `Upgrade cannot be activated until ${new Date(proposal.activationTime!).toISOString()}`
      );
    }

    // Deprecate old version
    if (this.activeVersion) {
      this.activeVersion.status = 'deprecated';
    }

    // Activate new version
    this.activeVersion = proposal.version;
    proposal.version.status = 'active';
    proposal.status = 'activated';

    // Update feature flags
    for (const feature of proposal.version.features) {
      this.featureFlags.set(feature.name, feature);
    }

    this.emit({
      type: 'upgrade-activated',
      proposal,
    });
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureName: string, userDID?: string): boolean {
    const feature = this.featureFlags.get(featureName);
    if (!feature) {
      return false;
    }

    if (!feature.enabled) {
      return false;
    }

    // Check rollout percentage
    if (feature.rolloutPercentage < 100 && userDID) {
      // Use consistent hashing to determine if user gets the feature
      const hash = this.hashUserForFeature(userDID, featureName);
      return hash < feature.rolloutPercentage;
    }

    return true;
  }

  /**
   * Get rollout percentage for a feature
   */
  getFeatureRolloutPercentage(featureName: string): number {
    const feature = this.featureFlags.get(featureName);
    return feature?.rolloutPercentage || 0;
  }

  /**
   * Update feature rollout percentage
   */
  updateFeatureRollout(featureName: string, percentage: number): void {
    const feature = this.featureFlags.get(featureName);
    if (!feature) {
      throw new Error(`Feature ${featureName} not found`);
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    feature.rolloutPercentage = percentage;

    this.emit({
      type: 'feature-rollout-updated',
      feature,
      percentage,
    });
  }

  /**
   * Hash user for consistent feature rollout
   */
  private hashUserForFeature(userDID: string, featureName: string): number {
    const hash = createHash('sha256');
    hash.update(`${userDID}:${featureName}`);
    const digest = hash.digest();
    return (digest[0] + digest[1] + digest[2]) % 100;
  }

  /**
   * Get active version
   */
  getActiveVersion(): ProtocolVersion | null {
    return this.activeVersion;
  }

  /**
   * Get version by version string
   */
  getVersion(version: string): ProtocolVersion | null {
    return this.versions.get(version) || null;
  }

  /**
   * Get all versions
   */
  getAllVersions(): ProtocolVersion[] {
    return Array.from(this.versions.values());
  }

  /**
   * Get all proposals
   */
  getAllProposals(): ProtocolUpgradeProposal[] {
    return Array.from(this.proposals.values());
  }

  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): ProtocolUpgradeProposal | null {
    return this.proposals.get(proposalId) || null;
  }

  /**
   * Get active proposals
   */
  getActiveProposals(): ProtocolUpgradeProposal[] {
    return Array.from(this.proposals.values()).filter(
      (p) => p.status === 'voting'
    );
  }

  /**
   * Get all features
   */
  getAllFeatures(): ProtocolFeature[] {
    return Array.from(this.featureFlags.values());
  }

  /**
   * Get feature by name
   */
  getFeature(featureName: string): ProtocolFeature | null {
    return this.featureFlags.get(featureName) || null;
  }

  /**
   * Subscribe to protocol events
   */
  subscribe(listener: (event: ProtocolEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit protocol event
   */
  private emit(event: ProtocolEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in protocol event listener:', error);
      }
    }
  }

  /**
   * Get protocol statistics
   */
  getStats(): {
    activeVersion: string;
    totalVersions: number;
    totalProposals: number;
    activeProposals: number;
    totalFeatures: number;
    enabledFeatures: number;
  } {
    const enabledFeatures = Array.from(this.featureFlags.values()).filter(
      (f) => f.enabled
    ).length;

    return {
      activeVersion: this.activeVersion?.version || 'none',
      totalVersions: this.versions.size,
      totalProposals: this.proposals.size,
      activeProposals: this.getActiveProposals().length,
      totalFeatures: this.featureFlags.size,
      enabledFeatures,
    };
  }
}

/**
 * Protocol Events
 */
export type ProtocolEvent =
  | {
      type: 'version-created';
      version: ProtocolVersion;
    }
  | {
      type: 'upgrade-proposed';
      proposal: ProtocolUpgradeProposal;
    }
  | {
      type: 'vote-cast';
      proposal: ProtocolUpgradeProposal;
      voter: string;
      choice: 'yes' | 'no' | 'abstain';
    }
  | {
      type: 'upgrade-approved';
      proposal: ProtocolUpgradeProposal;
    }
  | {
      type: 'upgrade-rejected';
      proposal: ProtocolUpgradeProposal;
    }
  | {
      type: 'upgrade-activated';
      proposal: ProtocolUpgradeProposal;
    }
  | {
      type: 'feature-rollout-updated';
      feature: ProtocolFeature;
      percentage: number;
    };

// Global protocol manager instance
let globalProtocolManager: ProtocolManager | null = null;

/**
 * Get the global protocol manager
 */
export function getProtocolManager(): ProtocolManager {
  if (!globalProtocolManager) {
    globalProtocolManager = new ProtocolManager();
  }
  return globalProtocolManager;
}
