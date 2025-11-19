# Post-Release Monitoring & Investigation Log – Mama First (v2.3.2)
**Instance:** 6287792348908 (ID `44d098ff-548b-4a37-947e-3a88589098ec`)
**Last Updated:** Nov 18, 2025 15:15 WIB
**Purpose:** Living document for troubleshooting, evidence capture, and action tracking across sessions/LLMs.

---

## 1. Situation Overview
- **Upgrade outcome:** Evolution API v2.3.2 is in production. The legacy instance (Prospek inbox 63) suffered repeated disconnect/freeze symptoms and was **retired on Nov 18**.
- **Environment reset:** A brand-new instance (`999e9d24-cf32-46f3-b75b-577df5124ef0`) now feeds **Prospek inbox 71** (“6287792348908”). Prospek greetings are enabled for this inbox and WhatsApp-native greetings have been **disabled** so Evolution/Prospek are the single automation source.
- **Legacy findings preserved:** Sections 3.2–3.6 document historical issues (PENDING malformed greetings, DELIVERY_ACK albums, backfill gap, ghost greeting, freeze/disconnect) for reference, since the same code paths exist in the new instance.
- **New observations post-reset:**
  1. **WhatsApp-native greeting (F9)** – previously caused “ghost” messages when Evolution was offline; now disabled to avoid conflicts.
  2. **Instagram ad greeting (F10)** – “Hi, Mam! Ada yg bisa kami bantu?” greeting triggered by IG click-to-WhatsApp showed in WhatsApp but never synced to Prospek.
  3. **Historical data gap (F7)** – Old inbox 63 still contains conversations Evolution no longer tracks; backfill process needed if data must be preserved.

---

## 2. Timeline & Key Events

### Nov 17, 2025
| Time | Event |
|------|-------|
| 13:00 | CPU spike (72–78%) during container restart; instance stable afterward. |
| 14:48–16:10 | Sync verification: 55/73 messages reached Prospek (75%); timestamps aligned within 3s (`evolution-prospek-sync-verification-20251117.txt`). |
| 16:30–16:45 | Status analysis: `SERVER_ACK/READ` >90% success; `DELIVERY_ACK` 44%; `PENDING` 0% (but duplicates). |
| 17:35 | Burst of incoming group image album (disappearing mode) stuck at `DELIVERY_ACK`. |
| 17:53 | WhatsApp 401 `device_removed` logout (`mama-first-disconnect-incident-20251117.txt`). Instance `connectionStatus=close`. |
| ~18:00 | **WhatsApp automatically reconnected.** Instance back to `connectionStatus=open`. |
| 20:15–20:30 | Investigation session: PENDING message structure analyzed; Prisma cache bug root cause identified; sync health verified improved to 85%+ overall. |
| 22:45–23:15 | Gap investigation: Cross-database analysis revealed **65 messages in Prospek missing from Evolution** during disconnect period. Backfill mechanism not functioning. See Section 3.5. |

### Nov 18, 2025
| Time | Event |
|------|-------|
| 01:18 | Connection re-established (Prospek bot message: "🚀 Connection successfully established!") |
| 04:00 | **Second connection re-established** (Prospek bot message: "🚀 Connection successfully established!") |
| 04:16:07 | PENDING automated greeting created (ID: cmi3n9kw0073fib4xe9ovq64f) - malformed structure |
| 04:16 – 12:39 | Instance continues processing messages normally (165 messages total) |
| 12:39:52 | **Last message processed** (chatwootMessageId: 3019978) |
| 12:40:03 | **Instance disconnected** - connectionStatus changed to 'close' |
| 10:00–11:15 | Initial freeze investigation (later found to be incorrect - instance was still processing messages). See Section 3.6. |
| 11:15 | Pre-restart forensic evidence capture. Instance status shows 'close' at 12:40. |
| 13:24 | ❌ **Ghost greeting observed** - Greeting message appears in WhatsApp but NOT in Evolution/Prospek DBs. See Section 3.7. |
| 15:00–15:15 | Corrective analysis: Confirmed disconnect at 12:40 PM, ghost greeting investigation. |

---

## 3. Confirmed Findings

### 3.1 Freeze Resolved
- v2.3.2 keeps message persistence alive; `last_message_timestamp` and DB metrics are current. No idle-in-transaction buildup.

### 3.2 Chatwoot Sync Status

**Historical (16:30–17:00 window):**
| Status | Total | Unsynced | Success | Notes |
|--------|-------|----------|---------|-------|
| `SERVER_ACK` | 37 | 0 | **100%** | Incoming/outgoing once server-acked sync reliably. |
| `READ` | 16 | 1 | **93.75%** | Minor loss. |
| `DELIVERY_ACK` | 45 | 25 | **44.44%** | All are incoming group images, many in albums w/ disappearing mode. |
| `PENDING` | 12 | 12* | **0%** | Automated greetings - duplicates in Prospek, no `chatwootMessageId`. |

**Current (last 2 hours, as of 20:30):**
| Status | Total | Unsynced | Success | Notes |
|--------|-------|----------|---------|-------|
| `SERVER_ACK` | 45 | 0 | **100%** | Excellent. |
| `READ` | 17 | 0 | **100%** | Fully recovered. |
| `DELIVERY_ACK` | 34 | 9 | **73.53%** | Improved significantly; 9 still pending sync. |
| `PENDING` | 6 | 6 | **0%** | Still broken - root cause identified (see 3.2.1). |
| `EDITED` | 2 | 0 | **100%** | — |

**Overall sync rate (last 2 hours):** 95/104 = **91.35%** (excluding PENDING: 89/98 = **90.82%**)

#### 3.2.1 PENDING Message Root Cause
- **Issue:** PENDING messages (WhatsApp Business greeting feature) are stored with incomplete WhatsApp message structure.
- **Business context:** This flow is configured from **WhatsApp Business App → Settings → Business Tools → Greeting message**. Many Prospek customers rely on it, so Evolution/Chatwoot must learn to handle this native greeting type.
- **Expected structure:**
  ```json
  {
    "key": { "remoteJid": "...", "fromMe": true, "id": "..." },
    "pushName": "...",
    "message": { "conversation": "..." },
    "messageType": "conversation",
    ...
  }
  ```
- **Actual structure (PENDING):**
  ```json
  {
    "conversation": "Hai Mam, selamat datang..."
  }
  ```
- **Impact:** ChatwootService cannot process messages without `key`/metadata, so they remain unsynced. They DO appear in Prospek but as duplicate/misattributed records (one marked as system, one as “User”).
- **Status:** WhatsApp-native greeting has been **disabled** for the new inbox to avoid freezes, but a code fix is still required so this widely used feature is supported without disrupting Evolution.
- **Fix required:** Update the ingestion path to build the full WhatsApp envelope (or add special handling for the WhatsApp greeting payload) before inserting into the database.

