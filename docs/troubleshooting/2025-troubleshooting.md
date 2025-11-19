# Troubleshooting Session: Prospek & Evolution API Integration

## Background & Project Context

- **Project**: Prospek - an omnichannel CRM for SMEs in Indonesia, focused on WhatsApp & Instagram DM integration. Multi-tenant SaaS architecture. Prospek is a forked of Chatwoot open source project.

### Technology Stack
- **Prospek (CRM)**: Ruby on Rails application hosted on Azure Container Apps.
  - **Resource Group**: `prospek-prod`
  - **Container App**: `prospek-prod`
  - **Account ID**: `20`
  - **Conversation Link**: [https://web.prospek.app/app/accounts/20/dashboard](https://web.prospek.app/app/accounts/20/dashboard)
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
User reports that Prospek is not receiving WhatsApp messages for a specific account, despite messages arriving in WhatsApp.

### Affected Instance
- **Phone Number**: `6287792348908`
- **Instance Name**: “Mama First”
- **Evolution Instance ID**: `44d098ff-548b-4a37-947e-3a88589098ec`
- **Prospek Account**: Account ID `20` ([Link](https://web.prospek.app/app/accounts/20/dashboard))

### Observed Symptoms
- Evolution manager UI shows instance status as “connected”.
- Instance does **NOT** appear in WhatsApp’s linked devices list.
- Messages sent to `6287792348908` in WhatsApp are not showing up in Prospek.
- **Previous occurrence**: Same issue happened 1 week ago, was resolved by reconnecting (disconnect + scan QR again).
- **Current situation**: Reconnecting by scanning QR does **NOT** resolve the issue this time.

---

## Hypothesis: "Zombie Session"

The Evolution instance `6287792348908` is in a “phantom/zombie session state”.

- **Database State vs Reality Mismatch**:
  - Evolution’s internal database shows the instance as “connected”.
  - WhatsApp servers have invalidated/forgotten the session.
  - No active cryptographic session exists between Evolution and WhatsApp.
- **Why QR Reconnection Fails**:
  - The session data itself is corrupted at the WhatsApp protocol level.
  - Re-scanning the QR code updates the connection but doesn’t fix the underlying session corruption.
- **Ghost Session Characteristics**:
  - Evolution thinks it’s connected (UI shows “connected”).
  - WhatsApp doesn’t recognize the session (not in linked devices).
  - No message processing occurs (no logs, no webhooks with real messages).

---

## Findings from Log Analysis

### Evolution API Logs (`evolution-prod`)
- **Instance `6287792348908` is COMPLETELY ABSENT**:
  - No message processing logs, no connection events, and no error logs specific to this instance.
  - **Conclusion**: The instance is not actively participating in the Evolution API runtime.
- **Other Instances Show Activity**:
  - A working instance (`6281384833969`) is actively processing messages with no errors.
  - Other instances *are* generating logs, even though they have cryptographic failures (`PreKeyError`, session decryption errors).

### Prospek Logs (`prospek-prod`)
- **System Notifications Present**:
  - Prospek **IS** receiving bot-generated status messages for `6287792348908` (e.g., “instance is connected”).
  - This confirms the Prospek webhook integration is working, but Evolution isn’t sending real message data.
- **No Incoming WhatsApp Messages**:
  - No webhook calls from Evolution containing actual user messages for instance `6287792348908`.

### Critical Observation
The smoking gun: Instance `6287792348908` is completely silent in Evolution logs while showing “connected” in the UI. This indicates the instance is in a “zombie” state—it exists in the database but not in the runtime.

---

## Definitive Root Cause and Final Remediation Plan (08/10/2025)

### Final Analysis
A review of the `evolution-prod` container app's configuration has revealed the definitive root cause of the ongoing instability.

**Finding**: The container app has **no persistent storage volume attached**.
```json
"template": {
    "volumes": []
}
```
This means the container's local filesystem is ephemeral and is **wiped clean on every restart**.

### The Instability Cycle Explained
1.  **Connection Works**: A user connects an instance, creating a session file (e.g., `/evolution/instances/44d098ff-548b-4a37-947e-3a88589098ec/session.json`) inside the container's temporary filesystem.
2.  **Container Restarts**: For any reason (platform maintenance, scaling, crash), the Azure Container App restarts.
3.  **Session File Deleted**: The restart destroys the container's ephemeral filesystem, deleting the session file.
4.  **Zombie State Created**: The Evolution API starts up and reads its persistent PostgreSQL database, which still lists the instance as "connected". However, the corresponding session file is gone. This creates the "zombie" state.
5.  **Manual Intervention**: A user then tries to fix this by logging out and reconnecting. This creates a *new* session file on the *new* ephemeral filesystem, making the instance work temporarily.
6.  **Cycle Repeats**: The fix only lasts until the next container restart.

---

## Collaborative Verification & Remediation (08/10/2025)

To validate the "ephemeral storage" hypothesis, a deeper investigation was conducted with an LLM assistant using the Azure CLI and external research.

### Verification Steps & Findings
1.  **Restart Automation Check**: The `restart-evolution-daily` Logic App was confirmed to be **`Disabled`**. Container revision history also showed no recent restarts, ruling out a scheduled restart as the immediate cause of the Oct 8th logout.
2.  **Persistent Storage Validation**: An `az containerapp show` command confirmed `template.volumes` was `[]` (an empty array), proving the `evolution-prod` container has **no persistent storage volume attached**.
3.  **Anomalous Session State Confirmed**: `az containerapp exec` commands failed due to Azure platform errors (`ClusterExecFailure`). As a workaround, the Azure portal's container console was used.
    - **Action**: `ls -l /evolution/instances` was run in the console.
    - **Finding**: The directory for the problematic instance (`44d098ff-548b-4a37-947e-3a88589098ec`) was initially missing. After upgrading the container and reconnecting the instance, the same command showed the directory was now present.
4.  **External Research via LLM**: Research into the Baileys/Evolution API community uncovered multiple GitHub issues describing the same "zombie session" behavior. A key issue (`#1424`) suggested a fix was available in version `v2.3.4`.

### Resolution & Current Status
1.  **Immediate Action Taken**: The `evolution-prod` container was upgraded from `v2.3.1` to `v2.3.4`. After the upgrade, the "Mama First" instance was reconnected, and its session directory was confirmed to exist on the filesystem.
2.  **Current Status**: The immediate "zombie session" issue is **resolved**. The instance is active and can process messages.
3.  **Next Step (Permanent Solution)**: The fix is **temporary**. The root cause of instability—ephemeral storage—remains. To permanently solve this, the next step is to provision an Azure Files share and mount it to the container at the `/evolution/instances` path. This will ensure session files survive all future container restarts.

---

## Appendix: Permanent Storage Cost Analysis

### Azure Files Pricing Model
The pricing model for Azure Files is primarily **pay-per-usage**; it is not a fixed monthly cost. The total price is determined by three main factors:

1.  **Storage Amount**: You are billed per GiB of data you store per month. For this use case, the total data size will be minimal (likely less than 1 GiB), making this portion of the cost very low.
2.  **Transactions**: This will be the main driver of your cost. You pay for file operations like reads, writes, and listings, billed per 10,000 transactions. Every time a session is read or updated, it counts as a transaction.
3.  **Data Redundancy**: You choose how your data is replicated. **Locally-redundant storage (LRS)** is the cheapest option and is sufficient for this use case.

### Recommended Tier
For storing session files, the most cost-effective option is the **Standard** tier (HDD-based) with the **"Transaction Optimized"** setting. The "Premium" tier (SSD-based) is unnecessary and would be overkill for this workload.

### Estimated Cost
Given the small file sizes and the likely volume of transactions, the total monthly cost for the Azure Files share is expected to be **very low, likely only a few dollars per month**. The cost will scale naturally as you add more instances and they generate more transactions.

---

## Version Upgrade to v2.3.6 (05/11/2025)

### Action Taken
- The `evolution-prod` container app was upgraded from version `v2.3.1` to `v2.3.6`.

### Reason for Upgrade
- **Addressing Persistent Errors**: This upgrade was performed to resolve recurring issues, including the "File Failed to Send" error (`SessionError: No sessions`) that was happening on version `v2.3.1`.
- **Stability and Bug Fixes**: Research into the official Evolution API repository indicated that version `v2.3.6` contains specific fixes for document sending via Chatwoot and significant improvements to session data handling.
- **Goal**: To improve the overall stability and reliability of the WhatsApp integration with Prospek.

### Current Status
- The system is now running on `v2.3.6`. Monitoring is in place to confirm that the previous errors are resolved.
