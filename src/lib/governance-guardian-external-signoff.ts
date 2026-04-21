import type { GuardianExternalSignerRow } from '@/lib/governance-guardian-multisig';
import {
  hashExternalSignedMessage,
  verifyExternalGuardianSignature,
} from '@/lib/governance-external-signing';

interface PrepareExternalGuardianSignoffArgs {
  signer: GuardianExternalSignerRow;
  payloadHashInput: string;
  signedMessageInput: string;
  signatureInput: string;
}

interface PrepareExternalGuardianSignoffResult {
  verificationMethod: string;
  payloadHash: string | null;
  signedMessage: string | null;
  signature: string | null;
  hasCryptographicPayload: boolean;
}

export async function prepareExternalGuardianSignoffPayload(
  args: PrepareExternalGuardianSignoffArgs,
): Promise<PrepareExternalGuardianSignoffResult> {
  const payloadHash = args.payloadHashInput.trim() || null;
  const signedMessage = args.signedMessageInput.trim();
  const signature = args.signatureInput.trim();
  const hasSignedMessage = signedMessage.length > 0;
  const hasSignature = signature.length > 0;
  const hasCryptographicPayload = hasSignedMessage || hasSignature;

  if (hasSignedMessage !== hasSignature) {
    throw new Error('Signed message and signature must both be provided for cryptographic verification.');
  }

  if (!hasCryptographicPayload) {
    return {
      verificationMethod: 'guardian_multisig_attestation',
      payloadHash,
      signedMessage: null,
      signature: null,
      hasCryptographicPayload: false,
    };
  }

  const verified = await verifyExternalGuardianSignature({
    keyAlgorithm: args.signer.key_algorithm,
    signerPublicKey: args.signer.signer_key,
    signedMessage,
    signature,
  });

  if (!verified) {
    throw new Error('Signature verification failed for the selected external signer key.');
  }

  const computedPayloadHash = await hashExternalSignedMessage(signedMessage);
  if (payloadHash && payloadHash !== computedPayloadHash) {
    throw new Error('Payload hash does not match the signed message digest.');
  }

  return {
    verificationMethod: 'cryptographic_signature_verification',
    payloadHash: payloadHash || computedPayloadHash,
    signedMessage,
    signature,
    hasCryptographicPayload: true,
  };
}
