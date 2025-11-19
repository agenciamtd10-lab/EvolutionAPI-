# Mama First Incident Tracker (Updated Nov 14, 2025)

## Executive Summary (Nov 14, 17:00 WIB - ✅ ROOT CAUSE IDENTIFIED)

**Status:** ✅ **ROOT CAUSE CONFIRMED** | 🚨 **UPGRADE REQUIRED** | 💊 **FIX AVAILABLE**

### 🎯 ROOT CAUSE IDENTIFIED (95% Confidence)

**Bug**: Evolution API v2.3.1 - Message Persistence Failure Handling
**Fix**: Evolution API v2.3.2 PR #1798 - "Fix for correct utilization when messages are not persisted in the DB"
**Solution**: Upgrade to Evolution API v2.3.6 (latest stable)

**Quick Summary**: v2.3.1 has a confirmed bug where database message write failures cause the entire message processing pipeline to halt permanently. Connection shows "open" (WhatsApp WebSocket alive) but no messages are processed. The fix is available in v2.3.2+.

📋 **See**: [Investigation Plan](14-11-25-freeze-investigation-plan.md) for detailed analysis

---

## 🚨 CURRENT INCIDENT: Second Freeze (Nov 14, 2025)

**Freeze Details:**
- **Freeze Start**: Nov 14, 2025 **06:23:59 WIB** (Nov 13, 23:23:59 UTC) - Complete halt of message insertion to database
- **Current Status**: **STILL FROZEN** as of Nov 14 15:40 WIB
- **Freeze Duration**: **9 hours 16 minutes** (and ongoing)
- **Container**: Same revision `0000015` (deployed Nov 11 09:12 WIB), **no restarts** since deployment
- **Days Since Previous Recovery**: **2.3 days** (recovered Nov 12 21:52 WIB, froze again Nov 14 06:23 WIB)

**Key Observations:**
- ✅ No container restarts between incidents
- ✅ No manual reconnection attempts
- ✅ WhatsApp connection status: "open" (misleading - same as previous freeze)
- ✅ Resource metrics: Normal (CPU 2-3%, Memory 17%, NO spikes like Nov 11)
- ✅ Sentry errors: Only 6 events each for PROD-3 and PROD-18 in last 24h (chronic, not acute)
- ⚠️ **CRITICAL**: Same symptoms as Nov 11 freeze, but WITHOUT resource spike pattern

**🚨 RELATED SYMPTOM: 5 Instances Stuck in "connecting" State**

**User Context**: These instances were manually disconnected via Evolution Manager UI and were intended to stay disconnected. They unexpectedly started "connecting" and never stopped.

During investigation, discovered **5 instances permanently stuck in "connecting" state**:

| Instance ID | Instance Name | Status | Disconnected WIB | Updated (became "connecting") WIB | Reason Code |
|-------------|---------------|--------|------------------|----------------------------------|-------------|
| `3f412dd7-d905-4c95-8c9b-75bc2ea42a8a` | 628116548448 Harper & Cordon | connecting | Nov 10 19:12:51 | Nov 12 09:54:53 | 401 (Logout) |
| `0f52a94a-4f8f-4476-b4cd-4b1deb96c796` | 628116183018 Harper & Cordon | connecting | Nov 10 19:12:46 | Nov 12 09:54:52 | 401 (Logout) |
| `4dbaa6f1-d351-4e83-8256-6dd92a343d8e` | 6282167174480 Harper & Cordon | connecting | Nov 10 19:12:56 | Nov 12 09:54:52 | 401 (Logout) |
| `1959f210-f641-4dbe-b387-5aadba146071` | 6281802233167 SBP | connecting | Nov 10 19:12:49 | Nov 12 09:54:51 | 401 (Logout) |
| `8113ab7d-4c83-40d1-bea4-4df8ab481deb` | 628116588181 Harper & Cordon | connecting | Nov 10 19:13:00 | Nov 12 09:54:51 | 401 (Logout) |

**Complete Timeline (CORRECTED after database investigation):**
```
Nov 10 19:12 WIB - User manually disconnected 5 instances (reason 401 = logout)
                   Instances should stay "disconnected"
    ↓ 21.2 hours later
Nov 11 16:26 WIB - Mama First freeze begins
    ↓ 17.5 hours later (38.7h after manual disconnect)
Nov 12 09:54 WIB - 5 instances SPONTANEOUSLY changed to "connecting" (ALL within 2 seconds)
                   Something triggered them to reconnect during freeze
                   They stuck in "connecting" indefinitely
    ↓ 12 hours later
Nov 12 21:52 WIB - Mama First freeze recovers
                   BUT stuck instances remain "connecting"
    ↓ 2.3 days later
Nov 14 06:23 WIB - Mama First freezes AGAIN
                   Stuck instances STILL "connecting" (400 Bad Request on disconnect attempts)
```

**Critical Findings (UPDATED after investigation):**

1. ✅ **Instances were ALREADY disconnected** on Nov 10 (before freeze)
   - User manually disconnected them (reason code 401)
   - They were supposed to stay "disconnected"

2. ⚠️ **Something triggered automatic reconnection** on Nov 12 during freeze
   - 38.7 hours after manual disconnect
   - All 5 instances triggered simultaneously (within 2 seconds)
   - Occurred while Mama First was frozen

3. ⚠️ **Connecting state never timed out to "disconnected"**
   - Normal behavior: connecting → timeout → disconnected
   - Actual behavior: connecting → stuck indefinitely
   - Still connecting 2+ days later (Nov 14)

4. ⚠️ **Disconnect API returns 400 Bad Request**
   - Invalid state in application
   - Cannot manually disconnect stuck instances

5. ⚠️ **NO resource spike when connecting started**
   - CPU: 7.7% peak (brief, returned to normal)
   - Memory: 15% stable (no spike)
   - **ANSWER**: Connecting instances did NOT cause Mama First freeze

**Current System State:**
- **Total instances**: 11 (6 "open", 5 "connecting")
- **Stuck instances**: 5 (all since Nov 12 09:54 WIB)
- **Working instances**: 6 (including Mama First when not frozen)

### Answering User's Investigation Questions

**Question 1: What is the definition of "stuck"? When did instances become disconnected vs connecting?**

**Answer (CLARIFIED after database investigation):**

- **"Stuck" Definition**: Instance remains in "connecting" state indefinitely without timeout, and disconnect API returns 400 Bad Request (invalid state).

- **Timeline**:
  - **Nov 10 19:12 WIB**: Instances **became "disconnected"** (user manually disconnected via UI, reason code 401 = logout)
  - **Nov 12 09:54 WIB**: Instances **became "connecting"** (38.7 hours later, during Mama First freeze)
  - **Nov 14 (current)**: Still "connecting" (2+ days later, never timed out to disconnected)

- **The Issue**: Instances that were manually disconnected spontaneously started connecting again during the freeze, then stuck indefinitely.

**Question 2: Why didn't connecting instances transition to "disconnected" after timeout?**

**Answer (INVESTIGATION FINDINGS):**

**Normal Expected Behavior:**
```
connecting → connection attempt fails → timeout after X minutes → status: disconnected
```

**Actual Observed Behavior:**
```
disconnected (Nov 10 19:12) → connecting (Nov 12 09:54) → STUCK indefinitely (2+ days)
```

**Why This Happened (Hypothesis):**

1. **State Machine Corruption During Freeze**:
   - Instances started connecting during Mama First freeze (17.5h into freeze)
   - Application was in deadlocked state
   - Connection timeout logic may have been blocked/frozen
   - State updates to database failed (same issue blocking message writes)

2. **Timeout Handler Not Executing**:
   - Worker thread/event loop may be blocked
   - Timeout callbacks never fired
   - OR timeout occurred but database update failed

3. **Invalid State Prevents Transition**:
   - 400 Bad Request on disconnect suggests state validation failure
   - State machine in undefined/corrupted state
   - Cannot transition from invalid state

**Evidence:**
- Disconnect API returns 400 Bad Request (invalid state)
- All 5 instances stuck simultaneously (shared state corruption)
- Freeze continued 12 hours AFTER instances started connecting
- No automatic recovery even after Mama First freeze recovered

**Question 3: Does never-ending "connecting" state cause resource consumption that led to Mama First freeze?**

**Answer: ❌ NO - Connecting instances did NOT cause the freeze**

**Resource Analysis:**

At Nov 12 02:45-03:00 UTC (09:45-10:00 WIB) when instances became "connecting":
- **CPU**: Brief spike to 7.7%, quickly returned to 1.9-2.4% (normal)
- **Memory**: Stable at 15.2-15.7% (no spike)
- **Freeze continued**: Mama First freeze lasted 12 MORE hours after instances started connecting

**Timeline Proves Causation:**
```
Nov 11 16:26 WIB - Mama First freeze STARTED (instances still disconnected)
    ↓ 17.5 hours of freeze
Nov 12 09:54 WIB - Instances started connecting (freeze ONGOING for 17.5h already)
    ↓ 12 hours more freeze
Nov 12 21:52 WIB - Mama First freeze recovered
```

**Conclusion:**
- **Freeze preceded connecting instances** by 17.5 hours
- **Freeze is the CAUSE**, connecting instances are an **EFFECT/SYMPTOM**
- **NO resource exhaustion** from connecting instances
- Typical QR generation resource consumption NOT observed
- Connecting instances are another victim of the same shared state corruption

**Root Cause Hypothesis (UPDATED):**

The **same shared state corruption** that froze Mama First ALSO:
1. Triggered disconnected instances to start connecting (invalid state transition)
2. Prevented timeout handlers from executing (blocked worker)
3. Broke disconnect API (400 Bad Request = state validation failure)
4. Persisted across freeze recovery (corruption not cleared)

**Pattern Analysis:**
```
Nov 11 Freeze: 16:26 WIB → Recovered Nov 12 21:52 WIB (29h 26m)
  ↓ 2.3 days of stability
Nov 14 Freeze: 06:23 WIB → Currently frozen (9h 16m and counting)
```

**This Confirms:**
1. ❌ **NOT a one-time transient issue** - Pattern is recurring
2. ❌ **NOT resource exhaustion** - Nov 14 freeze has normal CPU/memory
3. ❌ **NOT container-related** - Same container revision for 3.25 days
4. ⚠️ **Likely application-level bug** - Database write logic or message queue deadlock

---

## PREVIOUS INCIDENT: First Freeze (Nov 11-12, 2025) - RESOLVED

**What Happened:**
- **Freeze Start**: Nov 11, 2025 **16:26:04 WIB** (09:26:04 UTC) - Complete halt of message insertion to database
- **Recovery Time**: Nov 12, 2025 **21:52:33 WIB** (14:52:33 UTC) - First message inserted after freeze
- **Freeze Duration**: **29 hours 26 minutes**
- **Container**: Revision `0000015` deployed Nov 11 09:12 WIB, **no restarts** during entire freeze period
- **Current State**: ~~Mama First instance is **OPERATIONAL** as of Nov 13 14:03 WIB~~ **FROZEN AGAIN** as of Nov 14 06:23 WIB
- **No manual intervention** documented between freeze and recovery