### 3.3 Prisma Cache Error (Systemic)
- **Error:** `PrismaClientValidationError: Invalid 'this.cache.delete()' invocation - Argument 'Message' is missing`
- **Location:** `/evolution/dist/main.js:227:33183` (compiled code)
- **Affected instance:** `a33df2dc-b387-4e3d-b691-757a8476cf29` (Theory of Living, 6282361899698)
- **Timestamp:** Nov 17, 2025 06:38:43 UTC (13:38 WIB)
- **Root cause:** `cache.delete()` is being called with Prisma update/create parameters instead of a simple cache key:
  ```javascript
  // Wrong - what's happening now:
  this.cache.delete({
    data: {
      keyId: "...",
      remoteJid: "...",
      Message: { create: ..., connectOrCreate: ..., connect: ... }  // ❌ Prisma params
    }
  })

  // Expected - should be:
  this.cache.delete(cacheKey)  // ✅ Simple string/identifier
  ```
- **Impact:** Causes unhandled rejection errors but doesn't appear to crash the instance. May lead to stale cache entries.
- **Fix required:** Upstream code change in Evolution API source (not available in this repository - only compiled dist). Need to identify where `cache.delete()` is incorrectly invoked and pass the correct cache key parameter.
- **Status:** No evidence of this error on Mama First instance yet; monitoring continues.

### 3.4 WhatsApp Disconnect & Recovery
- **Disconnect:** At 17:53 WIB, WhatsApp returned `stream:error code=401 device_removed`. Instance went to `connectionStatus=close`.
- **Recovery:** Automatically reconnected around 18:00 WIB. Instance stable since then with `connectionStatus=open`.
- **Likely cause:** Unclear - could be automated greeting behavior, rate limiting, or external device logout.
- **Current status:** ✅ Resolved - instance operational and receiving/sending messages normally.

### 3.5 Disconnect Gap Investigation (17:53-18:21 WIB)

**Context:** User observed messages stopped syncing to Prospek at 17:53 and resumed at 18:21. Investigation was conducted to verify if Evolution's backfill mechanism worked and if there were missing messages.

#### 3.5.1 Investigation Methodology

**Step 1: Query Evolution DB for messages during gap**
```sql
-- Count messages by status during disconnect period
SELECT
  status,
  COUNT(*) AS total,
  COUNT("chatwootMessageId") AS synced,
  COUNT(*) - COUNT("chatwootMessageId") AS unsynced
FROM "Message"
WHERE "instanceId"='44d098ff-548b-4a37-947e-3a88589098ec'
  AND to_timestamp("messageTimestamp") BETWEEN '2025-11-17 17:53:00' AND '2025-11-17 18:21:00'
GROUP BY status
ORDER BY total DESC;
```

**Result:**
- 44 READ receipts (protocol messages - expected, not synced)
- 20 DELIVERY_ACK (protocol messages - expected, not synced)
- 3 READ status customer messages (incoming, malformed structure)
- 1 SERVER_ACK message (synced to chatwootMessageId 3017639)
- **0 outgoing messages (fromMe=true)**

**Step 2: Query Prospek DB for messages during gap**
```sql
-- Count messages by sender type during gap
SELECT
  m.sender_type,
  COUNT(*) AS message_count,
  MIN(m.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') AS earliest,
  MAX(m.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') AS latest
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.inbox_id = 63
  AND m.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'
      BETWEEN '2025-11-17 17:53:00' AND '2025-11-17 18:21:00'
GROUP BY m.sender_type;
```

**Result:**
- **51 User (outgoing) messages** - timestamps 17:53:25 → 18:20:48
- **15 Contact (incoming) messages** - timestamps 17:53:53 → 18:20:43
- All have WhatsApp source IDs (WAID:...)

**Step 3: Cross-reference - Check if Prospek messages exist in Evolution**
```sql
-- Search for specific Prospek message IDs in Evolution
SELECT
  id, status, "chatwootMessageId",
  to_timestamp("messageTimestamp") AT TIME ZONE 'Asia/Jakarta' AS ts_wib
FROM "Message"
WHERE "instanceId"='44d098ff-548b-4a37-947e-3a88589098ec'
  AND "chatwootMessageId" IN (3017639, 3018511, 3018759, 3018760, 3018792, ...)
ORDER BY "messageTimestamp";
```

**Result:** Only 1 message found - chatwootMessageId 3017639 (the imageMessage sent at 17:53:18)

**Step 4: Verify malformed incoming messages**
```sql
-- Search for content matching Prospek incoming messages
SELECT id, status, "message"::jsonb
FROM "Message"
WHERE "instanceId"='44d098ff-548b-4a37-947e-3a88589098ec'
  AND ("message"::text ILIKE '%boleh tau PLnya%'
    OR "message"::text ILIKE '%Saya book nya tgl 22 Nov%'
    OR "message"::text ILIKE '%Apa bisa ttp dilakukan%')
ORDER BY "messageTimestamp" DESC;
```

**Result:** Found 3 messages (IDs: cmi320hvr03wlib4x9u2pi4an, cmi320hvt03xgib4x4vmqvgac, cmi320hvt03xfib4x8n14153a)
- All have status READ
- All have NULL chatwootMessageId (not synced)
- Timestamps: 17:55:02, 17:55:43, 17:55:52

**Step 5: Examine message structure**
```sql
SELECT "message"::jsonb
FROM "Message"
WHERE id = 'cmi320hvr03wlib4x9u2pi4an';
```

**Result:**
```json
{
  "conversation": "boleh tau PLnya",
  "messageContextInfo": {"messageSecret": "kSWmtwz2IoFHfXPP0RtFEYvVTPmycwcEU9axok8C37Y="}
}
```

**Missing fields:** `key`, `pushName`, `message` wrapper, `messageType` - same malformed structure as PENDING messages (see 3.2.1).

**Step 6: Verify Prospek inbox configuration**
```sql
SELECT id, name, channel_type, channel_id, account_id
FROM inboxes WHERE id = 63;
```

**Result:**
- inbox_id: 63
- name: 6287792348908
- channel_type: **Channel::Api** (Evolution webhook integration, NOT direct WhatsApp)
- No separate WhatsApp Cloud API integration found

#### 3.5.2 Gap Analysis Summary

**Messages During Disconnect Period (17:53-18:21 WIB):**

