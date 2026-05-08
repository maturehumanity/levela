import * as crypto from 'crypto';

/**
 * Secure Key Storage
 * 
 * Manages storage of private keys in the device's Secure Enclave (iOS) / Keystore (Android).
 * In a real implementation, this would use platform-specific APIs.
 * For development, we use encrypted local storage.
 */

export interface KeyStorageProvider {
  /**
   * Store a key securely
   */
  storeKey(keyId: string, key: Uint8Array, metadata?: Record<string, any>): Promise<void>;

  /**
   * Retrieve a key from secure storage
   */
  retrieveKey(keyId: string): Promise<Uint8Array | null>;

  /**
   * Delete a key from secure storage
   */
  deleteKey(keyId: string): Promise<void>;

  /**
   * Check if a key exists
   */
  keyExists(keyId: string): Promise<boolean>;

  /**
   * List all stored keys
   */
  listKeys(): Promise<string[]>;

  /**
   * Require biometric authentication before accessing key
   */
  requireBiometric(keyId: string): Promise<void>;
}

/**
 * Development Key Storage Provider
 * 
 * Uses encrypted local storage for development.
 * In production, replace with platform-specific implementations.
 */
export class DevKeyStorageProvider implements KeyStorageProvider {
  private encryptionKey: string;
  private storagePrefix = 'levela_key_';

  constructor(masterPassword: string) {
    // In production, this would be derived from device-specific values
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(masterPassword)
      .digest('hex');
  }

  async storeKey(
    keyId: string,
    key: Uint8Array,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(this.encryptionKey, 'hex'),
        iv
      );

      let encrypted = cipher.update(key);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const storageData = {
        iv: iv.toString('hex'),
        encrypted: encrypted.toString('hex'),
        metadata: metadata || {},
        createdAt: Date.now(),
      };

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          this.storagePrefix + keyId,
          JSON.stringify(storageData)
        );
      }
    } catch (error) {
      console.error('Failed to store key:', error);
      throw error;
    }
  }

  async retrieveKey(keyId: string): Promise<Uint8Array | null> {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }

      const storageData = localStorage.getItem(this.storagePrefix + keyId);
      if (!storageData) {
        return null;
      }

      const { iv, encrypted } = JSON.parse(storageData);

      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(this.encryptionKey, 'hex'),
        Buffer.from(iv, 'hex')
      );

      let decrypted = decipher.update(Buffer.from(encrypted, 'hex'));
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return new Uint8Array(decrypted);
    } catch (error) {
      console.error('Failed to retrieve key:', error);
      return null;
    }
  }

  async deleteKey(keyId: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.storagePrefix + keyId);
      }
    } catch (error) {
      console.error('Failed to delete key:', error);
      throw error;
    }
  }

  async keyExists(keyId: string): Promise<boolean> {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }

      return localStorage.getItem(this.storagePrefix + keyId) !== null;
    } catch (error) {
      console.error('Failed to check key existence:', error);
      return false;
    }
  }

  async listKeys(): Promise<string[]> {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }

      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          keys.push(key.substring(this.storagePrefix.length));
        }
      }
      return keys;
    } catch (error) {
      console.error('Failed to list keys:', error);
      return [];
    }
  }

  async requireBiometric(keyId: string): Promise<void> {
    // In development, this is a no-op
    // In production, this would trigger biometric authentication
    console.log(`Biometric authentication required for key: ${keyId}`);
  }
}

/**
 * iOS Secure Enclave Key Storage Provider
 * 
 * Uses native iOS Secure Enclave for key storage.
 * Requires react-native-keychain or similar library.
 */
export class iOSSecureEnclaveProvider implements KeyStorageProvider {
  async storeKey(
    keyId: string,
    key: Uint8Array,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Implementation would use:
    // import * as Keychain from 'react-native-keychain';
    // await Keychain.setGenericPassword(keyId, Buffer.from(key).toString('base64'), {
    //   service: 'com.levela.identity',
    //   accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
    // });
    throw new Error('iOS implementation requires native module');
  }

  async retrieveKey(keyId: string): Promise<Uint8Array | null> {
    // Implementation would use:
    // import * as Keychain from 'react-native-keychain';
    // const credentials = await Keychain.getGenericPassword({ service: 'com.levela.identity' });
    // if (credentials && credentials.username === keyId) {
    //   return new Uint8Array(Buffer.from(credentials.password, 'base64'));
    // }
    throw new Error('iOS implementation requires native module');
  }

