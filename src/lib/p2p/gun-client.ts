import Gun from 'gun';
import 'gun/sea';
import 'gun/axe';

/**
 * Gun.js Client for P2P Data Synchronization
 * 
 * Gun is a decentralized, real-time database that syncs data between peers.
 * This module provides a wrapper around Gun for Levela's data storage needs.
 */

export interface GunConfig {
  peers?: string[];
  localStorage?: boolean;
  radix?: boolean;
  debug?: boolean;
}

export interface GunData {
  [key: string]: any;
}

/**
 * Gun Client Manager
 * 
 * Manages connections to the Gun.js network and provides high-level
 * data access methods.
 */
export class GunClientManager {
  private gun: any;
  private config: GunConfig;
  private isConnected: boolean = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private memoryStore: Map<string, any> = new Map();

  constructor(config: GunConfig = {}) {
    this.config = {
      peers: config.peers || this.getDefaultPeers(),
      localStorage: config.localStorage !== false,
      radix: config.radix !== false,
      debug: config.debug || false,
    };

    this.initializeGun();
  }

  /**
   * Get default peers based on environment
   */
  private getDefaultPeers(): string[] {
    if (process.env.NODE_ENV === 'development') {
      return ['http://localhost:8765/gun'];
    }

    if (process.env.NODE_ENV === 'staging') {
      return ['http://staging-gun.levela.local:8765/gun'];
    }

    // Production: Use DHT-based peer discovery
    return [];
  }

