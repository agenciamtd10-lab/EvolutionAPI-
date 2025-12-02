# Mama First Freeze & Dec 1 Gap (Instance 999e9d24-cf32-46f3-b75b-577df5124ef0)

## 1) Incident Recap
- **Nov 30 08:33 WIB:** Instance froze. `connectionStatus=open` but `updatedAt` stale. Logs showed `PrismaClientValidationError: Argument \`Message\` is missing` during `messages.update`, specifically when calling `prismaRepository.messageUpdate.create`. This indicated a failure to link a message update to its parent message (stack at `/evolution/dist/main.js:227:33183`, with a misleading log artifact `Invalid this.cache.delete() invocation`). PENDING greetings (malformed `{"conversation": ...}`) were present before the freeze.
- **Dec 1 00:13 WIB restart(s):** Two restarts after deleting ~792 PENDING rows. Prisma errors continued to flood (crash loop).
- **Dec 1 morning (07:14–12:50 WIB):** Instance processing resumed partially. Evolution stored 167 messages; only 96 synced to Prospek. Prospek recorded **1,824 WAID messages** (1,885 total) in the same window → **~1,700-message gap**. Unsynced Evolution rows include normal conversations, images/reactions, PENDING greetings, and interactiveMessage ad greetings.
- **Duplication spike (Prospek-side, Nov 30):** For many contacts (e.g., 6287776643851, 6282112362417, 6281319991506), **10 conversations created at the exact same timestamp** (e.g., 2025-11-30 01:59:54 WIB) with identical promo content sent by Prospek user. Suggests Prospek job/automation duplication, not Evolution log-generated.

## 2) Current Evidence (Dec 1 window)
- Evolution DB (Dec 1):
  - Total 167 msgs; synced 96; window 07:13:56–12:50:41 WIB.
  - By status/type: DELIVERY_ACK convo 69 (47 synced), SERVER_ACK convo 30 (30), READ convo 20 (8), PENDING 8 (0), SERVER_ACK image 7 (7), DELIVERY_ACK reaction 6 (0), DELIVERY_ACK image 4 (0), interactiveMessage 3 (0), EDITED convo 2 (2), EDITED image 1 (1), SERVER_ACK video 1 (1).
  - Unsynced samples include normal incoming text, PENDING greetings, interactiveMessage ad greetings, and media/reactions.
- Prospek DB (Dec 1, inbox 71):
  - 1,885 messages total; 1,824 with `WAID` source_id. Time range 07:13:56–12:50:49 WIB (aligns with Evolution window). Indicates most traffic bypassed or failed sync.
- Logs (Dec 1):
  - PrismaClientValidationError: 984 occurrences between ~00:12Z–05:00Z.
  - PENDING log lines: 35 occurrences through the morning.
  - createConversation 894 vs reopenConversation 243 log lines (high churn).
  - No device_removed/conflict for Mama First in filtered instance logs.
- Sentry: Issue `EVOLUTION-PROD-3` (Prisma cache.delete misuse) last seen 2025-12-01T05:02:41Z, culprit `POST /chatwoot/webhook/:instanceName`.

## 3) Working Hypothesis
1. The `messages.update` handler triggered `PrismaClientValidationError` around the restart. The primary issue was `prismaRepository.messageUpdate.create` failing due to a missing `messageId` when a parent message was not found in the DB. A misleading log artifact (`Invalid this.cache.delete() invocation`) initially confused the root cause. This led to crash loops, breaking Chatwoot webhook processing and history sync; many incoming/outgoing events persisted but failed to sync, leaving `chatwootMessageId` null.
2. PENDING/interactiveMessage payloads remain unsupported/poison; they coincide with error bursts and remain unsynced. The interactive greetings are Meta ad auto-replies (sourceApp instagram/facebook, containsAutoReply=true) and cannot be disabled from WhatsApp—must be handled in code.
3. Massive Prospek-side duplication on Nov 30 (10 conversations per contact at identical timestamps) likely from Prospek automation, inflating counts and forcing Evolution to create/reopen repeatedly; Prospek “single conversation” lock did not prevent this under the error storm.

## 4) Actions Taken
- Deleted 792 PENDING rows pre-Dec 1 restart; performed two container restarts.
- Pulled Azure Log Analytics and Sentry data; filtered instance logs for Mama First; captured DB snapshots for Dec 1 (see tool section).
- Added `docs/troubleshooting/logs-howto.md` with exact commands/IDs to fetch logs via Log Analytics.
- **Code fix applied:** Guarded `messages.update` by checking for `message.messageId` before calling `prismaRepository.messageUpdate.create` to prevent `PrismaClientValidationError` due to missing `Message` relation. Added `// [WIDGET-WORKS]` comments for clarity.
- **Related Fix:** `messages.update` cache cleanup is now also guarded by a `try/catch` and can be disabled via `MESSAGE_UPDATE_CACHE_DELETE_DISABLED` env var (commit `b6341ff9`).
- **Development Process:** Ran `npm run lint` for code quality checks; updated `task.md` for progress tracking.
- Branch `fix/cache-delete-messages-update`, commit `fc433c98` pushed.
- **Staging integration follow-up (unrelated):** Prospek ↔ Evolution staging wired after fixing bad URLs. QR connect test caused repeated “Connection successfully established!” bot messages despite WA link failure; root cause not yet confirmed (likely bot contact enabled + reconnect loop). This was addressed in a separate branch (`fix/reconnection-loop-conflict-401`).

