import { getGunClient } from './gun-client';
import { getIPFSClient } from './ipfs-client';

/**
 * Peer Discovery and Management
 * 
 * Handles discovery of peers on the network using multiple strategies:
 * - mDNS (Local network discovery)
 * - DHT (Distributed Hash Table for internet-wide discovery)
 * - Manual peer addition
 */

export interface PeerInfo {
  id: string;                     // Peer identifier
  addresses: string[];            // Network addresses
  lastSeen: number;               // Last connection timestamp
  reputation: number;             // Reputation score (0-100)
  type: 'gun' | 'ipfs' | 'both';  // Peer type
}

export interface PeerDiscoveryConfig {
  enableMDNS?: boolean;
  enableDHT?: boolean;
  maxPeers?: number;
  reputationThreshold?: number;
  debug?: boolean;
}

/**
 * Peer Discovery Manager
 */
export class PeerDiscoveryManager {
  private discoveredPeers: Map<string, PeerInfo> = new Map();
  private config: PeerDiscoveryConfig;
  private isDiscovering: boolean = false;
  private discoveryInterval: NodeJS.Timeout | null = null;

  constructor(config: PeerDiscoveryConfig = {}) {
    this.config = {
      enableMDNS: config.enableMDNS !== false,
      enableDHT: config.enableDHT !== false,
      maxPeers: config.maxPeers || 50,
      reputationThreshold: config.reputationThreshold || 20,
      debug: config.debug || false,
    };
  }

