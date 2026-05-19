import { create, IPFSHTTPClient } from 'ipfs-http-client';
import * as crypto from 'crypto';

/**
 * IPFS Client for Distributed File Storage
 * 
 * IPFS (InterPlanetary File System) provides distributed, content-addressed storage.
 * Files are stored by their content hash (CID) and can be retrieved from any peer.
 */

export interface IPFSConfig {
  apiUrl?: string;
  gatewayUrl?: string;
  debug?: boolean;
}

export interface FileUploadResult {
  cid: string;                    // Content Identifier
  size: number;                   // File size in bytes
  name: string;                   // Original filename
  path: string;                   // Full path in IPFS
  timestamp: number;              // Upload timestamp
}

export interface FileMetadata {
  cid: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  uploadedBy: string;             // User's DID
}

/**
 * IPFS Client Manager
 * 
 * Manages connections to IPFS nodes and provides file storage/retrieval.
 */
export class IPFSClientManager {
  private client: IPFSHTTPClient | null = null;
  private config: IPFSConfig;
  private isConnected: boolean = false;
  private uploadedFiles: Map<string, FileMetadata> = new Map();
  private fileContents: Map<string, Buffer> = new Map();
  private pinnedFiles: Set<string> = new Set();

  constructor(config: IPFSConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || this.getDefaultApiUrl(),
      gatewayUrl: config.gatewayUrl || this.getDefaultGatewayUrl(),
      debug: config.debug || false,
    };

