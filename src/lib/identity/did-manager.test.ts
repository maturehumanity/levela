import {
  generateDID,
  signMessage,
  verifySignature,
  isValidDID,
  extractPublicKeyFromDID,
  createRegistrationClaim,
  verifyRegistrationClaim,
  createAuthToken,
  verifyAuthToken,
  createIntegrityProof,
  verifyIntegrityProof,
} from './did-manager';
import * as crypto from 'crypto';

describe('DID Manager', () => {
  describe('generateDID', () => {
    it('should generate a valid DID', () => {
      const identity = generateDID();

      expect(identity.did).toBeDefined();
      expect(identity.did).toMatch(/^did:key:z6Mk/);
      expect(identity.publicKey).toBeDefined();
      expect(identity.publicKeyMulticodec).toBeDefined();
      expect(identity.createdAt).toBeGreaterThan(0);
      expect(identity.version).toBe(1);
    });

    it('should generate unique DIDs', () => {
      const identity1 = generateDID();
      const identity2 = generateDID();

      expect(identity1.did).not.toBe(identity2.did);
      expect(identity1.publicKey).not.toBe(identity2.publicKey);
    });
  });

  describe('isValidDID', () => {
    it('should validate correct DIDs', () => {
      const identity = generateDID();
      expect(isValidDID(identity.did)).toBe(true);
    });

    it('should reject invalid DIDs', () => {
      expect(isValidDID('invalid-did')).toBe(false);
      expect(isValidDID('did:key:invalid')).toBe(false);
      expect(isValidDID('')).toBe(false);
    });
  });

  describe('extractPublicKeyFromDID', () => {
    it('should extract public key from valid DID', () => {
      const identity = generateDID();
      const extractedKey = extractPublicKeyFromDID(identity.did);

      expect(extractedKey).toBe(identity.publicKey);
    });

    it('should return null for invalid DID', () => {
      expect(extractPublicKeyFromDID('invalid-did')).toBeNull();
    });
  });

  describe('signMessage and verifySignature', () => {
    it('should sign and verify a message', () => {
      const identity = generateDID();
      const message = 'Test message';

      // Generate a key pair for signing
      const { privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { format: 'raw', type: 'spki' },
        privateKeyEncoding: { format: 'raw', type: 'pkcs8' },
      });

      const signature = signMessage(message, privateKey as Uint8Array, identity.did);

      expect(signature.signature).toBeDefined();
      expect(signature.did).toBe(identity.did);
      expect(signature.message).toBe(message);
      expect(signature.timestamp).toBeGreaterThan(0);

      const isValid = verifySignature(
        signature.signature,
        identity.publicKey,
        message
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const identity = generateDID();
      const message = 'Test message';
      const invalidSignature = 'invalid-signature';

      const isValid = verifySignature(
        invalidSignature,
        identity.publicKey,
        message
      );

      expect(isValid).toBe(false);
    });

    it('should reject signatures with wrong message', () => {
      const identity = generateDID();
      const message = 'Test message';

      const { privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { format: 'raw', type: 'spki' },
        privateKeyEncoding: { format: 'raw', type: 'pkcs8' },
      });

      const signature = signMessage(message, privateKey as Uint8Array, identity.did);

      const isValid = verifySignature(
        signature.signature,
        identity.publicKey,
        'Different message'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('createRegistrationClaim and verifyRegistrationClaim', () => {
    it('should create and verify a registration claim', () => {
      const identity = generateDID();
      const username = 'alice';

      const { privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { format: 'raw', type: 'spki' },
        privateKeyEncoding: { format: 'raw', type: 'pkcs8' },
      });

      const claim = createRegistrationClaim(
        identity.did,
        username,
        privateKey as Uint8Array
      );

      expect(claim.did).toBe(identity.did);
      expect(claim.signature).toBeDefined();

      const isValid = verifyRegistrationClaim(claim);
      expect(isValid).toBe(true);
    });

    it('should reject invalid registration claims', () => {
      const claim = {
        signature: 'invalid',
        did: 'invalid-did',
        timestamp: Date.now(),
        message: JSON.stringify({ type: 'registration', did: 'invalid-did', username: 'alice' }),
      };

      const isValid = verifyRegistrationClaim(claim);
      expect(isValid).toBe(false);
    });
  });

  describe('createAuthToken and verifyAuthToken', () => {
    it('should create and verify an auth token', () => {
      const identity = generateDID();

      const { privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { format: 'raw', type: 'spki' },
        privateKeyEncoding: { format: 'raw', type: 'pkcs8' },
      });

      const token = createAuthToken(identity.did, privateKey as Uint8Array);

      expect(token.did).toBe(identity.did);
      expect(token.signature).toBeDefined();

      const isValid = verifyAuthToken(token);
      expect(isValid).toBe(true);
    });

    it('should reject expired auth tokens', () => {
      const identity = generateDID();

      const { privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { format: 'raw', type: 'spki' },
        privateKeyEncoding: { format: 'raw', type: 'pkcs8' },
      });

      const token = createAuthToken(identity.did, privateKey as Uint8Array);

      // Manually set expiration to the past
      const tokenData = JSON.parse(token.message);
      tokenData.expiresAt = Date.now() - 1000;
      token.message = JSON.stringify(tokenData);

      const isValid = verifyAuthToken(token);
      expect(isValid).toBe(false);
    });
  });

  describe('createIntegrityProof and verifyIntegrityProof', () => {
    it('should create and verify an integrity proof', () => {
      const identity = generateDID();
      const data = { name: 'Alice', score: 85 };

      const { privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { format: 'raw', type: 'spki' },
        privateKeyEncoding: { format: 'raw', type: 'pkcs8' },
      });

      const proof = createIntegrityProof(
        data,
        identity.did,
        privateKey as Uint8Array
      );

      expect(proof.did).toBe(identity.did);
      expect(proof.signature).toBeDefined();

      const isValid = verifyIntegrityProof(data, proof);
      expect(isValid).toBe(true);
    });

    it('should reject integrity proofs with tampered data', () => {
      const identity = generateDID();
      const data = { name: 'Alice', score: 85 };

      const { privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { format: 'raw', type: 'spki' },
        privateKeyEncoding: { format: 'raw', type: 'pkcs8' },
      });

      const proof = createIntegrityProof(
        data,
        identity.did,
        privateKey as Uint8Array
      );

      // Tamper with data
      const tamperedData = { name: 'Alice', score: 100 };

      const isValid = verifyIntegrityProof(tamperedData, proof);
      expect(isValid).toBe(false);
    });
  });
});
