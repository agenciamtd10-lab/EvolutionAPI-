# Mama First Staging - Reconnection Loop Spam (Dec 1, 2025)

## Incident Summary
**Date**: December 1, 2025 ~23:03 WIB (16:03 UTC)
**Instance**: `{INSTANCE_ID}` ({CUSTOMER_NAME} staging)
**Environment**: `{RESOURCE_GROUP}` (Azure Container Apps)
**Symptom**: Spam of "🚀 Connection successfully established!" messages, high CPU usage, unresponsive UI
**Duration**: ~10 minutes (16:03-16:13 UTC)

## Timeline
- **16:03 UTC**: User scanned QR code, connection attempt started → **192 logs/min** (spike begins)
- **16:04-16:05 UTC**: Peak spam → **508-635 logs/min** (8-10x normal rate)
- **16:06-16:12 UTC**: Sustained high volume → **450-660 logs/min**
- **16:13 UTC**: Spam decreased → **236 logs/min**
- **16:14 UTC**: Back to normal → **35 logs/min**
- **Normal baseline**: 73-129 logs/min

## Root Cause

### The Reconnection Loop
Evolution entered an **infinite reconnection loop** due to improper handling of WhatsApp's "conflict/replaced" error:

1. **User scanned QR code** for instance `{INSTANCE_NAME}`
2. **WhatsApp rejected** with stream error:
   ```json
   {
     "tag": "stream:error",
     "content": [{"tag": "conflict", "attrs": {"type": "replaced"}}]
   }
   ```
   This means WhatsApp detected another active session for the same device.

3. **Instead of stopping**, Evolution's connection logic:
   - Caught the error
   - Immediately attempted to reconnect
   - Got the same conflict error
   - Tried again indefinitely

### The Spam Pattern
**Each reconnection attempt** (happening multiple times per second) logged:
```
INFO [ChannelStartupService] Browser: Evolution API,Chrome,5.15.186.1-1.cm2
INFO [ChannelStartupService] Baileys version: 2.3000.1030447823
INFO [ChannelStartupService] Group Ignore: false
INFO [ChannelStartupService]
┌──────────────────────────────┐
│    CONNECTED TO WHATSAPP     │  ← This banner = the spam!
└──────────────────────────────┘
VERBOSE [CacheService] cacheservice disabled
ERROR stream errored out (conflict/replaced)
[Loop repeats...]
```

The **"CONNECTED TO WHATSAPP" banner** is what the user saw as spam messages. This banner is logged on *every connection attempt*, even though the connection fails immediately with a conflict error.

## Impact
- **CPU spike**: 8-10x increase in log volume = high CPU usage processing reconnection logic
- **UI freeze**: Node.js event loop saturated by 40-50 DB queries/sec + 20-40 webhook requests/sec
- **Disconnect button fails**: Returns 400 "instance is not connected" due to state race condition
- **Failed device link**: WhatsApp conflict error prevented successful pairing
- **Log pollution**: 5,000+ spam logs in 10 minutes

## Evidence
**Log query** (Azure Log Analytics):
```kql
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == '{CONTAINER_APP}'
| where TimeGenerated between (datetime(2025-12-01T16:00:00Z) .. datetime(2025-12-01T16:15:00Z))
| summarize count() by bin(TimeGenerated, 1m)
```

**Sample logs**: [docs/troubleshooting/01-12-25-staging-reconnection-logs.txt]

## Deep Dive: State Race Condition

### Why Disconnect Button Fails (400 Error)
When user clicks disconnect during the loop, API returns `{"status": 400, "message": ["The \"...\" instance is not connected"]}`.

**The race condition** (whatsapp.baileys.service.ts:300-482):
1. Each reconnection cycle (~100-150ms):
   - `connecting` → WhatsApp accepts → `open` (logs "CONNECTED TO WHATSAPP" banner at line 446)
   - WhatsApp sends conflict error → `close` (status code 401)
   - Close handler checks if 401 in exclusion list (line 394) → **NOT excluded**
   - Calls `connectToWhatsapp()` again (line 397) → repeat