  async deleteKey(keyId: string): Promise<void> {
    // Implementation would use:
    // import * as Keychain from 'react-native-keychain';
    // await Keychain.resetGenericPassword({ service: 'com.levela.identity' });
    throw new Error('iOS implementation requires native module');
  }

  async keyExists(keyId: string): Promise<boolean> {
    // Implementation would check Secure Enclave
    throw new Error('iOS implementation requires native module');
  }

  async listKeys(): Promise<string[]> {
    // Implementation would list all keys in Secure Enclave
    throw new Error('iOS implementation requires native module');
  }

  async requireBiometric(keyId: string): Promise<void> {
    // Implementation would trigger Face ID / Touch ID
    throw new Error('iOS implementation requires native module');
  }
}

/**
 * Android Keystore Key Storage Provider
 * 
 * Uses native Android Keystore for key storage.
 * Requires react-native-keychain or similar library.
 */
export class AndroidKeystoreProvider implements KeyStorageProvider {
  async storeKey(
    keyId: string,
    key: Uint8Array,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Implementation would use:
    // import * as Keychain from 'react-native-keychain';
    // await Keychain.setGenericPassword(keyId, Buffer.from(key).toString('base64'), {
    //   service: 'com.levela.identity',
    //   accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
    // });
    throw new Error('Android implementation requires native module');
  }

  async retrieveKey(keyId: string): Promise<Uint8Array | null> {
    // Implementation would use:
    // import * as Keychain from 'react-native-keychain';
    // const credentials = await Keychain.getGenericPassword({ service: 'com.levela.identity' });
    // if (credentials && credentials.username === keyId) {
    //   return new Uint8Array(Buffer.from(credentials.password, 'base64'));
    // }
    throw new Error('Android implementation requires native module');
  }

  async deleteKey(keyId: string): Promise<void> {
    // Implementation would use:
    // import * as Keychain from 'react-native-keychain';
    // await Keychain.resetGenericPassword({ service: 'com.levela.identity' });
    throw new Error('Android implementation requires native module');
  }

  async keyExists(keyId: string): Promise<boolean> {
    // Implementation would check Android Keystore
    throw new Error('Android implementation requires native module');
  }

  async listKeys(): Promise<string[]> {
    // Implementation would list all keys in Keystore
    throw new Error('Android implementation requires native module');
  }

  async requireBiometric(keyId: string): Promise<void> {
    // Implementation would trigger fingerprint authentication
    throw new Error('Android implementation requires native module');
  }
}

/**
 * Get the appropriate key storage provider based on platform
 */
export function getKeyStorageProvider(): KeyStorageProvider {
  // In development, use encrypted local storage
  if (process.env.NODE_ENV === 'development') {
    return new DevKeyStorageProvider(process.env.REACT_APP_MASTER_PASSWORD || 'dev-password');
  }

  // In production, detect platform and use appropriate provider
  if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
    // Running in React Native WebView
    const platform = (window as any).ReactNativeWebView.platform;
    if (platform === 'ios') {
      return new iOSSecureEnclaveProvider();
    } else if (platform === 'android') {
      return new AndroidKeystoreProvider();
    }
  }

  // Fallback to development provider
  return new DevKeyStorageProvider(process.env.REACT_APP_MASTER_PASSWORD || 'dev-password');
}

/**
 * Key Storage Manager
 * 
 * High-level interface for key storage operations.
 */
export class KeyStorageManager {
  private provider: KeyStorageProvider;

  constructor(provider?: KeyStorageProvider) {
    this.provider = provider || getKeyStorageProvider();
  }

  async generateAndStoreKey(keyId: string): Promise<Uint8Array> {
    // Generate a new key
    const key = crypto.randomBytes(32);

    // Store it securely
    await this.provider.storeKey(keyId, key, {
      algorithm: 'Ed25519',
      createdAt: new Date().toISOString(),
    });

    return key;
  }

  async getKey(keyId: string): Promise<Uint8Array | null> {
    return this.provider.retrieveKey(keyId);
  }

  async deleteKey(keyId: string): Promise<void> {
    return this.provider.deleteKey(keyId);
  }

  async hasKey(keyId: string): Promise<boolean> {
    return this.provider.keyExists(keyId);
  }

  async getAllKeys(): Promise<string[]> {
    return this.provider.listKeys();
  }

  async requireBiometric(keyId: string): Promise<void> {
    return this.provider.requireBiometric(keyId);
  }
}

// Global instance
let globalKeyStorageManager: KeyStorageManager | null = null;

export function getKeyStorageManager(): KeyStorageManager {
  if (!globalKeyStorageManager) {
    globalKeyStorageManager = new KeyStorageManager();
  }
  return globalKeyStorageManager;
}
