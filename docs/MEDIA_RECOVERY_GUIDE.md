# Media Recovery System — Agent Reference Guide

> **Branch:** `fix/media-key-jsonb-updateMediaMessage`
> **4 commits** on top of `release/2.3.7` — all production-tested.

## Overview

This patch adds 3 new endpoints + 2 bug fixes to Evolution API, making it **self-sufficient** for WhatsApp media recovery without external orchestrators.

### Problem Solved

WhatsApp CDN URLs expire after ~7 days. Once expired, media files (SOR documents, images, etc.) become permanently inaccessible unless you:
1. Have the original `mediaKey` + `directPath` (stored in EA's Message table)
2. Can trigger WhatsApp's `updateMediaMessage` protocol (asks sender to re-upload)
3. Can request historical messages via `fetchMessageHistory` (on-demand history sync)

Previously, only OwnPilot had these capabilities. Now EA has them natively.

---

## Endpoints

### 1. `POST /chat/retryMediaFromMetadata/{instance}`

**Purpose:** Download media using caller-supplied metadata — does NOT require message to exist in EA's DB.

**When to use:**
- You have `mediaKey` + `directPath` from an external source (e.g., OwnPilot DB)
- The message exists in EA but `getBase64FromMediaMessage` fails (DB lookup issue)

**Request:**
```json
{
  "messageId": "3EB0D228037ED522E72774",
  "remoteJid": "120363423491841999@g.us",
  "participant": "119365882089638@lid",
  "fromMe": false,
  "mediaKey": "base64-encoded-key",
  "directPath": "/v/t62.7119-24/...",
  "url": "https://mmg.whatsapp.net/...",
  "mimeType": "application/octet-stream",
  "filename": "2314CP_82_V1.SOR",
  "fileLength": 20973,
  "convertToMp4": false
}
```

**Response:**
```json
{
  "base64": "TWFwAMgAfA...",
  "mimetype": "application/octet-stream",
  "filename": "2314CP_82_V1.SOR"
}
```

**Algorithm:**
1. Reconstruct minimal WAMessage proto from provided metadata
2. Try direct `downloadMediaMessage` (fast-path — CDN still valid)
3. On failure → explicit `updateMediaMessage` with 30s timeout (Baileys RC9 workaround)
4. Retry download with refreshed URL

**Edge Cases:**
- `mediaKey` from PostgreSQL JSONB may be stored as `{0: 123, 1: 45, ...}` object instead of Uint8Array — the code handles both formats via lexicographic sort fix (commit `262c9300`)
- `updateMediaMessage` times out after 30s if sender is permanently offline — throws `BadRequestException`
- Audio files with `convertToMp4: true` are processed via `processAudioMp4`

---

### 2. `POST /chat/fetchGroupHistory/{instance}`

**Purpose:** Trigger WhatsApp on-demand history sync for a group. WhatsApp responds with old message protos containing **fresh mediaKey + directPath**.

**When to use:**
- Messages are missing from EA's DB (were sent before EA was connected)
- You need fresh mediaKeys for messages whose CDN URLs expired

**Request:**
```json
{
  "groupJid": "120363423491841999@g.us",
  "count": 50,
  "anchorMessageId": "3EB0DCCA32F22B9AA2A3B4",
  "anchorTimestamp": 1765216930,
  "anchorFromMe": false,
  "anchorParticipant": "90383560261829@lid"
}
```

**Response (immediate — 202-style):**
```json
{
  "sessionId": "3EB006B411C1B0933F9410",
  "groupJid": "120363423491841999@g.us",
  "count": 50,
  "message": "History sync requested. WhatsApp will deliver messages via messaging-history.set event (async)."
}
```

**Algorithm:**
1. Validate groupJid ends with `@g.us`
2. Rate-limit check (1 call per 30 seconds)
3. Call `sock.fetchMessageHistory(count, anchorKey, anchorTimestamp)`
4. WhatsApp delivers messages asynchronously via `messaging-history.set` event
5. Messages are stored in DB if `DATABASE_SAVE_DATA_HISTORIC=true`

**CRITICAL Prerequisites:**
- `DATABASE_SAVE_DATA_HISTORIC=true` must be set in env — otherwise messages arrive but are NOT saved to DB
- `daysLimitImportMessages` in Chatwoot config should be high (e.g., 1000) — otherwise old messages are filtered out
- EA must be the **sole linked device** on the WhatsApp number — if another client (e.g., OwnPilot) is connected, WhatsApp may route the response to that client instead

**Edge Cases:**
- Rate limited: 1 call per 30 seconds. Calling faster throws `BadRequestException` with wait time
- Empty anchor (`anchorMessageId: ""`) — WhatsApp may not respond at all
- WhatsApp returns messages OLDER than the anchor (backward direction only)
- Duplicate messages are handled by `messagesRepository.has(m.key.id)` check — no duplicates in DB
- Max 50 messages per call (WhatsApp protocol limit)
- Response is async — poll DB count or check logs to verify delivery

**Iterative Fetching Pattern:**
```
1. Find oldest message in DB → use as anchor
2. Call fetchGroupHistory
3. Wait 35s (30s rate-limit + 5s buffer)
4. Check if DB count increased
5. If increased → repeat from step 1 (new oldest message = new anchor)
6. If no increase → reached beginning of history
```

---

### 3. `POST /chat/batchRecoverMedia/{instance}`

**Purpose:** End-to-end batch recovery pipeline. For each message: DB lookup → download → MinIO upload → media record → mediaUrl update.

**When to use:**
- You have message IDs in EA's DB with expired CDN URLs
- You want to permanently store media in MinIO (S3) and update DB references

**Request:**
```json
{
  "messageIds": ["3EB0D228037ED522E72774", "3EB0DCCA32F22B9AA2A3B4"],
  "continueOnError": true,
  "storeToMinIO": true
}
```

**Response:**
```json
{
  "total": 2,
  "ok": 1,
  "skip": 1,
  "error": 0,
  "results": [
    {
      "messageId": "3EB0D228037ED522E72774",
      "status": "ok",
      "mediaUrl": "http://minio:9000/evolution-media/..."
    },
    {
      "messageId": "3EB0DCCA32F22B9AA2A3B4",
      "status": "skip",
      "error": "Already stored in MinIO"
    }
  ]
}
```

**Algorithm per message:**
1. Fetch message from DB by `key.id` + `instanceId`
2. Extract media metadata from `documentMessage | imageMessage | videoMessage | audioMessage | stickerMessage`
3. Skip if no `mediaKey`/`directPath`
4. Skip if `mediaUrl` already points to non-WhatsApp URL (already in MinIO)
5. Handle JSONB mediaKey format: `Object.keys().sort((a,b)=>parseInt(a)-parseInt(b))` for numeric key ordering
6. Call `retryMediaFromMetadata` with `getBuffer=true`
7. Upload buffer to MinIO via `s3Service.uploadFile`
8. Upsert `Media` record in DB
9. Update `message.mediaUrl` in the document message content

**Edge Cases:**
- JSONB mediaKey sort: PostgreSQL stores `{0:x, 1:y, 10:z, 2:w}` — lexicographic sort gives wrong byte order. Numeric sort fix applied.
- `continueOnError: false` — stops at first failure, returns partial results
- `storeToMinIO: false` — downloads but doesn't upload (useful for testing)
- S3 not enabled — downloads and reports size but doesn't upload
- Message not found in DB → `status: "skip"`
- Empty buffer after download → `status: "error"`
- Presigned URLs in `mediaUrl` expire after 7 days — but the object persists in MinIO. Generate new presigned URL via `s3Service.getObjectUrl()`

**Batch Processing Pattern:**
```python
# Recommended: 10 per batch, 1-2s delay between batches
for batch in chunks(message_ids, 10):
    response = POST /chat/batchRecoverMedia/{instance} { messageIds: batch }
    # Each batch takes ~10-30s depending on CDN/updateMediaMessage
```

---

## Bug Fixes (included in this patch)

### Fix 1: JSONB mediaKey Sort (commit `262c9300`)

**Problem:** PostgreSQL stores Uint8Array as JSONB object `{0: 182, 1: 45, 10: 67, 2: 99, ...}`. JavaScript `Object.keys()` returns lexicographic order: `["0", "1", "10", "2", ...]` — wrong byte sequence → HKDF decryption fails.

**Fix:** `Object.keys(mediaKey).sort((a, b) => parseInt(a) - parseInt(b)).map(k => mediaKey[k])`

**Affected:** `getBase64FromMediaMessage` + `batchRecoverMedia`

### Fix 2: Baileys RC9 `reuploadRequest` Dead Code (commit `f268571b`)

**Problem:** Baileys 7.0.0-rc.9 wires `reuploadRequest` callback in download options, but the catch block checks `error.status` while the actual error has `output.statusCode` — callback never triggers on 410/404.

**Fix:** Explicit `updateMediaMessage()` call in the catch block with 30s timeout, bypassing Baileys' broken internal retry.

**Affected:** `getBase64FromMediaMessage` + `retryMediaFromMetadata`

---

## Environment Configuration

**Required for history sync to work:**
```env
DATABASE_SAVE_DATA_HISTORIC=true    # MUST be set — otherwise messaging-history.set messages are dropped
```

**Required for old message import:**
```sql
-- In Chatwoot table, increase daysLimitImportMessages (default: 3 days)
UPDATE "Chatwoot" SET "daysLimitImportMessages" = 1000
WHERE "instanceId" = '<your-instance-id>';
```

**Required for MinIO storage:**
```env
S3_ENABLED=true
S3_BUCKET=evolution-media
S3_PORT=9000
S3_ENDPOINT=minio
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
```

---

## Production Results

Tested on GoConnectIT WhatsApp instance (Euronet SOR documents):

| Metric | Before | After |
|--------|--------|-------|
| Total messages | 1646 | 1870 (+224) |
| Oldest message | Dec 8, 2025 | Nov 10, 2025 |
| SOR files in MinIO | 0 | 1132/1137 (99.6%) |
| Irrecoverable | — | 5 (sender permanently offline) |

---

## File Changes

| File | Changes |
|------|---------|
| `src/api/dto/chat.dto.ts` | +3 DTOs: `RetryMediaFromMetadataDto`, `FetchGroupHistoryDto`, `BatchRecoverMediaDto` |
| `src/api/controllers/chat.controller.ts` | +3 controller methods |
| `src/api/routes/chat.router.ts` | +3 route registrations |
| `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` | +3 service methods, 2 bug fixes |
