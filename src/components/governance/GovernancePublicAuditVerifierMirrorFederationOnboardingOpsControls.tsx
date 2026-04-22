import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorFederationOnboardingOpsControlsProps {
  federationOperationsSummary: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null;
  federationOnboardingBoard: GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow[];
  registeringFederationOperator: boolean;
  submittingOnboardingRequest: boolean;
  reviewingOnboardingRequest: boolean;
  onboardingFederationRequest: boolean;
  savingFederationOpsRequirement: boolean;
  registerFederationOperator: (draft: {
    operatorKey: string;
    operatorLabel: string;
    contactEndpoint: string;
    jurisdictionCountryCode: string;
    trustDomain: string;
  }) => Promise<void> | void;
  submitFederationOnboardingRequest: (draft: {
    operatorKey: string;
    requestedMirrorKey: string;
    requestedMirrorLabel: string;
    requestedEndpointUrl: string;
    requestedMirrorType: string;
    requestedRegionCode: string;
    requestedJurisdictionCountryCode: string;
    requestedTrustDomain: string;
  }) => Promise<void> | void;
  reviewFederationOnboardingRequest: (draft: {
    requestId: string;
    reviewDecision: 'approve' | 'reject';
    reviewNotes: string;
  }) => Promise<void> | void;
  onboardFederationRequest: (draft: {
    requestId: string;
    activateMirror: boolean;
  }) => Promise<void> | void;
  saveFederationOpsRequirement: (draft: {
    requireFederationOpsReadiness: boolean;
    maxOpenCriticalAlerts: string;
    minOnboardedOperators: string;
  }) => Promise<void> | void;
}

