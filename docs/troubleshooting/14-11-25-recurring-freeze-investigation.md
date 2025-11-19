# Mama First Freeze Investigation, Validation & Release Plan
**Last Updated:** Nov 17, 2025 10:30 WIB  
**Scope:** WhatsApp instance `6287792348908 (Mama First)` / Evolution API production stack

---

## Executive Summary
- Two freeze incidents (Nov 11 & Nov 14) halted message persistence while the WhatsApp socket stayed “open.” Root cause traced to the Evolution API **v2.3.1 persistence bug** (fixed upstream in PR #1798) that blocks the Baileys worker whenever a DB write fails. High-volume traffic and the monitoring service’s attempt to auto-reconnect logged-out instances amplified the failure.
- Local validation on **v2.3.2** demonstrated stable message flow, clean Prisma state, and—after the backlog cleared—**~95% Chatwoot sync**. Multi-line template messages that previously failed now sync end-to-end.
- We will now promote the environment to **`evoapicloud/evolution-api:v2.3.2`** using the official Docker Hub image, delete session folders, rescan QR codes, and run a 48–72 h monitoring soak before declaring the incident fully resolved.

---

## Chronology of Key Events
| Date/Time (WIB) | Event |
|-----------------|-------|
| **Nov 7 09:00** | Added missing `Chat_instanceId_remoteJid_key` constraint; resolved “couldn’t finish syncing.” |
| **Nov 8 16:55** | Accidental upgrade to v2.3.6 triggered message gaps (Evolution issue #2061). Rolled back to v2.3.1 but without recreating session → Bad MAC logout on Nov 10. |
| **Nov 11 16:26** | **Freeze #1**: Database writes stopped for 29 h while instance stayed `open`. No container restarts. |
| **Nov 12 09:54** | Five previously logged-out instances automatically flipped to `connecting` and stuck (monitoring service bug). |
| **Nov 14 06:23** | **Freeze #2**: Same symptom without resource spikes, confirming recurring application bug. |
| **Nov 14 22:30** | Local v2.3.2 test showed stable worker but only 47 % Chatwoot sync; eight multi-line template messages lacked `chatwootMessageId`. |
| **Nov 17 10:22** | After soak, sync rate recovered to **94.7 %**, no idle DB transactions, and multi-line “Midwife Level” price list messages confirmed synced (Prospek conversation 163 / message 2165). |

---

## Investigation Findings & Evidence
### 1. Failure Analysis
- **Primary Failure – v2.3.1 Persistence Bug:** PR #1798 fixes the exact “socket open but DB idle” symptom. During both freezes the latest `messageTimestamp` froze while `connectionStatus=open`, with historical Prisma `messages.update` failures in Sentry. There was no resource exhaustion.
- **Trigger – High-volume handler behavior:** Mama First’s load (2,599 chats, 33 message types, 36k unsynced msgs) increases the chance of write failures, which wedge the Baileys worker.
- **Amplifier – `WAMonitoringService` auto-reconnect:** Reconnecting logged-out instances without filtering led to five dormant tenants getting stuck in `connecting`, compounding the freeze.
- **Session corruption hypothesis:** New session files were created Nov 10, yet freezes recurred, proving old files weren’t the cause. Session recreation is still required whenever changing versions.
- **Resource checks:** Azure metrics showed normal CPU/memory during the second freeze; `pg_stat_activity` revealed no idle-in-transaction build-up at the checkpoints, eliminating DB pool exhaustion.

### 2. Validation & Monitoring (Local v2.3.2)

| Checkpoint | Key Observations |
|------------|------------------|
| **Nov 14 22:30 WIB** | `connectionStatus=open`, Baileys processing logs present, zero Prisma errors; latest message timestamp current. Chatwoot sync **46.7 %** (7/15), eight multi-line template messages unsynced—logged as degraded. |
| **Nov 17 10:22 WIB** | Latest message `2025-11-17 10:20:31`, DB clean (0 idle transactions). Chatwoot sync **94.7 %】**, confirming backlog cleared. Prospek DB contains message 545 and the “Midwife Level” price list (conversation 163 / message 2165). |

**Conclusion:** v2.3.2 resolves the freeze and, once backlog finishes, restores near-100% Chatwoot sync. Multi-line template messages now populate `chatwootMessageId`.

---

## Production Upgrade Plan – Evolution API v2.3.2

### Pre-Deployment Checklist
- [ ] Stakeholders notified; QR rescan downtime accepted.
- [ ] Azure Files share/DB snapshots confirmed.
- [ ] Monitoring queries/Sentry alerts ready for 48–72 h soak.

### Deployment Steps
1. **Image Prep:** Configure Container App → Application → Containers:
   - Image source: *Docker Hub or other registries*
   - Image type: *Public*
   - Registry login server: `evoapicloud`
   - Image & tag: `evolution-api:v2.3.2`
2. **Session Reset per Instance:**
   - Stop service → delete `<share>/instances/<instance-id>` → restart → rescan QR. Do not reuse old session files.

### Post-Deployment Monitoring (48–72 h)
- Hourly SQL checks: last message timestamp, Chatwoot sync rate, `pg_stat_activity`.
- `az containerapp logs show` for Baileys connection updates, ChatwootService dispatches, Prisma errors.
- Monitor Sentry issues EVOLUTION-PROD-3/18 for spikes; alert if sync <90%.
- Verify Prospek inbox receives sample messages (e.g., price list templates).

### Rollback Plan
- Keep v2.3.1 image cached for emergency redeploy.
- Restore backed-up session folders only if upgrade fails before QR scan completes.

### Image Source Decision
- Use official Docker Hub build (`evoapicloud/evolution-api:v2.3.2`). It already includes PR #1798 and Baileys 6.7.19; building locally is unnecessary unless custom patches are required.

---

## Next Steps
1. Execute the production upgrade per plan and document QR rescan confirmations.
2. Run the 48–72 h monitoring soak; update Nov 17–20 stats in the post-release report.
3. Close the incident with a summarized learning sheet (version change protocol, monitoring automation, Chatwoot sync guards).

---

*This consolidated log replaces previous separate notes (freeze investigation plan, monitoring logs). Fold its learnings into the permanent runbook once the incident is closed.*
