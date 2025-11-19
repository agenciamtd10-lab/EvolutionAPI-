# Troubleshooting Session — “File Failed to Send”

## Background & Environment

- **Project**: Prospek — omnichannel CRM (fork of Chatwoot) for SMEs in Indonesia.
- **Architecture**: Multi-tenant SaaS running on Azure Container Apps.

### Components in Scope
- **Prospek (Rails)**
  - Resource group: `prospek-prod`
  - Container app: `prospek-prod`
  - Account under investigation: `23`
  - Conversation: [Account 23 / Conversation 5](https://web.prospek.app/app/accounts/23/conversations/5)
- **Evolution API (WhatsApp gateway built on Baileys)**
  - Resource group: `evolution-prod`
  - Container app: `evolution-prod`
  - Version: `v2.3.1`
  - Instance ID: `1959f210-f641-4dbe-b387-5aadba146071`
  - Instance name: `6281802233167 SBP`
  - Dashboard: https://evolution.prospek.app/manager

### Message Flow Recap
1. Evolution maintains a logged-in WhatsApp Multi-Device (Baileys) session.
2. It receives inbound messages over websocket, then posts webhooks to Prospek.
3. Outbound messages originate from Prospek → Evolution webhook → WhatsApp.

---

## Reported Symptom

- Customer attempted to post two PDF files into WhatsApp group `120363272603012030@g.us` via Prospek.
- UI surfaced the toast “Failed to send” and a system follow-up message (`2905860`): “🚨 The message could not be sent. Please check your connection.”
- Outgoing message `2905858` (the file send) is stuck with `status: failed`; attachments remain inaccessible in the CRM conversation view.

---

## Investigation Timeline (20 Oct 2025 UTC)

| Time (UTC) | System | Observation |
|------------|--------|-------------|
| 07:07:16 | Prospek Rails | `SendReplyJob` enqueued for message `2905858` (two PDFs) to conversation 5. |
| 07:07:21 | Prospek Sidekiq | WARN: `Invalid webhook URL https://evolution.prospek.app/chatwoot/webhook/6281802233167%20SBP : Timed out reading data from server`. Message status flips to `failed`; `content_attributes.external_error` populated. |
| 07:07:27 | Prospek Sidekiq | System follow-up message `2905860` created to inform the user of the failure. |
| 07:07:27 | Evolution API | HTTP 400 response from Baileys send call: `SessionError: No sessions` for instance `6281802233167 SBP` while targeting group `120363272603012030@g.us`. |
| 07:07:27 | Evolution API | Logs show `ChannelStartupService onSendMessageError undefined` immediately after the 400. |
| 07:07:29+ | Evolution API | Subsequent logs show typing indicators, but the failed message remains unsent until session is rebuilt. |

Key evidence snippets:

```text
2025-10-20T07:07:21.611Z prospek-sidekiq-prod
W, [2025-10-20T07:07:21.611594 #1]  WARN -- : [ActiveJob] [WebhookJob]
Invalid webhook URL https://evolution.prospek.app/chatwoot/webhook/6281802233167%20SBP : Timed out reading data from server
```

```text
2025-10-20T07:07:21.68Z prospek-sidekiq-prod
...content_attributes=>{"external_error"=>"Timed out reading data from server"}...
```

```text
2025-10-20T07:07:27.678Z evolution-prod
{ status: 400, error: 'Bad Request', message: [ 'SessionError: No sessions' ] }

2025-10-20T07:07:27.678Z evolution-prod
[ChannelStartupService] onSendMessageError undefined
```

```text
2025-10-20T07:07:27.741Z prospek-sidekiq-prod
I, ... Enqueued SendReplyJob ... arguments: 2905860 (system failure message)
```

All logs were retrieved from Azure Log Analytics workspace `workspacen8nad20` using `az rest` queries filtered for account_id 23, conversation 5, and Evolution instance `1959f210-f641-4dbe-b387-5aadba146071`.

---

## Findings & Analysis

1. **Webhook timeout is a downstream symptom.** Prospek waits for Evolution to acknowledge the send. Evolution immediately returns HTTP 400, so the Rails webhook call hangs until it times out, surfacing as “message failed.”
2. **Root cause is inside Evolution/Baileys.** The 400 response contains `SessionError: No sessions`, an error thrown by Baileys’ libsignal session cipher when it cannot locate the signal session for the destination group/contact. This is distinct from the main login session that persists across restarts.
3. **Login session persisted; per-chat signal session did not.** Logs show the instance is online and processing other actions (typing indicators, cache logs), meaning the WhatsApp credentials still exist. Only the per-peer encryption session was missing or stale.
4. **Common triggers for missing signal sessions:**
   - Deployment without the Baileys MD store volume mounted (loss of `session-*.json`).
   - Group member key rotation or rejoin events where Evolution has not yet received a new inbound message to rebuild the session.
   - Known Baileys/Evolution bugs during reconnects that invalidate stored sessions (see Baileys GitHub discussions around `SessionError: No sessions`).

---

## Recommended Remediation

1. **Verify persistent storage.** Confirm the Evolution container mounts the multi-device store volume (typically contains `session-*.json`). Ensure it survives restarts and is writable.
2. **Rebuild the signal session for the affected chat.** Prompt an inbound message from the WhatsApp group or manually reset the session via Evolution’s dashboard so Baileys renegotiates keys. After the session is recreated, resend the attachments and monitor for successful delivery.
3. **Add observability.** Create alerts on Evolution logs containing `SessionError: No sessions` so the support team can intervene before users notice failures.
4. **Improve webhook response handling (optional).** Catch HTTP 400 responses from Evolution in the Prospek webhook and relay a structured error immediately rather than timing out, giving agents actionable guidance.

---

## Related Work & References

- **Chatwoot GitHub**: Issue [#8390](https://github.com/chatwoot/chatwoot/issues/8390) and linked discussions describe “Timed out reading data from server” originating from Evolution webhook delays—mirrors the timeout we observed in Sidekiq.
- **Evolution API GitHub**: Issues [#1735](https://github.com/EvolutionAPI/evolution-api/issues/1735), [#1424](https://github.com/EvolutionAPI/evolution-api/issues/1424), and [#221](https://github.com/EvolutionAPI/evolution-api/issues/221) document `SessionError: No sessions` after MD store resets or signal desync.
- **Baileys upstream**: WhiskeySockets/Baileys Issue [#105](https://github.com/WhiskeySockets/Baileys/issues/105) ties the same error to missing libsignal sessions; resolution is to rebuild the session store or receive fresh inbound messages.
- **Community media**: YouTube 2025-05-05 (Portuguese) walkthrough shows re-sync steps when Evolution throws `SessionError: No sessions` while still logged in ([video link](https://www.youtube.com/watch?v=7aPIZTVNB08)).
- For additional research, search terms that yielded the above resources: `"SessionError: No sessions" Baileys`, `"Evolution API onSendMessageError undefined"`, `"Chatwoot webhook timed out reading data"`.

---

## Outstanding Questions / Follow-ups

- Was the persistent store volume modified or remounted before the failure? If yes, investigate automation around remounts.
- Do other conversations on the same instance log `SessionError`? If widespread, a broader session store rebuild may be required.
- Should we add automated health checks that periodically validate Baileys session presence for critical groups?

---

## Summary

- **Root cause:** Evolution could not locate the signal (encryption) session for WhatsApp group `120363272603012030@g.us`, returning HTTP 400 with `SessionError: No sessions`. Prospek’s webhook timed out, causing the file send to fail and generating message `2905860`.
- **Resolution path:** Restore the missing per-chat session by ensuring the Baileys MD store is persistent, triggering a session re-sync, and retrying the send. Implement monitoring to catch future session drops quickly.