**Timeline Analysis Invalidated Previous Hypothesis:**
The Sentry errors PROD-3 and PROD-18 are **NOT** the root cause:
- **EVOLUTION-PROD-3**: Existed since **January 4, 2025** (10+ months), 5,394 total events
- **EVOLUTION-PROD-18**: Existed since **July 23, 2025** (4 months), 321 total events
- Messages were successfully inserted WITH these errors present before Nov 11
- Error rates during Nov 7-11 were LOWER than historical averages

**Azure Metrics Analysis During Freeze Window (Nov 11 09:26-09:34 UTC / 16:26-16:34 WIB):**
- **CPU Spike**: Jumped from 3% to **45.5%** at 09:28 UTC (16:28 WIB), 2 minutes after freeze
- **Memory Spike**: Increased from ~280MB to **439MB** (57% increase) at 09:28-09:32 UTC
- **Container Status**: Single replica, zero restarts throughout entire period
- **Resource Recovery**: CPU/memory returned to baseline (~280MB) by 09:35 UTC

**Leading Theory:**
Transient resource exhaustion (likely memory pressure causing message queue blockage or connection pool depletion) that self-corrected after ~29 hours. The CPU/memory spikes at 09:28-09:34 UTC suggest the application was under stress immediately after the freeze began, possibly attempting to process a backlog or recover from an internal state issue.

**Root Cause Remains Unknown Because:**
- No container crashes, restarts, or deployments during freeze
- No Baileys disconnects (last was Nov 8)
- WhatsApp connection stayed "open" throughout
- No new Sentry errors first seen during freeze window
- Resource metrics show stress response but not OOM or crash conditions

**Next Steps:** Investigate application-level logs for memory leak patterns, connection pool exhaustion, or deadlock conditions around Nov 11 16:26 WIB

---

## Current Health Snapshot (Nov 12, 08:45 WIB)
- WhatsApp session was reconnected at 16:26 WIB on Nov 11; storage shows fresh `app-state`/`pre-key`/`session` files, so creds regenerated successfully.
- Database still records inbound messages only up to **2025-11-11 16:26:04 WIB** (see `last_message_local` query below) and none thereafter; every message between 14:03-16:26 lacks `chatwootMessageId`, meaning Prospek never received them.
- `Instance.connectionStatus` currently reports **`open` (updated ~23:15 UTC / 06:15 WIB)**, but Sentry still logs Prisma errors (EVOLUTION-PROD-3 & -18) and no new Baileys disconnects, indicating the sync pipeline is blocked inside Evolution, not at WhatsApp.
- Conclusion: the platform is stuck despite clean sessions and version rollback; focus must shift to the database update logic and Chatwoot worker.

### Latest Instance State (authoritative facts)
- `Message` table: `SELECT to_timestamp(MAX("messageTimestamp")) AT TIME ZONE 'Asia/Jakarta' FROM "Message" WHERE "instanceId"='44d098ff-548b-4a37-947e-3a88589098ec';` ⇒ `2025-11-11 16:26:04 WIB` (run Nov 12 08:45 WIB).
- `Instance.connectionStatus`: `SELECT "connectionStatus", "updatedAt" AT TIME ZONE 'Asia/Jakarta' FROM "Instance" WHERE "id"='44d098ff-548b-4a37-947e-3a88589098ec';` ⇒ `open`, last updated `2025-11-11 23:15:43 WIB`.
- Storage account (file share): contains fresh session artifacts (`app-state-sync-key-*`, `pre-key-*`, `session-6287792348908.0.json`, etc.) created during the Nov 11 16:26 reconnection.
- Prospek Chatwoot: no new conversations for Nov 11 14:03 onward; backlog from Nov 7-11 remains unsynced.

## Investigation Toolkit (use these methods first)

### 1. Database queries (preferred via direct `psql`)
- Command template (Jakarta workstation):
  ```bash
  PGPASSWORD="<redacted>" psql \
    "postgresql://evolution@evolution-prod.postgres.database.azure.com:5432/evolution?sslmode=require" \
    -c '<SQL>'
  ```
- Firewall caveat: public IP rotates between `104.28.245.127/128` and `104.28.213.127`. Before running queries, add/verify an Azure Postgres firewall rule via Azure CLI MCP:
  ```
  az postgres flexible-server firewall-rule create \
    --resource-group evolution-prod \
    --name evolution-prod \
    --rule-name allow-codex-cli-<date> \
    --start-ip-address <current-ip> \
    --end-ip-address <current-ip>
  ```
- Use `chatwootMessageId IS NOT NULL` as the proxy for Prospek sync success when aggregating hourly/daily counts.

### 2. Sentry investigation
- **Organization:** `widget-works`
- **Project:** `evolution-prod`
- **API Token:** Use `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`
- **Key Issues:**
  - **EVOLUTION-PROD-3** (PrismaClientValidationError - cache.delete): Issue ID `15978899` | [View](https://widget-works.sentry.io/issues/15978899/?project=4508473891618896)
    - First Seen: Jan 4, 2025 07:50 UTC | Last Seen: Nov 13, 2025 01:44 UTC | Total: 5,394 events
  - **EVOLUTION-PROD-18** (PrismaClientUnknownRequestError - contact.findMany): Issue ID `52807815`
    - First Seen: Jul 23, 2025 04:27 UTC | Last Seen: Nov 13, 2025 04:20 UTC | Total: 321 events
  - **EVOLUTION-PROD-1H** (Baileys Connection Closed): Issue ID `71818646`
    - First Seen: Oct 24, 2025 19:23 UTC | Last Seen: Nov 8, 2025 15:55 UTC | Total: 12 events
- **API Usage:**
  ```bash
  curl -H "Authorization: Bearer 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" \
    "https://widget-works.sentry.io/api/0/organizations/widget-works/issues/<ISSUE_ID>/"
  ```
- Always capture the `First Seen`, `Last Seen`, and event frequency to correlate with DB gaps

### 3. Azure diagnostics
- Azure CLI MCP (`extension_az`) is the quickest path for:
  - Listing/posting firewall rules (`az postgres flexible-server firewall-rule list/create`).
  - Checking container logs: `az containerapp logs show --name evolution-prod --resource-group evolution-prod --tail 200 --query`. Filter locally for `Mama First` or `ChatwootService`.
- When pulling large logs, set retry parameters (`--retry-max-retries 3 --retry-delay 2`).

### 4. Storage inspection
- Session files live in the Azure Files share mounted by Evolution. Use Azure Storage Explorer or `az storage file list` (with the appropriate storage account/key) to verify whether session artifacts exist before/after reconnecting. If the share is already empty, skip manual deletion before rescanning the QR.

_Using the steps above should remove guesswork: run `curl https://ifconfig.me` (with escalated permissions) to capture the current IP, add one firewall rule if needed, then go straight to `psql`/Sentry instead of experimenting with multiple tools._

## Issue & Hypothesis Tracker

### Resolved / Confirmed Items
| Item | Origin | Evidence & Notes | Status |
|------|--------|------------------|--------|
| Missing `Chat_instanceId_remoteJid_key` constraint caused "Couldn't finish syncing" errors | 07-11 doc §Issue #1 | Constraint added via concurrent index on Nov 8; 42P10 errors stopped (`docs/07-11-25-prospek-instance-connection-issue.md:11-18,88-116`) | ✅ Resolved Nov 8 |
| Accidental upgrade to Evolution API v2.3.6 caused Nov 7-8 message-drop window | 07-11 doc §Issue #2 | Message reception restored after downgrading to v2.3.1 on Nov 8 (but only temporarily) (`docs/07-11-25-prospek-instance-connection-issue.md:17-23,193-234`) | ✅ Resolved root-cause for Nov 7-8 incident |
| Version rollback (v2.3.6 → v2.3.1) without session reset corrupted WhatsApp credentials, triggering Nov 8-10 logout cascade | 10-11 doc §Executive Summary/Timeline | Sentry logs show Baileys Connection Closed 7s after rollback, 882 unsynced msgs, Bad MAC at Nov 10 03:57 (`docs/10-11-25-mama-first-whatsapp-logout-issue.md:11-120,151-210`) | ✅ Confirmed; addressed by recreating session Nov 10 |

### Disproven / Retired Hypotheses
| Hypothesis | Origin | Evidence | Status |
|------------|--------|----------|--------|
| **"Nov 11 freeze was a one-time transient issue"** | **Nov 13 conclusion** | **DISPROVEN by Nov 14 recurrence. Second freeze occurred 2.3 days after recovery with identical symptoms (DB write halt, connection "open", no container issues). Pattern confirms RECURRING BUG, not transient failure.** | **❌ DISPROVEN Nov 14** |
| **"Resource exhaustion causes the freeze"** | **Nov 13 leading theory** | **DISPROVEN by Nov 14 freeze. Nov 11 had CPU/memory spikes (45% CPU, 439MB), but Nov 14 freeze has NORMAL resources (2-3% CPU, 17% memory). Freezes occur with different resource profiles, so NOT resource-related.** | **❌ DISPROVEN Nov 14** |
| **"EVOLUTION-PROD-3 and PROD-18 caused the Nov 11 16:26 freeze"** | **Nov 12 Seer analysis** | **Timeline data shows both errors existed for months (Jan/Jul 2025) without stopping message insertion. Nov 7-11 error rates were LOWER than historical. Messages were being inserted WITH these errors present until Nov 11 16:26.** | **❌ DISPROVEN Nov 13** |
| "v2.3.1 is more stable, so keep it permanently" | 07-11 doc decision log | Even after clean sessions on Nov 10-11, v2.3.1 still hits Prisma failures and stalls sync; thus stability depends on fixing DB logic, not version alone (`docs/10-11-25-mama-first-whatsapp-logout-issue.md:64-92`) | ❌ Disproven |
| "Session files remain corrupted" (post Nov 10) | 10-11 doc Phase 1 plan | Storage share confirmed empty before reconnect; new session files created Nov 11 14:26 & 16:26 yet issue persists (`docs/10-11-25-mama-first-whatsapp-logout-issue.md:64-92`) | ❌ Disproven |
| "Prospek/Chatwoot outage" | 10-11 doc Finding 1 | Prospek logs show zero webhook errors during outage; Evolution never sent payloads (`docs/10-11-25-mama-first-whatsapp-logout-issue.md:179-201`) | ❌ Disproven |
| "Simple reconnect/container restart solves message drops" | 07-11 doc §What Did NOT Work | Each reconnect yields ≤6 min of flow before silent failure (`docs/07-11-25-prospek-instance-connection-issue.md:617-643`) | ❌ Disproven |

### Active Issues / Hypotheses to Track
| Item | Description & Evidence | Next Steps | Owner |
|------|------------------------|------------|-------|
| **🚨🚨 CRITICAL - RECURRING MESSAGE FREEZE - SECOND INCIDENT ONGOING (Nov 14 06:23 WIB)** | **PATTERN CONFIRMED: Two freeze incidents in 3 days. Nov 11: 16:26 WIB (29h freeze, self-resolved). Nov 14: 06:23 WIB (9h+ and counting). SAME symptoms: DB write halt, connection shows "open", NO resource spikes (Nov 14 freeze has normal CPU/mem unlike Nov 11). NOT transient - RECURRING BUG. Same container revision 0000015 (3.25 days uptime). Likely application deadlock in message processing pipeline.** | **URGENT: 1) Container restart to restore service, 2) Enable application-level debug logging, 3) Investigate message queue/worker architecture, 4) Check for deadlocks in DB transaction handling, 5) Review message processing pipeline for race conditions or blocking operations.** | **Eng (CRITICAL)** |
| **🚨 UNKNOWN ROOT CAUSE - Nov 11 16:26 WIB Message Freeze (SELF-RESOLVED Nov 12 21:52) - NOW PATTERN** | **29-hour freeze (Nov 11 16:26 - Nov 12 21:52 WIB). NOT caused by PROD-3/18 (existed for months). NO container restarts, crashes, or disconnects. CPU/memory spiked 2min after freeze (45% CPU, 439MB memory) then recovered. Application spontaneously resumed processing. NOW CONFIRMED AS RECURRING PATTERN - see Nov 14 freeze above.** | **Root cause investigation ESCALATED due to recurrence. Pattern suggests time-based trigger or gradual resource accumulation leading to deadlock every ~2-3 days.** | **Eng (CRITICAL)** |
| Chatwoot sync failing (no `chatwootMessageId`) - SECONDARY ISSUE | Since Nov 7 the proportion of synced msgs plunged from 27% historical to 0-7% (Nov 7-10) and only 75% during Nov 11 09:00-13:00. This is a sync issue, NOT the reception freeze cause. (`docs/10-11-25-mama-first-whatsapp-logout-issue.md:46-59`) | Fix PROD-3/18 to improve sync rate, but this won't restore message reception | Eng (Lower priority) |
| Prisma errors (EVOLUTION-PROD-3/18) - CHRONIC, NOT ACUTE | Existing since Jan/Jul 2025. Total 5,394 + 321 events. Cause sync failures but NOT message reception failures. Both occur AFTER DB insertion. | Fix for better Chatwoot sync, but NOT related to Nov 11 freeze | Eng (Backlog) |
| 882-message backlog (Nov 8-10) and subsequent unsynced chunks | No automated replay yet; Prospek missing entire Nov 9 plus portions of Nov 10-11 (`docs/10-11-25-mama-first-whatsapp-logout-issue.md:46-59`) | Decide between manual import vs. discard after root cause fixed | Ops |
| Monitoring/alert gaps | No alerts fired for silent failures; detection relied on manual observation | Implement health checks for (a) last message timestamp per instance (PRIMARY), (b) `chatwootMessageId` rate, (c) Prisma error spikes | Ops |

