# Active Context
- **Current Status**: Migration complete. Local build of `v2.3.2` **FAILED** due to a TypeScript error in the `baileys` dependency (`SenderKeyStore` mismatch).
- **Last Action**: Documented the build failure in [docs/troubleshooting/20251119-build-failure-v2.3.2.md](file:///Users/wahyusaputra/dev/widget-works/evolution-api/docs/troubleshooting/20251119-build-failure-v2.3.2.md).
- **Blocker**: Cannot verify local build of v2.3.2 without patching dependencies or upgrading.
- **Next Step**: Research and attempt build with **v2.3.6** (latest stable) to see if the dependency issue is resolved.

# Task List

## Phase 1: Migration & Setup (Completed)
- [x] Explore workspace and identify troubleshooting docs <!-- id: 0 -->
- [x] Analyze issues (Pending Messages, Delivery ACK) <!-- id: 1 -->
- [x] Migrate files to `docs/troubleshooting` and `backups` <!-- id: 6 -->
- [x] Move repo to root and cleanup <!-- id: 7 -->
- [x] Setup Azure deployment docs (`docs/deployment.md`) and script (`build.sh`) <!-- id: 3 -->
- [x] Establish `AGENTS.md` with protocols and guardrails <!-- id: 4 -->

## Phase 2: Stability Verification (Active)
- [ ] **Verify Local Build (v2.3.2)** <!-- id: 9 -->
    - [x] Attempt v2.3.2 build (Failed: Baileys type error)
    - [x] Fix v2.3.2 build (Dependency pinning/patching) <!-- id: 16 -->
    - [x] Verify local run of v2.3.2 <!-- id: 17 -->
- [ ] **Workflow Test** <!-- id: 18 -->
    - [ ] Commit and push documentation/scripts to main <!-- id: 10 -->
    - [ ] Deploy unmodified v2.3.2 to Staging/Prod <!-- id: 11 -->
- [ ] **Upgrade Decision** <!-- id: 19 -->
    - [ ] Research v2.3.6 stability and fixes <!-- id: 12 -->
    - [ ] Decide: Fix bugs on v2.3.2 OR Upgrade to v2.3.6 <!-- id: 20 -->

## Phase 3: Bug Fixes (Pending)
- [ ] Fix "Pending Message" duplicate attribution <!-- id: 13 -->
- [ ] Fix "Delivery ACK" media sync failures <!-- id: 14 -->
- [ ] Implement instance connection stability improvements <!-- id: 15 -->
