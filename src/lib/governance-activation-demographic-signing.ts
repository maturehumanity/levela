import {
  hashExternalSignedMessage,
  verifyExternalGuardianSignature,
} from '@/lib/governance-external-signing';

export async function hashActivationDemographicPayload(payload: string) {
  return hashExternalSignedMessage(payload);
}

export async function verifyActivationDemographicPayloadSignature(args: {
  keyAlgorithm: string;
  signerPublicKey: string;
  signedPayload: string;
  signature: string;
}) {
  return verifyExternalGuardianSignature({
    keyAlgorithm: args.keyAlgorithm,
    signerPublicKey: args.signerPublicKey,
    signedMessage: args.signedPayload,
    signature: args.signature,
  });
}