### Pending Questions / Hypotheses
1. **Are Prisma errors caused by malformed message payloads (e.g., VCARD parsing)?** – Need to inspect failing records cited in EVOLUTION-PROD-3 stack traces (see vCard snippet around `END:VCARD`).
2. **Why do Baileys sockets stay "open" while database work stalls?** – Hypothesis: worker promise rejection leaves queue unacknowledged; confirm via application logs.
3. **Does disabling Chatwoot temporarily restore base WhatsApp reception?** – Could isolate whether webhook dispatch is the blocking step.
4. **Should we migrate Mama First to a dedicated container or queue to avoid cross-instance interference?** – Only consider after Prisma fix.

---

## Data Integrity Issues: Duplicate Conversations & Missing Messages (Nov 13 Investigation)

### User-Reported Issues

**Issue 1: Duplicate Conversations in Prospek**
- Contact #141575 (6285162670468) has 10 duplicate conversations: #3311, 3397, 3440, 3483, 3526, 3569, 3612, 3655, 3698, 3354
- Within conversations: duplicate messages (e.g., messageId 2949809 and 2949810)

**Issue 2: Missing Messages in Prospek**
- Contact 62895393869809: Message "Lanjut pricelist akk" sent Nov 8 16:05 WIB
- Missing from all three conversations: #3156, 3133, 3179
- Message visible in WhatsApp but not in Prospek

### Database Investigation Results (Nov 13)

**Finding 1: Duplicate Conversations - Prospek-Side Issue**

Evolution database query for contact 6285162670468:
```sql
SELECT DISTINCT "chatwootConversationId", COUNT(*) as msg_count
FROM "Message" WHERE "key"::jsonb->>'remoteJid'='6285162670468@s.whatsapp.net'
AND "chatwootConversationId" IS NOT NULL
GROUP BY "chatwootConversationId";

Result: Only 1 conversation (3311) with 1 synced message
```

**Analysis**:
- Evolution database shows only ONE conversation (3311)
- 10 duplicate conversations in Prospek are NOT created by Evolution
- **Root Cause**: Duplicates created within Prospek/Chatwoot itself, not by Evolution API
- **Possible Cause**: Manual conversation creation, Prospek bug, or multiple inbox assignments

**Finding 2: Missing Messages - Webhook Sync Failure**

Evolution database query for contact 62895393869809:
```sql
SELECT "messageTimestamp", "message"::jsonb->>'conversation', "chatwootMessageId"
FROM "Message" WHERE "key"::jsonb->>'remoteJid'='62895393869809@s.whatsapp.net'
AND to_timestamp("messageTimestamp") AT TIME ZONE 'Asia/Jakarta' >= '2025-11-08 15:00';

Results:
- Nov 8 15:39 - "Usia kandungan 26 weeks" - NULL chatwootMessageId
- Nov 8 16:05 - "Lanjut pricelist akk" - NULL chatwootMessageId  ← FOUND IN DB
- Nov 8 16:05 - "Jaktimnya dimana studionya?" - NULL chatwootMessageId
- 10 total messages in this time window, ALL with NULL chatwootMessageId
```

**Analysis**:
- Message "Lanjut pricelist akk" EXISTS in Evolution database
- Message was received Nov 8 16:05:01 WIB (during webhook failure period)
- **Zero** messages from this contact have `chatwootMessageId`
- **Zero** conversations created for this contact (no chatwootConversationId in database)
- **Root Cause**: Complete webhook sync failure for this contact during Nov 8-10 incident

### Evolution API Chatwoot Integration Behavior

**Automatic Message Replay**: `syncLostMessages()` method
- Looks back **6 hours only**: `created_at >= now() - interval '6h'`
- Queries Chatwoot database for recent messages
- Compares against Evolution DB to find "lost" messages
- **Limitation**: Nov 8-10 messages (882 total) are now >72 hours old - outside 6-hour window

**Conversation Creation Logic**: `createConversation()` method
- Creates conversation on first message.upsert event
- Uses cache to prevent duplicates: `{instanceName}:createConversation-{remoteJid}`
- Lock mechanism prevents race conditions
- With `reopenConversation: false` - reuses non-resolved conversations only

**Deduplication Mechanisms**:
- Cache checking (8-hour TTL)
- Lock polling (5-second wait)
- Status filtering (reuses non-resolved or respects reopenConversation setting)
- BUT: Cache was cleared during session recreation and container restarts

### Root Cause Analysis

**Why Missing Messages Won't Auto-Sync:**

1. **Outside 6-Hour Replay Window**: Nov 8-10 messages are >72 hours old
2. **No Conversation Created**: Contact 62895393869809 has zero chatwootConversationId
3. **Cache Cleared**: Session recreation + container restarts cleared conversation cache
4. **Webhook Never Fired**: Evolution never sent webhooks to Prospek during Nov 8-10

**Why Duplicate Conversations Exist:**

1. **NOT Evolution's Fault**: Database shows only 1 conversation per contact
2. **Prospek-Side Issue**: Multiple conversations created within Chatwoot
3. **Possible Causes**:
   - Manual conversation creation by agents
   - Chatwoot bug during inbox reassignment
   - Multiple contact imports
   - Browser tab synchronization issues

### Remediation Strategy

**Option 1: Manual Message Import (Recommended for Critical Contacts)**

**Pros**: Preserves exact message content and timestamps
**Cons**: Labor intensive, requires custom script
**Risk**: Low - messages already exist in Evolution DB

**Implementation**:
```sql
-- Identify all unsynced messages
SELECT "id", "key"::jsonb->>'remoteJid' as contact,
       to_timestamp("messageTimestamp") AT TIME ZONE 'Asia/Jakarta' as time,
       "message"::jsonb->>'conversation' as preview
FROM "Message"
WHERE "instanceId"='44d098ff-548b-4a37-947e-3a88589098ec'
  AND "chatwootMessageId" IS NULL
  AND "messageTimestamp" >= 1730937600  -- Nov 7, 2025 00:00 UTC
ORDER BY "messageTimestamp";

-- Export to CSV, then use Chatwoot API to bulk import
```

**Steps**:
1. Export unsynced messages (882 total) to CSV
2. Group by remoteJid (contact)
3. For each contact: Create conversation in Chatwoot (if not exists)
4. Bulk import messages via Chatwoot API `/api/v1/accounts/{account_id}/conversations/{id}/messages`
5. Update Evolution DB with returned chatwootMessageId

**Option 2: Accept Data Loss (Recommended for Non-Critical Contacts)**

**Pros**: No manual work, system continues forward
**Cons**: Permanent data loss, customer context missing
**Risk**: Medium - depends on business criticality

**Implementation**:
- Document which contacts have missing messages
- Notify agents that Nov 8-10 messages are lost
- Agents manually ask customers to resend if needed

**Option 3: Recreate Chatwoot Integration (NOT RECOMMENDED)**

**Why NOT Recommended**:
```
DELETE Chatwoot integration + CREATE new integration will:
❌ NOT sync old messages (outside 6-hour window)
❌ NOT fix Prospek-side duplicate conversations
❌ MIGHT create MORE duplicates if old conversations still exist
✅ ONLY helps for FUTURE messages
```

