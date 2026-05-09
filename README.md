# Levela: The Sovereign Decentralized Platform

Levela is a fully self-sustaining, sovereign peer-to-peer (P2P) platform designed for a decentralized society. It operates as a network of mobile, desktop, and server apps, independent of any centralized service or third-party platform.

## 🚀 Key Features

- **Self-Sovereign Identity (SSI)**: Users own and control their identity via DIDs and local secure key storage.
- **P2P Data Sync**: Real-time data synchronization across the network using Gun.js.
- **Distributed Storage**: Files and evidence stored on IPFS, ensuring data permanence and availability.
- **Decentralized Governance**: Community-driven protocol upgrades via weighted voting and consensus.
- **Sovereign Development Workflow**: Professional Dev-Test-Prod lifecycle managed by the community.

## 🏗️ Architecture

Levela is built on a local-first, P2P architecture:

1. **Identity**: Ed25519-based DIDs stored in the device's Secure Enclave.
2. **Networking**: Gun.js for real-time data and IPFS for distributed file storage.
3. **Governance**: Protocol versioning with timelock-protected upgrades.
4. **Deployment**: Multi-stage approval gates for safe feature promotion.

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18+)
- Expo CLI
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/maturehumanity/levela.git
   cd levela
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development environment:
   ```bash
   npm start
   ```

## 📖 Documentation

Comprehensive documentation is available in the `docs/` directory:

- [Sovereign Architecture](./docs/SOVEREIGN_LEVELA_ARCHITECTURE.md)
- [Phase 1: Identity Guide](./docs/PHASE1_IDENTITY_GUIDE.md)
- [Phase 2: P2P Integration](./docs/PHASE2_P2P_INTEGRATION_GUIDE.md)
- [Phase 3: Protocol Governance](./docs/PHASE3_PROTOCOL_GOVERNANCE_GUIDE.md)
- [Phase 4: Staged Promotion](./docs/PHASE4_STAGED_PROMOTION_WORKFLOW.md)
- [Final Verification Report](./docs/SOVEREIGN_LEVELA_VERIFICATION_REPORT.md)

## 🤝 Contributing

Levela is a community-governed project. To contribute:

1. Propose a feature or fix via a Governance Proposal.
2. Develop the feature in the `development` environment.
3. Submit for review and testing in the `staging` environment.
4. Once approved by the community, the feature will be promoted to `production`.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built for a Sovereign Humanity*

---

## Original Project Info (Legacy)

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

### Hybrid Development Workflow
This project supports development across multiple platforms:
- Lovable Platform (Web)
- Android Development (`npm run update:application`)
- iOS Development (`npm run cap:ios`)

### Feature Registry Rule
Source of truth: `src/lib/feature-registry.ts`
Update the feature registry and the matching Features-page copy in the same change.

### Autosave-by-Default Rule
Editable application pages should use autosave as the default interaction pattern.
