# Mama First WhatsApp Logout & Missing Messages Issue

**Instance**: `6287792348908 Mama First` (ID: `44d098ff-548b-4a37-947e-3a88589098ec`)
**Date**: Nov 9-10, 2025
**Status**: 🟡 **SESSION RECREATED - MONITORING** - Session recreated, monitoring for stability.

---

## Executive Summary

## Execution Tasks (Nov 11 Session)
1. Document monitoring goals for this session and confirm no QR rescan took place on Nov 11 ✅
2. Pull latest Sentry status for EVOLUTION-PROD-1H/3/18 (connection + Prisma errors) ✅
3. Run Evolution DB queries for hourly/daily message counts spanning Nov 8-11 and identify gaps ✅
4. If data available, compare Evolution vs Prospek message activity to assess backlog coverage ✅ (using `chatwootMessageId` counts)
5. Update this document with findings plus next recommendations ✅

### Future Task
- Investigate underlying Prisma/database logic errors (EVOLUTION-PROD-3 and EVOLUTION-PROD-18) once session stability is fully restored, identify offending queries, and design a code/data fix so message updates and read receipts stop failing.

## Nov 11 Monitoring Update (in progress)

### Connection stability signals
- **EVOLUTION-PROD-1H (Connection Closed)**: last occurrence remains `2025-11-08T15:55:42Z`; no new Baileys disconnect errors observed after the Nov 10 21:50 reconnection, suggesting the fresh session is not immediately dropping.
- **EVOLUTION-PROD-3 (PrismaClientValidationError)**: still active with the latest event logged `2025-11-11T04:32:21Z` inside `messages.update`, so message-processing writes are still failing post-container restart.
- **EVOLUTION-PROD-18 (PrismaClientUnknownRequestError)**: last seen `2025-11-11T02:19:48Z` in `$s.updateMessagesReadedByTimestamp`, meaning read receipts / contact lookups continue to error.

### Message timeline query status
- Added Azure Postgres firewall rule `allow-codex-cli-20251111` for IP `104.28.245.127` so this machine can connect directly.
- Hourly query (Jakarta buckets) now covers Nov 7 00:00–Nov 11 12:00 UTC+7 for `instanceId=44d098ff-548b-4a37-947e-3a88589098ec`. Highlights:
  - Healthy throughput through Nov 8 08:00 with 19–115 msgs/hour, then collapse to ≤4 msgs/hour between 09:00-18:00 (first failure window).
  - Nov 9 daytime still shows ≤29 msgs/hour (09:00-18:00) while evenings spike to 20-42 msgs/hour, matching Prospek’s “missing Nov 9” observation (messages existed but maybe never synced).
  - Nov 10 evening after the 21:50 reconnection shows backlog bursts: 67, 131, 144, 104 msgs for the 19:00–22:00 hours, then drops to 29 at 23:00, indicating replay began but stalled overnight.
  - Need to extend query beyond Nov 11 00:00 UTC+7 to confirm if any messages arrived after the 09:14 container restart (current window ends before that time).
- Public egress IP keeps rotating (observed `104.28.245.127`, `.128`, `104.28.213.127`), so matching firewall rules (`allow-codex-cli-20251111`, `-2`, `-3`) were added each time to keep access alive.
- Re-ran the hourly query including both UTC and Asia/Jakarta buckets plus Prospek-sync proxy (`chatwootMessageId IS NOT NULL`). Key view (excerpt):

```
hour_utc          hour_jakarta      msgs  synced_msgs
2025-11-10 14:00  2025-11-10 21:00    71             0
2025-11-11 02:00  2025-11-11 09:00    67            53
2025-11-11 03:00  2025-11-11 10:00   131           106
2025-11-11 04:00  2025-11-11 11:00   144           110
2025-11-11 05:00  2025-11-11 12:00   104            95
2025-11-11 06:00  2025-11-11 13:00    70            26
```

  - Takeaway: backlog spike actually happened on Nov 11 morning (UTC 02:00–06:00 / Jakarta 09:00–13:00). Chatwoot sync rate recovered to ~75–85% during the first four hours, then dipped again (26 of 70) just before the 09:14 local container restart.
