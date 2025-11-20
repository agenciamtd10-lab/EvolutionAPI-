# Project Task List

## Phase 1: Migration & Setup ✅
- [x] Explore workspace and identify troubleshooting docs
- [x] Analyze issues (Pending Messages, Delivery ACK)
- [x] Migrate files to `docs/troubleshooting` and `backups`
- [x] Move repo to root and cleanup
- [x] Setup Azure deployment docs (`docs/deployment.md`) and script (`build.sh`)
- [x] Establish `AGENTS.md` with protocols and guardrails

## Phase 2: Stability Verification ✅
- [x] **Verify Production Build (v2.3.2)**
    - Successfully resolved build issues in Codespaces
    - Switched to npm-published baileys@6.7.19 for reproducible builds
    - Docker build and push to ACR completed: `v2.3.2-evolution-2f4a5d0`
- [x] **Documentation Updates**
    - Updated `docs/deployment.md` with pre-build checklist and troubleshooting
    - Documented dependency deviation from upstream

## Phase 2.5: Staging Deployment & Monitoring (Active)
- [ ] Deploy to Staging environment
    - [ ] Update image tag in Azure Portal
    - [ ] Verify application starts successfully
- [ ] Execute test plan (defined below)
- [ ] Monitor metrics for 24-48 hours
- [ ] Get approval to proceed to production

## Phase 3: Bug Fixes (Pending)
- [ ] Fix "Pending Message" duplicate attribution
- [ ] Fix "Delivery ACK" media sync failures
- [ ] Implement instance connection stability improvements

---

## Current State
- **Branch**: `production-v2.3.2`
- **Build Status**: ✅ Working (Codespaces + Docker)
- **Latest Image**: `prospek.azurecr.io/evolution:v2.3.2-evolution-2f4a5d0`
- **Next**: Deploy to staging and monitor

---

## Staging Deployment Test Plan

### Pre-Deployment Checks
- [ ] Current staging environment is healthy
- [ ] Backup current staging configuration/data
- [ ] Document current staging image tag for rollback

### Deployment Steps
1. Azure Portal → Container Apps → Staging Environment
2. Edit and Deploy → Update image tag to `v2.3.2-evolution-2f4a5d0`
3. Create new revision
4. Wait for deployment to complete (~2-5 minutes)

### Smoke Tests (Immediate - within 15 minutes)
- [ ] **Application Health**: Check container logs for startup errors
- [ ] **API Health**: GET `/health` or root endpoint returns 200
- [ ] **Database Connection**: Verify Prisma connects successfully (check logs)
- [ ] **Redis Connection**: Verify cache connection (check logs)
- [ ] **Instance List**: GET `/instance/fetchInstances` returns data

### Functional Tests (Within 1 hour)
- [ ] **Create Instance**: POST `/instance/create` with test instance
- [ ] **QR Code Generation**: Generate QR code for WhatsApp connection
- [ ] **WhatsApp Connection**: Scan QR and verify connection established
- [ ] **Send Message**: Send test text message via API
- [ ] **Receive Message**: Send message to bot, verify webhook fires
- [ ] **Media Message**: Send/receive image message
- [ ] **Instance Status**: Verify status endpoints return correct data
- [ ] **Delete Instance**: Clean up test instance

### Monitoring Period (24-48 hours)

**Critical Metrics:**
- [ ] **Application Availability**: Uptime > 99.5%
- [ ] **Error Rate**: < 1% of requests
- [ ] **Response Time**: p95 < 2s, p99 < 5s
- [ ] **Memory Usage**: No memory leaks (stable over time)
- [ ] **CPU Usage**: < 80% sustained

**WhatsApp-Specific Metrics:**
- [ ] **Connection Stability**: No unexpected disconnections
- [ ] **Message Delivery Rate**: > 98% of sent messages delivered
- [ ] **Webhook Success Rate**: > 95% of webhooks succeed
- [ ] **QR Code Generation**: 100% success rate

**Known Issues to Monitor:**
- [ ] "Pending Message" duplicate attribution (existing bug)
- [ ] "Delivery ACK" media sync failures (existing bug)
- [ ] Instance 401 disconnections (existing issue)

### Success Criteria
- All smoke tests pass
- All functional tests pass
- No new critical errors introduced
- Existing known issues remain at current levels (no regression)
- No user complaints during monitoring period

### Rollback Plan
If critical issues occur:
1. Azure Portal → Container Apps → Staging
2. Revisions → Select previous working revision
3. Activate previous revision
4. Document issue in `docs/troubleshooting/`

---

## Monitoring Dashboard Setup

**Log Queries (Azure Log Analytics):**

```kusto
// Error rate tracking
ContainerAppConsoleLogs_CL
| where ContainerName_s contains "evolution"
| where Log_s contains "error" or Log_s contains "ERROR"
| summarize ErrorCount=count() by bin(TimeGenerated, 5m)
| render timechart

// Response time tracking
ContainerAppConsoleLogs_CL
| where Log_s contains "HTTP"
| extend ResponseTime = extract("([0-9]+)ms", 1, Log_s)
| summarize p95=percentile(toint(ResponseTime), 95), p99=percentile(toint(ResponseTime), 99) by bin(TimeGenerated, 5m)

// Memory usage
ContainerAppSystemLogs_CL
| where ContainerName_s contains "evolution"
| summarize avg(MemoryUsage_d) by bin(TimeGenerated, 5m)
| render timechart
```

**Alerts to Configure:**
- Error rate > 5% for 5 minutes
- Response time p95 > 5s for 10 minutes
- Memory usage > 90% for 15 minutes
- Container restart events
