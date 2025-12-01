# Troubleshooting Report: Indorama Instances Investigation (Nov 29 - Dec 1, 2025)

**Date:** Dec 1, 2025
**Affected Instances:**
1. `6281110139189 Indorama` (ID: `37298bd5-7eac-4389-84c6-04edaa739437`) - **Issue: Sync Failure**
2. `628131069178 Indorama` (ID: `48e6c232-1bb9-45cd-a91a-81053effc2d5`) - **Issue: Repeated Disconnects**

## 1. Executive Summary
- **Instance 1 (`37298bd5...`)** is connected but failing to sync messages to Prospek. Investigation reveals that while the socket is receiving events (`Update messages`), **no messages are being saved to the database**. This is likely due to network instability (`ECONNRESET`) disrupting the persistence flow or proxy issues.
- **Instance 2 (`48e6c232...`)** is suffering from repeated `401 device_removed` errors. This is a definitive **conflict** error from WhatsApp, indicating the session is being invalidated externally (e.g., user logging out, duplicate session conflict).

## 2. Investigation Findings

### 2.1 Instance 1: 6281110139189 (Sync Failure)
**Symptom:** Connected, logs show activity, but Prospek receives no messages.

**Evidence:**
- **DB Check:** `SELECT * FROM "Message" WHERE "instanceId" = '37298bd5...'` returned **0 rows**.
- **Logs:**
    - `Update messages [...]` events are present in logs (e.g., at 03:00 UTC), confirming the socket is alive and receiving data.
    - **Critical Error:** `Error: read ECONNRESET` observed multiple times (02:31 UTC, 02:36 UTC).
    - **Logout:** `Instance ... - LOGOUT` event at 02:49 UTC.

**Analysis:**
The `ECONNRESET` errors suggest the connection between the Evolution container and the WhatsApp servers (or proxy) is unstable. While the socket stays open long enough to receive *some* events, the instability likely interrupts the database transaction or the message processing pipeline before the save completes. Without the message in the `Message` table, the sync logic (which relies on DB triggers/polling) never fires for Prospek.

### 2.2 Instance 2: 628131069178 (Repeated Disconnects)
**Symptom:** Automatically disconnects shortly after connection. User denies logging out.

**Evidence:**
- **Status:** `close` (Disconnected).
- **Reason Code:** `401`.
- **Disconnection Object:** `{"tag":"stream:error","attrs":{"code":"401"},"content":[{"tag":"conflict","attrs":{"type":"device_removed"}}]}`
- **Proxy:** No proxy configured in `Proxy` table for this instance.
- **Session Table:** 0 rows found in `Session` table for this instance ID. This suggests Evolution is not successfully persisting the session credentials to the database, or they are being deleted immediately upon disconnect.
- **History:** Disconnected at 02:36, 02:49, and 02:58 UTC (and previously on Nov 29).

**Analysis:**
If the user is not logging out, the `401 Conflict` combined with the missing `Session` record points to a **race condition or zombie process**.
1.  **Zombie Process:** Another Evolution instance (perhaps a previous deployment that didn't shut down cleanly, or a staging environment) might still be holding onto the session. When the new instance connects, WhatsApp detects two active sockets for the same session ID and kills both with "conflict".
2.  **Session Persistence Failure:** Evolution might be failing to save the session tokens correctly. When it tries to reconnect or refresh the token, it sends an invalid/empty token, causing WhatsApp to reject it.

## 3. Comparison with Mama First (Freeze)
**Question:** Is this related to the "Mama First" freeze?
**Answer:** **No.**
- **Mama First** failed due to a `PrismaClientValidationError` (code bug) causing a crash loop.
- **Indorama** is failing due to **Network/Proxy Instability** (Instance 1) and **Session Conflict** (Instance 2).
- The logs for Indorama do *not* show the Prisma cache error.

## 4. Recommendations

### For Instance 1 (`6281110139189` - Sync)
1.  **Restart:** Disconnect and reconnect the instance to establish a fresh socket.
2.  **Proxy Check:** If using a proxy, verify its stability/latency. `ECONNRESET` often points here.
3.  **Monitor:** Watch logs for successful `Message` table inserts after reconnection.

### For Instance 2 (`628131069178` - Disconnect)
1.  **Delete & Recreate:** Instead of just scanning QR, **DELETE** the instance entirely from Evolution and create a new one. This ensures a fresh session ID and clears any corrupted state.
2.  **Verify Environment:** Ensure no other Evolution deployments (staging, dev) are running with this instance ID.
3.  **Network:** Ensure the phone has a stable internet connection.

## 5. Post-Restart Analysis (Dec 1, 03:05 UTC)
**Status:** Container restarted successfully at `03:05:06 UTC`.
**Observations from Logs (`logs_indorama.txt`):**
1.  **Instance 2 Changed:** The logs show a **new** instance connecting: `628131069189` (ID: `ce70e00f...`).
    - This replaces the problematic `628131069178` (ID: `48e6c232...`).
    - **Status:** Connected. Logs show `Update messages` and `Update readed messages`. No immediate disconnects observed in the short log window (13s).
    - **Potential Issue:** If Prospek settings (Instance ID/Token) were not updated to `ce70e00f...`, the integration will fail.
2.  **Instance 1 Missing:** The instance `6281110139189` (ID: `37298bd5...`) is **absent** from the startup logs captured.
    - **Risk:** It may not have started, or failed to initialize before the log capture began.
    - **Action:** Verify if this instance is visible in the Evolution UI.

**Conclusion:** The "still failing" report likely stems from:
- **Instance 1:** Not running (missing from logs).
- **Instance 2:** Configuration mismatch (new ID not updated in Prospek) OR transient sync issues not yet visible in short logs.