## 5) Next Steps (priority)
1. **Deploy `messages.update` fix:** Merge/push `fix/cache-delete-messages-update` into `production-v2.3.2` and roll the image (`prospek.azurecr.io/evolution:v2.3.2-evolution-a36173a9` or newer) to ACA; monitor Sentry/Log Analytics for `PrismaClientValidationError` and `[WIDGET-WORKS] Skipping messageUpdate.create` warnings.
2. **Backfill/Replay Dec 1 gap:** Extract unsynced Evolution rows (Dec 1, `chatwootMessageId IS NULL`) and replay to Prospek, or archive CSV for manual import.
3. **Stabilize PENDING/interactive handling:** Build safe envelope + poison-pill guards so PENDING/interactiveMessage ad auto-replies don’t block sync.
4. **Dedupe containment:** Add backend guard to reuse/reopen conversations if one exists in last 24h to reduce create-on-error bursts from Prospek duplication.
5. **Monitoring:** Alert on PrismaClientValidationError rate, PENDING count >0, unsynced rate, and conversation create spikes.
6. **Upstream tracking:** Upstream issues (EvolutionAPI #1158, #1266, #1852, #1925, #2080) mirror the Prisma bug; keep local fix minimal/labelled for mergeability.

## 6) To-Do After Fix (deferred until code hole is closed)
- **Backfill Dec 1 gap:** Export `Message` rows for Dec 1 with `chatwootMessageId IS NULL` (instance `999e9d24…`) and replay to Prospek; archive the CSV.
- **Dedup cleanup:** Merge the Nov 30 tenfold conversations per contact (e.g., 6287776643851, 6282112362417, 6281319991506; contact_ids 162753–162776) into single canonical convos.
- **Contact names backfill:** For duplicated/nameless Prospek contacts, set name from WhatsApp `pushName`/display name present in Evolution payloads; verify Prospek contact creation applies it.

## 7) Tooling (logs & DB) — SSOT
- Log pulls (Azure Log Analytics): see `docs/troubleshooting/logs-howto.md` for subscription/resource IDs and example commands. Key workspace: `3aaf7750-6587-4814-99ce-72558b7dde41`. Example query (post-fix, use for debugging):
  ```kql
  ContainerAppConsoleLogs_CL 
  | where ContainerAppName_s == 'evolution-dev' 
  | where TimeGenerated > ago(7d) 
  | where Log_s contains "Argument \`Message\` is missing" or Log_s contains "WIDGET-WORKS"
  | project TimeGenerated, Log_s
  | order by TimeGenerated desc
  ```
- Helpful filters (Python snippets in logs-howto):
  - Match instanceId `999e9d24` → `logs-evolution-prod-2025-12-01-mamafirst.txt`
  - Keywords: PrismaClientValidationError, PENDING, createConversation/reopenConversation, device_removed/conflict.
- DB quick queries (run with provided URLs):
  - Evolution Dec 1 status/type counts:
    ```
    SELECT status,"messageType",COUNT(*) total,COUNT("chatwootMessageId") synced
    FROM "Message"
    WHERE "instanceId"='999e9d24-cf32-46f3-b75b-577df5124ef0'
      AND to_timestamp("messageTimestamp")::date='2025-12-01'
    GROUP BY status,"messageType" ORDER BY total DESC;
    ```
  - Unsynced sample (Dec 1):
    ```
    SELECT id,status,"messageType",
           to_timestamp("messageTimestamp") AT TIME ZONE 'Asia/Jakarta' AS ts_wib,
           "chatwootMessageId",
           substr("message"::text,1,120) AS payload
    FROM "Message"
    WHERE "instanceId"='999e9d24-cf32-46f3-b75b-577df5124ef0'
      AND to_timestamp("messageTimestamp")::date='2025-12-01'
      AND "chatwootMessageId" IS NULL
    ORDER BY "messageTimestamp" LIMIT 50;
    ```
  - Prospek counts (inbox 71):
    ```
    SELECT COUNT(*) FROM messages m
    JOIN conversations c ON c.id=m.conversation_id
    WHERE c.inbox_id=71 AND m.created_at::date='2025-12-01';
    SELECT COUNT(*) FROM messages m
    JOIN conversations c ON c.id=m.conversation_id
    WHERE c.inbox_id=71 AND m.created_at::date='2025-12-01'
      AND m.source_id ILIKE 'WAID:%';
    ```
  - Duplicate detection (Prospek, since Nov 30):
    ```
    SELECT ct.identifier, COUNT(c.id) convs, MIN(c.created_at), MAX(c.created_at)
    FROM conversations c
    JOIN contact_inboxes ci ON ci.id=c.contact_inbox_id
    JOIN contacts ct ON ct.id=ci.contact_id
    WHERE ci.inbox_id=71 AND c.created_at>='2025-11-30'
    GROUP BY ct.identifier HAVING COUNT(c.id)>1;
    ```

Keep this file concise and update after each investigative session to avoid context drift.*** End Patch