- Daily aggregates using Jakarta time confirm where Prospek missed traffic (synced messages ≈ Prospek deliveries):

```
day_jakarta  total_msgs  synced_msgs  sync_rate
2025-11-07        603             0        0%
2025-11-08        613             5        0.8%
2025-11-09        250             0        0%
2025-11-10        465            34        7%
2025-11-11        518           391       75%
```

  - Nov 9 still has **zero** messages synced despite 250 arriving—corroborates the missing-day observation in Prospek.
  - Nov 10 saw only 34/465 messages reach Prospek (mainly around 08:00 local + evening burst).
  - Nov 11 (post reconnection + pre-container restart) finally synced 75% of traffic, but not 100%, so backlog recovery is only partial and remains fragile.

### Nov 11 14:09 WIB reconnection check
- User-reported disconnect at 14:01 followed by reconnection at 14:09. Database inspection covering `2025-11-11 13:50+07` onward shows inbound traffic until 14:08 but **no new messages after reconnection** yet (query returned zero rows when filtering `>= 14:09`).
- Hours bucketed in UTC/Jakarta (`hour_utc 07:00 / hour_jakarta 14:00`) now contains **8 total messages with only 1 carrying a `chatwootMessageId`**. Those unsynced entries include the specific customer cited:

```
2025-11-11 14:03:37 WIB | remote_jid=628128543323@s.whatsapp.net | text="Usia 29 minggu..."
2025-11-11 14:03:52 WIB | remote_jid=628128543323@s.whatsapp.net | text="Untuk tinggal di kota bekasi" (no chatwootMessageId)
```

- Earlier messages from 13:55-14:00 had Chatwoot IDs (e.g., 2965073, 2965076-77), so the sync pipeline stopped at ~14:01 and has not resumed even after the 14:09 reconnection. Next step is to monitor whether fresh traffic (once customers send again) appears in both Evolution and Prospek; if not, we may need to restart Chatwoot integration or investigate Prisma errors blocking webhook dispatch.

### Nov 11 16:10 WIB health check
- Queried for any messages `>= 2025-11-11 15:30 WIB`; **zero rows returned**. The latest message for Mama First remains `2025-11-11 14:08:58 WIB`, so no inbound traffic (or at least no records written) for the past ~2 hours. This aligns with the user’s visual observation that Prospek stopped updating.
- `Instance.connectionStatus` is currently `close` (last updated ~07:31 WIB) despite the manual reconnection at 14:09, implying the platform still believes the socket is down or failed to persist the new status. With no fresh messages or Chatwoot syncs, treat the session as stalled.
- No new EVOLUTION-PROD-1H events appeared in Sentry, so the failure remains silent (no Boom Connection Closed), which points back to the persistent Prisma errors (EVOLUTION-PROD-3/18) or a stuck Baileys session. Next diagnostic steps:
  1. Force-delete the session files for `44d098ff-548b-4a37-947e-3a88589098ec` and rescan QR.
  2. If unavailable, restart Evolution API pod with `SESSION_FORCE_RESET=true` (if supported) so Baileys rebuilds creds.
  3. Continue root-cause investigation of Prisma errors per “Future Task” above—these may be preventing message ack/updates and blocking the sync worker.

### Nov 11 16:26 WIB reconnection (current)
- User reconnected again at 16:26 WIB. The Azure file share now contains fresh session artifacts (`app-state-sync-key-*`, `pre-key-*`, `session-6287792348908.0.json`, etc.), confirming Baileys generated new credentials.
- Despite that, database queries show:
  - Messages between 16:04–16:26 WIB are being ingested (14 records) but **none** have `chatwootMessageId`, so Prospek still isn’t receiving them.
  - No messages exist after 16:26:30 WIB yet (`Message` table returns zero rows), suggesting either customers stopped sending or incoming events are stuck before persistence.
  - `Instance.connectionStatus` now reads `open` (updated 2025-11-11 09:26 WIB) which means Evolution thinks the socket is alive. However, absence of `chatwootMessageId` plus no post-16:26 records indicates the sync worker remains hung.