  /**
   * Start peer discovery
   */
  async startDiscovery(): Promise<void> {
    if (this.isDiscovering) {
      return;
    }

    this.isDiscovering = true;

    if (this.config.debug) {
      console.log('[PeerDiscovery] Starting peer discovery');
    }

    // Perform initial discovery
    await this.discoverPeers();

    // Set up periodic discovery
    this.discoveryInterval = setInterval(() => {
      this.discoverPeers().catch((error) => {
        console.error('[PeerDiscovery] Discovery error:', error);
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop peer discovery
   */
  stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    this.isDiscovering = false;

    if (this.config.debug) {
      console.log('[PeerDiscovery] Stopped peer discovery');
    }
  }

  /**
   * Discover peers on the network
   */
  private async discoverPeers(): Promise<void> {
    try {
      // Discover Gun peers
      if (this.config.enableDHT) {
        await this.discoverGunPeers();
      }

      // Discover IPFS peers
      if (this.config.enableDHT) {
        await this.discoverIPFSPeers();
      }

      // Discover mDNS peers (local network)
      if (this.config.enableMDNS) {
        await this.discoverMDNSPeers();
      }

      // Clean up low-reputation peers
      this.cleanupPeers();

      if (this.config.debug) {
        console.log(
          '[PeerDiscovery] Discovered',
          this.discoveredPeers.size,
          'peers'
        );
      }
    } catch (error) {
      console.error('[PeerDiscovery] Error discovering peers:', error);
    }
  }

  /**
   * Discover Gun.js peers
   */
  private async discoverGunPeers(): Promise<void> {
    try {
      const gunClient = getGunClient();
      const peers = gunClient.getPeers();

      for (const peerUrl of peers) {
        this.addPeer({
          id: peerUrl,
          addresses: [peerUrl],
          lastSeen: Date.now(),
          reputation: 50,
          type: 'gun',
        });
      }
    } catch (error) {
      console.error('[PeerDiscovery] Error discovering Gun peers:', error);
    }
  }

  /**
   * Discover IPFS peers
   */
  private async discoverIPFSPeers(): Promise<void> {
    try {
      const ipfsClient = getIPFSClient();
      const nodeInfo = await ipfsClient.getNodeInfo();

      if (nodeInfo && nodeInfo.addresses) {
        for (const address of nodeInfo.addresses) {
          this.addPeer({
            id: nodeInfo.id,
            addresses: [address],
            lastSeen: Date.now(),
            reputation: 50,
            type: 'ipfs',
          });
        }
      }
    } catch (error) {
      console.error('[PeerDiscovery] Error discovering IPFS peers:', error);
    }
  }

  /**
   * Discover mDNS peers (local network)
   */
  private async discoverMDNSPeers(): Promise<void> {
    try {
      // In a real implementation, this would use mDNS libraries like:
      // - bonjour (Node.js)
      // - react-native-mdns (React Native)
      
      // For now, we'll skip mDNS discovery in this implementation
      if (this.config.debug) {
        console.log('[PeerDiscovery] mDNS discovery not yet implemented');
      }
    } catch (error) {
      console.error('[PeerDiscovery] Error discovering mDNS peers:', error);
    }
  }

  /**
   * Manually add a peer
   */
  addPeer(peerInfo: PeerInfo): void {
    if (this.discoveredPeers.size >= this.config.maxPeers!) {
      // Remove lowest reputation peer
      let lowestRepPeer: [string, PeerInfo] | null = null;

      for (const [id, peer] of this.discoveredPeers) {
        if (!lowestRepPeer || peer.reputation < lowestRepPeer[1].reputation) {
          lowestRepPeer = [id, peer];
        }
      }

      if (lowestRepPeer) {
        this.discoveredPeers.delete(lowestRepPeer[0]);
      }
    }

    this.discoveredPeers.set(peerInfo.id, peerInfo);

    if (this.config.debug) {
      console.log('[PeerDiscovery] Added peer:', peerInfo.id);
    }

    // Connect to the peer
    this.connectToPeer(peerInfo);
  }

  /**
   * Connect to a peer
   */
  private connectToPeer(peerInfo: PeerInfo): void {
    try {
      if (peerInfo.type === 'gun' || peerInfo.type === 'both') {
        const gunClient = getGunClient();
        for (const address of peerInfo.addresses) {
          gunClient.addPeer(address);
        }
      }

      if (peerInfo.type === 'ipfs' || peerInfo.type === 'both') {
        // IPFS connections are handled automatically
      }

      if (this.config.debug) {
        console.log('[PeerDiscovery] Connected to peer:', peerInfo.id);
      }
    } catch (error) {
      console.error('[PeerDiscovery] Error connecting to peer:', error);
    }
  }

  /**
   * Update peer reputation
   */
  updatePeerReputation(peerId: string, delta: number): void {
    const peer = this.discoveredPeers.get(peerId);

    if (peer) {
      peer.reputation = Math.max(0, Math.min(100, peer.reputation + delta));
      peer.lastSeen = Date.now();

      if (this.config.debug) {
        console.log(
          '[PeerDiscovery] Updated peer reputation:',
          peerId,
          'reputation:',
          peer.reputation
        );
      }
    }
  }

  /**
   * Get all discovered peers
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.discoveredPeers.values());
  }

  /**
   * Get peers above reputation threshold
   */
  getTrustedPeers(): PeerInfo[] {
    return Array.from(this.discoveredPeers.values()).filter(
      (peer) => peer.reputation >= this.config.reputationThreshold!
    );
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): PeerInfo | null {
    return this.discoveredPeers.get(peerId) || null;
  }

  /**
   * Remove a peer
   */
  removePeer(peerId: string): void {
    this.discoveredPeers.delete(peerId);

    if (this.config.debug) {
      console.log('[PeerDiscovery] Removed peer:', peerId);
    }
  }

  /**
   * Clean up low-reputation or stale peers
   */
  private cleanupPeers(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [peerId, peer] of this.discoveredPeers) {
      // Remove stale peers
      if (now - peer.lastSeen > staleThreshold) {
        this.discoveredPeers.delete(peerId);

        if (this.config.debug) {
          console.log('[PeerDiscovery] Removed stale peer:', peerId);
        }
      }

      // Remove low-reputation peers
      if (peer.reputation < 10) {
        this.discoveredPeers.delete(peerId);

        if (this.config.debug) {
          console.log('[PeerDiscovery] Removed low-reputation peer:', peerId);
        }
      }
    }
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): {
    totalPeers: number;
    trustedPeers: number;
    averageReputation: number;
  } {
    const peers = Array.from(this.discoveredPeers.values());
    const trustedPeers = peers.filter(
      (p) => p.reputation >= this.config.reputationThreshold!
    );
    const avgReputation =
      peers.length > 0
        ? peers.reduce((sum, p) => sum + p.reputation, 0) / peers.length
        : 0;

    return {
      totalPeers: peers.length,
      trustedPeers: trustedPeers.length,
      averageReputation: Math.round(avgReputation),
    };
  }
}

// Global peer discovery instance
let globalPeerDiscovery: PeerDiscoveryManager | null = null;

/**
 * Get the global peer discovery manager
 */
export function getPeerDiscoveryManager(
  config?: PeerDiscoveryConfig
): PeerDiscoveryManager {
  if (!globalPeerDiscovery) {
    globalPeerDiscovery = new PeerDiscoveryManager(config);
  }
  return globalPeerDiscovery;
}

/**
 * Start global peer discovery
 */
export async function startPeerDiscovery(): Promise<void> {
  const manager = getPeerDiscoveryManager();
  await manager.startDiscovery();
}

/**
 * Stop global peer discovery
 */
export function stopPeerDiscovery(): void {
  if (globalPeerDiscovery) {
    globalPeerDiscovery.stopDiscovery();
  }
}