| Source | Outgoing (User) | Incoming (Contact) | Total | Notes |
|--------|-----------------|-------------------|-------|-------|
| **Prospek DB** | 51 | 15 | **66** | All have WAID source IDs |
| **Evolution DB** | 0 | 3* | **3** | *Malformed, no sync |
| **Gap** | **51** | **12** | **63** | Messages missing/unsynced |

**Critical Findings:**

1. **65 messages exist in Prospek but NOT properly in Evolution:**
   - 51 outgoing User messages: Completely absent from Evolution's Message table (no fromMe=true records during gap)
   - 14 incoming Contact messages: Either absent or have malformed structure preventing sync

2. **Only 1 message successfully synced during gap:**
   - Evolution ID: cmi310rh703tqib4xpf42al8u
   - Prospek ID: 3017639
   - Type: imageMessage with caption
   - Timestamp: 17:53:18 (Evolution) → 17:53:25 (Prospek)
   - Status: SERVER_ACK, properly synced

3. **3 incoming messages have malformed structure:**
   - Same structural issue as PENDING messages (missing `key`, `pushName`, `messageType`)
   - Stored with status READ but never synced (chatwootMessageId = NULL)
   - Cannot be processed by ChatwootService due to incomplete WhatsApp envelope

4. **Architecture confirmed:**
   - Prospek inbox 63 is Channel::Api (webhook-based, not direct WhatsApp integration)
   - All messages should flow: WhatsApp → Evolution → Prospek (via Evolution API webhook)
   - No alternative WhatsApp source for Prospek found

#### 3.5.3 Hypothesis & Conclusion

**Backfill Mechanism Status:** ❌ **NOT FUNCTIONING**

The gap represents real data inconsistency. Possible explanations:

1. **Outgoing messages (51):** Either:
   - Not persisted to Evolution DB during disconnect (queue/buffer lost)
   - Sent from a different source/service directly to Prospek
   - Created manually in Prospek during troubleshooting

2. **Incoming messages (14):** Either:
   - 3 received with malformed structure (preventing sync)
   - 11 never received by Evolution at all
   - Possible WhatsApp message loss during disconnect/reconnection

3. **Expected backfill behavior:** After reconnection (~18:00), Evolution should have:
   - Fetched missed messages from WhatsApp Cloud API
   - Stored them with proper structure
   - Synced them to Prospek with chatwootMessageId callbacks
   - **This did NOT happen**

**Impact:** Message continuity is broken. Prospek has 65 more messages than Evolution knows about during the disconnect period, creating data inconsistency between systems.

**Recommended Actions:**
1. **Immediate:** Investigate where Prospek's 65 messages originated (check for manual creation, alternative integrations, or Evolution logs for send attempts)
2. **Code review:** Examine Evolution's message receive/send logic during disconnect to understand why messages weren't persisted
3. **Backfill mechanism:** Verify if Evolution has automatic message history fetch on reconnection - if so, debug why it failed; if not, implement it
4. **Monitoring:** Add alerts for Evolution-Prospek message count discrepancies per time window

### 3.6 Freeze Recurrence (Nov 18, 04:16 WIB)

**Context:** On Nov 18 at 10:00 AM WIB, user reported last message sync to Prospek was at 04:16 AM (~6 hours gap). Investigation confirmed a **complete freeze recurrence**, indicating v2.3.2 did NOT fully resolve the freeze issue.

#### 3.6.1 Freeze Evidence

**Instance Status Check:**
```sql
SELECT "connectionStatus", "updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' AS updated_wib
FROM "Instance" WHERE "id"='44d098ff-548b-4a37-947e-3a88589098ec';
```

**Result:**
- `connectionStatus`: `open` (STALE - shows as connected but not processing)
- Last status update: Nov 18 04:00:09 WIB (6.5 hours ago)
- Instance appears connected but is non-responsive

**Message Flow Analysis:**
```sql
SELECT to_timestamp(MAX("messageTimestamp")) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' AS last_msg_wib,
       NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' AS current_time_wib,
       EXTRACT(EPOCH FROM (NOW() - to_timestamp(MAX("messageTimestamp"))))/3600 AS hours_since_last
FROM "Message" WHERE "instanceId"='44d098ff-548b-4a37-947e-3a88589098ec';
```

**Result:**
- Last message: Nov 18 04:16:07 WIB
- Current time: Nov 18 10:20 WIB
- **Gap: 5.79 hours** (complete silence)

**Cross-Instance Health Comparison:**
```sql
SELECT "name", "connectionStatus",
       EXTRACT(EPOCH FROM (NOW() - "updatedAt"))/3600 AS hours_since_update
FROM "Instance" WHERE "connectionStatus" = 'open'
ORDER BY "updatedAt" DESC;
```

**Result:**
| Instance | Status | Hours Since Update | Health |
|----------|--------|-------------------|---------|
| Widget Works (6287785582370) | open | 0.44 hours (~26 min) | ✅ HEALTHY |
| Theory of Living (6282361899698) | open | 0.44 hours (~26 min) | ✅ HEALTHY |
| Widget Works (6287777635515) | open | 0.49 hours (~29 min) | ✅ HEALTHY |
| Indorama (628131069189) | open | 1.34 hours (~1h 20m) | ✅ HEALTHY |
| **Mama First (6287792348908)** | **open** | **6.30 hours** | ❌ **FROZEN** |

#### 3.6.2 The Last Message Before Freeze

**Query:**
```sql
SELECT id, status, "message"::jsonb, "chatwootMessageId"
FROM "Message" WHERE id = 'cmi3n9kw0073fib4xe9ovq64f';
```

**Result:**
```json
{
  "id": "cmi3n9kw0073fib4xe9ovq64f",
  "status": "PENDING",
  "messageTimestamp": 1763414167,  // Nov 18 04:16:07 WIB
  "chatwootMessageId": null,
  "message": {
    "conversation": "Terima kasih telah menghubungi Customer Service MamaFirst. Kami akan membalas pesan anda secepatnya. Jam operasional kami adalah pukul 09.00 - 22.00 setiap hari Senin s/d Sabtu. Khusus Hari Minggu hanya dari Jam 09.00 - 20.00. Terimakasih dan Salam #SayangDiriDulu"
  }
}
```

**Critical Observation:**
- Message is **PENDING status** (automated greeting)
- Has **malformed structure** - same issue as F2 (Section 3.2.1)
- Missing: `key`, `pushName`, `messageType`, full WhatsApp envelope
- This is the **exact message type that triggered malformed structure issues**

#### 3.6.3 Connection Events Timeline

**Evidence from Prospek bot messages:**

