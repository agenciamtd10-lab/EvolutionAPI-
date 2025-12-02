# Troubleshooting Report: Indorama Instances Investigation (Nov 29 - Dec 1, 2025)

**Date:** Dec 1, 2025
**Affected Instances:**
1. `628131069178` (Indorama) - **Issue: Crash Loop (Code Bug)**
2. `6281110139189` (Indorama) - **Issue: Network Instability (ECONNRESET)**
3. `628131069189` (Indorama) - **Status: Stable**

## 1. Executive Summary
Investigation confirms distinct root causes for the failing instances.
- **Instance `...178`** is trapped in a **restart loop caused by a software bug** (`PrismaClientValidationError`). A container restart at 03:05 UTC temporarily cleared the process but the instance crashes immediately upon processing specific message update events.
- **Instance `...189` (Sync Fail)** is suffering from severe **network instability** (`ECONNRESET`), preventing it from maintaining a connection long enough to sync messages.
- **Instance `...189` (Stable)** was incorrectly flagged as having conflicts due to a log parsing error; it remains healthy.

## 2. Investigation Findings

### 2.1 Instance 628131069178 (The "Disconnect" Issue)
**Status:** CRASH LOOP
**Analysis:**
This instance is not just "disconnecting"; it is **crashing** the Node.js process, causing the container to automatically restart it.
- **Trigger:** Processing `messages.update` events (likely status updates or edits).
- **Error:** `PrismaClientValidationError: Invalid this.cache.delete()`.
- **Mechanism:** The code attempts to use `this.cache.delete()` incorrectly during message updates. This throws an unhandled exception, crashing the service.
- **Evidence:**
    - Logs show repeated startup sequences followed by the error and an immediate `LOGOUT` or process exit.
    - Timestamps: 03:32, 03:35, 03:40 UTC (looping every few minutes).
- **Container Restart:** The manual container restart at 03:05 UTC successfully killed any zombie processes, but since the root cause is a code defect, the crashes resumed immediately.

### 2.2 Instance 6281110139189 (The "Sync" Issue)
**Status:** CONNECTION FAILURE
**Analysis:**
This instance is failing to establish or maintain a stable socket connection to WhatsApp.
- **Error:** `Error: read ECONNRESET`.
- **Impact:** The instance connects briefly but the connection is reset by the peer (network/proxy) before data can be reliably synced or persisted.
- **Relation to Bug:** It is likely *not* hitting the Prisma bug yet because it cannot stay connected long enough to receive the triggering events.

### 2.3 Instance 628131069189 (Stable)
**Status:** HEALTHY
**Analysis:**
- Previously reported "Conflict/401" errors were **false positives**.
- **Explanation:** The log analysis tool incorrectly matched the string "401" inside a WhatsApp Group ID (`120363401...`).
- **Verification:** Detailed manual review of logs shows normal message processing and Chatwoot sync activity.

## 3. Root Cause: The Prisma Bug
**Issue:** Misuse of the cache deletion method in `src/services/baileys/baileys.service.ts`.
**Context:** This is the **same bug** responsible for the "Mama First" incident.
- **Location:** `messages.update` handler.
- **Impact:** Affects any instance receiving specific types of message updates (e.g., status changes, edits).

## 4. Action Plan

### Immediate Actions
1.  **Patch Code (Priority 1):** Fix the `this.cache.delete` call in `baileys.service.ts`. This is critical to stop the crash loops for Instance `...178` and "Mama First".
2.  **Deploy:** Rebuild and deploy the fixed image.

### Secondary Actions
1.  **Monitor Network:** Once the code fix is live, observe Instance `...189` (Sync Fail). If `ECONNRESET` persists, investigate the proxy configuration or network path for that specific number.

