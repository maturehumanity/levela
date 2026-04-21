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
  GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  GovernancePublicAuditVerifierMirrorFederationAlertBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorFederationControlsProps {
  canManageMirrorFederation: boolean;
  registeringDiscoverySource: boolean;
  recordingDiscoveryRun: boolean;
  upsertingDiscoveredCandidate: boolean;
  promotingDiscoveredCandidate: boolean;
  savingPolicyRatification: boolean;
  savingFederationOpsRequirement: boolean;
  registeringFederationOperator: boolean;
  submittingOnboardingRequest: boolean;
  reviewingOnboardingRequest: boolean;
  onboardingFederationRequest: boolean;
  recordingFederationWorkerRun: boolean;
  openingFederationAlert: boolean;
  resolvingFederationAlert: boolean;
  discoverySources: GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow[];
  discoveredCandidates: GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow[];
  federationOperationsSummary: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null;
  federationOnboardingBoard: GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow[];
  federationAlertBoard: GovernancePublicAuditVerifierMirrorFederationAlertBoardRow[];
  registerDiscoverySource: (draft: {
    sourceKey: string;
    sourceLabel: string;
    endpointUrl: string;
    discoveryScope: string;
    trustTier: string;
  }) => Promise<void> | void;
  recordDiscoveryRun: (draft: {
    sourceId: string;
    runStatus: 'ok' | 'degraded' | 'failed';
    discoveredCount: string;
    acceptedCandidateCount: string;
    staleCandidateCount: string;
    errorMessage: string;
  }) => Promise<void> | void;
  upsertDiscoveredCandidate: (draft: {
    sourceId: string;
    candidateKey: string;
    candidateLabel: string;
    endpointUrl: string;
    mirrorType: string;
    regionCode: string;
    jurisdictionCountryCode: string;
    operatorLabel: string;
    trustDomain: string;
    discoveryConfidence: string;
    candidateStatus: 'new' | 'reviewed' | 'promoted' | 'rejected' | 'inactive';
  }) => Promise<void> | void;
  promoteDiscoveredCandidate: (candidateId: string) => Promise<void> | void;
  recordPolicyRatification: (draft: {
    policyKey: string;
    signerKey: string;
    ratificationDecision: 'approve' | 'reject';
    ratificationSignature: string;
  }) => Promise<void> | void;
  saveFederationOpsRequirement: (draft: {
    requireFederationOpsReadiness: boolean;
    maxOpenCriticalAlerts: string;
    minOnboardedOperators: string;
  }) => Promise<void> | void;
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
  recordFederationWorkerRun: (draft: {
    runScope: 'onboarding_sweep' | 'operator_health_audit' | 'diversity_audit' | 'manual';
    runStatus: 'ok' | 'degraded' | 'failed';
    discoveredRequestCount: string;
    approvedRequestCount: string;
    onboardedRequestCount: string;
    openAlertCount: string;
    errorMessage: string;
  }) => Promise<void> | void;
  openFederationAlert: (draft: {
    alertKey: string;
    severity: 'info' | 'warning' | 'critical';
    alertScope: string;
    alertMessage: string;
  }) => Promise<void> | void;
  resolveFederationAlert: (draft: {
    alertId: string;
    resolutionNotes: string;
  }) => Promise<void> | void;
}