| Time | Event | Source |
|------|-------|---------|
| Nov 18 01:18 AM | "🚀 Connection successfully established!" | Prospek bot (Evolution connection) |
| Nov 18 04:00 AM | "🚀 Connection successfully established!" | Prospek bot (Evolution connection) |
| Nov 18 04:16 AM | Last message processed (PENDING automated greeting) | Evolution DB |
| Nov 18 04:16+ | **FREEZE** - No messages or status updates | Evolution DB silence |

**Observation:** Connection was re-established at 04:00 AM, messages flowed normally for 16 minutes, then **freeze occurred immediately after PENDING automated greeting was created**.

#### 3.6.4 Container & Infrastructure Status

**Container Status:**
```bash
az containerapp show --name evolution-prod --resource-group evolution-prod
```

**Result:**
- Provisioning State: `Succeeded`
- Running Status: `Running`
- Latest Revision: `evolution-prod--0000016` (deployed Nov 17 15:12 WIB)
- Container appears healthy at infrastructure level

**Recent Logs Analysis (as of Nov 18 10:30 WIB):**
```bash
az containerapp logs show --name evolution-prod --resource-group evolution-prod --tail 300
```

**Instance Activity Count in Last 300 Log Entries:**
- Indorama (628131069189): 11 log entries
- Theory of Living (6282361899698): 3 log entries
- **Mama First (6287792348908): 0 log entries** ❌
- Widget Works instances: 0 log entries in recent sample

**Findings:**
- No Mama First logs in last 300 console entries (covering ~30 minutes of activity)
- Only Indorama and Theory of Living instances show active message processing
- Mama First completely silent in logs - confirms application-level freeze
- Other instances processing messages normally (Indorama most active)

**Database Connections:**
```sql
SELECT application_name, state, COUNT(*)
FROM pg_stat_activity WHERE datname = 'evolution'
GROUP BY application_name, state;
```

**Result:**
- 5 idle connections (normal connection pooling)
- 1 active connection (current query)
- No idle-in-transaction (unlike original Nov 11/14 freeze)
- No Evolution application connections actively querying

**Sentry Error Monitoring:**

Checked Sentry for errors around 04:00-04:20 AM WIB freeze timeframe:
- Organization: `widget-works`
- Project: `evolution-api` (ID: 4508473891618896)
- Time range: Last 8 hours (covering 03:00-11:00 AM WIB)

**Critical Finding:**
❌ **NO Sentry issues detected around 3-4 AM freeze time**

**Issues in Last 8 Hours:**
- Only issue: **EVOLUTION-PROD-3** (ID: 15978899) - PrismaClientValidationError (cache.delete)
- This issue is the known Prisma cache bug (F4) affecting Theory of Living instance
- **NO occurrences around 04:00-04:16 AM** (freeze timeframe)
- **NO exceptions related to PENDING messages**
- **NO errors related to automated greetings**
- **NO connection/reconnection handler errors**

**Implications:**
This is **highly significant** - the freeze occurred without throwing any catchable exceptions:
1. **Not an exception-based crash** - No uncaught errors logged to Sentry
2. **Likely a deadlock or hang** - Process became unresponsive without throwing errors
3. **Silent failure mode** - Application stopped processing but didn't crash with stack trace
4. **Harder to debug** - No error logs means the freeze is likely:
   - Infinite loop in message processing
   - Deadlock in concurrent operations
   - Resource exhaustion (memory leak, file descriptors)
   - Process signal/kill without exception handling

This narrows down the root cause to **non-exception failure modes** in the application logic.

**Pre-Restart Diagnostic Capture:**

Before restarting the frozen instance, captured runtime state for forensic analysis:

**PENDING Messages Snapshot:**
```sql
SELECT id, status, to_timestamp("messageTimestamp") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' AS msg_time_wib,
       "chatwootMessageId", "message"::jsonb->'conversation' AS conversation_preview
FROM "Message" WHERE "instanceId" = '44d098ff-548b-4a37-947e-3a88589098ec' AND status = 'PENDING'
ORDER BY "messageTimestamp" DESC LIMIT 10;
```

**Result:** **10 PENDING automated greetings**, all stuck without `chatwootMessageId`:
- `cmi3n9kw0073fib4xe9ovq64f` - Nov 18 04:16:07 WIB (FREEZE TRIGGER)
- 9 earlier greetings from Nov 17 (all same pattern)
- All have malformed structure (missing WhatsApp envelope fields)
- None successfully sent to WhatsApp
- All remain in PENDING state indefinitely

**Queue State:**
- No queue tables in database (Evolution uses in-memory/external queue system)
- Unable to capture queue state directly
- Worker/processor state lost in frozen process

**Critical Finding:**
**Freeze occurred IMMEDIATELY after creating PENDING message** `cmi3n9kw0073fib4xe9ovq64f` at 04:16:07 WIB. This message has identical malformed structure to the other 9 PENDING messages. The pattern suggests:
1. Automated greeting triggers PENDING message creation
2. Message send logic attempts to process malformed structure
3. Process enters infinite loop/deadlock (NO exception thrown)
4. Event loop blocks permanently
5. Instance becomes completely unresponsive

Evidence saved: `docs/freeze-diagnostic-evidence-20251118.txt`

#### 3.6.5 Correlation Analysis

**Freeze Trigger Hypothesis:**

1. **PENDING Message as Trigger:**
   - Last message before freeze is PENDING automated greeting
   - Same malformed structure as F2 issue
   - F2 was identified as "high priority fix needed"
   - **Hypothesis:** PENDING message creation may be causing application hang (NOT exception-based crash)
   - **Sentry evidence:** No exceptions thrown, suggesting infinite loop or deadlock in PENDING message handling

2. **Connection Instability:**
   - Two reconnection events in 3 hours (01:18 AM, 04:00 AM)
   - Freeze occurred 16 minutes after second reconnection
   - **Hypothesis:** Reconnection logic may have race condition or state corruption
   - **Sentry evidence:** No reconnection errors logged, suggesting hang occurs in normal flow

3. **Difference from Original Freeze:**
   - **Original (Nov 11/14):** DB writes halted, idle-in-transaction buildup, but connection showed "open"
   - **Current (Nov 18):** No DB activity at all, no idle transactions, instance completely unresponsive
   - **Conclusion:** This is a DIFFERENT type of freeze (application hang vs DB connection freeze)

