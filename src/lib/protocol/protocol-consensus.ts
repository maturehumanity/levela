import { getDataSyncManager } from '../p2p/data-sync';
import { getKeyStorageManager } from '../identity/key-storage';

/**
 * Protocol Consensus Mechanism
 * 
 * Implements voting-based consensus for protocol upgrades.
 * Uses weighted voting based on user's Trust & Contribution score.
 */

export interface VoterWeight {
  did: string;
  weight: number;              // Based on Trust & Contribution score
  role: 'citizen' | 'steward' | 'guardian' | 'admin';
  canVote: boolean;
}

export interface ConsensusVote {
  proposalId: string;
  voter: string;
  choice: 'yes' | 'no' | 'abstain';
  weight: number;
  timestamp: number;
  signature: string;            // Signed vote for integrity
}

export interface ConsensusResult {
  proposalId: string;
  totalVoters: number;
  totalWeight: number;
  yesWeight: number;
  noWeight: number;
  abstainWeight: number;
  yesPercentage: number;
  noPercentage: number;
  quorumMet: boolean;
  approved: boolean;
}

/**
 * Consensus Manager
 */
export class ConsensusManager {
  private votes: Map<string, ConsensusVote[]> = new Map();
  private voterWeights: Map<string, VoterWeight> = new Map();
  private quorumPercentage: number = 40;  // 40% of eligible voters
  private approvalThreshold: number = 66;  // 66% of votes

  constructor() {
    this.initializeVoterWeights();
  }

  /**
   * Initialize voter weights from profiles
   */
  private async initializeVoterWeights(): Promise<void> {
    try {
      const dataSync = getDataSyncManager();
      // In a real implementation, this would fetch all user profiles
      // and calculate their weights based on Trust & Contribution scores
    } catch (error) {
      console.error('Error initializing voter weights:', error);
    }
  }

  /**
   * Register a voter with their weight
   */
  registerVoter(voterWeight: VoterWeight): void {
    this.voterWeights.set(voterWeight.did, voterWeight);
  }

  /**
   * Update voter weight based on Trust & Contribution score
   */
  updateVoterWeight(did: string, score: number, role: string): void {
    const weight = this.calculateWeight(score, role);

    this.voterWeights.set(did, {
      did,
      weight,
      role: role as any,
      canVote: weight > 0,
    });
  }

  /**
   * Calculate voting weight based on score and role
   */
  private calculateWeight(score: number, role: string): number {
    let baseWeight = score / 100;  // Normalize to 0-1

    // Apply role multiplier
    const roleMultiplier: { [key: string]: number } = {
      citizen: 1.0,
      steward: 1.5,
      guardian: 2.0,
      admin: 3.0,
    };

    const multiplier = roleMultiplier[role] || 1.0;
    return baseWeight * multiplier;
  }

  /**
   * Cast a weighted vote
   */
  async castVote(
    proposalId: string,
    voter: string,
    choice: 'yes' | 'no' | 'abstain',
    privateKey: Uint8Array
  ): Promise<ConsensusVote> {
    const voterWeight = this.voterWeights.get(voter);
    if (!voterWeight) {
      throw new Error(`Voter ${voter} not registered`);
    }

    if (!voterWeight.canVote) {
      throw new Error(`Voter ${voter} is not eligible to vote`);
    }

    // Check if voter already voted
    const existingVotes = this.votes.get(proposalId) || [];
    if (existingVotes.some((v) => v.voter === voter)) {
      throw new Error(`Voter ${voter} has already voted on this proposal`);
    }

    // Create vote object
    const vote: ConsensusVote = {
      proposalId,
      voter,
      choice,
      weight: voterWeight.weight,
      timestamp: Date.now(),
      signature: await this.signVote(
        { proposalId, voter, choice },
        privateKey
      ),
    };

    // Store vote
    if (!this.votes.has(proposalId)) {
      this.votes.set(proposalId, []);
    }
    this.votes.get(proposalId)!.push(vote);

    // Sync vote to network
    const dataSync = getDataSyncManager();
    await dataSync.syncVote(
      `vote-${proposalId}-${voter}`,
      vote,
      voter,
      privateKey
    );

    return vote;
  }

