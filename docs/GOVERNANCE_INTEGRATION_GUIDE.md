# Governance Integration Guide

This guide explains how the new Governance UI components and Steward Consoles have been integrated into the Levela Mobile MVP to achieve full decentralization.

## Architecture Overview

The decentralization program consists of three main layers:

### 1. Backend Layer (Database & RPCs)
Located in `supabase/migrations/`, these SQL files define:
- **Identity Verification**: Tables and RPCs for managing user identity verification processes.
- **Constitutional Offices**: Tables and RPCs for managing governance roles and office holders.
- **Proposals & Voting**: Tables and RPCs for creating, voting on, and managing governance proposals.

### 2. Permission Model Layer
Located in `src/lib/governance-permission-model.ts`, this layer provides:
- **Role-Based Access Control (RBAC)**: Defines governance roles (Admin, Steward, Office Holder, Verified User).
- **Action Permissions**: Maps actions to required roles.
- **Context Checking**: Verifies user permissions before allowing operations.

### 3. UI Layer
Located in `src/components/governance/`, these React components provide:
- **GovernanceDashboard**: Main entry point for governance features.
- **GovernanceProposalsList**: Displays active proposals and allows voting.
- **StewardConsole**: Provides steward management tools.
- **StewardConsoleIdentityVerification**: Manages identity verification requests.
- **StewardConsoleOfficeManagement**: Manages constitutional offices and holders.

## Component Hierarchy

```
GovernanceDashboard
├── GovernanceProposalsList
│   └── Individual Proposal Cards (with voting)
├── StewardConsole (if user is steward)
│   ├── StewardConsoleIdentityVerification
│   └── StewardConsoleOfficeManagement
└── Proposal Details Panel
```

## Integration Steps

### Step 1: Update App Routing
In `src/App.tsx`, replace the existing Governance route with the new one:

```typescript
// OLD:
const Governance = lazy(() => import('@/pages/Governance'));

// NEW:
const GovernanceNew = lazy(() => import('@/pages/GovernanceNew'));

// In Routes:
<Route path="/governance" element={<ProtectedRoute><GovernanceNew /></ProtectedRoute>} />
```

### Step 2: Verify Database Migrations
Ensure all three migration files have been applied to your Supabase database:
- `20260501120000_identity_verifications.sql`
- `20260501121000_constitutional_offices.sql`
- `20260501122000_proposals_and_voting.sql`

Run:
```bash
supabase db push
```

### Step 3: Test the Governance Flow

1. **As a Regular User**:
   - Navigate to `/governance`
   - View active proposals
   - Cast votes on proposals
   - See voting results update in real-time

2. **As a Steward**:
   - Navigate to `/governance`
   - Access the "Steward Console" tab
   - Review and approve/reject identity verifications
   - Manage constitutional office holders
   - Configure governance policies

## Key Features Implemented

### For All Users
- **View Active Proposals**: Browse all active governance proposals with descriptions.
- **Vote on Proposals**: Cast votes (Yes/No/Abstain) on active proposals.
- **See Results**: View real-time voting results with percentages.
- **Check Status**: See your governance status and permissions.

### For Stewards
- **Identity Verification Management**: Review and approve/reject identity verification requests.
- **Office Management**: Appoint and revoke constitutional office holders.
- **Policy Configuration**: Configure governance policies and rules.
- **Audit Trail**: View history of governance actions.

## Permission Model

The following roles and permissions are enforced:

| Role | Can Vote | Can Create Proposals | Can Manage Offices | Can Manage Verifications |
| :--- | :--- | :--- | :--- | :--- |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Office Holder | ✅ | ✅ | ❌ | ❌ |
| Verified User | ✅ | ❌ | ❌ | ❌ |
| Regular User | ❌ | ❌ | ❌ | ❌ |

## API Integration

All UI components use the utility functions defined in `src/lib/governance-ui-utils.ts`:

- `fetchGovernanceProposals()`: Get active proposals
- `castGovernanceVote()`: Submit a vote
- `getGovernanceProposalResults()`: Get voting results
- `fetchIdentityVerificationStatus()`: Get verification requests
- `fetchConstitutionalOffices()`: Get office information
- `fetchOfficeHolders()`: Get current office holders
- `checkGovernancePermissions()`: Check user permissions

## Testing

Run the governance RPC tests:
```bash
supabase db execute supabase/tests/governance_rpc_test.sql
```

Run the UI utility tests:
```bash
npm test src/lib/governance-ui-utils.test.ts
```

## Next Steps

1. **Integrate with Existing Governance Page**: Merge `GovernanceNew.tsx` with the existing `Governance.tsx` or replace it entirely.
2. **Add More Governance Features**: Implement proposal creation UI, advanced filtering, and governance analytics.
3. **Enhance Steward Tools**: Add more management capabilities, audit logging, and reporting.
4. **Mobile Optimization**: Ensure all components are fully responsive for mobile devices.

## Troubleshooting

**Issue**: "User is not authorized" error
- **Solution**: Verify the user's role in the `profiles` table and ensure they have the appropriate permissions.

**Issue**: Proposals not loading
- **Solution**: Check that the Supabase migrations have been applied and the RPC functions are accessible.

**Issue**: Voting not working
- **Solution**: Ensure the user is authenticated and has the `can_vote` permission. Check the browser console for API errors.