export function GovernancePublicAuditVerifierMirrorFederationControls({
  canManageMirrorFederation,
  registeringDiscoverySource,
  recordingDiscoveryRun,
  upsertingDiscoveredCandidate,
  promotingDiscoveredCandidate,
  savingPolicyRatification,
  savingFederationOpsRequirement,
  registeringFederationOperator,
  submittingOnboardingRequest,
  reviewingOnboardingRequest,
  onboardingFederationRequest,
  recordingFederationWorkerRun,
  openingFederationAlert,
  resolvingFederationAlert,
  discoverySources,
  discoveredCandidates,
  federationOperationsSummary,
  federationOnboardingBoard,
  federationAlertBoard,
  registerDiscoverySource,
  recordDiscoveryRun,
  upsertDiscoveredCandidate,
  promoteDiscoveredCandidate,
  recordPolicyRatification,
  saveFederationOpsRequirement,
  registerFederationOperator,
  submitFederationOnboardingRequest,
  reviewFederationOnboardingRequest,
  onboardFederationRequest,
  recordFederationWorkerRun,
  openFederationAlert,
  resolveFederationAlert,
}: GovernancePublicAuditVerifierMirrorFederationControlsProps) {
  const [sourceDraft, setSourceDraft] = useState({
    sourceKey: '',
    sourceLabel: '',
    endpointUrl: '',
    discoveryScope: 'public_registry',
    trustTier: 'observer',
  });
  const [runDraft, setRunDraft] = useState({
    sourceId: '',
    runStatus: 'ok' as 'ok' | 'degraded' | 'failed',
    discoveredCount: '',
    acceptedCandidateCount: '',
    staleCandidateCount: '',
    errorMessage: '',
  });
  const [candidateDraft, setCandidateDraft] = useState({
    sourceId: '',
    candidateKey: '',
    candidateLabel: '',
    endpointUrl: '',
    mirrorType: 'https_gateway',
    regionCode: 'GLOBAL',
    jurisdictionCountryCode: '',
    operatorLabel: '',
    trustDomain: 'public',
    discoveryConfidence: '50',
    candidateStatus: 'new' as 'new' | 'reviewed' | 'promoted' | 'rejected' | 'inactive',
  });
  const [promotionCandidateId, setPromotionCandidateId] = useState('');
  const [ratificationDraft, setRatificationDraft] = useState({
    policyKey: 'default',
    signerKey: '',
    ratificationDecision: 'approve' as 'approve' | 'reject',
    ratificationSignature: '',
  });
  const [opsRequirementDraft, setOpsRequirementDraft] = useState({
    requireFederationOpsReadiness: false,
    maxOpenCriticalAlerts: '0',
    minOnboardedOperators: '1',
  });
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
  const [workerRunDraft, setWorkerRunDraft] = useState({
    runScope: 'manual' as 'onboarding_sweep' | 'operator_health_audit' | 'diversity_audit' | 'manual',
    runStatus: 'ok' as 'ok' | 'degraded' | 'failed',
    discoveredRequestCount: '',
    approvedRequestCount: '',
    onboardedRequestCount: '',
    openAlertCount: '',
    errorMessage: '',
  });
  const [alertDraft, setAlertDraft] = useState({
    alertKey: '',
    severity: 'warning' as 'info' | 'warning' | 'critical',
    alertScope: 'manual',
    alertMessage: '',
  });
  const [resolveAlertDraft, setResolveAlertDraft] = useState({
    alertId: '',
    resolutionNotes: '',
  });

  const promotableCandidates = useMemo(
    () => discoveredCandidates.filter((candidate) => candidate.candidateStatus === 'new' || candidate.candidateStatus === 'reviewed'),
    [discoveredCandidates],
  );
  const reviewableRequests = useMemo(
    () => federationOnboardingBoard.filter((request) => request.requestStatus === 'pending'),
    [federationOnboardingBoard],
  );
  const onboardableRequests = useMemo(
    () => federationOnboardingBoard.filter((request) => request.requestStatus === 'approved'),
    [federationOnboardingBoard],
  );
  const openAlerts = useMemo(
    () => federationAlertBoard.filter((alert) => alert.alertStatus === 'open' || alert.alertStatus === 'acknowledged'),
    [federationAlertBoard],
  );

  useEffect(() => {
    if (!federationOperationsSummary) return;
    setOpsRequirementDraft({
      requireFederationOpsReadiness: federationOperationsSummary.requireFederationOpsReadiness,
      maxOpenCriticalAlerts: String(federationOperationsSummary.maxOpenCriticalFederationAlerts),
      minOnboardedOperators: String(federationOperationsSummary.minOnboardedFederationOperators),
    });
  }, [federationOperationsSummary]);

  if (!canManageMirrorFederation) return null;

  return (
    <>
      <Label className="pt-1 text-xs">Register federation operator</Label>
      <Input
        value={operatorDraft.operatorKey}
        onChange={(event) => setOperatorDraft((current) => ({ ...current, operatorKey: event.target.value }))}
        placeholder="Operator key"
      />
      <Input
        value={operatorDraft.operatorLabel}
        onChange={(event) => setOperatorDraft((current) => ({ ...current, operatorLabel: event.target.value }))}
        placeholder="Operator label"
      />
      <Input
        value={operatorDraft.contactEndpoint}
        onChange={(event) => setOperatorDraft((current) => ({ ...current, contactEndpoint: event.target.value }))}
        placeholder="Contact endpoint (optional)"
      />
      <Input
        value={operatorDraft.jurisdictionCountryCode}
        onChange={(event) => setOperatorDraft((current) => ({ ...current, jurisdictionCountryCode: event.target.value.toUpperCase() }))}
        placeholder="Jurisdiction country code (optional)"
        maxLength={2}
      />
      <Input
        value={operatorDraft.trustDomain}
        onChange={(event) => setOperatorDraft((current) => ({ ...current, trustDomain: event.target.value }))}
        placeholder="Trust domain"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={registeringFederationOperator || !operatorDraft.operatorKey.trim()}
        onClick={() => void registerFederationOperator(operatorDraft)}
      >
        {registeringFederationOperator ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save federation operator
      </Button>

      <Label className="pt-1 text-xs">Submit onboarding request</Label>
      <Input
        value={onboardingRequestDraft.operatorKey}
        onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, operatorKey: event.target.value }))}
        placeholder="Operator key"
      />
      <Input
        value={onboardingRequestDraft.requestedMirrorKey}
        onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedMirrorKey: event.target.value }))}
        placeholder="Mirror key"
      />
      <Input
        value={onboardingRequestDraft.requestedMirrorLabel}
        onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedMirrorLabel: event.target.value }))}
        placeholder="Mirror label"
      />
      <Input
        value={onboardingRequestDraft.requestedEndpointUrl}
        onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedEndpointUrl: event.target.value }))}
        placeholder="Mirror endpoint URL"
      />
      <Input
        value={onboardingRequestDraft.requestedMirrorType}
        onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedMirrorType: event.target.value }))}
        placeholder="Mirror type"
      />
      <Input
        value={onboardingRequestDraft.requestedRegionCode}
        onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedRegionCode: event.target.value.toUpperCase() }))}
        placeholder="Region code"
      />
      <Input
        value={onboardingRequestDraft.requestedJurisdictionCountryCode}
        onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedJurisdictionCountryCode: event.target.value.toUpperCase() }))}
        placeholder="Jurisdiction country code (optional)"
        maxLength={2}
      />
      <Input
        value={onboardingRequestDraft.requestedTrustDomain}
        onChange={(event) => setOnboardingRequestDraft((current) => ({ ...current, requestedTrustDomain: event.target.value }))}
        placeholder="Trust domain"
      />
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
      <Select
        value={reviewDraft.reviewDecision}
        onValueChange={(value) => setReviewDraft((current) => ({ ...current, reviewDecision: value as typeof current.reviewDecision }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Review decision" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="approve">Approve</SelectItem>
          <SelectItem value="reject">Reject</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={reviewDraft.reviewNotes}
        onChange={(event) => setReviewDraft((current) => ({ ...current, reviewNotes: event.target.value }))}
        placeholder="Review notes (optional)"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={reviewingOnboardingRequest || !reviewDraft.requestId}
        onClick={() => void reviewFederationOnboardingRequest(reviewDraft)}
      >
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
      <Select
        value={onboardDraft.activateMirror ? 'yes' : 'no'}
        onValueChange={(value) => setOnboardDraft((current) => ({ ...current, activateMirror: value === 'yes' }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Activate mirror on onboard" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Activate mirror immediately</SelectItem>
          <SelectItem value="no">Leave mirror inactive</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={onboardingFederationRequest || !onboardDraft.requestId}
        onClick={() => void onboardFederationRequest(onboardDraft)}
      >
        {onboardingFederationRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Onboard request
      </Button>

      <Label className="pt-1 text-xs">Federation ops requirement</Label>
      <Select
        value={opsRequirementDraft.requireFederationOpsReadiness ? 'yes' : 'no'}
        onValueChange={(value) => setOpsRequirementDraft((current) => ({
          ...current,
          requireFederationOpsReadiness: value === 'yes',
        }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Require federation operations readiness" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Require federation ops readiness</SelectItem>
          <SelectItem value="no">Do not require federation ops readiness</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={opsRequirementDraft.maxOpenCriticalAlerts}
        onChange={(event) => setOpsRequirementDraft((current) => ({ ...current, maxOpenCriticalAlerts: event.target.value }))}
        placeholder="Max open critical alerts"
      />
      <Input
        value={opsRequirementDraft.minOnboardedOperators}
        onChange={(event) => setOpsRequirementDraft((current) => ({ ...current, minOnboardedOperators: event.target.value }))}
        placeholder="Min onboarded operators"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={savingFederationOpsRequirement}
        onClick={() => void saveFederationOpsRequirement(opsRequirementDraft)}
      >
        {savingFederationOpsRequirement ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save federation ops requirement
      </Button>

      <Label className="pt-1 text-xs">Record worker run</Label>
      <Select
        value={workerRunDraft.runScope}
        onValueChange={(value) => setWorkerRunDraft((current) => ({ ...current, runScope: value as typeof current.runScope }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Run scope" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="onboarding_sweep">Onboarding sweep</SelectItem>
          <SelectItem value="operator_health_audit">Operator health audit</SelectItem>
          <SelectItem value="diversity_audit">Diversity audit</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={workerRunDraft.runStatus}
        onValueChange={(value) => setWorkerRunDraft((current) => ({ ...current, runStatus: value as typeof current.runStatus }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Run status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ok">OK</SelectItem>
          <SelectItem value="degraded">Degraded</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={workerRunDraft.discoveredRequestCount}
        onChange={(event) => setWorkerRunDraft((current) => ({ ...current, discoveredRequestCount: event.target.value }))}
        placeholder="Discovered request count"
      />
      <Input
        value={workerRunDraft.approvedRequestCount}
        onChange={(event) => setWorkerRunDraft((current) => ({ ...current, approvedRequestCount: event.target.value }))}
        placeholder="Approved request count"
      />
      <Input
        value={workerRunDraft.onboardedRequestCount}
        onChange={(event) => setWorkerRunDraft((current) => ({ ...current, onboardedRequestCount: event.target.value }))}
        placeholder="Onboarded request count"
      />
      <Input
        value={workerRunDraft.openAlertCount}
        onChange={(event) => setWorkerRunDraft((current) => ({ ...current, openAlertCount: event.target.value }))}
        placeholder="Open alert count"
      />
      <Input
        value={workerRunDraft.errorMessage}
        onChange={(event) => setWorkerRunDraft((current) => ({ ...current, errorMessage: event.target.value }))}
        placeholder="Error message (optional)"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={recordingFederationWorkerRun}
        onClick={() => void recordFederationWorkerRun(workerRunDraft)}
      >
        {recordingFederationWorkerRun ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save worker run
      </Button>

      <Label className="pt-1 text-xs">Open federation alert</Label>
      <Input
        value={alertDraft.alertKey}
        onChange={(event) => setAlertDraft((current) => ({ ...current, alertKey: event.target.value }))}
        placeholder="Alert key"
      />
      <Select
        value={alertDraft.severity}
        onValueChange={(value) => setAlertDraft((current) => ({ ...current, severity: value as typeof current.severity }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Alert severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="info">Info</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={alertDraft.alertScope}
        onChange={(event) => setAlertDraft((current) => ({ ...current, alertScope: event.target.value }))}
        placeholder="Alert scope"
      />
      <Input
        value={alertDraft.alertMessage}
        onChange={(event) => setAlertDraft((current) => ({ ...current, alertMessage: event.target.value }))}
        placeholder="Alert message"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={openingFederationAlert || !alertDraft.alertKey.trim() || !alertDraft.alertMessage.trim()}
        onClick={() => void openFederationAlert(alertDraft)}
      >
        {openingFederationAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Open federation alert
      </Button>

      <Label className="pt-1 text-xs">Resolve federation alert</Label>
      <Select
        value={resolveAlertDraft.alertId}
        onValueChange={(value) => setResolveAlertDraft((current) => ({ ...current, alertId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select open alert" />
        </SelectTrigger>
        <SelectContent>
          {openAlerts.map((alert) => (
            <SelectItem key={alert.alertId} value={alert.alertId}>
              {alert.alertKey} • {alert.severity}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={resolveAlertDraft.resolutionNotes}
        onChange={(event) => setResolveAlertDraft((current) => ({ ...current, resolutionNotes: event.target.value }))}
        placeholder="Resolution notes (optional)"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={resolvingFederationAlert || !resolveAlertDraft.alertId}
        onClick={() => void resolveFederationAlert(resolveAlertDraft)}
      >
        {resolvingFederationAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Resolve alert
      </Button>

      <Label className="pt-1 text-xs">Register discovery source</Label>
      <Input
        value={sourceDraft.sourceKey}
        onChange={(event) => setSourceDraft((current) => ({ ...current, sourceKey: event.target.value }))}
        placeholder="Source key"
      />
      <Input
        value={sourceDraft.sourceLabel}
        onChange={(event) => setSourceDraft((current) => ({ ...current, sourceLabel: event.target.value }))}
        placeholder="Source label"
      />
      <Input
        value={sourceDraft.endpointUrl}
        onChange={(event) => setSourceDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
        placeholder="Source endpoint URL"
      />
      <Select
        value={sourceDraft.discoveryScope}
        onValueChange={(value) => setSourceDraft((current) => ({ ...current, discoveryScope: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Discovery scope" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="public_registry">Public registry</SelectItem>
          <SelectItem value="signed_catalog">Signed catalog</SelectItem>
          <SelectItem value="community_feed">Community feed</SelectItem>
          <SelectItem value="manual_seed">Manual seed</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={sourceDraft.trustTier}
        onValueChange={(value) => setSourceDraft((current) => ({ ...current, trustTier: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Trust tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="observer">Observer</SelectItem>
          <SelectItem value="independent">Independent</SelectItem>
          <SelectItem value="community">Community</SelectItem>
          <SelectItem value="bootstrap">Bootstrap</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={registeringDiscoverySource || !sourceDraft.sourceKey.trim() || !sourceDraft.endpointUrl.trim()}
        onClick={() => void registerDiscoverySource(sourceDraft)}
      >
        {registeringDiscoverySource ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save discovery source
      </Button>

      <Label className="pt-1 text-xs">Record discovery run</Label>
      <Select
        value={runDraft.sourceId}
        onValueChange={(value) => setRunDraft((current) => ({ ...current, sourceId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select source" />
        </SelectTrigger>
        <SelectContent>
          {discoverySources.map((source) => (
            <SelectItem key={source.sourceId} value={source.sourceId}>
              {source.sourceLabel || source.sourceKey}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={runDraft.runStatus}
        onValueChange={(value) => setRunDraft((current) => ({ ...current, runStatus: value as typeof current.runStatus }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Run status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ok">OK</SelectItem>
          <SelectItem value="degraded">Degraded</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={runDraft.discoveredCount}
        onChange={(event) => setRunDraft((current) => ({ ...current, discoveredCount: event.target.value }))}
        placeholder="Discovered count"
      />
      <Input
        value={runDraft.acceptedCandidateCount}
        onChange={(event) => setRunDraft((current) => ({ ...current, acceptedCandidateCount: event.target.value }))}
        placeholder="Accepted candidate count"
      />
      <Input
        value={runDraft.staleCandidateCount}
        onChange={(event) => setRunDraft((current) => ({ ...current, staleCandidateCount: event.target.value }))}
        placeholder="Stale candidate count"
      />
      <Input
        value={runDraft.errorMessage}
        onChange={(event) => setRunDraft((current) => ({ ...current, errorMessage: event.target.value }))}
        placeholder="Error message (optional)"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={recordingDiscoveryRun || !runDraft.sourceId}
        onClick={() => void recordDiscoveryRun(runDraft)}
      >
        {recordingDiscoveryRun ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save discovery run
      </Button>

      <Label className="pt-1 text-xs">Upsert discovered candidate</Label>
      <Select
        value={candidateDraft.sourceId}
        onValueChange={(value) => setCandidateDraft((current) => ({ ...current, sourceId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select source" />
        </SelectTrigger>
        <SelectContent>
          {discoverySources.map((source) => (
            <SelectItem key={source.sourceId} value={source.sourceId}>
              {source.sourceLabel || source.sourceKey}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={candidateDraft.candidateKey}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, candidateKey: event.target.value }))}
        placeholder="Candidate key"
      />
      <Input
        value={candidateDraft.candidateLabel}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, candidateLabel: event.target.value }))}
        placeholder="Candidate label"
      />
      <Input
        value={candidateDraft.endpointUrl}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
        placeholder="Candidate endpoint URL"
      />
      <Input
        value={candidateDraft.mirrorType}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, mirrorType: event.target.value }))}
        placeholder="Mirror type"
      />
      <Input
        value={candidateDraft.regionCode}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, regionCode: event.target.value.toUpperCase() }))}
        placeholder="Region code"
      />
      <Input
        value={candidateDraft.jurisdictionCountryCode}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, jurisdictionCountryCode: event.target.value.toUpperCase() }))}
        placeholder="Jurisdiction country code (optional)"
        maxLength={2}
      />
      <Input
        value={candidateDraft.operatorLabel}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, operatorLabel: event.target.value }))}
        placeholder="Operator label"
      />
      <Input
        value={candidateDraft.trustDomain}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, trustDomain: event.target.value }))}
        placeholder="Trust domain"
      />
      <Input
        value={candidateDraft.discoveryConfidence}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, discoveryConfidence: event.target.value }))}
        placeholder="Discovery confidence (0-100)"
      />
      <Select
        value={candidateDraft.candidateStatus}
        onValueChange={(value) => setCandidateDraft((current) => ({ ...current, candidateStatus: value as typeof current.candidateStatus }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Candidate status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="new">New</SelectItem>
          <SelectItem value="reviewed">Reviewed</SelectItem>
          <SelectItem value="promoted">Promoted</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={upsertingDiscoveredCandidate || !candidateDraft.sourceId || !candidateDraft.candidateKey.trim() || !candidateDraft.endpointUrl.trim()}
        onClick={() => void upsertDiscoveredCandidate(candidateDraft)}
      >
        {upsertingDiscoveredCandidate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save discovered candidate
      </Button>

      <Label className="pt-1 text-xs">Promote discovered candidate</Label>
      <Select value={promotionCandidateId} onValueChange={setPromotionCandidateId}>
        <SelectTrigger>
          <SelectValue placeholder="Select candidate" />
        </SelectTrigger>
        <SelectContent>
          {promotableCandidates.map((candidate) => (
            <SelectItem key={candidate.candidateId} value={candidate.candidateId}>
              {candidate.candidateLabel || candidate.candidateKey} • {candidate.candidateStatus}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={promotingDiscoveredCandidate || !promotionCandidateId}
        onClick={() => void promoteDiscoveredCandidate(promotionCandidateId)}
      >
        {promotingDiscoveredCandidate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Promote candidate
      </Button>

      <Label className="pt-1 text-xs">Record policy ratification</Label>
      <Input
        value={ratificationDraft.policyKey}
        onChange={(event) => setRatificationDraft((current) => ({ ...current, policyKey: event.target.value }))}
        placeholder="Policy key"
      />
      <Input
        value={ratificationDraft.signerKey}
        onChange={(event) => setRatificationDraft((current) => ({ ...current, signerKey: event.target.value }))}
        placeholder="Signer key"
      />
      <Select
        value={ratificationDraft.ratificationDecision}
        onValueChange={(value) => setRatificationDraft((current) => ({ ...current, ratificationDecision: value as typeof current.ratificationDecision }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Ratification decision" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="approve">Approve</SelectItem>
          <SelectItem value="reject">Reject</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={ratificationDraft.ratificationSignature}
        onChange={(event) => setRatificationDraft((current) => ({ ...current, ratificationSignature: event.target.value }))}
        placeholder="Ratification signature"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={savingPolicyRatification || !ratificationDraft.signerKey.trim() || !ratificationDraft.ratificationSignature.trim()}
        onClick={() => void recordPolicyRatification(ratificationDraft)}
      >
        {savingPolicyRatification ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save policy ratification
      </Button>
    </>
  );
}
