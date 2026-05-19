import {
  getProtocolManager,
  ProtocolVersion,
  ProtocolFeature,
} from './protocol-versioning';
import { getConsensusManager } from './protocol-consensus';
import { getProtocolExecutor } from './protocol-executor';

describe('Protocol Governance Tests', () => {
  describe('ProtocolManager', () => {
    it('should initialize with default version', () => {
      const manager = getProtocolManager();
      const activeVersion = manager.getActiveVersion();

      expect(activeVersion).toBeDefined();
      expect(activeVersion?.version).toBe('1.0.0');
      expect(activeVersion?.status).toBe('active');
    });

    it('should create new protocol version', () => {
      const manager = getProtocolManager();

      const features: ProtocolFeature[] = [
        {
          name: 'new-feature',
          description: 'A new feature',
          version: '2.0.0',
          enabled: true,
          rolloutPercentage: 0,
          dependencies: [],
        },
      ];

      const version = manager.createVersion(
        '2.0.0',
        'Levela v2',
        'Second protocol version',
        'Added new features',
        features
      );

      expect(version.version).toBe('2.0.0');
      expect(version.status).toBe('draft');
      expect(version.features).toHaveLength(1);
    });

    it('should propose upgrade', () => {
      const manager = getProtocolManager();

      const features: ProtocolFeature[] = [
        {
          name: 'feature-1',
          description: 'Test feature',
          version: '2.0.0',
          enabled: true,
          rolloutPercentage: 0,
          dependencies: [],
        },
      ];

      const version = manager.createVersion(
        '2.0.0',
        'Test Version',
        'Test',
        'Test',
        features
      );

      const proposal = manager.proposeUpgrade(
        version,
        'did:key:proposer',
        7 * 24 * 60 * 60
      );

      expect(proposal.status).toBe('voting');
      expect(proposal.version.status).toBe('proposed');
    });

    it('should cast votes on proposal', () => {
      const manager = getProtocolManager();

      const features: ProtocolFeature[] = [
        {
          name: 'feature-1',
          description: 'Test feature',
          version: '2.0.0',
          enabled: true,
          rolloutPercentage: 0,
          dependencies: [],
        },
      ];

      const version = manager.createVersion(
        '2.0.0',
        'Test Version',
        'Test',
        'Test',
        features
      );

      const proposal = manager.proposeUpgrade(
        version,
        'did:key:proposer',
        1000  // 1 second voting period for testing
      );

      manager.castVote(proposal.id, 'did:key:voter1', 'yes');
      manager.castVote(proposal.id, 'did:key:voter2', 'yes');
      manager.castVote(proposal.id, 'did:key:voter3', 'no');

      expect(proposal.votes.size).toBe(3);
    });

    it('should finalize voting and approve upgrade', (done) => {
      const manager = getProtocolManager();

      const features: ProtocolFeature[] = [
        {
          name: 'feature-1',
          description: 'Test feature',
          version: '2.0.0',
          enabled: true,
          rolloutPercentage: 0,
          dependencies: [],
        },
      ];

      const version = manager.createVersion(
        '2.0.0',
        'Test Version',
        'Test',
        'Test',
        features
      );

      const proposal = manager.proposeUpgrade(
        version,
        'did:key:proposer',
        100  // 100ms voting period
      );

      manager.castVote(proposal.id, 'did:key:voter1', 'yes');
      manager.castVote(proposal.id, 'did:key:voter2', 'yes');
      manager.castVote(proposal.id, 'did:key:voter3', 'yes');

      setTimeout(() => {
        manager.finalizeVoting(proposal.id);

        expect(proposal.status).toBe('approved');
        expect(proposal.approvedAt).toBeDefined();
        expect(proposal.activationTime).toBeDefined();

        done();
      }, 150);
    });

    it('should check feature enabled status', () => {
      const manager = getProtocolManager();

      const isEnabled = manager.isFeatureEnabled('identity-verification');
      expect(isEnabled).toBe(true);

      const isDisabled = manager.isFeatureEnabled('non-existent-feature');
      expect(isDisabled).toBe(false);
    });

    it('should handle feature rollout percentage', () => {
      const manager = getProtocolManager();

      manager.updateFeatureRollout('identity-verification', 50);
      const percentage = manager.getFeatureRolloutPercentage('identity-verification');

      expect(percentage).toBe(50);
    });

    it('should get protocol statistics', () => {
      const manager = getProtocolManager();

      const stats = manager.getStats();

      expect(stats).toHaveProperty('activeVersion');
      expect(stats).toHaveProperty('totalVersions');
      expect(stats).toHaveProperty('totalProposals');
      expect(stats).toHaveProperty('totalFeatures');
      expect(stats.activeVersion).toBe('1.0.0');
    });
  });

  describe('ConsensusManager', () => {
    it('should register voters with weights', () => {
      const manager = getConsensusManager();

      manager.registerVoter({
        did: 'did:key:voter1',
        weight: 1.0,
        role: 'citizen',
        canVote: true,
      });

      manager.registerVoter({
        did: 'did:key:voter2',
        weight: 1.5,
        role: 'steward',
        canVote: true,
      });

      const voters = manager.getAllVoters();
      expect(voters).toHaveLength(2);
    });

    it('should calculate consensus result', () => {
      const manager = getConsensusManager();

      manager.registerVoter({
        did: 'did:key:voter1',
        weight: 1.0,
        role: 'citizen',
        canVote: true,
      });

      manager.registerVoter({
        did: 'did:key:voter2',
        weight: 1.0,
        role: 'citizen',
        canVote: true,
      });

      manager.registerVoter({
        did: 'did:key:voter3',
        weight: 1.0,
        role: 'citizen',
        canVote: true,
      });

      // Simulate votes (in real implementation, would use castVote)
      const result = manager.calculateConsensus('proposal-1');

      expect(result).toHaveProperty('totalVoters');
      expect(result).toHaveProperty('yesPercentage');
      expect(result).toHaveProperty('approved');
    });

    it('should get eligible voters', () => {
      const manager = getConsensusManager();

      manager.registerVoter({
        did: 'did:key:voter1',
        weight: 1.0,
        role: 'citizen',
        canVote: true,
      });

      manager.registerVoter({
        did: 'did:key:voter2',
        weight: 0,
        role: 'citizen',
        canVote: false,
      });

      const eligible = manager.getEligibleVoters();
      expect(eligible).toHaveLength(1);
    });

    it('should get total eligible weight', () => {
      const manager = getConsensusManager();

      manager.registerVoter({
        did: 'did:key:voter1',
        weight: 1.5,
        role: 'steward',
        canVote: true,
      });

      manager.registerVoter({
        did: 'did:key:voter2',
        weight: 2.0,
        role: 'guardian',
        canVote: true,
      });

      const totalWeight = manager.getTotalEligibleWeight();
      expect(totalWeight).toBe(3.5);
    });

    it('should set quorum and approval thresholds', () => {
      const manager = getConsensusManager();

      manager.setQuorumPercentage(50);
      manager.setApprovalThreshold(75);

      const stats = manager.getStats();
      expect(stats.quorumPercentage).toBe(50);
      expect(stats.approvalThreshold).toBe(75);
    });
  });

  describe('ProtocolExecutor', () => {
    it('should check if upgrade is ready', () => {
      const manager = getProtocolManager();
      const executor = getProtocolExecutor();

      const features: ProtocolFeature[] = [
        {
          name: 'feature-1',
          description: 'Test feature',
          version: '2.0.0',
          enabled: true,
          rolloutPercentage: 0,
          dependencies: [],
        },
      ];

      const version = manager.createVersion(
        '2.0.0',
        'Test Version',
        'Test',
        'Test',
        features
      );

      const proposal = manager.proposeUpgrade(version, 'did:key:proposer', 100);

      const isReady = executor.isUpgradeReady(proposal.id);
      expect(isReady).toBe(false);
    });

    it('should get time until execution', () => {
      const manager = getProtocolManager();
      const executor = getProtocolExecutor();

      const features: ProtocolFeature[] = [
        {
          name: 'feature-1',
          description: 'Test feature',
          version: '2.0.0',
          enabled: true,
          rolloutPercentage: 0,
          dependencies: [],
        },
      ];

      const version = manager.createVersion(
        '2.0.0',
        'Test Version',
        'Test',
        'Test',
        features
      );

      const proposal = manager.proposeUpgrade(version, 'did:key:proposer', 100);

      const timeRemaining = executor.getTimeUntilExecution(proposal.id);
      expect(timeRemaining).toBeGreaterThan(0);
    });

    it('should register rollback handler', () => {
      const executor = getProtocolExecutor();

      const handler = jest.fn(async () => {
        // Rollback logic
      });

      executor.registerRollbackHandler('proposal-1', handler);

      // Handler is registered but not called yet
      expect(handler).not.toHaveBeenCalled();
    });

    it('should get executor statistics', () => {
      const executor = getProtocolExecutor();

      const stats = executor.getStats();

      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('completedExecutions');
      expect(stats).toHaveProperty('failedExecutions');
      expect(stats).toHaveProperty('rolledBackExecutions');
      expect(stats).toHaveProperty('activeUpgrades');
    });
  });
});