export function GovernancePublicAuditVerifierMirrorFederationOnboardingOpsControls({
  federationOperationsSummary,
  federationOnboardingBoard,
  registeringFederationOperator,
  submittingOnboardingRequest,
  reviewingOnboardingRequest,
  onboardingFederationRequest,
  savingFederationOpsRequirement,
  registerFederationOperator,
  submitFederationOnboardingRequest,
  reviewFederationOnboardingRequest,
  onboardFederationRequest,
  saveFederationOpsRequirement,
}: GovernancePublicAuditVerifierMirrorFederationOnboardingOpsControlsProps) {
  const [operatorDraft, setOperatorDraft] = useState({
    operatorKey: '',
    operatorLabel: '',
    contactEndpoint: '',
    jurisdictionCountryCode: '',
    trustDomain: 'public',
  });
  const [onboardingRequestDraft, setOnboardingRequestDraft] = useState({
    operatorKey: '',
    requestedMirrorKey: '',
    requestedMirrorLabel: '',
    requestedEndpointUrl: '',
    requestedMirrorType: 'https_gateway',
    requestedRegionCode: 'GLOBAL',
    requestedJurisdictionCountryCode: '',
    requestedTrustDomain: 'public',
  });
  const [reviewDraft, setReviewDraft] = useState({
    requestId: '',
    reviewDecision: 'approve' as 'approve' | 'reject',
    reviewNotes: '',
  });
  const [onboardDraft, setOnboardDraft] = useState({
    requestId: '',
    activateMirror: true,
  });
  const [opsRequirementDraft, setOpsRequirementDraft] = useState({
    requireFederationOpsReadiness: false,
    maxOpenCriticalAlerts: '0',
    minOnboardedOperators: '1',
  });

  const reviewableRequests = useMemo(
    () => federationOnboardingBoard.filter((request) => request.requestStatus === 'pending'),
    [federationOnboardingBoard],
  );
  const onboardableRequests = useMemo(
    () => federationOnboardingBoard.filter((request) => request.requestStatus === 'approved'),
    [federationOnboardingBoard],
  );

  useEffect(() => {
    if (!federationOperationsSummary) return;
    setOpsRequirementDraft({
      requireFederationOpsReadiness: federationOperationsSummary.requireFederationOpsReadiness,
      maxOpenCriticalAlerts: String(federationOperationsSummary.maxOpenCriticalFederationAlerts),
      minOnboardedOperators: String(federationOperationsSummary.minOnboardedFederationOperators),
    });
  }, [federationOperationsSummary]);

  return (
    <>
      <Label className="pt-1 text-xs">Register federation operator</Label>
      <Input value={operatorDraft.operatorKey} onChange={(event) => setOperatorDraft((current) => ({ ...current, operatorKey: event.target.value }))} placeholder="Operator key" />
      <Input value={operatorDraft.operatorLabel} onChange={(event) => setOperatorDraft((current) => ({ ...current, operatorLabel: event.target.value }))} placeholder="Operator label" />
      <Input value={operatorDraft.contactEndpoint} onChange={(event) => setOperatorDraft((current) => ({ ...current, contactEndpoint: event.target.value }))} placeholder="Contact endpoint (optional)" />
      <Input value={operatorDraft.jurisdictionCountryCode} onChange={(event) => setOperatorDraft((current) => ({ ...current, jurisdictionCountryCode: event.target.value.toUpperCase() }))} placeholder="Jurisdiction country code (optional)" maxLength={2} />
      <Input value={operatorDraft.trustDomain} onChange={(event) => setOperatorDraft((current) => ({ ...current, trustDomain: event.target.value }))} placeholder="Trust domain" />
      <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={registeringFederationOperator || !operatorDraft.operatorKey.trim()} onClick={() => void registerFederationOperator(operatorDraft)}>
        {registeringFederationOperator ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save federation operator
      </Button>

      <Label className="pt-1 text-xs">Submit onboarding request</Label>
      <Input value={onboardingRequestDraft.operatorKey} onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, operatorKey: event.target.value }))} placeholder="Operator key" />
      <Input value={onboardingRequestDraft.requestedMirrorKey} onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedMirrorKey: event.target.value }))} placeholder="Mirror key" />
      <Input value={onboardingRequestDraft.requestedMirrorLabel} onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedMirrorLabel: event.target.value }))} placeholder="Mirror label" />
      <Input value={onboardingRequestDraft.requestedEndpointUrl} onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedEndpointUrl: event.target.value }))} placeholder="Mirror endpoint URL" />
      <Input value={onboardingRequestDraft.requestedMirrorType} onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedMirrorType: event.target.value }))} placeholder="Mirror type" />
      <Input value={onboardingRequestDraft.requestedRegionCode} onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedRegionCode: event.target.value.toUpperCase() }))} placeholder="Region code" />
      <Input value={onboardingRequestDraft.requestedJurisdictionCountryCode} onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedJurisdictionCountryCode: event.target.value.toUpperCase() }))} placeholder="Jurisdiction country code (optional)" maxLength={2} />
      <Input value={onboardingRequestDraft.requestedTrustDomain} onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedTrustDomain: event.target.value }))} placeholder="Trust domain" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={submittingOnboardingRequest || !onboardingRequestDraft.operatorKey.trim() || !onboardingRequestDraft.requestedMirrorKey.trim() || !onboardingRequestDraft.requestedEndpointUrl.trim()}
        onClick={() => void submitFederationOnboardingRequest(onboardingRequestDraft)}
      >
        {submittingOnboardingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Submit onboarding request
      </Button>

      <Label className="pt-1 text-xs">Review onboarding request</Label>
      <Select value={reviewDraft.requestId} onValueChange={(value) => setReviewDraft((current) => ({ ...current, requestId: value }))}>
        <SelectTrigger>
          <SelectValue placeholder="Select pending request" />
        </SelectTrigger>
        <SelectContent>
          {reviewableRequests.map((request) => (
            <SelectItem key={request.requestId} value={request.requestId}>
              {request.operatorLabel || request.operatorKey} • {request.requestedMirrorKey}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={reviewDraft.reviewDecision} onValueChange={(value) => setReviewDraft((current) => ({ ...current, reviewDecision: value as typeof current.reviewDecision }))}>
        <SelectTrigger>
          <SelectValue placeholder="Review decision" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="approve">Approve</SelectItem>
          <SelectItem value="reject">Reject</SelectItem>
        </SelectContent>
      </Select>
      <Input value={reviewDraft.reviewNotes} onChange={(event) => setReviewDraft((current) => ({ ...current, reviewNotes: event.target.value }))} placeholder="Review notes (optional)" />
      <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={reviewingOnboardingRequest || !reviewDraft.requestId} onClick={() => void reviewFederationOnboardingRequest(reviewDraft)}>
        {reviewingOnboardingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save onboarding review
      </Button>

      <Label className="pt-1 text-xs">Onboard approved request</Label>
      <Select value={onboardDraft.requestId} onValueChange={(value) => setOnboardDraft((current) => ({ ...current, requestId: value }))}>
        <SelectTrigger>
          <SelectValue placeholder="Select approved request" />
        </SelectTrigger>
        <SelectContent>
          {onboardableRequests.map((request) => (
            <SelectItem key={request.requestId} value={request.requestId}>
              {request.operatorLabel || request.operatorKey} • {request.requestedMirrorKey}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={onboardDraft.activateMirror ? 'yes' : 'no'} onValueChange={(value) => setOnboardDraft((current) => ({ ...current, activateMirror: value === 'yes' }))}>
        <SelectTrigger>
          <SelectValue placeholder="Activate mirror on onboard" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Activate mirror immediately</SelectItem>
          <SelectItem value="no">Leave mirror inactive</SelectItem>
        </SelectContent>
      </Select>
      <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={onboardingFederationRequest || !onboardDraft.requestId} onClick={() => void onboardFederationRequest(onboardDraft)}>
        {onboardingFederationRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Onboard request
      </Button>

      <Label className="pt-1 text-xs">Federation ops requirement</Label>
      <Select value={opsRequirementDraft.requireFederationOpsReadiness ? 'yes' : 'no'} onValueChange={(value) => setOpsRequirementDraft((current) => ({ ...current, requireFederationOpsReadiness: value === 'yes' }))}>
        <SelectTrigger>
          <SelectValue placeholder="Require federation operations readiness" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Require federation ops readiness</SelectItem>
          <SelectItem value="no">Do not require federation ops readiness</SelectItem>
        </SelectContent>
      </Select>
      <Input value={opsRequirementDraft.maxOpenCriticalAlerts} onChange={(event) => setOpsRequirementDraft((current) => ({ ...current, maxOpenCriticalAlerts: event.target.value }))} placeholder="Max open critical alerts" />
      <Input value={opsRequirementDraft.minOnboardedOperators} onChange={(event) => setOpsRequirementDraft((current) => ({ ...current, minOnboardedOperators: event.target.value }))} placeholder="Min onboarded operators" />
      <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={savingFederationOpsRequirement} onClick={() => void saveFederationOpsRequirement(opsRequirementDraft)}>
        {savingFederationOpsRequirement ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save federation ops requirement
      </Button>
    </>
  );
}