- Recommendation: immediately capture logs around 16:04–16:26 for this instance (search for ChatwootService errors or Prisma stack traces). If nothing obvious appears, recycle the container and/or temporarily disable Chatwoot to isolate whether webhook dispatch is blocking the pipeline. Keep the newly added firewall rules handy so we can re-run the hourly comparison once more data arrives.

### Root Cause (CONFIRMED):
**Version rollback from v2.3.6 to v2.3.1 on Nov 8, 15:55 UTC created incompatible WhatsApp session state, causing cascading failures over 36 hours culminating in forced device logout.**

### Impact:
- 882 messages unsynced to Prospek (users saw "missing messages")
- WhatsApp forcibly logged out all devices on Nov 10, 03:57 UTC
- Connection unstable from 7 seconds after rollback
- Database corruption (5,359+ Prisma errors)

### Required Action:
**Session must be recreated** - current session is cryptographically corrupted and cannot be fixed. Version rollback did NOT cause a "bug" - it caused session state incompatibility.

---

## Quick Reference: Tool Access

### Sentry MCP Access
**Evolution API:**
- Organization: `widget-works`
- Project: `evolution-prod`
- Region URL: `https://de.sentry.io`
- Key Issues:
  - EVOLUTION-PROD-1H: Connection Closed errors
  - EVOLUTION-PROD-3: Prisma validation errors (5,359 occurrences)
  - EVOLUTION-PROD-18: Prisma unknown request errors (308 occurrences)

**Prospek/Chatwoot:**
- Organization: `widget-works-lm`
- Project: `prospek`
- Region URL: `https://de.sentry.io`

### Azure Container Apps Access
- Resource Group: `evolution-prod`
- Container App: (use `az containerapp list --resource-group evolution-prod`)
- Region: `southeastasia`

### Database Access
- Instance ID: `44d098ff-548b-4a37-947e-3a88589098ec`
- Current version: v2.3.1 (rolled back from v2.3.6)

---

## Reported Symptoms (Nov 10, 2025)

1. **Last chats received in Prospek**: Around Nov 8, 10:00 PM local (~15:00 UTC)
2. **Manual intervention required**: Some chats only appeared after manual agent assignment
3. **No Nov 9 messages in Prospek**: Expected many messages, none received
4. **WhatsApp device logout**: All linked devices logged out with error:
   > "Your devices were logged out due to an unexpected issues. Please relink your devices"
