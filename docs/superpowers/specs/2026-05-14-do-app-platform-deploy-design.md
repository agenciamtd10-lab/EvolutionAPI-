# Evolution API — DigitalOcean App Platform deployment

**Date:** 2026-05-14
**Status:** Design — pending implementation plan
**Owner:** Victor Alencar

## Goal

Deploy Evolution API (this repo) to DigitalOcean App Platform across two environments — **staging** and **prod** — reusing the user's existing DO Managed Postgres and DO Managed Redis clusters, with media stored in DO Spaces. Other APIs already running in the user's DO account must be able to call Evolution API over authenticated HTTPS.

## Non-goals

- Self-hosted Postgres, Redis, or RabbitMQ. We reuse existing managed services.
- Horizontal autoscaling of the API service. Baileys holds long-lived WhatsApp Web sockets per tenant; multiple replicas would each try to own the same session. Vertical scale only.
- Private VPC ingress. App Platform doesn't offer it; access is public HTTPS guarded by `AUTHENTICATION_API_KEY`. If true VPC-internal ingress becomes a hard requirement, the right answer is a Droplet inside the VPC, not App Platform — out of scope for this design.
- Custom domains in v1. Use the default `*.ondigitalocean.app` URL first.

## Known trade-off (acknowledged)

Every App Platform deploy or restart drops all live WhatsApp Web sockets. Sessions are persisted in Redis via `CACHE_REDIS_SAVE_INSTANCES=true`, so tenants reconnect automatically within seconds, but they will see brief disconnects on each release. Accepted for v1.

## Architecture

```
                    Internet (HTTPS)
                          │
                          ▼
        ┌────────────────────────────────────┐
        │   DO App Platform                  │
        │   evolution-api-{prod,staging}     │
        │   ┌──────────────┐  ┌────────────┐ │
        │   │ api          │  │ manager    │ │
        │   │ Dockerfile   │  │ Manager UI │ │
        │   │ :8080        │  │ :80        │ │
        │   └──────────────┘  └────────────┘ │
        └─────────┬──────────────┬───────────┘
                  │              │
       Trusted sources           │ egress
                  │              ▼
   ┌──────────────┴──────────┐  DO Spaces
   │                         │  (media per env)
   ▼                         ▼
DO Managed Postgres     DO Managed Redis
(existing cluster,      (existing cluster,
 new DB per env)         shared, key prefix
                         per env)
```

### Two App Platform apps

Naming follows the existing CraftedAI convention (`craftedai-<service>-<env>`):

- `craftedai-evolution-api-prod` — region `nyc`, VPC `craftedai-prod` (`71038d79-53ae-421f-9bbb-8bc501ddd9f0`), deploys from `main`.
- `craftedai-evolution-api-staging` — region `nyc`, VPC `craftedai-staging` (`fa995bdd-294e-42fd-b4dc-e20133f596e5`), deploys from `staging` branch.

GitHub source: `CraftedAISolutions/evolution-api`. App Platform builds the image directly from the existing `Dockerfile` — no DOCR push step. (Other CraftedAI apps push to DOCR with a PRE_DEPLOY migration job; Evolution API deviates because the Dockerfile entrypoint already runs migrations, and skipping DOCR keeps the CI footprint minimal. Can be migrated to the DOCR pattern later for consistency.)

Each app contains two services defined in a single committed `.do/app.yaml`:

| Service | Source | Port | Instance size | Count |
|---------|--------|------|---------------|-------|
| `api` | Dockerfile in repo root | 8080 | `basic-xxs` | 1 |
| `manager` | `evoapicloud/evolution-manager:latest` image (or `manager/` directory build) | 80 | `basic-xxs` | 1 |

Both services use HTTP routes on the same app:

- `/` → `api`
- `/manager` → `manager` (rewrites to `/`)

Sizing is intentionally minimal; revisit once real instance counts are known.

### Database strategy

Reuses existing managed clusters — all four in `nyc3`:

| Env | Postgres cluster | Postgres host | Redis/Valkey cluster | Redis host |
|-----|------------------|---------------|----------------------|------------|
| prod | `craftedai-prod-pg` (`dc0f5397-25a0-4af9-8685-66d12ab131d5`) | `craftedai-prod-pg-do-user-37042223-0.l.db.ondigitalocean.com:25060` | `craftedai-prod-valkey` (`1f9703c1-9173-4456-8c33-74b0e96e72ed`) | `craftedai-prod-valkey-do-user-37042223-0.l.db.ondigitalocean.com:25061` |
| staging | `crafted-ai-staging-pg` (`1c712bb8-d951-4723-83cb-806417b1abad`) | `crafted-ai-staging-pg-do-user-37042223-0.f.db.ondigitalocean.com:25060` | `craftedai-staging-redis` (`7deda25f-27b4-420a-a885-13bc7e8d1572`) | `craftedai-staging-redis-do-user-37042223-0.f.db.ondigitalocean.com:25061` |

- **Postgres**: create dedicated logical databases on the existing clusters — `evolution_api` (prod cluster) and `evolution_api` (staging cluster), each with a dedicated `evolution_api` user holding privileges on its own DB only. `DATABASE_PROVIDER=postgresql`. Migrations run on container start via `Docker/scripts/deploy_database.sh` (existing entrypoint).
- **Redis/Valkey**: existing clusters reused. Use TLS (`rediss://`, port 25061). Isolation by key prefix:
  - prod: `CACHE_REDIS_PREFIX_KEY=evo:prod:`
  - staging: `CACHE_REDIS_PREFIX_KEY=evo:staging:`
  - `CACHE_REDIS_SAVE_INSTANCES=true` so Baileys sessions live in Redis (not on ephemeral disk).

