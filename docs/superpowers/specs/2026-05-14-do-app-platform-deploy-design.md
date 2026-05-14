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

- `evolution-api-prod` — connects to prod Postgres + prod Redis + prod Spaces, deploys from `main`.
- `evolution-api-staging` — connects to staging Postgres + staging Redis + staging Spaces, deploys from `staging` branch.

Each app contains two services defined in a single committed `app.yaml`:

| Service | Source | Port | Instance size | Count |
|---------|--------|------|---------------|-------|
| `api` | Dockerfile in repo root | 8080 | `basic-xxs` | 1 |
| `manager` | `evoapicloud/evolution-manager:latest` image (or `manager/` directory build) | 80 | `basic-xxs` | 1 |

Both services use HTTP routes on the same app:

- `/` → `api`
- `/manager` → `manager` (rewrites to `/`)

Sizing is intentionally minimal; revisit once real instance counts are known.

### Database strategy

- **Postgres**: one shared cluster per env (existing). Create dedicated logical databases:
  - prod cluster → `evolution_api_prod` database, `evolution_api` user with privileges on that DB only.
  - staging cluster → `evolution_api_staging` database, same user/role pattern.
  - `DATABASE_PROVIDER=postgresql`, `DATABASE_CONNECTION_URI` points at the env-specific DB.
  - Migrations run on container start via `Docker/scripts/deploy_database.sh` (already the entrypoint).
- **Redis**: existing cluster reused. Isolation by key prefix:
  - prod: `CACHE_REDIS_PREFIX_KEY=evo:prod:`
  - staging: `CACHE_REDIS_PREFIX_KEY=evo:staging:`
  - `CACHE_REDIS_SAVE_INSTANCES=true` so Baileys sessions live in Redis (not on ephemeral disk).

The App Platform app must be added as a **trusted source** on each managed cluster.

### Media storage (DO Spaces)

One Space per env in the same region as the DB cluster:

- `evo-media-prod`
- `evo-media-staging`

Env vars:

```
S3_ENABLED=true
S3_ENDPOINT=<region>.digitaloceanspaces.com
S3_REGION=<region>
S3_BUCKET=evo-media-<env>
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
DATABASE_CONNECTION_URI=postgresql://evolution_api:****@<cluster-host>:25060/evolution_api_<env>?sslmode=require
DATABASE_CONNECTION_CLIENT_NAME=evolution_<env>

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=rediss://default:****@<redis-host>:25061
CACHE_REDIS_PREFIX_KEY=evo:<env>:
CACHE_REDIS_SAVE_INSTANCES=true

S3_ENABLED=true
S3_ENDPOINT=<region>.digitaloceanspaces.com
S3_REGION=<region>
S3_BUCKET=evo-media-<env>
S3_ACCESS_KEY=****
S3_SECRET_KEY=****
S3_USE_SSL=true

AUTHENTICATION_API_KEY=****
LANGUAGE=en
LOG_LEVEL=ERROR,WARN,INFO

DEL_INSTANCE=false
DEL_TEMP_INSTANCES=true
```

## What's needed from the user to execute

1. **DO API token** (read scope sufficient for planning; read/write to apply via `doctl`).
2. **Existing cluster identifiers**: prod + staging Postgres cluster IDs, prod + staging Redis cluster IDs, regions.
3. **GitHub repo URL and branch mapping** (`main` → prod, `staging` → staging — confirm).
4. **Spaces region** (default: match DB region).

## Implementation outline (for the plan phase)

1. Add `.do/app.yaml` to repo (parameterized for both envs).
2. Provision DO Spaces buckets + Spaces access keys.
3. Create `evolution_api_prod` and `evolution_api_staging` databases + DB users on existing Postgres clusters.
4. Add the future App Platform apps to trusted sources on the DB and Redis clusters (done after first deploy when the app's outbound IPs are known, or via "App Platform" trusted source category).
5. Create staging app first via `doctl apps create --spec .do/app.yaml` with staging env vars.
6. Verify migrations ran, `GET /` returns 200, create a test WhatsApp instance, confirm reconnect-from-Redis works after a manual restart.
7. Create prod app the same way once staging passes.
8. Distribute prod/staging `AUTHENTICATION_API_KEY` to the consuming APIs.
9. Document the deploy + rollback procedure in `Docker/` or a top-level `DEPLOYMENT.md`.

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