4. **Sentry Absence Analysis (CRITICAL):**
   - **NO exceptions logged** during freeze timeframe (04:00-04:16 AM)
   - **Freeze without error** indicates non-exception failure mode:
     - **Most likely:** Infinite loop in message processing logic
     - **Possible:** Deadlock between concurrent operations (locks never released)
     - **Possible:** Await/promise that never resolves (async hang)
     - **Less likely:** Resource exhaustion (would typically throw errors)
   - **Implication:** Code review should focus on:
     - PENDING message send logic (loops, retry mechanisms)
     - Automated greeting handler (async operations, locks)
     - Message processor event loop (message queue handling)

#### 3.6.6 Freeze Classification

**Type:** Instance-Level Application Freeze (non-responsive process)

**Severity:** ❌ **CRITICAL**

**Scope:** Single instance (Mama First only, not system-wide)

**Impact:**
- All incoming messages lost (not received by Evolution)
- All outgoing messages blocked (cannot send through Evolution)
- Chatwoot integration completely broken for this instance
- **Business Impact:** Customer service unavailable for 6+ hours

**Root Cause:** Unknown - requires further investigation, but strong correlation with:
- PENDING automated greeting messages (malformed structure)
- Recent WhatsApp reconnection events

**CORRECTION (15:15 WIB):** Initial freeze diagnosis was incorrect. Further analysis revealed:
- Instance did NOT freeze at 04:16 AM
- Processed 165 messages from 04:16 AM to 12:39:52 PM (8+ hours of normal operation)
- Disconnected at 12:40:03 PM (connectionStatus changed to 'close')
- "Freeze" was actually a disconnect event, not an application hang

### 3.7 Ghost Greetings (Nov 18, 13:24 WIB)

**Context:** User reported automated greeting messages appearing in WhatsApp but NOT visible in Prospek or Evolution databases. This occurred AFTER instance disconnect at 12:40 PM.

#### 3.7.1 Evidence