  /**
   * Sign a vote for integrity
   */
  private async signVote(voteData: any, privateKey: Uint8Array): Promise<string> {
    // In a real implementation, this would use the DID manager to sign
    // For now, we'll return a placeholder
    return Buffer.from(JSON.stringify(voteData)).toString('base64');
  }

  /**
   * Get all votes for a proposal
   */
  getVotes(proposalId: string): ConsensusVote[] {
    return this.votes.get(proposalId) || [];
  }

  /**
   * Calculate consensus result
   */
  calculateConsensus(proposalId: string): ConsensusResult {
    const votes = this.votes.get(proposalId) || [];

    let yesWeight = 0;
    let noWeight = 0;
    let abstainWeight = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      totalWeight += vote.weight;

      switch (vote.choice) {
        case 'yes':
          yesWeight += vote.weight;
          break;
        case 'no':
          noWeight += vote.weight;
          break;
        case 'abstain':
          abstainWeight += vote.weight;
          break;
      }
    }

    // Calculate total eligible weight
    const totalEligibleWeight = Array.from(this.voterWeights.values())
      .filter((v) => v.canVote)
      .reduce((sum, v) => sum + v.weight, 0);

    // Check quorum
    const quorumMet = totalWeight >= totalEligibleWeight * (this.quorumPercentage / 100);

    // Calculate percentages
    const validVoteWeight = yesWeight + noWeight;
    const yesPercentage =
      validVoteWeight > 0 ? (yesWeight / validVoteWeight) * 100 : 0;
    const noPercentage =
      validVoteWeight > 0 ? (noWeight / validVoteWeight) * 100 : 0;

    // Determine if approved
    const approved = quorumMet && yesPercentage >= this.approvalThreshold;

    return {
      proposalId,
      totalVoters: votes.length,
      totalWeight,
      yesWeight,
      noWeight,
      abstainWeight,
      yesPercentage,
      noPercentage,
      quorumMet,
      approved,
    };
  }

  /**
   * Get voter weight
   */
  getVoterWeight(did: string): VoterWeight | null {
    return this.voterWeights.get(did) || null;
  }

  /**
   * Get all voters
   */
  getAllVoters(): VoterWeight[] {
    return Array.from(this.voterWeights.values());
  }

  /**
   * Get eligible voters
   */
  getEligibleVoters(): VoterWeight[] {
    return Array.from(this.voterWeights.values()).filter((v) => v.canVote);
  }

  /**
   * Get total eligible weight
   */
  getTotalEligibleWeight(): number {
    return this.getEligibleVoters().reduce((sum, v) => sum + v.weight, 0);
  }

  /**
   * Set quorum percentage
   */
  setQuorumPercentage(percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Quorum percentage must be between 0 and 100');
    }
    this.quorumPercentage = percentage;
  }

  /**
   * Set approval threshold
   */
  setApprovalThreshold(percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Approval threshold must be between 0 and 100');
    }
    this.approvalThreshold = percentage;
  }

  /**
   * Get consensus statistics
   */
  getStats(): {
    totalVoters: number;
    eligibleVoters: number;
    totalEligibleWeight: number;
    quorumPercentage: number;
    approvalThreshold: number;
  } {
    return {
      totalVoters: this.voterWeights.size,
      eligibleVoters: this.getEligibleVoters().length,
      totalEligibleWeight: this.getTotalEligibleWeight(),
      quorumPercentage: this.quorumPercentage,
      approvalThreshold: this.approvalThreshold,
    };
  }
}

// Global consensus manager instance
let globalConsensusManager: ConsensusManager | null = null;

/**
 * Get the global consensus manager
 */
export function getConsensusManager(): ConsensusManager {
  if (!globalConsensusManager) {
    globalConsensusManager = new ConsensusManager();
  }
  return globalConsensusManager;
}