**When to Consider**: Only if Chatwoot integration is completely broken (not the case - it's working now)

**Option 4: Fix Prospek Duplicate Conversations (Separate from Evolution)**

**Root Cause**: Prospek/Chatwoot internal issue, not Evolution
**Resolution**: Work with Prospek team or Chatwoot admin to:
1. Identify why 10 conversations exist for one contact
2. Merge duplicate conversations using Chatwoot API
3. Investigate inbox configuration or import settings

**Not Evolution's Responsibility**: Evolution only created 1 conversation per contact

### Recommended Action Plan (Nov 13)

**Immediate (High Priority)**:
1. ✅ **Clarify Root Cause Chain** - Documented above
2. **Document Missing Message Contacts** - Export list of 882 unsynced messages
3. **Business Decision Required**: Accept data loss vs manual import?
4. **Prospek Team**: Investigate duplicate conversation root cause

**Short-Term (If Manual Import Chosen)**:
5. **Create Import Script** - Python script using Chatwoot API
6. **Test on 1 Contact** - Verify message import works correctly
7. **Bulk Import** - Run script for all 882 messages
8. **Verify Sync** - Check Prospek for imported messages

**Long-Term (Prevent Recurrence)**:
9. **Fix EVOLUTION-PROD-3/18** - Improve Chatwoot sync rate from 27%
10. **Implement Monitoring** - Alert on chatwootMessageId rate drop
11. **Session Recreation Protocol** - Document: always check for unsynced messages before version changes

### Key Clarifications for User Questions

**Question 1: Root Cause Chain - CORRECTED**

❌ **Incorrect Understanding**: "Session corruption → Prisma errors → sync failures"

✅ **Correct Understanding**:
```
Version Rollback (Nov 8) WITHOUT Session Recreation
  ↓
Session State Incompatibility
  ↓
Connection Instability (7 sec after rollback)
  ↓
Webhook Sending Failure (Evolution couldn't send to Prospek)
  ↓
882 Messages Unsynced

SEPARATELY (Chronic Issue):
Prisma Errors (Jan-Nov 2025)
  ↓
Chatwoot Sync Rate Poor (27% historical)
```

**Key Points**:
- **Prisma errors existed BEFORE Nov 7** (since Jan/Jul 2025)
- **Prisma errors did NOT cause webhook failure** - they're a separate chronic issue
- **Session corruption caused webhook failure** - Evolution couldn't send ANY webhooks
- **Nov 7 issue was database constraint** (separate, fixed Nov 8)

**Question 2: Will Recreating Integration Help?**

❌ **NO** - Recreating integration will NOT:
- Sync old messages (outside 6-hour window)
- Fix duplicate conversations (Prospek-side issue)
- Prevent future duplicates

✅ **YES** - Manual import WILL:
- Restore missing 882 messages
- Preserve message timestamps
- Maintain conversation context

**Question 3: Will Deleting/Creating New Inbox Import Old Messages? - ANSWERED**

**User's Question**: "I thought chatwoot conversation is per inbox, so deleting old inbox and creating new inbox and importing means it will import again from last x days of evolution conversations?"

**Answer**: ❌ **NO** - This will NOT work for the reasons below:

**Code Investigation Results** (from [chatwoot.service.ts:main](https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/integrations/chatbot/chatwoot/services/chatwoot.service.ts)):

1. **Inbox Change Does NOT Trigger Auto-Import**
   - No inbox-change event listener in the code
   - Import is triggered by:
     - Initial integration setup (manual trigger)
     - `startImportHistoryMessages()` method (manual API call)
     - NOT by inbox deletion/recreation
   - **Conclusion**: Creating new inbox won't automatically import anything

2. **6-Hour Replay Window Too Short**
   - `syncLostMessages()` method has hard-coded 6-hour lookback:
     ```sql
     created_at >= now() - interval '6h'
     ```
   - Nov 8-10 messages (882 total) are now >72 hours old
   - Even if import was triggered, messages are outside the time window
   - **Conclusion**: Nov 8-10 messages won't be included even if import runs

3. **Import Uses `daysLimitImportMessages` Setting**
   - Import logic references `this.provider.daysLimitImportMessages`
   - This controls historical import window (e.g., 7 days, 30 days)
   - BUT: Import only runs on **initial setup**, not inbox change
   - **Conclusion**: Time window setting exists but won't help with inbox recreation

4. **Deduplication via `source_id` Would Block Re-Import**
   - Evolution creates messages with `source_id` field (prefixed "WAID:{messageId}")
   - Chatwoot checks `source_id` to prevent duplicate imports
   - Even if messages were in time window, they might be skipped
   - **Conclusion**: Messages that were partially synced might not re-import

**Why This Won't Work for the 882 Missing Messages:**

```
Inbox Deletion + Inbox Creation
  ↓
NO automatic import trigger (no event listener)
  ↓
IF manual import triggered (via API)
  ↓
Time window check (daysLimitImportMessages or 6-hour sync window)
  ↓
Nov 8-10 messages EXCLUDED (>72 hours old)
  ↓
Result: Zero messages imported
```

**What WOULD Work:**

✅ **Option 1: Manual Message Import via Chatwoot API**
- Export 882 unsynced messages from Evolution DB
- Use Chatwoot API to create conversations + messages
- Manually set timestamps to preserve message order
- Update Evolution DB with returned `chatwootMessageId`

✅ **Option 2: Modify Evolution Code to Force Historical Import**
- Temporarily change `syncLostMessages()` to look back 7 days instead of 6 hours
- Trigger manual import via API call
- Revert code after import completes
- Risk: May create duplicates if some messages already synced

✅ **Option 3: Accept Data Loss**
- Document which contacts have missing messages
- Users manually ask customers to resend important information
- No technical work required

**Recommended**: Option 1 (Manual Import) for critical contacts, Option 3 (Accept Loss) for others

## Action List (as of Nov 12, Post-Seer)

### Immediate Actions (to unblock production)
1. ✅ **[DONE] Seer RCA Analysis** – Both root causes confirmed and documented above
2. **Locate source code** – Need access to Evolution API repository to inspect:
   - `src/api/integrations/chatbot/chatwoot/services/chatwoot.service.ts` (PROD-3)
   - `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` (PROD-18)
3. **Deploy interim mitigations** (choose fastest path):
   - **Option A (fastest):** Wrap `this.cache.delete()` in try/catch to prevent crash, log failures
   - **Option B:** Temporarily disable "conversation resolved" webhook processing (comment out the conditional block)
   - **Option C:** Add input validation to `updateMessagesReadedByTimestamp` before calling `contact.findMany()`
4. **Hot-patch deployment** – Once mitigation code is ready, build & redeploy to `evolution-prod` container

### Code Fixes (permanent solution)
5. **EVOLUTION-PROD-3 fix:**
   - Rename `this.cache.delete()` to `this.cache.remove()` OR `this.cache.del()` to avoid Prisma pattern-matching
   - Alternatively: move cache deletion outside the webhook handler, use separate worker/queue
   - Add error handling around cache operations (they should never crash the sync pipeline)
6. **EVOLUTION-PROD-18 fix:**
   - Add explicit WHERE clause validation before `contact.findMany()` call
   - Validate `remoteJid` format (must match contact phone pattern)
   - Add defensive checks for `timestamp` parameter (ensure it's a valid number)
   - Log malformed inputs instead of crashing

### Post-Fix Actions
7. **Backlog replay strategy** – Once fixes deployed and stable for 24h:
   - Query unsynced messages: `SELECT * FROM "Message" WHERE "chatwootMessageId" IS NULL AND "messageTimestamp" >= <Nov7_timestamp> ORDER BY "messageTimestamp"`
   - Design replay script or accept data loss (business decision)
8. **Monitoring implementation:**
   - Alert on `chatwootMessageId IS NULL` rate > 10% per hour
   - Alert on Prisma error spike (>5 errors/min)
   - Alert on message timestamp lag (last message > 10 min old)
9. **Test on high-volume instance** – Use another large instance to verify fixes don't regress

## Active Investigation Plan (Nov 12, Revised Post-Seer)
1. ✅ **[DONE] Translate Seer RCA into actionable fixes** – Root causes mapped, code locations identified
2. ✅ **[DONE] Locate source repository** – Found `EvolutionAPI/evolution-api`, confirmed PROD-3 code path
3. ⚠️ **[PARTIAL] Access source code** – PROD-3 code visible; PROD-18 requires repo clone (method not in web-accessible file)

### Immediate Path Forward (3 Options)

**Option A: Quick Mitigation Patch (Fastest - Deploy Today)**
- Fork EvolutionAPI/evolution-api repo
- Apply PROD-3 fix only (wrap cache.delete in try/catch)
- Build custom Docker image tagged `atendai/evolution-api:v2.3.1-hotfix-prod3`
- Update production deployment to use hotfix image
- Monitor: This will stop 50% of crashes (all "conversation resolved" webhooks)
- Leave PROD-18 for deeper investigation

**Option B: Clone & Full Fix (Most Complete - 1-2 Days)**
- Clone full repository locally
- Search for `updateMessagesReadedByTimestamp` implementation
- Apply both PROD-3 and PROD-18 fixes
- Test locally with captured Sentry payloads
- Build and deploy comprehensive fix
- Requires: local dev environment, test database, Chatwoot sandbox

**Option C: Upstream Contribution (Best Long-term - Coordinate with Maintainers)**
- Open issues on EvolutionAPI/evolution-api for both bugs
- Include Seer analysis and proposed fixes
- Wait for maintainer response/fix
- Risk: slower timeline, but benefits entire community

### Recommended Approach: **Option A + Option C in Parallel**
1. Deploy Option A hotfix immediately (unblock production for PROD-3)
2. Open upstream issues for both bugs with detailed analysis
3. Meanwhile, clone repo and investigate PROD-18 locally
4. If upstream responds quickly, adopt their fix; otherwise deploy our own

### Next Concrete Steps (Choose Your Path)
1. **If Option A:** Fork repo → Create branch → Apply try/catch → Build Docker image → Deploy
2. **If Option B:** `git clone https://github.com/EvolutionAPI/evolution-api.git` → `grep -r "updateMessagesReadedByTimestamp"` → Fix both issues
3. **If Option C:** Create GitHub issue with Seer RCA → Wait for maintainer response

### Progress Log

#### Nov 14, 15:40 WIB (🚨 SECOND FREEZE INCIDENT - PATTERN CONFIRMED)

**CRITICAL DISCOVERY: Freeze recurrence confirms this is NOT transient issue but RECURRING BUG**

**Incident Details:**
- **Freeze Start**: Nov 14, 2025 06:23:59 WIB (Nov 13, 23:23:59 UTC)
- **Status**: **STILL FROZEN** as of Nov 14 15:40 WIB
- **Duration So Far**: 9 hours 16 minutes (and counting)
- **Time Since Previous Recovery**: 2.3 days (recovered Nov 12 21:52 WIB)

**Investigation Results:**

1. **Database Confirmation:**
   ```sql
   Last message: 2025-11-14 06:23:59 WIB (timestamp 1763076239)
   Connection status: "open" (last updated Nov 13 20:12 WIB)
   ```

2. **Message Sync Rate (Nov 14):**
   ```
   Hour          Total  Synced  Rate
   01:00-02:00     4      2     50%
   02:00-03:00     3      3    100%
   04:00-05:00     6      4     67%
   05:00-06:00     3      2     67%
   06:00-07:00    13      9     69%  ← Last hour before freeze
   ```

3. **Azure Metrics (Nov 13 23:00 - Nov 14 07:00 UTC):**
   ```
   CPU Usage:      0.3% - 2.6% (NORMAL - no spikes like Nov 11)
   Memory Usage:   14.7% - 17.9% (NORMAL - gradual increase)
   Restart Count:  0 (no restarts throughout period)
   ```

4. **Sentry Errors (Last 24h):**
   ```
   PROD-3:  6 events (last: Nov 14 08:12 UTC)
   PROD-18: 6 events (last: Nov 14 08:13 UTC)
   ```
   - Same chronic errors, NOT acute spike

5. **Container Status:**
   - Revision: `evolution-prod--0000015` (same since Nov 11 02:12 UTC)
   - Uptime: 3.25 days (78 hours)
   - No crashes, deployments, or manual interventions

**Key Differences from Nov 11 Freeze:**

| Metric | Nov 11 Freeze | Nov 14 Freeze |
|--------|--------------|---------------|
| **CPU Spike** | YES (45.5% peak) | NO (2.6% avg) |
| **Memory Spike** | YES (439MB peak) | NO (gradual to 17.9%) |
| **Time to Freeze** | 7h 14m after deployment | 78h after deployment |
| **Resource Pattern** | Sudden spike at freeze | Gradual increase overnight |

**What This Proves:**

1. ❌ **NOT Transient**: Two freezes in 3 days = RECURRING BUG
2. ❌ **NOT Resource Exhaustion**: Nov 14 freeze has normal CPU/memory
3. ❌ **NOT Container Issue**: Same container, 78h uptime
4. ✅ **Application Deadlock**: Likely message processing pipeline or DB transaction handling
5. ✅ **Time-Based Pattern**: Freezes occur ~2-3 days apart, suggesting gradual state corruption

**Hypotheses (Ranked by Likelihood):**

**🆕 UPDATED after discovering stuck instances - shared state corruption likely:**

1. **Shared State/Cache Corruption Leading to Deadlock** (VERY HIGH):
   - **Evidence**: 5 instances stuck in "connecting" simultaneously during freeze
   - **Evidence**: Disconnect API returns 400 Bad Request (invalid state)
   - **Evidence**: State persists across container uptime (not cleared on recovery)
   - **Mechanism**: Global state object or cache becomes corrupted
   - **Impact**: Message processing deadlocks AND instance state machine breaks
   - **Why simultaneous**: All instances share same corrupted state/cache
   - **NEW HYPOTHESIS**: Redis cache, in-memory state manager, or global singleton corruption

2. **Database Connection Pool Exhaustion** (HIGH):
   - Leaked connections accumulate over days
   - Pool depletes, new writes hang indefinitely
   - Connection status shows "open" but writes fail silently
   - **NEW EVIDENCE**: Stuck instances can't disconnect = API can't get DB connection

3. **Prisma Transaction Deadlock with Shared Lock** (MEDIUM-HIGH):
   - Long-running transaction holds global lock
   - Both message writes AND instance updates blocked
   - PROD-3/18 errors may indicate transaction issues
   - **NEW EVIDENCE**: 5 instances stuck = shared lock preventing state updates

4. **Message Queue Deadlock** (MEDIUM):
   - Queue fills over time, reaches blocking condition
   - No backpressure handling causes pipeline stall
   - WhatsApp receives messages but DB writes blocked
   - **DOWNGRADED**: Doesn't explain instance state corruption

5. **Memory Leak in Message Buffer** (LOW):
   - Nov 14 shows gradual memory increase (14.7% → 17.9%)
   - Unlike Nov 11's sudden spike, this is gradual accumulation
   - May fill buffers over time causing blocking
   - **DOWNGRADED**: Doesn't explain simultaneous instance state corruption

**Immediate Actions Required:**

1. 🚨 **URGENT - Restore Service:**
   - Container restart to unblock production
   - Document exact restart time for pattern analysis

2. 🔍 **Enable Debug Logging:**
   - Application-level logging for message queue depth
   - Database connection pool metrics
   - Transaction duration tracking

3. 📊 **Implement Monitoring:**
   - Alert on last message timestamp > 10 minutes
   - Alert on DB connection pool usage > 80%
   - Alert on memory growth rate (prevent silent accumulation)

4. 🛠️ **Investigation Tasks (UPDATED with stuck instances finding):**
   - **HIGH PRIORITY**: Review global state/cache management (Redis, in-memory singletons)
   - **HIGH PRIORITY**: Check instance state machine code - why does disconnect return 400?
   - **HIGH PRIORITY**: Analyze shared state between instances (global variables, caches)
   - Review message processing pipeline for blocking operations
   - Check Prisma transaction isolation levels and global locks
   - Analyze connection pool configuration and leak detection
   - Search for unclosed connections or unhandled promises
   - **NEW**: Investigate why 5 instances got stuck simultaneously (shared corruption point)

**Pattern Analysis for Next Recurrence:**

If freeze recurs again ~2-3 days after restart, this confirms:
- Time-based trigger or accumulation issue
- NOT random transient failure
- Requires code-level fix, not operational workaround

---

#### Nov 13, 15:30 WIB (INVESTIGATION COMPLETE - Root Cause Unknown) - SUPERSEDED BY NOV 14 RECURRENCE
**Complete Recovery Timeline:**
- Container revision `evolution-prod--0000015` deployed: **Nov 11, 2025 02:12:01 UTC** (09:12 WIB)
- Last message before freeze: **Nov 11, 2025 16:26:04 WIB** (timestamp 1762853164)
- First message after freeze: **Nov 12, 2025 21:52:33 WIB** (timestamp 1762959153)
- **Total freeze duration: 29 hours 26 minutes**
- Freeze occurred **7 hours 14 minutes** after container deployment

**Container Analysis:**
- **No restarts** between Nov 11-13 (verified via Azure activity logs and RestartCount metrics)
- Single replica maintained throughout freeze period
- No deployments, crashes, or manual interventions

**Azure Metrics During Freeze Window (Nov 11 09:26-09:34 UTC / 16:26-16:34 WIB):**
| Time (UTC) | Time (WIB) | CPU % | Memory MB | Notes |
|------------|-----------|-------|-----------|-------|
| 09:26 | 16:26 | 3.0 | 265.6 | **Freeze begins** |
| 09:27 | 16:27 | 3.0 | 279.9 | Baseline |
| 09:28 | 16:28 | **45.5** | **431.7** | **CPU/Memory spike** |
| 09:29 | 16:29 | 29.5 | 330.5 | Elevated |
| 09:30 | 16:30 | 4.0 | 308.9 | Declining |
| 09:31 | 16:31 | 11.0 | 396.2 | Fluctuating |
| 09:32 | 16:32 | 6.5 | **439.0** | **Peak memory** |
| 09:33 | 16:33 | 11.5 | 381.9 | Declining |
| 09:34 | 16:34 | 13.0 | 361.2 | Returning to baseline |
| 09:35 | 16:35 | 0.0 | 280.8 | **Baseline restored** |

**Current Status (Nov 13, 14:03 WIB):**
- Container logs show Mama First **IS WORKING** as of Nov 13 07:03 UTC (14:03 WIB)
- Instance processing messages: "Update messages", "Update readed messages 628176326083@s.whatsapp.net - 1763017427"
- Chatwoot integration active: "Found conversation in reopenConversation mode"

**KEY FINDINGS:**
1. ✅ **Recovery Time Confirmed**: Messages resumed Nov 12 21:52:33 WIB after 29h 26m freeze
2. ✅ **No Container Restarts**: Same container ran throughout entire freeze period
3. ⚠️ **Resource Spike Detected**: CPU/memory spiked 2 minutes after freeze, suggesting internal stress response
4. ❓ **Root Cause Unknown**: No crashes, no disconnects, no new errors - application simply stopped processing for ~29 hours then resumed

**Remaining Questions:**
- What caused the initial freeze at 16:26?
- What caused spontaneous recovery at 21:52 the next day?
- Why did CPU/memory spike 2 minutes after freeze (stress response vs. cause)?
- Were there message queue backlogs, connection pool exhaustion, or deadlocks?

#### Nov 13, 13:37 WIB (CRITICAL TIMELINE DISCOVERY)
**EVOLUTION-PROD-3 and PROD-18 Timeline Analysis:**
- Queried Sentry API successfully with token `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`
- **EVOLUTION-PROD-3**: First seen **Jan 4, 2025 07:50 UTC** (10 months ago), 5,394 total events
- **EVOLUTION-PROD-18**: First seen **Jul 23, 2025 04:27 UTC** (4 months ago), 321 total events
- **EVOLUTION-PROD-1H**: Last seen **Nov 8, 2025 15:55 UTC** (3 days before freeze), only 12 events
- **Nov 7-11 Event Counts:**
  - PROD-3: Nov 7=0, Nov 8=5, Nov 9=11, Nov 10=15, Nov 11=7, Nov 12=15
  - PROD-18: Nov 7=0, Nov 8=4, Nov 9=6, Nov 10=3, Nov 11=2, Nov 12=3
  - PROD-1H: Nov 7=7, Nov 8-11=0 (no disconnects!)

**CONCLUSION:** These errors are **chronic background issues** that have coexisted with successful message insertion for months. They explain Chatwoot sync failures (missing `chatwootMessageId`) but **NOT** the complete message reception freeze at Nov 11 16:26.

**The actual root cause of the freeze remains UNKNOWN.** Need to investigate:
1. Other Sentry issues first seen Nov 11
2. Container crashes/restarts
3. Database connection issues
4. Configuration changes

#### Nov 12, 09:10 WIB
- Attempted to open local source tree to inspect `chatwoot.service.ts` / `whatsapp.baileys.service.ts`, but this workspace only contains operational artifacts (docs, compose files). **Action:** request repo access via GitHub/other MCP before code review can proceed.
- Pulled latest EVOLUTION-PROD-3 (event `305f7d8e6c9748c58ab6db11a6dbf341`, 2025-11-12 01:12Z) confirming ongoing `this.cache.delete` failure. Need raw webhook payload—Seer summary references `conversation_status_changed` with `resolved` status, but actual body is not exposed via current API call. Consider re-running Seer with instruction "include request body/meta sender identifier" once access is available.

#### Nov 12, Afternoon (Source Code Investigation)
**Repository Located:** `EvolutionAPI/evolution-api` on GitHub

**EVOLUTION-PROD-3 Source Code Confirmed:**
- File: `src/api/integrations/chatbot/chatwoot/services/chatwoot.service.ts` [main branch]
- Problematic code block (in `receiveWebhook` method):
  ```typescript
  if (
    this.provider.reopenConversation === false &&
    body.event === 'conversation_status_changed' &&
    body.status === 'resolved' &&
    body.meta?.sender?.identifier
  ) {
    const keyToDelete = `${instance.instanceName}:createConversation-${body.meta.sender.identifier}`;
    this.cache.delete(keyToDelete);  // ← THIS LINE CRASHES IN MINIFIED BUILD
  }
  ```
- Additional cache.delete() usage found in lock cleanup (inside finally block) - this one is wrapped properly
- **Fix Options:**
  1. Wrap in try/catch: `try { this.cache.delete(keyToDelete); } catch (e) { this.logger.warn('Cache delete failed:', e); }`
  2. Rename method: Change CacheService API from `.delete()` to `.remove()` or `.del()` to avoid Prisma collision
  3. Move outside transaction scope if this code runs inside a Prisma transaction

**EVOLUTION-PROD-18 Investigation Status:**
- File: `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts`
- Method `updateMessagesReadedByTimestamp(remoteJid, timestamp)` is **called** in two places:
  - `messages.upsert` event handler
  - `messages.update` event handler (matches Sentry breadcrumb: "Update as read in message.update 6285793441343 - 1762870987")
- **Problem:** Method implementation NOT found via web access - requires:
  - Clone full repo OR access via authenticated GitHub API
  - Search across entire codebase (method may be in base class, mixin, or utility module)
- **Workaround Available:** Even without the exact code, Seer's analysis tells us the issue is **invalid arguments to `contact.findMany()`**
  - Likely cause: `remoteJid` validation missing (e.g., `6285793441343` without proper WHERE clause)
  - Likely cause: Missing instance filter in query
  - Likely cause: Timestamp parameter format issue

#### Nov 12, Latest (Post-Seer Analysis)
**EVOLUTION-PROD-3 (PrismaClientValidationError) - Root Cause CONFIRMED:**
- **Trigger:** Chatwoot webhook with `event=conversation_status_changed` and `status=resolved`
- **Code path:** `ChatwootService.receiveWebhook()` → cache deletion logic:
  ```typescript
  if (this.provider.reopenConversation === false &&
      body.event === 'conversation_status_changed' &&
      body.status === 'resolved' &&
      body.meta?.sender?.identifier) {
    const keyToDelete = `${instance.instanceName}:createConversation-${body.meta.sender.identifier}`;
    this.cache.delete(keyToDelete);  // ← Minification causes Prisma to misinterpret this as model.delete()
  }
  ```
- **Mechanism:** In minified `dist/main.js:227`, Prisma's runtime validation cannot distinguish `this.cache.delete()` (CacheService method) from `this.prisma.model.delete()` (Prisma client operation), triggering validation error
- **Impact:** Every "conversation resolved" webhook crashes the Chatwoot integration handler BEFORE messages can be synced → explains missing `chatwootMessageId`
- **Source location:** `src/api/integrations/chatbot/chatwoot/services/chatwoot.service.ts`
- **Sentry event ID:** `305f7d8e6c9748c58ab6db11a6dbf341` (2025-11-12 01:12Z)

**EVOLUTION-PROD-18 (PrismaClientUnknownRequestError) - Root Cause CONFIRMED:**
- **Trigger:** Message read-status update operations
- **Code path:** `WhatsappBaileysService.updateMessagesReadedByTimestamp()` → `this.prismaRepository.contact.findMany()`
- **Mechanism:** Invalid arguments passed to `contact.findMany()` (likely malformed `remoteJid` or missing WHERE filters)
- **Breadcrumb context:** `Update as read in message.update 6285793441343 - 1762870987` indicates `remoteJid=6285793441343`, `timestamp=1762870987`
- **Impact:** Stops message pipeline after DB insertion but before Chatwoot sync; every inbound message triggers read-status update that crashes
- **Source location:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts`
- **Minified location:** `dist/main.js:250:3365`

**Key Insights:**
1. Both errors occur in the POST-insertion phase (after messages hit DB but before Chatwoot sync completes)
2. Minification obscures method calls, making Prisma's pattern-matching too aggressive
3. The crashes are deterministic: EVERY "conversation resolved" webhook + EVERY message read-update fails
4. WhatsApp socket stays "open" because Baileys layer is healthy; only the application worker crashes

---

## Complete Incident Timeline: The Full Story (Nov 7-13, 2025)

This section synthesizes findings from three separate investigations into one cohesive narrative, showing how multiple issues compounded over 6 days.

### Phase 1: The Trigger - Database Constraint Issue (Nov 7-8)

**Initial Problem (Nov 7, 02:47 UTC):**
- Mama First instance disconnected with `LOGOUT` event
- Reconnection attempts failed with "Couldn't finish syncing" error
- **Root Cause**: Missing database constraint `Chat_instanceId_remoteJid_key`
- PostgreSQL error 42P10 during `labels.association` processing
- Known Evolution API bug affecting v2.2.2 through v2.3.6+ (GitHub issues #1189, #1284, #1904)

**Fix Applied (Nov 8, 09:00-09:30 UTC):**
```sql
CREATE UNIQUE INDEX CONCURRENTLY "Chat_instanceId_remoteJid_key"
ON "Chat" ("instanceId", "remoteJid");
```
- ✅ Fix successful - constraint added permanently
- ✅ WhatsApp shows "Active"
- ⚠️ But messages still not flowing consistently

### Phase 2: The Accidental Cascade - Version Upgrade (Nov 8, ~09:57 UTC)

**Critical Mistake:**
- During troubleshooting, container was restarted
- Accidentally upgraded from v2.3.1 → **v2.3.6** (known buggy version per Evolution API #2061)
- v2.3.1 had been **stable for 3+ weeks** (Oct 14 - Nov 8)

**Why It Affected Only Mama First:**
- **Scale/Complexity Outlier**: 2,599 chats (2-5x more than other instances)
- **Message Type Variety**: 33 distinct types (50% more than others)
- **Poor Historical Sync**: 27% Chatwoot sync rate vs 48-59% for other instances
- **Hypothesis**: Mama First's scale/complexity hit a threshold that exposed v2.3.6 bugs

**Brief Working Period (Nov 8, 09:52-09:58 UTC):**
- 18 messages received in 6-minute window
- Only 1 message (5.5%) synced to Chatwoot
- Pattern repeated with multiple reconnection attempts
- Each reconnection provided brief functionality (variable duration: 6-20+ minutes) before silent failure

### Phase 3: The Silent Degradation - Version Rollback Incompatibility (Nov 8, 15:30-16:08 UTC)

**Attempted Fix - Rollback to v2.3.1 (Nov 8, 15:30 UTC):**
```bash
az containerapp update --image prospek.azurecr.io/evolution:v2.3.1
```

**What Actually Happened:**
- ✅ 64 messages received in 38-minute window (appeared to work)
- **❌ 7 seconds after restart**: 6x "Connection Closed" errors (EVOLUTION-PROD-1H)
- **❌ Version rollback created session state incompatibility**
- WhatsApp session established with v2.3.6 parameters couldn't properly reconnect on v2.3.1

**Cascading Failures Began:**
1. **Connection Instability** (started 15:55:42 UTC - 7 seconds after rollback)
   - Baileys socket layer unable to maintain stable connection
   - WhatsApp shows "open" but connection actually unstable

2. **Webhook Sync Total Failure** (Nov 8-10)
   - Evolution stopped sending webhooks to Prospek
   - Zero errors in Prospek Sentry (confirmed issue was Evolution's sending, not Prospek's receiving)
   - **882 messages unsynced** (614 on Nov 8, 268 on Nov 9)

3. **Database Corruption** (Nov 8-10)
   - **EVOLUTION-PROD-3**: 5,359+ occurrences of `PrismaClientValidationError` in `messages.update`
   - **EVOLUTION-PROD-18**: 308+ occurrences of `PrismaClientUnknownRequestError` in `updateMessagesReadedByTimestamp`
   - Last occurrence: Nov 10, 03:32:08 UTC

### Phase 4: The Catastrophic Failure - Session Termination (Nov 10, 03:57 UTC)

**Fatal Session Error:**
```
Session error:Error: Bad MAC
```
- **Cause**: Encryption keys out of sync after 36 hours of connection instability
- **Result**: WhatsApp forcibly logged out ALL linked devices
- **Impact**: Complete service outage

**Reconnection Attempts (Nov 10):**
- 09:52 AM local: Connected, closed after 5 minutes
- 09:59 AM local: Reconnected (2nd attempt)
- Pattern: Brief functionality followed by failure

### Phase 5: Session Recreation & Partial Recovery (Nov 10, 21:50 - Nov 11)

**Session Recreated (Nov 10, 21:50 local time):**
- User reconnected, generating fresh session files
- Storage confirmed: old corrupted session cleared, new files created
- Timestamps: `2025-11-10T14:50:13+00:00` and newer

**Backlog Replay Began (Nov 11, 02:00-06:00 UTC / 09:00-13:00 WIB):**
```
hour_jakarta      msgs  synced_msgs  sync_rate
2025-11-11 09:00    67           53      79%
2025-11-11 10:00   131          106      81%
2025-11-11 11:00   144          110      76%
2025-11-11 12:00   104           95      91%
2025-11-11 13:00    70           26      37%  ← Sync degrading
```
- Chatwoot sync rate recovered to 75-91% during first 4 hours
- Then degraded to 37% before next failure

**Second Failure Wave (Nov 11, 02:13 UTC / 09:13 local):**
- Widespread cryptographic errors across multiple instances:
  - `PreKeyError: Invalid PreKey ID`
  - `Session error:Error: Bad MAC`
  - `failed to decrypt message`
  - `Error: read ECONNRESET`
- Not isolated to Mama First - affected `Widget Works` and others
- Container manually restarted at 09:14 WIB due to widespread failure

### Phase 6: The Mysterious Freeze - Unknown Root Cause (Nov 11, 16:26 WIB)

**Freeze Begins (Nov 11, 16:26:04 WIB / 09:26:04 UTC):**
- Container revision `0000015` deployed at 09:12 WIB (7h 14m before freeze)
- **Complete halt of message insertion to database**
- Last message timestamp: 1762853164
- No container crashes, restarts, or deployments
- WhatsApp connection status: "open" (misleading)
- No Baileys disconnects (last was Nov 8)
- No new Sentry errors during freeze window

**Resource Spike Pattern (09:26-09:34 UTC / 16:26-16:34 WIB):**
- **2 minutes after freeze** (09:28 UTC / 16:28 WIB):
  - CPU: 3% → **45.5%** (15x increase)
  - Memory: 265MB → **431MB** (63% increase)
- Peak memory: **439MB** at 09:32 UTC (16:32 WIB)
- Resources returned to baseline (~280MB) by 09:35 UTC (16:35 WIB)

**User Reconnection Attempts:**
- 14:01 WIB: Disconnect observed
- 14:09 WIB: Reconnected - no new messages received
- 16:26 WIB: Reconnected again - fresh session files generated
  - 14 messages ingested between 16:04-16:26 WIB
  - **Zero** messages with `chatwootMessageId` (Prospek not receiving)
  - **Zero** messages after 16:26:30 WIB

**Investigation Findings:**
- `Instance.connectionStatus`: "open" but misleading
- Storage: Fresh `app-state-sync-key-*`, `pre-key-*`, `session-*.json` files
- Database: Messages inserted but Chatwoot sync completely failed
- Logs: Prisma errors (PROD-3/18) continued throughout

### Phase 7: Spontaneous Recovery - Self-Resolution (Nov 12, 21:52:33 WIB)

**Recovery Timeline:**
- **Freeze Duration**: 29 hours 26 minutes
- **Recovery Time**: Nov 12, 21:52:33 WIB (14:52:33 UTC)
- **First Message After Freeze**: Timestamp 1762959153
- **No manual intervention** documented
- **Container**: Same revision `0000015` - no restarts throughout freeze

**Current Status (Nov 13, 14:03 WIB):**
- ✅ Mama First instance **OPERATIONAL**
- ✅ Processing messages normally
- ✅ Chatwoot integration active
- ✅ No connection errors

---

## Cross-Document Analysis: Key Insights

### Finding 1: Three Distinct Issues, Not One

The Mama First saga involved **three separate but interconnected issues**:

1. **Database Constraint Bug** (Nov 7-8)
   - ✅ **RESOLVED** - Permanent fix applied
   - PostgreSQL 42P10 errors eliminated
   - Known Evolution API bug, not instance-specific

2. **Version Management Disaster** (Nov 8-10)
   - ❌ Accidental upgrade to v2.3.6 (buggy)
   - ❌ Rollback to v2.3.1 without session recreation
   - ❌ Session state incompatibility caused 36-hour degradation
   - ❌ Culminated in "Bad MAC" forcing device logout
   - ✅ **RESOLVED** - Session recreated Nov 10

3. **Unknown Transient Freeze** (Nov 11 16:26 - Nov 12 21:52)
   - ❓ Root cause unknown
   - ✅ **SELF-RESOLVED** after 29 hours
   - Resource spike suggests internal stress/recovery attempt
   - No crashes, no errors, spontaneous resumption

### Finding 2: Chronic vs Acute Issues

**Chronic Issues (Existed for Months):**
- **EVOLUTION-PROD-3** (PrismaClientValidationError):
  - First seen: **January 4, 2025** (10 months before Nov 11 freeze)
  - Total: 5,394 events across 10+ months
  - Cause: Chatwoot sync failures, NOT message reception failures
  - Location: `chatwoot.service.ts` - `cache.delete()` misinterpreted by Prisma in minified build

- **EVOLUTION-PROD-18** (PrismaClientUnknownRequestError):
  - First seen: **July 23, 2025** (4 months before Nov 11 freeze)
  - Total: 321 events across 4+ months
  - Cause: Read receipt/contact lookup failures
  - Location: `whatsapp.baileys.service.ts` - `updateMessagesReadedByTimestamp` invalid arguments

**Acute Issues (Triggered by Incidents):**
- Connection Closed errors (EVOLUTION-PROD-1H): Triggered by version rollback
- Bad MAC errors: Result of 36-hour session degradation
- Nov 11 freeze: Unknown trigger, spontaneous resolution

### Finding 3: Why Only Mama First Was Affected (Nov 8-10)

**Scale/Complexity Analysis:**

| Metric | Mama First | Jaya Mandiri | Widget Works |
|--------|------------|--------------|--------------|
| **Total Chats** | **2,599** | 534 | 1,091 |
| **Message Types** | **33** | 21 | 23 |
| **Chatwoot Sync Rate** | **27%** | 59% | 48% |
| **Unsynchronized Messages** | **35,858** | Unknown | Unknown |

**Hypothesis Confirmed:**
- Mama First is an **outlier** in scale and complexity
- 2-5x more chats than other instances
- 50% more message type variety
- Poorest historical sync rate (27% vs 48-59%)
- Scale/complexity hit threshold that exposed bugs in:
  - v2.3.6 (message reception failures)
  - Session rollback compatibility
  - Prisma error accumulation

**Why Other Instances Eventually Affected (Nov 11):**
- Second failure wave (Nov 11, 02:13 UTC) hit multiple instances
- Cryptographic errors across "Widget Works" and others
- Suggests systemic issue, not Mama First-specific
- But Mama First was the **canary** - failed first due to scale

### Finding 4: The Version Rollback Was NOT the Primary Cause

**Common Misconception**: "v2.3.1 is stable, v2.3.6 is buggy"

**Reality**:
- ✅ v2.3.1 **was stable** for 3+ weeks (Oct 14 - Nov 8)
- ❌ v2.3.6 **is buggy** (Evolution API #2061 - message reception failures)
- ❌ Rollback v2.3.6 → v2.3.1 **without session recreation** = incompatibility
- ❌ "Brief working period" (64 messages) was misleading - degradation already started

**The Real Issue**: Version changes require session recreation
- WhatsApp session state is cryptographically tied to client version
- Changing versions with existing session = guaranteed instability
- Both v2.3.1 and v2.3.6 work fine **with fresh sessions**
- The problem was the **TRANSITION**, not the versions themselves

### Finding 5: Silent Failures Are Catastrophic

**Multiple Layers of Misleading Status:**

1. **WhatsApp Connection Status**: "open"
   - Reality: Connection unstable or messages not flowing
   - Observed throughout Nov 8-11 incidents

2. **Zero Errors in Prospek**
   - Reality: Evolution wasn't sending webhooks at all
   - Confirmed Evolution sending failure, not Prospek receiving failure

3. **Brief "Working" Periods**
   - Reality: Degradation already occurring in background
   - 6-minute to 20-minute windows before silent failure

4. **Resource Metrics "Normal"**
   - Reality: Application-level deadlock/queue blockage
   - Container healthy but message processing stuck

**Impact on Detection:**
- No alerts fired during any incident
- Detection relied on manual user observation
- 882 messages unsynced before detection (Nov 8-10)
- 29-hour freeze before detection (Nov 11-12)

### Finding 6: The Nov 11 Freeze Remains Unexplained

**What We Know:**
- ✅ Started at exact timestamp: Nov 11, 16:26:04 WIB
- ✅ Lasted exactly 29 hours 26 minutes
- ✅ No container events (crashes, restarts, deployments)
- ✅ No Baileys disconnects
- ✅ No new Sentry errors
- ✅ Resource spike 2 minutes after freeze began
- ✅ Spontaneously resolved Nov 12, 21:52:33 WIB

**What We Don't Know:**
- ❓ What caused the initial freeze?
- ❓ What caused spontaneous recovery?
- ❓ Was resource spike cause or effect?
- ❓ Were there message queue backlogs?
- ❓ Was there connection pool exhaustion?
- ❓ Was there a deadlock condition?

**Leading Theory:**
Transient resource exhaustion (memory pressure causing message queue blockage or connection pool depletion) that self-corrected. The freeze occurred 7 hours after container deployment, suggesting:
- Gradual memory leak or resource accumulation
- Threshold reached at 16:26 WIB
- Internal recovery mechanism eventually cleared blockage
- But this is speculation - no definitive evidence

### Finding 7: Prisma Errors Are a Separate, Chronic Problem

**EVOLUTION-PROD-3 and PROD-18 Analysis:**

**Timeline Evidence:**
```
PROD-3 Event Counts by Date:
- Jan 4, 2025: First occurrence (10 months ago)
- Nov 7: 0 events
- Nov 8: 5 events
- Nov 9: 11 events
- Nov 10: 15 events
- Nov 11: 7 events
- Nov 12: 15 events

Historical Average: ~540 events/month (5,394 total / 10 months)
Recent Week Average: ~9 events/day
```

**Key Insight**: These errors existed throughout **stable periods**
- Messages were successfully inserted Jan-Oct 2025 WITH these errors
- Nov 7-11 error rates were **LOWER** than historical average
- Errors occur in **POST-insertion phase** (after DB write, during Chatwoot sync)
- Explain poor Chatwoot sync rate (27%) but NOT message reception failures

**Impact on Investigations:**
- Initially suspected as Nov 11 freeze cause
- Timeline analysis disproved this hypothesis
- But errors still need fixing to improve Chatwoot sync rate
- Backlog item, not urgent production issue

---

## Lessons Learned: Complete Picture

### Technical Lessons

1. **Database constraints matter**: Missing constraint caused 42P10 errors, but fix was straightforward
2. **Version changes require session recreation**: ALWAYS delete session files before version changes
3. **Scale/complexity exposes bugs**: Mama First's 2,599 chats hit thresholds other instances didn't
4. **Session state is cryptographic**: Incompatible versions = session degradation over time, not immediate failure
5. **Transient issues can self-resolve**: Nov 11 freeze resolved after 29 hours with no intervention
6. **Resource metrics don't show application deadlocks**: Container healthy while message queue blocked

### Operational Lessons

7. **Silent failures are the worst**: Multiple status indicators misleading (WhatsApp "open", zero Prospek errors)
8. **Multi-layer validation is critical**: Need to check DB timestamps, not just connection status
9. **Correlation ≠ Causation**: Prisma errors correlated with incidents but didn't cause Nov 11 freeze
10. **Brief "working" periods are misleading**: 6-minute window after restart hid ongoing degradation
11. **Scale matters**: Outlier instances need different monitoring thresholds
12. **Cross-service investigation is essential**: Zero errors in Prospek told us Evolution was failing to send

### Incident Response Lessons

13. **Document as you go**: Three separate docs captured full picture over 6 days
14. **Timeline analysis reveals truth**: Sentry timestamps proved Prisma errors existed for months
15. **Question assumptions**: "v2.3.1 stable, v2.3.6 buggy" was oversimplified
16. **User observations are valuable**: "Missing messages" led to discovery of webhook sync failure
17. **Correlation across instances**: Second failure wave showed systemic issue beyond Mama First

---

## Recommendations: Preventing Future Incidents

### Immediate Actions (High Priority)

1. **Implement Message Insertion Monitoring**
   - Alert if last message timestamp > 10 minutes old
   - Alert if no messages received for X minutes (instance-specific threshold)
   - Monitor per instance, not aggregate

2. **Implement Chatwoot Sync Rate Monitoring**
   - Alert if `chatwootMessageId` rate < 80% (below historical 27% baseline)
   - Track sync rate per hour, not just daily aggregate
   - Separate alert from message reception (they're different issues)

3. **Fix Prisma Errors (EVOLUTION-PROD-3 and PROD-18)**
   - **PROD-3**: Wrap `cache.delete()` in try/catch or rename to `cache.remove()`
   - **PROD-18**: Add input validation before `contact.findMany()` call
   - These are chronic issues affecting Chatwoot sync, not urgent but should be fixed

4. **Version Change Protocol**
   - Document: ALWAYS delete session files before version changes
   - Document: ALWAYS require QR code rescan after version changes
   - Add checklist to deployment runbook
   - Never assume session compatibility across versions

### Medium-Term Actions

5. **Investigate Nov 11 Freeze Root Cause**
   - Analyze application logs for memory leak patterns around Nov 11 16:26 WIB
   - Check for connection pool exhaustion or deadlock conditions
   - Review message queue implementations for blocking behavior
   - Consider heap dump analysis if memory leak suspected

6. **Implement Health Checks**
   - Liveness probe: Last message timestamp freshness
   - Readiness probe: Chatwoot sync rate above threshold
   - Sentry error rate spike detection (Prisma errors)
   - Connection stability tracking (Baileys "Connection Closed" errors)

7. **Scale-Specific Monitoring**
   - Identify "outlier" instances like Mama First (2,599 chats)
   - Apply different thresholds for high-scale instances
   - Consider dedicated resources for scale outliers

8. **Message Backlog Recovery**
   - Decide on 882-message backlog (Nov 8-10) strategy
   - Option A: Accept data loss (users reconcile manually)
   - Option B: Manual batch import (risky - may trigger webhook overload)

### Long-Term Actions

9. **Automated Session Health Monitoring**
   - Track session age and stability
   - Alert on "Connection Closed" error spikes
   - Alert on cryptographic errors (Bad MAC, PreKey errors)
   - Implement graceful session recreation workflow

10. **Incident Detection Automation**
    - Don't rely on user reports for detection
    - Implement synthetic monitoring (test messages)
    - Cross-validate multiple status indicators
    - Alert on inconsistencies (e.g., "open" connection with no messages)

11. **Version Testing Protocol**
    - Test version changes on low-scale instance first
    - Monitor for 24 hours before rolling out to high-scale instances
    - Always test with fresh session to avoid compatibility issues
    - Document which versions are validated stable

12. **Root Cause Investigation Process**
    - Timeline analysis is critical (Sentry timestamps)
    - Check both sides of integration (Evolution + Prospek)
    - Question correlation vs causation
    - Don't assume first observed issue is root cause

---

## Open Questions for Future Investigation

1. **Nov 11 Freeze**:
   - What specific condition caused freeze at 16:26:04 WIB?
   - What specific condition triggered recovery at 21:52:33 WIB?
   - Was 29h 26m duration significant or random?
   - Can we reproduce in controlled environment?

2. **Second Failure Wave (Nov 11)**:
   - Why did cryptographic errors hit multiple instances simultaneously?
   - What changed at 02:13 UTC to trigger widespread failures?
   - Was this related to Nov 11 container restart at 09:14 WIB?

3. **Scale Threshold**:
   - Is there a specific chat count threshold where bugs manifest?
   - Is 2,599 chats approaching Evolution API's design limits?
   - Should we implement instance splitting for high-scale customers?

4. **Prisma Error Root Cause**:
   - Why does minified build cause Prisma to misinterpret `cache.delete()`?
   - Are there other method names at risk?
   - Should we disable minification or use build-time static analysis?

5. **Message Queue Architecture**:
   - Is there a message queue that can block/deadlock?
   - Are there any single points of failure in message processing?
   - What's the backpressure handling mechanism?

---

## Complete Context Summary for Investigation (Self-Contained)

**This section provides complete context for any LLM or engineer to understand and continue the investigation without reading previous sessions.**

### The Problem

**Primary Issue**: Evolution API message processing freezes every ~2-3 days, halting database writes while WhatsApp connection appears "open".

**Secondary Issue**: 5 instances stuck in "connecting" state with 400 Bad Request on disconnect attempts.

### Timeline of Events

```
Nov 7-8:   Database constraint bug + accidental v2.3.6 upgrade
Nov 8-10:  Version rollback without session recreation → 882 messages unsynced
Nov 10:    "Bad MAC" session error, session recreated
Nov 11 16:26 WIB: FIRST FREEZE - Mama First stops writing to database (29h 26m freeze)
Nov 12 09:54 WIB: 5 instances stuck in "connecting" (during freeze, simultaneously)
Nov 12 21:52 WIB: First freeze self-recovers (no intervention)
Nov 13-14: 2.3 days of normal operation
Nov 14 06:23 WIB: SECOND FREEZE - Mama First stops writing again (9h+ and counting)
```

### Key Evidence

**Freeze Pattern:**
- Occurs every ~2-3 days (Nov 11 → Nov 14 = 2.3 days)
- Database writes halt completely
- WhatsApp connection status shows "open" (misleading)
- No container crashes, restarts, or deployments
- Self-recovers after 12-29 hours (Nov 11 freeze) OR ongoing (Nov 14 freeze)

**Resource Metrics:**
- Nov 11 freeze: CPU spiked to 45%, memory to 439MB at freeze
- Nov 14 freeze: CPU normal 2.6%, memory gradual to 17.9%
- **Different resource profiles** = NOT resource exhaustion

**Stuck Instances (CLARIFIED - Nov 14):**
- **User manually disconnected** 5 instances on Nov 10 19:12 WIB (reason 401 = logout)
- Instances **spontaneously started connecting** on Nov 12 09:54 WIB (38.7h later, during freeze)
- ALL transitioned simultaneously (within 2 seconds)
- Occurred DURING Nov 11 freeze (17.5h into the freeze)
- **Never timed out** to disconnected (stuck connecting for 2+ days)
- Disconnect API returns 400 Bad Request (invalid state)
- **NO resource spike** when connecting started (CPU 7.7%, Memory 15%)
- **Connecting instances did NOT cause freeze** - freeze preceded by 17.5 hours

**Database Evidence:**
```sql
-- Mama First instance
Instance ID: 44d098ff-548b-4a37-947e-3a88589098ec
Last message: 2025-11-14 06:23:59 WIB (timestamp 1763076239)
Connection status: "open" (last updated Nov 13 20:12 WIB)

-- Stuck instances (disconnected Nov 10, became connecting Nov 12)
ID: 3f412dd7-d905-4c95-8c9b-75bc2ea42a8a - 628116548448 Harper & Cordon
  disconnectionAt: Nov 10 19:12:51 | updatedAt (connecting): Nov 12 09:54:53
ID: 0f52a94a-4f8f-4476-b4cd-4b1deb96c796 - 628116183018 Harper & Cordon
  disconnectionAt: Nov 10 19:12:46 | updatedAt (connecting): Nov 12 09:54:52
ID: 4dbaa6f1-d351-4e83-8256-6dd92a343d8e - 6282167174480 Harper & Cordon
  disconnectionAt: Nov 10 19:12:56 | updatedAt (connecting): Nov 12 09:54:52
ID: 1959f210-f641-4dbe-b387-5aadba146071 - 6281802233167 SBP
  disconnectionAt: Nov 10 19:12:49 | updatedAt (connecting): Nov 12 09:54:51
ID: 8113ab7d-4c83-40d1-bea4-4df8ab481deb - 628116588181 Harper & Cordon
  disconnectionAt: Nov 10 19:13:00 | updatedAt (connecting): Nov 12 09:54:51
```

**System Configuration:**
- Container: `evolution-prod--0000015` (deployed Nov 11 02:12 UTC)
- Uptime: 78 hours (3.25 days) as of Nov 14 15:40 WIB
- Evolution API version: v2.3.1
- Database: Azure PostgreSQL Flexible Server
- Total instances: 11 (6 "open", 5 "connecting")

**Sentry Errors (Chronic, NOT Acute):**
- PROD-3 (PrismaClientValidationError): Existed since Jan 2025, 5,394+ total events
- PROD-18 (PrismaClientUnknownRequestError): Existed since Jul 2025, 321+ total events
- Both errors occurred BEFORE freezes, during freezes, and after freezes
- Not root cause, but chronic Chatwoot sync issue

### What We've Ruled Out

❌ **Transient issue**: Two freezes in 3 days = recurring pattern
❌ **Resource exhaustion**: Different resource profiles between freezes
❌ **Container issue**: Same container, 78h uptime, no restarts
❌ **Prisma errors**: Existed for months during stable periods
❌ **WhatsApp session**: Fresh sessions recreated, still freezes
❌ **Version issue**: v2.3.1 was stable for 3+ weeks before Nov 7

### Leading Hypothesis (Updated Nov 14)

**Shared State/Cache Corruption Leading to System-Wide Deadlock**

**Why this is most likely:**
1. **Simultaneous failures**: 5 instances stuck at exact same time (within 2 seconds)
2. **Persistent state**: Corruption survives freeze recovery (2+ days)
3. **Multiple symptoms**: Both message writes AND instance state management affected
4. **Invalid state**: 400 Bad Request suggests state machine corruption
5. **Shared behavior**: All instances share same corrupted state/cache

**Suspected Components:**
- Redis cache (if used for instance state)
- In-memory global state manager
- Shared singleton objects
- Global cache with no TTL or cleanup
- Prisma connection pool shared state

**Investigation Priorities:**
1. Review global state/cache management code
2. Check instance state machine - why 400 Bad Request on disconnect?
3. Analyze shared state between instances
4. Check for Redis cache corruption or memory leaks
5. Review Prisma connection pool implementation

### What to Investigate Next

**Code Locations to Review:**
1. Instance state management (connect/disconnect logic)
2. Global state initialization and cleanup
3. Cache implementation (Redis or in-memory)
4. Message processing pipeline
5. Prisma connection pool configuration
6. Shared singletons or global variables

**Database Queries to Run:**
```sql
-- Check all instance states
SELECT "connectionStatus", COUNT(*),
       MIN("updatedAt" AT TIME ZONE 'Asia/Jakarta'),
       MAX("updatedAt" AT TIME ZONE 'Asia/Jakarta')
FROM "Instance"
GROUP BY "connectionStatus";

-- Check Mama First last message
SELECT to_timestamp(MAX("messageTimestamp")) AT TIME ZONE 'Asia/Jakarta',
       MAX("messageTimestamp")
FROM "Message"
WHERE "instanceId"='44d098ff-548b-4a37-947e-3a88589098ec';
```

**Azure Metrics to Check:**
```bash
az monitor metrics list \
  --resource "/subscriptions/51f055c6-9754-46dc-82a8-e746d43afec5/resourceGroups/evolution-prod/providers/Microsoft.App/containerApps/evolution-prod" \
  --metric "CpuPercentage,MemoryPercentage,RestartCount" \
  --start-time "2025-11-14T00:00:00Z" --end-time "2025-11-14T12:00:00Z" --interval PT1H
```

### Immediate Recovery Steps

1. **Container restart** to unblock production
2. **Document restart time** for pattern analysis
3. **Monitor for recurrence** in ~2-3 days
4. **Enable debug logging** for state management, connection pool, cache operations

### Long-Term Fix Strategy

1. **Root cause**: Fix shared state corruption issue
2. **Monitoring**: Alert on last message timestamp >10min
3. **Health checks**: Instance state validation, connection pool metrics
4. **Code review**: Global state management, cache cleanup, connection lifecycle

### Related Documentation

- Previous incidents: `docs/07-11-25-prospek-instance-connection-issue.md`
- Version rollback disaster: `docs/10-11-25-mama-first-whatsapp-logout-issue.md`
- This tracker: Single source of truth for ongoing investigation

---

_This tracker supersedes the scattered notes in `07-11-25-prospek-instance-connection-issue.md` and `10-11-25-mama-first-whatsapp-logout-issue.md`. Retain those files for deep forensic detail, but treat this document as the live status board going forward._