  /**
   * Initialize Gun.js instance
   */
  private initializeGun(): void {
    try {
      this.gun = Gun({
        peers: this.config.peers,
        localStorage: this.config.localStorage,
        radix: this.config.radix,
        debug: this.config.debug,
      });

      this.gun.on('create', (msg: any) => {
        this.isConnected = true;
        if (this.config.debug) {
          console.log('[Gun] Connected to network');
        }
      });

      this.gun.on('in', (msg: any) => {
        if (this.config.debug) {
          console.log('[Gun] Received message:', msg);
        }
      });

      this.gun.on('out', (msg: any) => {
        if (this.config.debug) {
          console.log('[Gun] Sent message:', msg);
        }
      });
    } catch (error) {
      console.error('Failed to initialize Gun.js:', error);
      this.gun = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if connected to the network
   */
  isNetworkConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Add a peer to the network
   */
  addPeer(peerUrl: string): void {
    if (this.gun && this.gun.opt && this.gun.opt.peers) {
      this.gun.opt.peers[peerUrl] = 1;
      if (this.config.debug) {
        console.log(`[Gun] Added peer: ${peerUrl}`);
      }
    }
  }

  /**
   * Get all connected peers
   */
  getPeers(): string[] {
    if (this.gun && this.gun.opt && this.gun.opt.peers) {
      return Object.keys(this.gun.opt.peers);
    }
    return [];
  }

  /**
   * Store data in Gun
   * 
   * @param path - Path in the Gun database (e.g., 'users/alice')
   * @param data - Data to store
   */
  async put(path: string, data: GunData): Promise<void> {
    if (!this.gun) {
      this.memoryStore.set(path, data);
      this.listeners.get(path)?.forEach((callback) => callback(data));
      return;
    }
    return new Promise((resolve, reject) => {
      try {
        const pathParts = path.split('/');
        let reference = this.gun;

        for (const part of pathParts) {
          reference = reference.get(part);
        }

        reference.put(data, (ack: any) => {
          if (ack.err) {
            reject(new Error(`Failed to put data: ${ack.err}`));
          } else {
            if (this.config.debug) {
              console.log(`[Gun] Put data at path: ${path}`);
            }
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Retrieve data from Gun
   * 
   * @param path - Path in the Gun database
   * @returns Data at the path
   */
  async get(path: string): Promise<GunData | null> {
    if (!this.gun) {
      return this.memoryStore.get(path) ?? null;
    }
    return new Promise((resolve, reject) => {
      try {
        const pathParts = path.split('/');
        let reference = this.gun;

        for (const part of pathParts) {
          reference = reference.get(part);
        }

        reference.once((data: any) => {
          if (data && data._ === undefined) {
            if (this.config.debug) {
              console.log(`[Gun] Got data from path: ${path}`, data);
            }
            resolve(data);
          } else {
            resolve(null);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Subscribe to real-time updates at a path
   * 
   * @param path - Path in the Gun database
   * @param callback - Function to call when data changes
   * @returns Unsubscribe function
   */
  subscribe(path: string, callback: (data: any) => void): () => void {
    if (!this.gun) {
      if (!this.listeners.has(path)) {
        this.listeners.set(path, new Set());
      }
      this.listeners.get(path)!.add(callback);
      return () => this.listeners.get(path)?.delete(callback);
    }
    try {
      const pathParts = path.split('/');
      let reference = this.gun;

      for (const part of pathParts) {
        reference = reference.get(part);
      }

      reference.on((data: any) => {
        if (data && data._ === undefined) {
          callback(data);
        }
      });

      // Store listener for cleanup
      if (!this.listeners.has(path)) {
        this.listeners.set(path, new Set());
      }
      this.listeners.get(path)!.add(callback);

      // Return unsubscribe function
      return () => {
        const listeners = this.listeners.get(path);
        if (listeners) {
          listeners.delete(callback);
        }
      };
    } catch (error) {
      console.error('Failed to subscribe:', error);
      return () => {};
    }
  }

  /**
   * Delete data from Gun
   * 
   * @param path - Path in the Gun database
   */
  async delete(path: string): Promise<void> {
    if (!this.gun) {
      this.memoryStore.delete(path);
      return;
    }
    return new Promise((resolve, reject) => {
      try {
        const pathParts = path.split('/');
        let reference = this.gun;

        for (const part of pathParts) {
          reference = reference.get(part);
        }

        reference.put(null, (ack: any) => {
          if (ack.err) {
            reject(new Error(`Failed to delete data: ${ack.err}`));
          } else {
            if (this.config.debug) {
              console.log(`[Gun] Deleted data at path: ${path}`);
            }
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * List all keys at a path
   * 
   * @param path - Path in the Gun database
   * @returns Array of keys
   */
  async keys(path: string): Promise<string[]> {
    if (!this.gun) {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      return Array.from(this.memoryStore.keys())
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length).split('/')[0])
        .filter((key, index, all) => key && all.indexOf(key) === index);
    }
    return new Promise((resolve, reject) => {
      try {
        const pathParts = path.split('/');
        let reference = this.gun;

        for (const part of pathParts) {
          reference = reference.get(part);
        }

        const keys: string[] = [];
        reference.map().on((data: any, key: string) => {
          if (key && data && data._ === undefined) {
            keys.push(key);
          }
        });

        // Wait a bit for all keys to be collected
        setTimeout(() => {
          resolve(keys);
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Search for data matching a condition
   * 
   * @param path - Path to search in
   * @param predicate - Function to test each item
   * @returns Array of matching items
   */
  async search(
    path: string,
    predicate: (item: any, key: string) => boolean
  ): Promise<Array<{ key: string; data: any }>> {
    if (!this.gun) {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      return Array.from(this.memoryStore.entries())
        .filter(([key, data]) => key.startsWith(prefix) && predicate(data, key.slice(prefix.length)))
        .map(([key, data]) => ({ key: key.slice(prefix.length), data }));
    }
    return new Promise((resolve, reject) => {
      try {
        const pathParts = path.split('/');
        let reference = this.gun;

        for (const part of pathParts) {
          reference = reference.get(part);
        }

        const results: Array<{ key: string; data: any }> = [];
        reference.map().on((data: any, key: string) => {
          if (key && data && data._ === undefined && predicate(data, key)) {
            results.push({ key, data });
          }
        });

        // Wait for search to complete
        setTimeout(() => {
          resolve(results);
        }, 500);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get statistics about the Gun network
   */
  getNetworkStats(): {
    peers: number;
    connected: boolean;
    uptime: number;
  } {
    return {
      peers: this.getPeers().length,
      connected: this.isConnected,
      uptime: Date.now(),
    };
  }

  /**
   * Close the Gun connection
   */
  close(): void {
    if (this.gun) {
      this.gun.off();
    }
    this.isConnected = false;
    this.listeners.clear();
    if (this.config.debug) {
      console.log('[Gun] Closed connection');
    }
  }
}

// Global Gun client instance
let globalGunClient: GunClientManager | null = null;

/**
 * Get the global Gun client instance
 */
export function getGunClient(config?: GunConfig): GunClientManager {
  if (!globalGunClient) {
    globalGunClient = new GunClientManager(config);
  }
  return globalGunClient;
}

/**
 * Close the global Gun client
 */
export function closeGunClient(): void {
  if (globalGunClient) {
    globalGunClient.close();
    globalGunClient = null;
  }
}