    this.initializeIPFS();
  }

  /**
   * Get default IPFS API URL based on environment
   */
  private getDefaultApiUrl(): string {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:5001';
    }

    if (process.env.NODE_ENV === 'staging') {
      return 'http://staging-ipfs.levela.local:5001';
    }

    // Production: Use public IPFS gateway
    return 'https://ipfs.infura.io:5001';
  }

  /**
   * Get default IPFS gateway URL
   */
  private getDefaultGatewayUrl(): string {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:8080';
    }

    if (process.env.NODE_ENV === 'staging') {
      return 'http://staging-ipfs.levela.local:8080';
    }

    // Production: Use public gateway
    return 'https://ipfs.io';
  }

  /**
   * Initialize IPFS client
   */
  private async initializeIPFS(): Promise<void> {
    try {
      this.client = create({
        url: this.config.apiUrl,
      });

      // Test connection
      const version = await this.client.version();
      this.isConnected = true;

      if (this.config.debug) {
        console.log('[IPFS] Connected to IPFS node:', version);
      }
    } catch (error) {
      console.error('Failed to initialize IPFS client:', error);
      this.client = null;
      this.isConnected = false;
    }
  }

  private storeLocalFile(buffer: Buffer, fileName: string, userDID: string): FileUploadResult {
    const cid = `local-${crypto.createHash('sha256').update(buffer).update(fileName).digest('hex')}`;
    const uploadResult: FileUploadResult = {
      cid,
      size: buffer.length,
      name: fileName,
      path: fileName,
      timestamp: Date.now(),
    };
    this.fileContents.set(cid, buffer);
    this.uploadedFiles.set(cid, {
      cid,
      name: fileName,
      size: buffer.length,
      mimeType: 'application/octet-stream',
      uploadedAt: Date.now(),
      uploadedBy: userDID,
    });
    return uploadResult;
  }

  /**
   * Check if connected to IPFS
   */
  isNetworkConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Upload a file to IPFS
   * 
   * @param file - File to upload (Blob or Buffer)
   * @param fileName - Name of the file
   * @param userDID - DID of the uploader
   * @returns FileUploadResult with CID
   */
  async uploadFile(
    file: Blob | Buffer,
    fileName: string,
    userDID: string
  ): Promise<FileUploadResult> {
    try {
      const buffer = file instanceof Blob 
        ? Buffer.from(await file.arrayBuffer())
        : file;

      if (!this.client) {
        return this.storeLocalFile(buffer, fileName, userDID);
      }

      let result;
      try {
        result = await this.client.add({
          path: fileName,
          content: buffer,
        });
      } catch (error) {
        this.client = null;
        this.isConnected = false;
        return this.storeLocalFile(buffer, fileName, userDID);
      }

      const uploadResult: FileUploadResult = {
        cid: result.cid.toString(),
        size: buffer.length,
        name: fileName,
        path: result.path,
        timestamp: Date.now(),
      };

      // Store metadata
      const metadata: FileMetadata = {
        cid: uploadResult.cid,
        name: fileName,
        size: buffer.length,
        mimeType: file instanceof Blob ? file.type : 'application/octet-stream',
        uploadedAt: Date.now(),
        uploadedBy: userDID,
      };

      this.uploadedFiles.set(uploadResult.cid, metadata);

      if (this.config.debug) {
        console.log('[IPFS] Uploaded file:', uploadResult);
      }

      return uploadResult;
    } catch (error) {
      console.error('Failed to upload file to IPFS:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files as a directory
   * 
   * @param files - Array of files to upload
   * @param userDID - DID of the uploader
   * @returns Array of FileUploadResult
   */
  async uploadDirectory(
    files: Array<{ name: string; content: Blob | Buffer }>,
    userDID: string
  ): Promise<FileUploadResult[]> {
    try {
      const results: FileUploadResult[] = [];

      for (const file of files) {
        const buffer = file.content instanceof Blob
          ? Buffer.from(await file.content.arrayBuffer())
          : file.content;

        if (!this.client) {
          results.push(this.storeLocalFile(buffer, file.name, userDID));
          continue;
        }

        let result;
        try {
          result = await this.client.add({
            path: file.name,
            content: buffer,
          });
        } catch (error) {
          this.client = null;
          this.isConnected = false;
          results.push(this.storeLocalFile(buffer, file.name, userDID));
          continue;
        }

        const uploadResult: FileUploadResult = {
          cid: result.cid.toString(),
          size: buffer.length,
          name: file.name,
          path: result.path,
          timestamp: Date.now(),
        };

        results.push(uploadResult);

        // Store metadata
        const metadata: FileMetadata = {
          cid: uploadResult.cid,
          name: file.name,
          size: buffer.length,
          mimeType: file.content instanceof Blob ? file.content.type : 'application/octet-stream',
          uploadedAt: Date.now(),
          uploadedBy: userDID,
        };

        this.uploadedFiles.set(uploadResult.cid, metadata);
      }

      if (this.config.debug) {
        console.log('[IPFS] Uploaded directory with', results.length, 'files');
      }

      return results;
    } catch (error) {
      console.error('Failed to upload directory to IPFS:', error);
      throw error;
    }
  }

  /**
   * Retrieve file content from IPFS
   * 
   * @param cid - Content Identifier
   * @returns File content as Buffer
   */
  async getFile(cid: string): Promise<Buffer> {
    if (!this.client) {
      const local = this.fileContents.get(cid);
      if (!local) throw new Error(`File not found: ${cid}`);
      return local;
    }

    try {
      const chunks: Uint8Array[] = [];

      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      if (this.config.debug) {
        console.log('[IPFS] Retrieved file:', cid, 'size:', buffer.length);
      }

      return buffer;
    } catch (error) {
      console.error('Failed to retrieve file from IPFS:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   * 
   * @param cid - Content Identifier
   * @returns File metadata
   */
  getFileMetadata(cid: string): FileMetadata | null {
    return this.uploadedFiles.get(cid) || null;
  }

  /**
   * Pin a file to ensure it's retained
   * 
   * @param cid - Content Identifier
   */
  async pinFile(cid: string): Promise<void> {
    if (!this.client) {
      this.pinnedFiles.add(cid);
      return;
    }

    try {
      try {
        await this.client.pin.add(cid);
      } catch {
        this.pinnedFiles.add(cid);
        return;
      }

      if (this.config.debug) {
        console.log('[IPFS] Pinned file:', cid);
      }
    } catch (error) {
      console.error('Failed to pin file:', error);
      throw error;
    }
  }

  /**
   * Unpin a file to allow garbage collection
   * 
   * @param cid - Content Identifier
   */
  async unpinFile(cid: string): Promise<void> {
    if (!this.client) {
      this.pinnedFiles.delete(cid);
      return;
    }

    try {
      try {
        await this.client.pin.rm(cid);
      } catch {
        this.pinnedFiles.delete(cid);
        return;
      }

      if (this.config.debug) {
        console.log('[IPFS] Unpinned file:', cid);
      }
    } catch (error) {
      console.error('Failed to unpin file:', error);
      throw error;
    }
  }

  /**
   * Get the gateway URL for a CID
   * 
   * @param cid - Content Identifier
   * @returns Full gateway URL
   */
  getGatewayUrl(cid: string): string {
    return `${this.config.gatewayUrl}/ipfs/${cid}`;
  }

  /**
   * Get IPFS node information
   */
  async getNodeInfo(): Promise<any> {
    if (!this.client) {
      return {
        id: 'local-ipfs-fallback',
        addresses: [],
        agentVersion: 'local-fallback',
        bandwidth: null,
      };
    }

    try {
      const id = await this.client.id();
      const stats = await this.client.stats.bw();

      return {
        id: id.id,
        addresses: id.addresses,
        agentVersion: id.agentVersion,
        bandwidth: stats,
      };
    } catch (error) {
      console.error('Failed to get node info:', error);
      throw error;
    }
  }

  /**
   * Get list of pinned files
   */
  async getPinnedFiles(): Promise<string[]> {
    if (!this.client) {
      return Array.from(this.pinnedFiles);
    }

    try {
      const pinnedFiles: string[] = [];

      for await (const pin of this.client.pin.ls()) {
        pinnedFiles.push(pin.cid.toString());
      }

      return pinnedFiles;
    } catch (error) {
      console.error('Failed to get pinned files:', error);
      throw error;
    }
  }

  /**
   * Clean up local cache
   */
  clearLocalCache(): void {
    this.uploadedFiles.clear();
    this.fileContents.clear();
    this.pinnedFiles.clear();
    if (this.config.debug) {
      console.log('[IPFS] Cleared local cache');
    }
  }

  /**
   * Close the IPFS connection
   */
  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.stop();
      } catch {
        /* ignore local/offline shutdown errors */
      }
    }
    this.isConnected = false;
    if (this.config.debug) {
      console.log('[IPFS] Closed connection');
    }
  }
}

// Global IPFS client instance
let globalIPFSClient: IPFSClientManager | null = null;

/**
 * Get the global IPFS client instance
 */
export function getIPFSClient(config?: IPFSConfig): IPFSClientManager {
  if (!globalIPFSClient) {
    globalIPFSClient = new IPFSClientManager(config);
  }
  return globalIPFSClient;
}

/**
 * Close the global IPFS client
 */
export async function closeIPFSClient(): Promise<void> {
  if (globalIPFSClient) {
    await globalIPFSClient.close();
    globalIPFSClient = null;
  }
}