**Customer:** 628112128592 (+62 811-2128-592)
**Prospek Conversation:** [4739](https://web.prospek.app/app/accounts/20/conversations/4739)
**WhatsApp Screenshot:** [20251118-124725.jpeg](20251118-124725.jpeg)
**Prospek Screenshot:** [20251118-124720.jpeg](20251118-124720.jpeg)

**Greeting Message Content (from WhatsApp):**
```
Hai Mam, selamat datang di MamaFirst ❤️
Terima kasih sudah menghubungi kami 🤗

Agar Mamin bisa bantu rekomendasi yang paling sesuai dengan kebutuhan Mam,
mohon isi form singkat berikut ya 📝

• Usia kandungan / usia Baby:
• HPL:
• Rencana persalinan: SC / Pervaginam
• Kecamatan / Kota:
• Kelas / layanan yang diminati:

#SayangiDiriDulu 💕
```

**Timestamp:** ~13:24 PM WIB (44 minutes AFTER instance disconnect at 12:40 PM)

#### 3.7.2 Database Investigation

**Query Evolution for greeting messages to customer 628112128592:**
```sql
SELECT id, status, chatwootMessageId, chatwootConversationId, message
FROM "Message"
WHERE "instanceId" = '44d098ff-548b-4a37-947e-3a88589098ec'
  AND "key"::jsonb->>'remoteJid' = '628112128592@s.whatsapp.net'
  AND ("message"::text LIKE '%selamat datang%' OR status = 'PENDING');
```

**Result:** 0 rows

**Query Evolution for ALL messages in conversation 4739:**
```sql
SELECT id, status, message
FROM "Message"
WHERE "chatwootConversationId" = 4739
ORDER BY "messageTimestamp" ASC;
```

**Result:** 9 messages found (first message at 09:46:07 AM WIB), **NO greeting message** matching WhatsApp content.

**First message in conversation 4739:** Customer message "Haloo.\nMasuk 8-9 bulan\nHPL 12 Desember..."

**Instance Status at Greeting Time:**
```sql
SELECT "connectionStatus", "updatedAt"
FROM "Instance" WHERE "id"='44d098ff-548b-4a37-947e-3a88589098ec';
```

**Result:**
- connectionStatus: **'close'** (disconnected)
- updatedAt: 2025-11-18 12:40:03 WIB

#### 3.7.3 Key Findings

1. **Greeting NOT in Evolution database:**
   - Message appears in WhatsApp at 13:24 PM
   - Zero matching records in Evolution Message table
   - No PENDING greetings for this customer
   - No messages with matching text content

2. **Greeting NOT in Prospek:**
   - User confirmed message not visible in Prospek conversation 4739
   - Prospek screenshot shows conversation WITHOUT greeting
   - WhatsApp screenshot shows conversation WITH greeting

3. **Sent AFTER Evolution disconnect:**
   - Evolution disconnected at 12:40:03 PM
   - Greeting sent at ~13:24 PM (44 minutes later)
   - Evolution cannot send messages when connectionStatus = 'close'

4. **Comparison with Previous Case:**
   - User referenced conversation 4550, message 3017349 as similar issue
   - Message 3017349 also NOT found in Evolution database
   - Pattern: Messages exist in Prospek/WhatsApp but not in Evolution

#### 3.7.4 Root Cause Hypothesis

**Most Likely:** WhatsApp Business Auto-Reply feature is enabled separately from Evolution API.

**Evidence:**
1. Message sent when Evolution is disconnected (impossible via Evolution)
2. Message not logged in Evolution database (bypasses Evolution entirely)
3. Message content matches automated greeting pattern
4. WhatsApp Business accounts have built-in auto-reply settings independent of API integrations

**Alternative Hypotheses (Less Likely):**
1. **Manual staff message:** Staff manually sent greeting from WhatsApp Web/Business app
2. **Different automation platform:** Another service (ManyChat, Wati, etc.) integrated with WhatsApp Business
3. **Cached/phantom message:** WhatsApp UI glitch showing message that wasn't actually sent

#### 3.7.5 Difference from F2 (PENDING Greetings)

| Aspect | F2: PENDING Greetings | F9: Ghost Greetings |
|--------|----------------------|---------------------|
| **In Evolution DB?** | ✅ Yes (PENDING status) | ❌ No (not in DB at all) |
| **Message Structure** | Malformed (missing key, pushName) | N/A (never created) |
| **In Prospek?** | ✅ Yes (as duplicates) | ❌ No (not synced) |
| **In WhatsApp?** | ❓ Unknown | ✅ Yes (visible to customer) |
| **Sent By** | Evolution API (malformed) | WhatsApp Business Auto-Reply (hypothesis) |
| **Timing** | During Evolution operation | AFTER Evolution disconnect |

#### 3.7.6 Impact & Recommendations

**Impact:**
- Customer experience inconsistency (greeting in WhatsApp but not tracked in Prospek)
- Support agents don't see greeting in Prospek, may send duplicate greetings
- Message tracking broken (no audit trail in Evolution/Prospek)

**Immediate Actions:**
1. **Verify:** Check WhatsApp Business settings for auto-reply/greeting messages
2. **Disable:** Turn off WhatsApp Business auto-reply if enabled (conflicts with Evolution automation)
3. **Document:** Identify all active automation sources for this WhatsApp number
4. **Standardize:** Ensure single source of truth for automated messages (Evolution only)

**Long-term:**
- Review all WhatsApp Business account settings across instances
- Implement monitoring for messages appearing in WhatsApp but not in Evolution
- Consider webhook from WhatsApp Business API to capture ALL messages (even non-Evolution ones)

### 3.8 Instagram Ad Greeting Not Syncing (Nov 18, inbox 71)

**Symptom:** Conversation [5630](https://web.prospek.app/app/accounts/20/conversations/5630?messageId=3028874) and multiple others show Instagram/Facebook ad greetings ("Hi, Mam! Ada yang bisa kami bantu? 🙏") visible in WhatsApp but NOT in Prospek or Evolution.

#### 3.8.1 Evidence Collected (Nov 19, 2025)

**Database Investigation:**

**Query 1: Conversation 5630 Messages**
```sql
SELECT id, to_timestamp("messageTimestamp") AT TIME ZONE 'Asia/Jakarta' AS ts_local,
       status, "chatwootMessageId", "chatwootConversationId",
       "message"::jsonb -> 'message' AS payload
FROM "Message"
WHERE "instanceId"='999e9d24-cf32-46f3-b75b-577df5124ef0'
  AND "chatwootConversationId" = 5630
ORDER BY "messageTimestamp" ASC;
```

**Result:** 3 messages found, ALL synced successfully:
- `cmi4cqnu90ffdf44x5m4p9jga` (16:09:14) - Customer message, status READ, synced to 3028868
- `cmi4cutxv0fgtf44xnmmfvmrz` (16:12:29) - Auto-reply greeting, status SERVER_ACK, synced to 3028874
- `cmi4f7d8n0g6jf44xkkx1k9v4` (17:18:14) - Manual greeting, status SERVER_ACK, synced to 3028959
- **All 3 are messageType: "conversation"** ✅

**Query 2: Search for Instagram Greeting Text**
```sql
SELECT id, to_timestamp("messageTimestamp") AT TIME ZONE 'Asia/Jakarta' AS ts_local,
       status, "chatwootMessageId", "chatwootConversationId", "message"::text
FROM "Message"
WHERE "instanceId"='999e9d24-cf32-46f3-b75b-577df5124ef0'
  AND "message"::text ILIKE '%Hi, Mam%bantu%'
ORDER BY "messageTimestamp" DESC;
```

**Result:** Found **4 messages** with Instagram greeting text, **NONE synced**:
- All have status: NULL (empty)
- All have chatwootMessageId: NULL
- All have messageType: **"interactiveMessage"** ❌
- Timestamps: 15:13:06, 15:13:05 (x2), 12:12:03

**Query 3: Count ALL interactiveMessage Messages**
```sql
SELECT "messageType", status,
       COUNT(*) AS total,
       COUNT("chatwootMessageId") AS synced,
       COUNT(*) - COUNT("chatwootMessageId") AS unsynced
FROM "Message"
WHERE "instanceId"='999e9d24-cf32-46f3-b75b-577df5124ef0'
  AND "messageType" = 'interactiveMessage'
GROUP BY "messageType", status
ORDER BY unsynced DESC;
```

**Critical Finding:**
| messageType | status | total | synced | unsynced |
|-------------|--------|-------|--------|----------|
| interactiveMessage | (NULL) | 40 | 0 | **40** |
| interactiveMessage | DELIVERY_ACK | 1 | 0 | **1** |
| **TOTAL** | | **41** | **0** | **41** |

**Query 4: Sample interactiveMessage Structure**
```sql
SELECT id, to_timestamp("messageTimestamp") AT TIME ZONE 'Asia/Jakarta' AS ts_wib,
       status,
       "key"::jsonb->>'remoteJid' AS customer,
       "key"::jsonb->>'fromMe' AS from_me,
       "message"::jsonb->'interactiveMessage'->'body'->>'text' AS greeting_text,
       "message"::jsonb->'interactiveMessage'->'contextInfo'->'externalAdReply'->>'sourceApp' AS source_app
FROM "Message"
WHERE "instanceId"='999e9d24-cf32-46f3-b75b-577df5124ef0'
  AND "messageType" = 'interactiveMessage'
  AND "chatwootMessageId" IS NULL
ORDER BY "messageTimestamp" DESC LIMIT 10;
```

**Sample Results:**
| Timestamp | Customer | fromMe | Greeting | Source | Status |
|-----------|----------|--------|----------|--------|--------|
| 2025-11-18 15:13:06 | 6285156127818 | true | "Hi, Mam! Ada yang bisa kami bantu? 🙏" | instagram | NULL |
| 2025-11-18 15:13:05 | 6282166205550 | true | "Hi, Mam! Ada yang bisa kami bantu? 🙏" | instagram | NULL |
| 2025-11-18 15:13:05 | 628812873816 | true | "Hi, Mam! Ada yang bisa kami bantu? 🙏" | instagram | NULL |
| 2025-11-18 12:12:03 | 6281346691102 | true | "Hi, Mam! Ada yang bisa kami bantu? 🙏" | facebook | NULL |
| 2025-11-18 12:12:03 | 6287872506299 | true | "Hi, Mam! Ada yang bisa kami bantu? 🙏" | facebook | NULL |
| ... (35 more) | ... | ... | ... | ... | ... |

**Message Payload Structure (Sample):**
```json
{
  "interactiveMessage": {
    "body": {"text": "Hi, Mam! Ada yang bisa kami bantu? 🙏"},
    "contextInfo": {
      "externalAdReply": {
        "title": "Chat with us",
        "body": "[Instagram ad content...]",
        "sourceApp": "instagram",
        "sourceType": "ad",
        "sourceUrl": "https://www.instagram.com/p/...",
        "mediaType": "VIDEO",
        "ctwaClid": "...",
        "containsAutoReply": true,
        "showAdAttribution": true,
        "greetingMessageBody": "Hi, Mam! Ada yang bisa kami bantu? 🙏",
        "automatedGreetingMessageShown": true
      }
    }
  }
}
```

#### 3.8.2 Root Cause Analysis

**Confirmed:** Evolution API stores Instagram/Facebook ad greetings with proper structure BUT does NOT sync them to Chatwoot/Prospek.

**Root Cause:** `messageType = 'interactiveMessage'` is **NOT supported** by the ChatwootService integration.

**Key Findings:**
1. **41 Instagram/Facebook ad greetings** stored in Evolution DB
2. **100% sync failure rate** (0/41 synced to Prospek)
3. Messages have proper WhatsApp envelope structure:
   - ✅ `key` field present (fromMe, remoteJid, id)
   - ✅ Full message metadata available
   - ❌ ChatwootService does NOT process `interactiveMessage` type
4. Messages are triggered by:
   - Instagram click-to-WhatsApp ads (`sourceApp: "instagram"`)
   - Facebook click-to-WhatsApp ads (`sourceApp: "facebook"`)
   - Automated greeting feature in Meta ads (`containsAutoReply: true`)
5. All affected customers are **different contacts** (not a single conversation issue)

**Comparison with Other Message Types:**

| messageType | Sync Support | Example Count | Success Rate |
|-------------|--------------|---------------|--------------|
| conversation | ✅ Yes | Hundreds | ~90%+ |
| imageMessage | ✅ Yes | Dozens | ~75% |
| videoMessage | ✅ Yes | Some | ~75% |
| audioMessage | ✅ Yes | Some | ~75% |
| documentMessage | ✅ Yes | Some | ~75% |
| **interactiveMessage** | **❌ No** | **41** | **0%** |

**Impact:**
- Customer experience gap: Greetings visible in WhatsApp but not tracked in Prospek
- Support agents unaware of automated greetings, may send duplicate messages
- No audit trail for Instagram/Facebook ad conversions
- Business cannot measure ad-to-conversation conversion rate

#### 3.8.3 Recommended Actions

**Immediate:**
1. **Document limitation:** Inform business team that Instagram/Facebook ad greetings are NOT visible in Prospek
2. **Monitor impact:** Track how many conversations start from ads vs other sources

**Code Fix (Requires Evolution API source access):**
1. **Extend ChatwootService** to handle `interactiveMessage` type:
   - Extract text from `message.interactiveMessage.body.text`
   - Map ad metadata to Prospek custom attributes (ad source, campaign ID, etc.)
   - Sync to Chatwoot with proper attribution
2. **Add tests** for `interactiveMessage` processing
3. **Backfill:** Consider syncing the existing 41 unsynced messages after fix is deployed

**Alternative (If code fix not feasible):**
- Disable Instagram/Facebook ad auto-greetings in Meta Business Manager
- Use Evolution's own greeting system instead (but this has F2 bug - must fix first)

---

## 4. Evidence Archive
| File | Description |
|------|-------------|
| `evolution-prospek-sync-verification-20251117.txt` | Cross-check of 8 synced messages; Evo ↔ Prospek timestamps within 1–3s. |
| `unsynced-messages-complete-analysis-20251117.txt` | Deep dive into PENDING duplicates & DELIVERY_ACK media album failures (includes samples). |
| `evolution-prisma-error-full-context.txt` | Full stack trace for cache/delete Prisma validation error (other instance). |
| `mama-first-disconnect-incident-20251117.txt` | Details of the 401 device_removed logout. |
| `freeze-diagnostic-evidence-20251118.txt` | **Pre-restart forensic capture** of Nov 18 freeze: PENDING messages snapshot, container logs analysis, Sentry findings, freeze sequence reconstruction. Captured at 11:15 AM WIB before instance restart. |

All raw SQL/log outputs referenced above are retained for reproducibility.

---

## 5. Investigation Tracker
| ID | Issue | Status & Evidence | Next Step |
|----|-------|------------------|-----------|
| F1 | Freeze / DB write halt (Nov 11/14) | ⚠️ **Partially Resolved** – v2.3.2 fixed DB-level freeze but different freeze mechanism appeared. See F8. | Monitor for DB idle-in-transaction. Original freeze resolved but new type emerged. |
| F2 | PENDING greetings missing `chatwootMessageId` | ✅ **Root cause identified** – messages stored without WhatsApp envelope (key, pushName, etc.). See Section 3.2.1. **Strong correlation with F8 freeze.** | **URGENT:** Fix automated greeting send logic. May be triggering instance freeze (F8). HIGH PRIORITY. |
| F3 | DELIVERY_ACK sync failure (group media) | 🟡 **Improving** – was 44% success, now 73.5% (last 2h). 9 messages still unsynced. | Continue monitoring; if pattern persists, investigate media/album handling in ChatwootService. May be eventual consistency. |
| F4 | Prisma cache/delete validation error | 🟡 **Documented** – affects Theory of Living instance. Root cause: `cache.delete()` called with Prisma params instead of cache key. See Section 3.3. | **Upstream fix required:** Evolution API source code needs correction to pass proper cache key. Report to Evolution API maintainers. |
| F5 | WhatsApp 401 logout (Nov 17) | ⚠️ **Legacy** – Auto-reconnected ~18:00 WIB; old instance was later decommissioned. | None (instance retired). |
| F6 | Duplicate conversations/messages in Prospek | 🟡 Known since earlier incidents; still unresolved. Partially related to F2. | After F2 fix is deployed, re-investigate dedupe strategy with Prospek team. |
| F7 | Message gap during disconnect (17:53-18:21) | 🔵 **Archived** – Old inbox 63 retained as-is; no backfill planned for the new inbox. | No action (legacy inbox accepted as a loss cause). |
| F8 | **Freeze/Disconnect (Nov 18)** | ⚠️ **Legacy** – Old instance ran until 12:39, disconnected at 12:40, and was replaced at 15:15. | Reference only; fix greeting send logic (F2) before enabling on new instance. |
| F9 | WhatsApp-native greetings | ✅ **Disabled** – WhatsApp Business greeting turned off so Evolution/Prospek own automation. | Monitor in case it’s re-enabled in the future. |
| F10 | Instagram ad greeting not syncing | ✅ **Root cause identified** – `messageType='interactiveMessage'` NOT supported by ChatwootService. 41 ad greetings stored in Evolution but 0% sync rate. See Section 3.8. | **Code fix required:** Extend ChatwootService to handle interactiveMessage type. Extract text from `message.interactiveMessage.body.text` and sync to Prospek. |

---

## 6. Upcoming Actions (Prioritized)

**Immediate (new instance / inbox 71):**
1. ✅ **WhatsApp-native greeting disabled (F9)** – Nothing further unless business wants to re-enable it.
2. ✅ **Instagram greeting evidence captured (F10)** – Root cause identified: `messageType='interactiveMessage'` not supported by ChatwootService. 41 ad greetings stored in Evolution but 0% sync rate. Full analysis in Section 3.8. Business team should be informed that these greetings won't appear in Prospek until code fix is deployed.
3. **Monitor new inbox sync** – Verify the new instance maintains ≥90 % success, watching PENDING/DELIVERY_ACK counts as greetings/media reappear.

**Code fixes (requires Evolution API source access):**
4. **Fix automated greeting structure (F2)** – Rebuild the greeting send logic so it stores the full WhatsApp envelope (`key`, `pushName`, `messageType`, etc.) to avoid duplicates/freezes when greetings are re-enabled.
4b. **Extend ChatwootService for interactiveMessage (F10)** – Add support for `interactiveMessage` type: extract text from `message.interactiveMessage.body.text`, map ad metadata to Prospek custom attributes. Can backfill 41 existing unsynced ad greetings after deployment.
5. **Patch Prisma cache bug (F4)** – Replace `cache.delete({ data: ... })` with a proper cache-key delete; add tests to prevent recurrence.

**Operational follow-ups:**
6. **Backfill strategy for old inbox (F7)** – Decide whether to migrate key conversations from Prospek inbox 63 or keep it as read-only history.
7. **Alerts & dashboards** – Keep/extend alerts for PENDING counts, DELIVERY_ACK rate, WhatsApp disconnects, and Sentry Prisma errors on the new instance.

---

## 7. Proven vs Disproven Hypotheses
| Hypothesis | Result | Notes |
|------------|--------|-------|
| "Post-deploy freeze persists." | ❌ Disproven | No DB gaps since v2.3.2. |
| "PENDING messages never reach Prospek." | ❌ Disproven | They reach Prospek but as duplicates/misattributed entries. |
| "DELIVERY_ACK failures are due to Prospek rejection." | ❌ Disproven | Prospek logs show no webhook attempts; issue is on Evolution side. |
| "Prisma error is causing Mama First sync loss." | ❌ Disproven | Error only affects Theory of Living instance; no evidence on Mama First. |
| "Sync stuck at 14:48." | ❌ Disproven | Messages continued through 16:31; initial observation was UI cache/specific conversation. |
| "PENDING sync blocked by Chatwoot API." | ❌ Disproven | Root cause is incomplete message structure in DB - ChatwootService never attempts sync. |
| "DELIVERY_ACK sync improving over time." | ✅ Confirmed | Went from 44.44% (earlier) to 73.53% (current), suggesting eventual consistency or retry logic. |
| "WhatsApp disconnect is permanent." | ❌ Disproven | Auto-reconnected within ~7 minutes without manual intervention. |

---

## 8. Investigation Tools & Commands
Use these when gathering fresh evidence (replace IDs/timestamps as needed).

### 8.1 Evolution DB Health Snapshot
```bash
PGPASSWORD="$EVOLUTION_AZURE_PGPASSWORD" psql \
  "postgresql://evolution@evolution-prod.postgres.database.azure.com:5432/evolution?sslmode=require" -c "
SELECT 'instance_status', \"connectionStatus\", \"updatedAt\" AT TIME ZONE 'Asia/Jakarta'
FROM \"Instance\" WHERE \"id\"='44d098ff-548b-4a37-947e-3a88589098ec';

SELECT 'last_message_timestamp', to_timestamp(MAX(\"messageTimestamp\")) AT TIME ZONE 'Asia/Jakarta'
FROM \"Message\" WHERE \"instanceId\"='44d098ff-548b-4a37-947e-3a88589098ec';

SELECT status,
       COUNT(*) AS total,
       COUNT(\"chatwootMessageId\") AS synced,
       COUNT(*) - COUNT(\"chatwootMessageId\") AS unsynced
FROM \"Message\"
WHERE \"instanceId\"='44d098ff-548b-4a37-947e-3a88589098ec'
  AND to_timestamp(\"messageTimestamp\") > (now() - interval '1 hour')
GROUP BY status;
"
```

### 8.2 Sample Unsynced Messages (PENDING / DELIVERY_ACK)
```bash
PGPASSWORD="$EVOLUTION_AZURE_PGPASSWORD" psql ... -c "
SELECT id,
       status,
       to_timestamp(\"messageTimestamp\") AT TIME ZONE 'Asia/Jakarta' AS ts_local,
       \"message\"::jsonb -> 'message' AS payload
FROM \"Message\"
WHERE \"instanceId\"='44d098ff-548b-4a37-947e-3a88589098ec'
  AND \"chatwootMessageId\" IS NULL
  AND status IN ('PENDING','DELIVERY_ACK')
ORDER BY \"messageTimestamp\" DESC
LIMIT 10;
"
```

### 8.3 Evolution ↔ Prospek Cross-Check
```bash
# Evolution side (replace timeframe as needed)
PGPASSWORD="$EVOLUTION_AZURE_PGPASSWORD" psql ... -c "
SELECT to_timestamp(\"messageTimestamp\") AT TIME ZONE 'Asia/Jakarta' AS evo_ts_wib,
       \"chatwootMessageId\",
       id
FROM \"Message\"
WHERE \"instanceId\"='44d098ff-548b-4a37-947e-3a88589098ec'
  AND \"chatwootMessageId\" IS NOT NULL
ORDER BY \"messageTimestamp\" DESC
LIMIT 20;
"

# Prospek (Chatwoot) verification – update IDs from query above
PGPASSWORD="$PROSPEK_AZURE_PGPASSWORD" psql \
  "postgresql://whisper@prospek-prod.postgres.database.azure.com:5432/whisper?sslmode=require" -c "
SELECT m.id,
       m.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' AS prospek_ts_wib,
       c.inbox_id
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE m.id IN ( ... );
"
```

### 8.4 Container Logs & Metrics
```bash
# Evolution logs (adjust time window)
az containerapp logs show \
  --name evolution-prod \
  --resource-group evolution-prod \
  --tail 500 \
  --type console \
  --start-time "2025-11-17T05:30:00Z" \
  --end-time   "2025-11-17T08:30:00Z"

# CPU metrics
az monitor metrics list \
  --resource "/subscriptions/51f055c6-9754-46dc-82a8-e746d43afec5/resourceGroups/evolution-prod/providers/Microsoft.App/containerApps/evolution-prod" \
  --metric "CpuUsage" \
  --start-time "2025-11-17T04:00:00Z" \
  --end-time   "2025-11-17T08:00:00Z" \
  --interval PT5M
```

### 8.5 Prospek Logs for Webhooks
```bash
az containerapp logs show \
  --name prospek-prod \
  --resource-group prospek-prod \
  --tail 500 \
  --type console \
  | grep -E "webhook|403|422|error"
```

---

This document should be updated after each investigative session with new evidence, resolved items, and action status to prevent context loss across collaborators. 