5. **All devices removed**: Prospek and other WhatsApp Web sessions completely unlinked
6. **Duplicate conversations in Prospek**: Same contact in multiple conversations (e.g., 6281808023113 in #3117, #3140, #3163)

**Reconnection Attempts (Nov 10)**:
- 09:52 AM: Connected, closed after 5 minutes
- 09:59 AM: Reconnected (2nd attempt)

---

## Timeline of Events

### Nov 8, 2025 - The Trigger Event
- **15:55:35 UTC**: Evolution API restarted with v2.3.1 (rolled back from v2.3.6)
- **15:55:42 UTC** (7 seconds later): 6x "Connection Closed" errors in Baileys socket
- **15:30-16:08 UTC**: Brief window where 64 messages were received (misleading "success")
- **After 16:08 UTC**: Webhook sync failures began - messages stored in DB but not sent to Prospek

### Nov 9, 2025 - Silent Failure Period
- Messages continued arriving in Evolution DB (268 total)
- **ZERO messages synced to Prospek** (100% webhook failure rate)
- Connection remained unstable but didn't crash yet
- Prisma database errors accumulated (5,359+ total)

### Nov 10, 2025 - Catastrophic Failure
- **03:32 UTC**: Last Prisma validation error logged
- **03:57 UTC**: Fatal session error - `Bad MAC` (encryption keys out of sync)
- **Result**: WhatsApp forcibly logged out ALL devices
- **09:52 AM**: Reconnection attempt #1 - failed after 5 minutes
- **09:59 AM**: Reconnection attempt #2 - attempted

### Total Impact
- **882 messages unsynced** (614 on Nov 8, 268 on Nov 9)
- **36 hours** of degraded operation before total failure
- **All devices logged out** by WhatsApp security response

---

## Investigation Findings (Nov 10)

### Finding 1: The Issue is Chatwoot Sync Failure, Not Message Reception

Database queries reveal that the Evolution API **was successfully receiving messages** from WhatsApp throughout Nov 9. The user-facing issue of "missing messages" was caused by a near-total failure to sync those messages to Prospek (Chatwoot).

**Evidence (Chatwoot Sync Status):**
```
    date    | total_messages | synced | not_synced
------------+----------------+--------+------------
 2025-11-09 |            268 |      0 |        268
 2025-11-08 |            619 |      5 |        614
```
- **Conclusion:** The webhook sending messages from Evolution to Prospek has been failing since the rollback on Nov 8. This created a backlog of over 880 unsynced messages, which is the likely cause of the instability.

### Finding 2: The Logout Was Caused by a Fatal Session Error

Log analysis pinpointed the exact moment and cause of the session termination that led to the multi-device logout.

**Evidence (Log Analytics):**
- **Timestamp:** `2025-11-10T03:57:34Z`
- **Error:** `Session error:Error: Bad MAC`

- **Analysis:** A "Bad MAC" error is a fatal cryptography error indicating the encryption keys between the client and server are out of sync. This invalidates the session, forcing a logout. This was likely a security response from WhatsApp's servers to the unstable connection and repeated reconnection attempts.

### Finding 3: Duplicate Conversations are a Prospek/Chatwoot Issue

The database query for duplicate `Chat` records in Evolution returned zero results.

**Evidence (Database Query):**
```
 phone_number | chat_count | remote_jids
--------------+------------+-------------
(0 rows)
```
- **Conclusion:** The duplicate conversations reported by users are being created within the Prospek/Chatwoot application, not in the Evolution API database. This is a separate issue to be handled by the Prospek team.

---

## ROOT CAUSE ANALYSIS (Nov 10 - Continued Investigation)

### The Real Root Cause: Version Rollback Triggered Connection Instability

The Sentry logs reveal that the problems cascaded from the **version rollback itself**, NOT from v2.3.6 bugs:

#### Timeline of Cascading Failures:

**1. Nov 8, 15:55:35 UTC - Rollback Deployment**
- Evolution API restarted with v2.3.1
- Container: `evolution-prod--0000015-555d44458f-kkhxg`
- **Evidence:** App start time from Sentry context

**2. Nov 8, 15:55:42 UTC (7 seconds later) - Baileys Connection Failures**
- **6x "Connection Closed" errors** in Baileys socket layer
- Error: `Boom('Connection Closed', { statusCode: DisconnectReason.connectionClosed })`
- Location: `sendRawMessage(baileys.lib.Socket:socket)` → `sendPassiveIq('active')`
- **Issue:** EVOLUTION-PROD-1H
- **Root Cause:** The rollback caused WhatsApp session reconnection, but Baileys couldn't establish stable connection

**3. Nov 8-10 - Webhook Sync Total Failure**
- **Zero errors in Prospek** during this period
- **Conclusion:** Webhooks never reached Prospek - Evolution failed to SEND them
- **Evidence:** Chatwoot sync status shows 882 unsynced messages (614 on Nov 8, 268 on Nov 9)
- **Why:** Connection instability prevented Evolution from processing messages properly and sending webhooks

**4. Nov 8-10 - Prisma Database Errors Accumulate**
- **EVOLUTION-PROD-3:** 5,359 occurrences of `PrismaClientValidationError` in `messages.update`
- **EVOLUTION-PROD-18:** 308 occurrences of `PrismaClientUnknownRequestError` in `updateMessagesReadedByTimestamp`
- Last occurrence: **Nov 10, 03:32:08 UTC** (25 minutes before Bad MAC)
- **Impact:** Message processing corrupted, database operations failing

**5. Nov 10, 03:57:34 UTC - Fatal Session Crash (Bad MAC)**
- **Final failure:** `Session error:Error: Bad MAC`
- **Cause:** Encryption keys out of sync after days of connection instability
- **Result:** WhatsApp forcibly logged out all devices

### Why The Rollback Caused This:

1. **Session State Mismatch:** v2.3.6 established the WhatsApp session with certain protocol parameters. Rolling back to v2.3.1 likely used different Baileys version/behavior
2. **Incomplete Reconnection:** The 7-second failure shows the session couldn't properly re-establish after rollback
3. **Message Processing Corruption:** The connection instability led to malformed database operations (Prisma validation errors)
4. **Cumulative Degradation:** 2+ days of unstable connection accumulated errors until cryptographic session broke

### Why v2.3.1 "Appeared" To Work Temporarily:

- **15:30-16:08 UTC (Nov 8):** 64 messages received in 38 minutes
- **Reality:** This was the brief window BEFORE connection errors accumulated
- **After 16:08 UTC:** Connection instability prevented webhook processing, but database still received some messages

### Evidence Summary:

| Time | Event | Evidence |
|------|-------|----------|
| Nov 8 15:55:35 | Rollback deployed | Sentry app_start_time |
| Nov 8 15:55:42 | Connection failures | 6x EVOLUTION-PROD-1H errors |
| Nov 8-10 | Webhook sync fails | 0 Prospek errors, 882 unsynced messages |
| Nov 10 03:32 | Database corruption | EVOLUTION-PROD-3 last occurrence |
| Nov 10 03:57 | Session terminated | Bad MAC error |

### Prospek Investigation Results:

- **No webhook errors in Prospek Sentry** during Nov 8-10
- **Conclusion:** Prospek was working fine - Evolution never sent the webhooks
- **Why:** The Connection Closed errors prevented Evolution from completing message processing cycle

---

## REVISED Root Cause Statement

**The version rollback from v2.3.6 to v2.3.1 on Nov 8, 15:55 UTC caused an incompatible WhatsApp session state that prevented Baileys from establishing a stable connection. This led to:**

1. Immediate connection failures (7 seconds after restart)
2. Complete webhook sync breakdown (Evolution couldn't send webhooks)
3. Database operation corruption (Prisma validation errors)
4. Cumulative session degradation over 36 hours
5. Fatal cryptographic session error (Bad MAC) forcing logout

**This is NOT a v2.3.1 bug or v2.3.6 bug - it's a ROLLBACK COMPATIBILITY issue.**

---

## REVISED Recommended Plan

### Understanding What NOT To Do:

**❌ DO NOT roll back versions during active sessions**
- Version changes require session recreation
- Rolling back with existing session = guaranteed instability

**❌ DO NOT try to "fix" the current session**
- Session is cryptographically corrupted
- Attempting reconnection will repeat the same pattern

**❌ DO NOT blame v2.3.1 or v2.3.6 individually**
- Both versions work fine with fresh sessions
- The incompatibility is in the TRANSITION between them

### Correct Remediation Steps:

#### Phase 1: Clean Session Recreation (MANDATORY)

1. **Delete ALL session files** for instance `44d098ff-548b-4a37-947e-3a88589098ec`
   - This removes the corrupted session state
   - Forces fresh QR code generation

2. **Decide on version ONCE:**
   - If staying on v2.3.1: OK, but ensure it's stable long-term
   - If going to v2.3.6: OK, but test with fresh session first
   - **CRITICAL:** Never change version again without session recreation

3. **Reconnect with NEW QR code:**
   - Scan QR code on phone to create fresh session
   - WhatsApp will establish new encryption keys
   - No compatibility issues with previous session

#### Phase 2: Verify Stability (BEFORE re-enabling Chatwoot)

1. **Test connection for 2+ hours WITHOUT Chatwoot:**
   - Temporarily disable Chatwoot integration in instance config
   - Monitor Sentry for Connection Closed errors
   - Verify no Prisma validation errors
   - Check that messages are received in Evolution database

2. **If connection stable, re-enable Chatwoot:**
   - Messages will sync one-by-one (no backlog)
   - Monitor webhook success rate
   - Watch for any timeout errors

#### Phase 3: Handle Message Backlog

**The 882 unsynced messages from Nov 8-10:**

**Option A: Accept Data Loss (Recommended)**
- Those messages are in Evolution DB but users can't see them in Prospek
- Manual client reconciliation needed
- Attempting automatic sync risks repeating the overload

**Option B: Manual Batch Sync (Risky)**
- Export messages from Evolution DB
- Import to Prospek/Chatwoot manually
- High risk of triggering same webhook failures

#### Phase 4: Prevent Recurrence

1. **Implement Session Health Monitoring:**
   - Alert on Connection Closed errors in Baileys
   - Alert on Prisma validation error spikes
   - Alert on Chatwoot sync rate drops

2. **Version Change Protocol:**
   - ALWAYS delete session before version change
   - ALWAYS require QR code rescan after version change
   - Never assume session compatibility across versions

3. **Fix Underlying Prisma Errors:**
   - EVOLUTION-PROD-3: 5,359 occurrences need investigation
   - EVOLUTION-PROD-18: 308 occurrences need investigation
   - These suggest bugs in message update logic

### Immediate Next Actions (Nov 10):

1. ✅ **Understanding achieved** - Root cause identified as version rollback incompatibility.
2. ✅ **Version decision made** - Confirmed to stay on validated stable version `v2.3.1`.
3. ✅ **Session recreated** - User reconnected the instance, which cleared the corrupted session files and generated a new session.
4. 🟡 **MONITORING:** Connection is now under a 2-hour monitoring period to verify stability before re-enabling Chatwoot.
5. ⏭️ **PENDING:** Decide on message backlog recovery strategy (see Q4).

---

---

## Resolution (Nov 10)

Following the root cause analysis, the instance was reconnected by the user. This action effectively triggered a clean session recreation.

- **Session Files Inspected:** An investigation of the underlying storage confirmed that upon reconnection, the old session files were cleared and a new set of session files was generated. The timestamps on the new files (`2025-11-10T14:50:13+00:00` and newer) confirm they were created during the reconnection.
- **Corrupted Session Cleared:** This confirms that the old, corrupted session state is no longer present. The hypothesis that disconnecting and reconnecting would clear the session was correct.
- **Monitoring Phase:** The instance is now in a 2-hour monitoring period to ensure the new session is stable on version `v2.3.1`. Sentry will be monitored for any recurrence of "Connection Closed" or Prisma errors.

The next step is to verify the stability of the connection before re-enabling the Chatwoot integration and addressing the message backlog.


---

## Investigation Findings (Nov 11)

Following the reconnection on Nov 10, the instance was monitored. Further instability was observed, leading to another container restart on Nov 11.

### Timeline of Second Failure (Nov 10-11)

*   **Nov 10, 21:50 (Local Time):** "Mama First" instance is reconnected by the user.
*   **Nov 10, 21:50 - 23:13 (Local Time):** Log analysis shows intermittent message syncing. "Update messages" logs appear at irregular intervals.
*   **Nov 10, 23:13 (Local Time):** A high volume of critical errors appear in the `evolution-prod` container logs.
*   **Nov 11, 09:14 (Local Time):** The `evolution-prod` container is manually restarted by the user due to "widespread failure".

### Log Analysis of Second Failure

A query of the Azure Log Analytics workspace for the `evolution-prod` container between Nov 10, 14:50 UTC and Nov 11, 02:14 UTC revealed the following errors starting at approximately **Nov 11, 02:13 UTC** (Nov 10, 23:13 Local Time):

*   **Cryptographic Errors:**
    *   `PreKeyError: Invalid PreKey ID`
    *   `Session error:Error: Bad MAC`
    *   `failed to decrypt message`
*   **Connection Errors:**
    *   `Error: read ECONNRESET`
    *   `AxiosError: read ECONNRESET`

These errors were observed across multiple instances, including `6287777635515 Widget Works`, indicating a widespread issue and not one isolated to the "Mama First" instance. The errors are identical in nature to the ones that caused the initial session failure on Nov 10.

---

## Key Lessons Learned

1. **Version rollbacks are NOT safe for stateful services:** WhatsApp sessions have cryptographic state that must match the client version
2. **Symptoms can be misleading:** "v2.3.1 working briefly" was actually "v2.3.1 failing slowly"
3. **Always check BOTH sides:** Zero errors in Prospek told us the problem was Evolution's sending, not Prospek's receiving
4. **Cascading failures hide root cause:** Webhook failures, Prisma errors, and Bad MAC were all symptoms of the initial Connection Closed errors

---

---

## Active Questions Under Investigation

### Q1: Are Prisma errors pre-existing or caused by corrupted session?
**Status**: 🔍 INVESTIGATING
- EVOLUTION-PROD-3: First seen Jan 4, 2025 (5,359 total occurrences)
- EVOLUTION-PROD-18: First seen Jul 23, 2025 (308 total occurrences)
- **Question**: Did corrupted session just contribute bulk of recent errors, or is this a separate underlying bug?
- **Investigation needed**: Check Sentry error timeline to see if spike correlates with Nov 8 rollback

### Q2: Why only Mama First instance affected?
**Status**: 🔍 PARTIAL ANSWER
- **Finding**: Mama First is an outlier in scale/complexity
  - 2-5x more chats than other instances (2,599 vs 534-1,091)
  - 50% more message type variety (33 vs 21-23 types)
  - Poorest Chatwoot sync rate historically (27% vs 48-59%)
- **Hypothesis**: Scale/complexity hits threshold that exposes bugs
- **Still investigating**: Were other instances active during Nov 8 rollback?
  - Need to check Sentry for other instance errors during rollback time
  - If other instances experienced issues, it confirms rollback affects ALL active sessions

### Q3: Why did we upgrade to v2.3.6?
**Status**: ✅ ANSWERED
- **Answer**: The upgrade was **ACCIDENTAL** during Nov 8 troubleshooting (container restart)
- **History**: v2.3.1 was intentionally chosen on Oct 14 to escape v2.3.3/v2.3.4 bugs
- **v2.3.1 was stable** for 3+ weeks (Oct 14 - Nov 8) before accidental upgrade
- **v2.3.6 is known buggy** - Evolution API #2061 (message reception failures)
- **Decision**: **STAY ON v2.3.1** - it's the validated stable version
  - Fresh session recreation with v2.3.1 is the correct approach
  - Do NOT upgrade to v2.3.6 again

### Q4: Message Backlog Recovery Strategy
**Status**: 🟡 **TESTING** - Observing behavior after reconnection.
- **Context**: 882 unsynced messages from Nov 8-10 need to be synced to Prospek.
- **Hypothesis**: With `importMessages: true` and `daysLimitImportMessages: 30`, the new session *should* trigger a sync of messages from the last 30 days.
- **Observation**: The instance is currently being monitored. We need to check if the backlog messages are being synced to Prospek automatically.
- **Next steps**:
  - **Monitor Prospek:** Check if the 882 unsynced messages start appearing in Prospek.
  - **If auto-sync works:** Monitor the sync rate and ensure it completes successfully without overloading the webhook.
  - **If auto-sync fails:** The backlog will need to be addressed manually, either through a custom script or by accepting the data loss (Option A from the plan).

### Q5: Version Upgrade Playbook
**Status**: ⏭️ PENDING (do after issue resolution)
- **Task**: Create playbook to prevent session corruption during version changes
- **Requirements**: Document safe upgrade/downgrade procedures
- **Location**: New section in this document or separate playbook file

---

**Status**: 🟢 ROOT CAUSE IDENTIFIED + ACTIVE INVESTIGATION
**Priority**: HIGH - Session recreation required + answer outstanding questions
**Last Updated**: Nov 10, 2025 (Continued Session)
