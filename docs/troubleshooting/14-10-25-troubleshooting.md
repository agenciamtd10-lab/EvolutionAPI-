# Troubleshooting Session: Prospek & Evolution API Integration

## Background & Project Context

- **Project**: Prospek - an omnichannel CRM for SMEs in Indonesia, focused on WhatsApp & Instagram DM integration. Multi-tenant SaaS architecture. Prospek is a forked of Chatwoot open source project.

### Technology Stack
- **Prospek (CRM)**: Ruby on Rails application hosted on Azure Container Apps.
  - **Resource Group**: `prospek-prod`
  - **Container App**: `prospek-prod`
  - **Account ID**: `3`
  - **Conversation Link**: [https://web.prospek.app/app/accounts/3/dashboard](https://web.prospek.app/app/accounts/3/dashboard)
- **Evolution API (WhatsApp Gateway)**: Node.js-based WhatsApp Web API provider.
  - **Resource Group**: `evolution-prod`
  - **Container App**: `evolution-prod`
  - **Details**: Handles WhatsApp connections via Baileys library (WhatsApp Web protocol).
  - **Version**: `v2.3.1`
  - **Dashboard**: [https://evolution.prospek.app/manager](https://evolution.prospek.app/manager)

### Integration Flow
1. Evolution API connects to WhatsApp Web via QR code scanning.
2. WhatsApp sends messages → Evolution API receives via websocket.
3. Evolution API forwards messages to Prospek via webhook.
4. Prospek displays messages in the CRM interface.

---

## Known Issues

### Primary Complaint
Prospek isn't receiving the QR code when initiating prospek x evolution connection. Expected: prospek (chatwoot) x evolution will send QR code to prospek contact +123456. 

Evolution Instance: https://evolution.prospek.app/manager/instance/5b64b8a2-23af-4f0d-9ffb-9e4793f4655f/dashboard -> I tried connection today but did not receive QR via +123456 contact
Prospek account: https://web.prospek.app/app/accounts/3/dashboard

---

## Troubleshooting Log - 14/10/2025

### Issue
Prospek not receiving QR code from Evolution API after upgrading to `v2.3.4`.

### Investigation
- **Analyzed `evolution-prod` logs:** Found a recurring "conversation not found" error from the `ChatwootService` immediately after a QR code was generated.
- **Analyzed `prospek-prod` logs:** Confirmed that there were no incoming requests to create a new conversation when the QR code was generated.
- **Searched GitHub Issues:** Discovered multiple community-reported issues regarding QR code generation failures in Evolution API versions `2.3.3` and `2.3.4`, pointing to regressions and instability in these releases.

### Hypothesis
The "conversation not found" error is a bug in Evolution API `v2.3.4`. The `ChatwootService` is incorrectly trying to find an existing conversation to send the QR code to, instead of creating a new one. This fails the process and prevents the QR code from being sent to Prospek.

### User Context & Root Cause Analysis
- The user upgraded from `v2.3.1` to `v2.3.4` to resolve a "zombie session" issue.
- The "zombie session" issue was caused by a lack of persistent storage on the `evolution-prod` container app, which meant session files were deleted on every container restart.
- The upgrade to `v2.3.4` was a temporary workaround, not a permanent fix for the "zombie session" problem.

### Decision & Plan
The best course of action is to address the root cause of the original "zombie session" issue and then revert to a stable version of the Evolution API.

1.  **Add Persistent Storage:** Provision an Azure Files share and mount it to the `evolution-prod` container app at the `/evolution/instances` path. This will ensure session files persist across container restarts, permanently fixing the "zombie session" issue.
2.  **Downgrade Evolution API:** Downgrade the `evolution-prod` container app from the buggy `v2.3.4` to the more stable `v2.3.1`.

---

## Troubleshooting Log - 14/10/2025 (Part 2)

### Action Taken
- Created a new storage account `evostorprospeksea` in `Southeast Asia`.
- Created a file share `evolution-instances`.
- Mounted the file share to the `evolution-prod` container app at `/evolution/instances`.
- Downgraded the `evolution-prod` container app to `v2.3.1`.

### Resolution
- The QR code issue is resolved. The instance `5b64b8a2-23af-4f0d-9ffb-9e4793f4655f` is now connected and able to receive the QR code message.
- The "conversation not found" error is no longer present in the `evolution-prod` logs.
- The user has confirmed the existence of the session file (`session-6287777635515.0.json`) in the persistent storage, which validates that the "zombie session" issue is permanently fixed.
- The system is now stable and working as expected.