Each App Platform app is bound to the matching VPC and added as a **trusted source** on its env's Postgres and Redis clusters.

### Media storage (DO Spaces)

One Space per env in `nyc3` (same region as DBs):

- `craftedai-evolution-media-prod`
- `craftedai-evolution-media-staging`

Env vars:

```
S3_ENABLED=true
S3_ENDPOINT=nyc3.digitaloceanspaces.com
S3_REGION=nyc3
S3_BUCKET=craftedai-evolution-media-<env>
S3_ACCESS_KEY=<spaces key>
S3_SECRET_KEY=<spaces secret>
S3_USE_SSL=true
```

No persistent volume on the App Platform app.

### Auth / access for other APIs

- Each env has its own strong, random `AUTHENTICATION_API_KEY`.
- Other APIs in the user's DO account call Evolution API at the public App Platform URL using the `apikey` header.
- Hardening pass post-launch (out of scope for v1): Cloudflare front-door with IP allowlist for caller egress IPs.

### Health checks & deploys

- `GET /` returns API metadata with 200 → use as the App Platform HTTP health check on `api`.
- Manager service: TCP health check on port 80.
- Deploys triggered by GitHub push:
  - `main` → prod app
  - `staging` → staging app
- No pre-deploy job needed; migrations run on container start.

### Observability

- App Platform captures stdout/stderr; logs available via the dashboard and `doctl apps logs`.
- Optional Sentry (`SENTRY_DSN` env var) with separate Sentry projects per env. Defer unless the user wants it in v1.

## Configuration

Single committed `.do/app.yaml` template parameterized per env. Secrets injected via App Platform encrypted env vars, never committed. Source of truth for non-secret config stays in `env.example`; the deployed env vars are the prod-shaped subset.

Critical env vars per env (non-exhaustive):

```
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=https://<app-default-url>

DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution_api:****@<env-pg-host>:25060/evolution_api?sslmode=require
DATABASE_CONNECTION_CLIENT_NAME=evolution_<env>

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=rediss://default:****@<env-redis-host>:25061
CACHE_REDIS_PREFIX_KEY=evo:<env>:
CACHE_REDIS_SAVE_INSTANCES=true

S3_ENABLED=true
S3_ENDPOINT=nyc3.digitaloceanspaces.com
S3_REGION=nyc3
S3_BUCKET=craftedai-evolution-media-<env>
S3_ACCESS_KEY=****
S3_SECRET_KEY=****
S3_USE_SSL=true

AUTHENTICATION_API_KEY=****
LANGUAGE=en
LOG_LEVEL=ERROR,WARN,INFO

DEL_INSTANCE=false
DEL_TEMP_INSTANCES=true
```

## Inputs confirmed

- DO API token: provided (rotate after deploy completes — exposed in chat).
- Postgres clusters: `craftedai-prod-pg`, `crafted-ai-staging-pg` (both `nyc3`).
- Redis/Valkey clusters: `craftedai-prod-valkey`, `craftedai-staging-redis` (both `nyc3`).
- GitHub repo: `CraftedAISolutions/evolution-api`. Branch mapping: `main` → prod, `staging` → staging (`staging` branch must be created; see implementation outline).
- Spaces region: `nyc3`.

## Implementation outline (for the plan phase)

1. Create `staging` branch on the GitHub repo (currently only `main` exists per `gitStatus`).
2. Add `.do/app.staging.yaml` and `.do/app.prod.yaml` (or a single template + per-env values) to the repo.
3. On each existing Postgres cluster, create the `evolution_api` database and a dedicated `evolution_api` user/role with privileges scoped to that DB only.
4. Provision the two DO Spaces buckets in `nyc3` and create one Spaces access key per env.
5. Create the **staging** app first via `doctl apps create --spec .do/app.staging.yaml` with secrets attached.
6. Add the staging app as a trusted source on `crafted-ai-staging-pg` and `craftedai-staging-redis`.
7. Verify: migrations ran, `GET /` returns 200, create a test WhatsApp instance, confirm reconnect-from-Redis after a manual app restart, confirm media upload to Spaces.
8. Create the **prod** app the same way; add it as trusted source on `craftedai-prod-pg` and `craftedai-prod-valkey`.
9. Distribute prod + staging `AUTHENTICATION_API_KEY` to the consuming APIs (CraftedAI core-api, etc.) via their secret stores.
10. Add a top-level `DEPLOYMENT.md` documenting deploy + rollback (App Platform "Roll back to previous deployment" + how to re-add trusted sources if a cluster is rebuilt).
11. Rotate the DO API token used during this work.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `basic-xxs` (0.5 GB) OOMs once a few Baileys instances are active | Scale vertically to `basic-xs` (1 GB) or higher; memory headroom is the first thing to watch. |
| Redeploys disconnect all WhatsApp sessions | Accepted; sessions reconnect from Redis. Schedule deploys outside peak hours. |
| Shared Redis cluster: a key-pattern bug could touch other apps' keys | Strict `CACHE_REDIS_PREFIX_KEY` per env; review any `KEYS *` / `FLUSHDB` usage in code. |
| App Platform egress IPs change → outbound webhook receivers with IP allowlists break | Document that egress is not pinned; if a consumer needs allowlisting, route through a fixed proxy. |
| Shared Postgres cluster CPU contention from neighbor apps | Monitor; move Evolution API to its own cluster if it becomes noisy. |

## Out of scope (future work)

- Custom domain + TLS via App Platform domains.
- Cloudflare front-door with WAF + IP allowlist.
- Prometheus/Grafana metrics (`Dockerfile.metrics` exists; defer).
- RabbitMQ / SQS / NATS event integrations.
- Multi-region or DR setup.