2. User clicks disconnect → `DELETE /instance/logout/{name}`
   - Controller checks `instance.state` (instance.controller.ts:407)
   - At that moment, state is almost always `close` (90% of cycle time)
   - Throws 400: "instance is not connected" (line 408)

**Why logs show "CONNECTED":** Connection DOES reach `open` state momentarily (triggering the banner log), but WhatsApp immediately terminates it with conflict error before disconnect request can be processed.

### Why UI Becomes Unresponsive
**Event loop saturation** from 8-10 reconnection cycles/second:

**Per-cycle overhead:**
- WebSocket open/close (TCP, TLS, Baileys handshake)
- 4+ DB queries (SELECT instance, UPDATE to `open`, UPDATE to `close`, SELECT auth)
- 5-10 log writes
- 2-4 webhook HTTP requests
- Profile picture fetch, Baileys event processing

**Aggregate load (500+ cycles in 10 minutes):**
- 40-50 DB queries/sec
- 50-100 log writes/sec
- 20-40 webhook requests/sec
- Constant network I/O

**Result:** Node.js event loop can't process user HTTP requests (disconnect/logout) promptly. API appears frozen.

## Fix Required

### Code Changes Needed
**File**: [src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts:392-397](src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts#L392-L397)

**Problem**: `codesToNotReconnect` list doesn't include 401 (conflict error status code), so Evolution keeps reconnecting indefinitely.

**Solution 1 (Simple)**: Add 401 to exclusion list:
```typescript
// Line 394
const codesToNotReconnect = [
  DisconnectReason.loggedOut,
  DisconnectReason.forbidden,
  401,  // [WIDGET-WORKS] Stop reconnection on conflict/replaced errors
  402,
  406
];
```

**Solution 2 (Comprehensive)**: Add conflict error detection:
```typescript
// [WIDGET-WORKS] Handle WhatsApp conflict/replaced error
private handleConnectionError(error: any) {
  // Check if error is conflict/replaced type
  if (error?.node?.tag === 'stream:error') {
    const conflictError = error.node.content?.find(
      (c: any) => c.tag === 'conflict' && c.attrs?.type === 'replaced'
    );

    if (conflictError) {
      this.logger.error('WhatsApp session conflict detected (replaced). Stopping reconnection.');

      // Clear session data to force new QR scan
      await this.clearSession();

      // Update instance status to show error
      await this.updateInstanceStatus('conflict');

      // DO NOT reconnect - user must scan new QR
      return;
    }
  }

  // For other errors, existing reconnection logic applies
  this.handleReconnection(error);
}
```

### Configuration Option
Add environment variable to control reconnection behavior:
```env
# Stop reconnection on conflict errors (recommended for staging/prod)
STOP_ON_SESSION_CONFLICT=true

# Max reconnection attempts before giving up
MAX_RECONNECT_ATTEMPTS=3
```

## Workaround (Immediate)
If conflict spam occurs again:
1. **Stop the instance** via Evolution UI or API: `DELETE /instance/:name`
2. **Clear browser cache/cookies** (if using web QR scan)
3. **Ensure no other devices** are linked to the WhatsApp account
4. **Scan fresh QR code** after waiting 30 seconds

## Prevention
1. **Implement fix above** to detect and stop on conflict errors
2. **Add reconnection limits** (max 3 attempts before manual intervention required)
3. **Rate limit connection attempts** (minimum 5 second delay between retries)
4. **Improve error messaging** - show "Session conflict - please disconnect other devices" to user

## Related Issues

**Evolution API GitHub:**
- [#765](https://github.com/EvolutionAPI/evolution-api/issues/765) - Loop conectando/desconectado (OPEN)
- [#272](https://github.com/EvolutionAPI/evolution-api/issues/272) - API reconnection loop (closed but persists)
- [#368](https://github.com/EvolutionAPI/evolution-api/issues/368) - Can't connect multiple instances (conflict)

**Baileys Library:**
- [#963](https://github.com/WhiskeySockets/Baileys/issues/963) - Stream Errored (conflict)
- [#1052](https://github.com/WhiskeySockets/Baileys/issues/1052) - 401 conflict errors

**Local:**
- [30-11-25-mama-first-freeze-analysis.md] - Different issue (Prisma cache.delete bug)

**Root cause:** WhatsApp's external "conflict/replaced" error (status 401) when session conflict detected. Evolution doesn't stop reconnecting on this error.

## Execution Tips (For Future Sessions)

### Quick Investigation Workflow
1. **Check logs for volume spike:**
   ```bash
   export AZURE_CONFIG_DIR="$(pwd)/.azure"
   az monitor log-analytics query \
     --workspace {LOG_ANALYTICS_WORKSPACE} \
     --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == '{CONTAINER_APP}' | where TimeGenerated between (datetime(YYYY-MM-DDTHH:MM:SSZ) .. datetime(YYYY-MM-DDTHH:MM:SSZ)) | summarize count() by bin(TimeGenerated, 1m)" \
     --output json
   ```

2. **Search for conflict errors:**
   ```bash
   # In saved logs JSON:
   grep -i "conflict\|stream error\|401" docs/troubleshooting/logs-{CONTAINER_APP}-*.json
   ```

3. **Check instance state:**
   ```bash
   curl -H "apikey: {KEY}" https://{CONTAINER_APP}.{AZURE_RANDOM_SUBDOMAIN}.southeastasia.azurecontainerapps.io/instance/connectionState/{instanceName}
   ```

### Key IDs & Endpoints
- **Subscription**: `{SUBSCRIPTION_ID}` (Microsoft Azure Sponsorship)
- **Resource Group**: `{RESOURCE_GROUP}`
- **Container App**: `{CONTAINER_APP}`
- **Log Analytics Workspace**: `{LOG_ANALYTICS_WORKSPACE}`
- **Staging URL**: `https://{CONTAINER_APP}.{AZURE_RANDOM_SUBDOMAIN}.southeastasia.azurecontainerapps.io`
- **Instance ID** (this incident): `{INSTANCE_ID}`
- **Instance Name** (this incident): `{INSTANCE_NAME}`

### Emergency Workaround
If reconnection loop happens again:
```bash
# Stop container (forces restart, breaks loop)
az containerapp revision restart \
  --name {CONTAINER_APP} \
  --resource-group {RESOURCE_GROUP} \
  --revision {current-revision-name}

# OR delete instance via API (won't work if UI frozen - use container restart)
curl -X DELETE \
  -H "apikey: {KEY}" \
  https://{CONTAINER_APP}.{AZURE_RANDOM_SUBDOMAIN}.southeastasia.azurecontainerapps.io/instance/delete/{instanceName}
```

### Testing the Fix
1. Deploy fix to staging
2. Scan QR code with **already-connected** WhatsApp (intentionally trigger conflict)
3. Verify:
   - No reconnection loop (logs return to normal within 1 minute)
   - Instance state set to 'close' permanently
   - Disconnect button works (returns success, not 400 error)
   - No CPU spike

### File References
- **Connection handler**: [src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts:300-482](src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts#L300-L482)
- **Reconnection logic**: Line 392-430 (close handler, codesToNotReconnect check)
- **"CONNECTED" banner**: Line 443-448 (logged on connection === 'open')
- **Logout endpoint**: [src/api/controllers/instance.controller.ts:404-418](src/api/controllers/instance.controller.ts#L404-L418)
- **State check**: Line 407-408 (throws 400 if state === 'close')

### Log Queries (Azure Monitor)
See [logs-howto.md](logs-howto.md) for complete reference. Replace `YYYY-MM-DD` with incident date:
```kql
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == '{CONTAINER_APP}'
| where TimeGenerated between (datetime(YYYY-MM-DDTHH:MM:SSZ) .. datetime(YYYY-MM-DDTHH:MM:SSZ))
| where Log_s contains "CONNECTED TO WHATSAPP" or Log_s contains "conflict" or Log_s contains "stream error"
| project TimeGenerated, Log_s
| order by TimeGenerated asc
```
