# Evolution API — DigitalOcean App Platform Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Evolution API to DigitalOcean App Platform in two envs (staging + prod), reusing existing managed Postgres + Valkey clusters, with media in DO Spaces.

**Architecture:** Two App Platform apps (`craftedai-evolution-api-prod` and `craftedai-evolution-api-staging`), each running two services (`api` from this repo's Dockerfile, `manager` from `evoapicloud/evolution-manager:latest`). Each app is bound to its env's VPC and added as a trusted source on the matching Postgres + Valkey clusters. Baileys WhatsApp sessions persist in Redis; media goes to DO Spaces. App Platform builds the API image directly from GitHub on push.

**Tech Stack:** DigitalOcean App Platform · DO Managed Postgres · DO Managed Valkey · DO Spaces (S3-compatible) · `doctl` CLI · GitHub source (`CraftedAISolutions/evolution-api`)

**Spec:** [`docs/superpowers/specs/2026-05-14-do-app-platform-deploy-design.md`](../specs/2026-05-14-do-app-platform-deploy-design.md)

---

## Prerequisites

Before starting, verify on the executor's machine:

```bash
doctl version                            # any recent version
doctl auth init -t $DIGITALOCEAN_TOKEN   # token in env, NOT inline
doctl account get                        # confirms auth works
psql --version                           # for DB user provisioning
openssl version                          # for secret generation
```

The DO API token must be exported as `DIGITALOCEAN_ACCESS_TOKEN` for `doctl` (or pass `--access-token`). Never echo it into logs or commit it.

**Known IDs and hosts (from spec, do not re-derive):**

| Resource | Prod | Staging |
|----------|------|---------|
| Postgres cluster ID | `dc0f5397-25a0-4af9-8685-66d12ab131d5` | `1c712bb8-d951-4723-83cb-806417b1abad` |
| Postgres host | `craftedai-prod-pg-do-user-37042223-0.l.db.ondigitalocean.com` | `crafted-ai-staging-pg-do-user-37042223-0.f.db.ondigitalocean.com` |
| Valkey cluster ID | `1f9703c1-9173-4456-8c33-74b0e96e72ed` | `7deda25f-27b4-420a-a885-13bc7e8d1572` |
| Valkey host | `craftedai-prod-valkey-do-user-37042223-0.l.db.ondigitalocean.com` | `craftedai-staging-redis-do-user-37042223-0.f.db.ondigitalocean.com` |
| VPC UUID | `71038d79-53ae-421f-9bbb-8bc501ddd9f0` | `fa995bdd-294e-42fd-b4dc-e20133f596e5` |

Postgres port: `25060` (SSL required). Valkey port: `25061` (TLS, scheme `rediss://`). Region: `nyc3` (clusters and Spaces) / `nyc` (App Platform).

---

## Task 1: Create the `staging` branch on GitHub

**Files:** none (git only)

- [ ] **Step 1: Verify current branch is `main` and clean**

```bash
git status -sb
```
Expected: `## main...origin/main` and no uncommitted changes (the design + plan docs already committed).

- [ ] **Step 2: Create and push the `staging` branch**

```bash
git checkout -b staging
git push -u origin staging
git checkout main
```
Expected: `staging` branch exists on `origin`. Verify:
```bash
git ls-remote --heads origin staging
```
Output must include a SHA followed by `refs/heads/staging`.

---

## Task 2: Provision DO Spaces buckets and access keys

DO Spaces buckets and Spaces *access keys* are created via the DO API, not `doctl` (doctl doesn't manage Spaces). Use `s3cmd` or `aws s3api` after creating an access key in the DO console.

**Files:** none (DO resources only); write the resulting keys into your password manager or `.envrc` (gitignored).

- [ ] **Step 1: Generate one Spaces access key per env in the DO console**

In the DO Control Panel → API → Spaces Keys, create:
- `evolution-api-staging` → save `key` and `secret` as `SPACES_STAGING_KEY` / `SPACES_STAGING_SECRET`.
- `evolution-api-prod` → save as `SPACES_PROD_KEY` / `SPACES_PROD_SECRET`.

Store all four values in your secret manager. They will be injected into the App Platform env vars later.

- [ ] **Step 2: Create the two Spaces buckets using `s3cmd`**

Install `s3cmd` if needed (`brew install s3cmd`), then for each env:

```bash
# Staging
s3cmd --access_key=$SPACES_STAGING_KEY --secret_key=$SPACES_STAGING_SECRET \
  --host=nyc3.digitaloceanspaces.com --host-bucket='%(bucket)s.nyc3.digitaloceanspaces.com' \
  mb s3://craftedai-evolution-media-staging

# Prod
s3cmd --access_key=$SPACES_PROD_KEY --secret_key=$SPACES_PROD_SECRET \
  --host=nyc3.digitaloceanspaces.com --host-bucket='%(bucket)s.nyc3.digitaloceanspaces.com' \
  mb s3://craftedai-evolution-media-prod
```
Expected: `Bucket 's3://craftedai-evolution-media-<env>/' created`.

- [ ] **Step 3: Verify both buckets exist**

```bash
s3cmd --access_key=$SPACES_PROD_KEY --secret_key=$SPACES_PROD_SECRET \
  --host=nyc3.digitaloceanspaces.com ls
```
Expected: list includes `s3://craftedai-evolution-media-prod`. Repeat with staging key to confirm staging bucket.

---

## Task 3: Provision Postgres databases and users (staging)

The Evolution API user gets a dedicated database with full privileges on that DB only. No privileges on the `defaultdb` or other consumers' DBs on the cluster.

**Files:** none (DB only); save the generated DB password to your secret manager.

- [ ] **Step 1: Get the staging cluster admin connection string**

```bash
doctl databases connection 1c712bb8-d951-4723-83cb-806417b1abad --format URI
```
Save the output as `STAGING_ADMIN_URI`. It's `postgresql://doadmin:...@host:25060/defaultdb?sslmode=require`.

- [ ] **Step 2: Generate a strong password for the new DB user**

```bash
openssl rand -base64 32 | tr -d '/+=' | head -c 32
```
Save as `STAGING_DB_PASSWORD`. Store in secret manager.

- [ ] **Step 3: Create the database, role, and grants**

```bash
psql "$STAGING_ADMIN_URI" <<EOF
CREATE DATABASE evolution_api;
CREATE ROLE evolution_api WITH LOGIN PASSWORD '$STAGING_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE evolution_api TO evolution_api;
\c evolution_api
GRANT ALL ON SCHEMA public TO evolution_api;
EOF
```
Expected output: `CREATE DATABASE`, `CREATE ROLE`, `GRANT`, `You are now connected...`, `GRANT`.

- [ ] **Step 4: Verify by connecting as the new role**

```bash
PGPASSWORD="$STAGING_DB_PASSWORD" psql \
  "postgresql://evolution_api@crafted-ai-staging-pg-do-user-37042223-0.f.db.ondigitalocean.com:25060/evolution_api?sslmode=require" \
  -c "SELECT current_user, current_database();"
```
Expected: one row showing `evolution_api | evolution_api`.

The full staging `DATABASE_CONNECTION_URI` to use later:
```
postgresql://evolution_api:$STAGING_DB_PASSWORD@crafted-ai-staging-pg-do-user-37042223-0.f.db.ondigitalocean.com:25060/evolution_api?sslmode=require
```

---

## Task 4: Provision Postgres databases and users (prod)

Same as Task 3, against the prod cluster. Repeated in full (do not skim from Task 3).

- [ ] **Step 1: Get the prod cluster admin connection string**

```bash
doctl databases connection dc0f5397-25a0-4af9-8685-66d12ab131d5 --format URI
```
Save the output as `PROD_ADMIN_URI`.

- [ ] **Step 2: Generate a strong password for the new DB user**

```bash
openssl rand -base64 32 | tr -d '/+=' | head -c 32
```
Save as `PROD_DB_PASSWORD`.

- [ ] **Step 3: Create the database, role, and grants**

```bash
psql "$PROD_ADMIN_URI" <<EOF
CREATE DATABASE evolution_api;
CREATE ROLE evolution_api WITH LOGIN PASSWORD '$PROD_DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE evolution_api TO evolution_api;
\c evolution_api
GRANT ALL ON SCHEMA public TO evolution_api;
EOF
```
Expected: same output pattern as Task 3 Step 3.

- [ ] **Step 4: Verify by connecting as the new role**

```bash
PGPASSWORD="$PROD_DB_PASSWORD" psql \
  "postgresql://evolution_api@craftedai-prod-pg-do-user-37042223-0.l.db.ondigitalocean.com:25060/evolution_api?sslmode=require" \
  -c "SELECT current_user, current_database();"
```
Expected: one row showing `evolution_api | evolution_api`.

Full prod `DATABASE_CONNECTION_URI`:
```
postgresql://evolution_api:$PROD_DB_PASSWORD@craftedai-prod-pg-do-user-37042223-0.l.db.ondigitalocean.com:25060/evolution_api?sslmode=require
```

---

## Task 5: Fetch the Valkey (Redis) connection URIs

App Platform needs a full `rediss://` URI per env. The managed cluster only has the `default` user with a generated password — we reuse it.

- [ ] **Step 1: Fetch the prod Valkey URI**

```bash
doctl databases connection 1f9703c1-9173-4456-8c33-74b0e96e72ed --format URI
```
Save as `PROD_REDIS_URI`. Must start with `rediss://`. (If it shows `redis://`, replace the scheme with `rediss://` and keep port `25061`.)

- [ ] **Step 2: Fetch the staging Valkey URI**

```bash
doctl databases connection 7deda25f-27b4-420a-a885-13bc7e8d1572 --format URI
```
Save as `STAGING_REDIS_URI`.

- [ ] **Step 3: Verify both with `redis-cli`**

```bash
redis-cli -u "$STAGING_REDIS_URI" PING   # expect PONG
redis-cli -u "$PROD_REDIS_URI" PING      # expect PONG
```

(If `redis-cli` isn't installed: `brew install redis`.)

---

## Task 6: Generate per-env Evolution API auth keys

`AUTHENTICATION_API_KEY` is the bearer-style API key consumers will use to call Evolution API.

- [ ] **Step 1: Generate the two keys**

```bash
echo "STAGING: evo_staging_$(openssl rand -hex 24)"
echo "PROD:    evo_prod_$(openssl rand -hex 24)"
```
Save as `STAGING_API_KEY` and `PROD_API_KEY`. These must be stored in the project's secret manager — consuming services (e.g. CraftedAI core-api) will need them.

---

## Task 7: Add the App Platform spec for staging

**Files:**
- Create: `.do/app.staging.yaml`

- [ ] **Step 1: Create `.do/app.staging.yaml`**

```yaml
name: craftedai-evolution-api-staging
region: nyc
vpc_uuid: fa995bdd-294e-42fd-b4dc-e20133f596e5

services:
  - name: api
    instance_count: 1
    instance_size_slug: basic-xxs
    http_port: 8080
    dockerfile_path: Dockerfile
    source_dir: /
    github:
      repo: CraftedAISolutions/evolution-api
      branch: staging
      deploy_on_push: true
    health_check:
      http_path: /
      initial_delay_seconds: 30
      period_seconds: 15
      timeout_seconds: 5
      failure_threshold: 3
      success_threshold: 1
    envs:
      - { key: SERVER_TYPE, value: "http", scope: RUN_TIME }
      - { key: SERVER_PORT, value: "8080", scope: RUN_TIME }
      - { key: SERVER_URL, value: "${APP_URL}", scope: RUN_TIME }
      - { key: SERVER_DISABLE_DOCS, value: "false", scope: RUN_TIME }
      - { key: SERVER_DISABLE_MANAGER, value: "true", scope: RUN_TIME }
      - { key: CORS_ORIGIN, value: "*", scope: RUN_TIME }
      - { key: CORS_METHODS, value: "POST,GET,PUT,DELETE", scope: RUN_TIME }
      - { key: CORS_CREDENTIALS, value: "true", scope: RUN_TIME }
      - { key: DATABASE_PROVIDER, value: "postgresql", scope: RUN_AND_BUILD_TIME }
      - { key: DATABASE_CONNECTION_URI, value: "<STAGING_DATABASE_CONNECTION_URI>", scope: RUN_TIME, type: SECRET }
      - { key: DATABASE_CONNECTION_CLIENT_NAME, value: "evolution_staging", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_INSTANCE, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_NEW_MESSAGE, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_MESSAGE_UPDATE, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_CONTACTS, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_CHATS, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_HISTORIC, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_LABELS, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_IS_ON_WHATSAPP, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_IS_ON_WHATSAPP_DAYS, value: "7", scope: RUN_TIME }
      - { key: DATABASE_DELETE_MESSAGE, value: "false", scope: RUN_TIME }
      - { key: CACHE_REDIS_ENABLED, value: "true", scope: RUN_TIME }
      - { key: CACHE_REDIS_URI, value: "<STAGING_REDIS_URI>", scope: RUN_TIME, type: SECRET }
      - { key: CACHE_REDIS_PREFIX_KEY, value: "evo:staging:", scope: RUN_TIME }
      - { key: CACHE_REDIS_TTL, value: "604800", scope: RUN_TIME }
      - { key: CACHE_REDIS_SAVE_INSTANCES, value: "true", scope: RUN_TIME }
      - { key: CACHE_LOCAL_ENABLED, value: "true", scope: RUN_TIME }
      - { key: CACHE_LOCAL_TTL, value: "86400", scope: RUN_TIME }
      - { key: AUTHENTICATION_API_KEY, value: "<STAGING_API_KEY>", scope: RUN_TIME, type: SECRET }
      - { key: AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES, value: "false", scope: RUN_TIME }
      - { key: LOG_LEVEL, value: "ERROR,WARN,INFO", scope: RUN_TIME }
      - { key: LOG_COLOR, value: "false", scope: RUN_TIME }
      - { key: LOG_BAILEYS, value: "error", scope: RUN_TIME }
      - { key: DEL_INSTANCE, value: "false", scope: RUN_TIME }
      - { key: DEL_TEMP_INSTANCES, value: "true", scope: RUN_TIME }
      - { key: LANGUAGE, value: "en", scope: RUN_TIME }
      - { key: WEBSOCKET_ENABLED, value: "true", scope: RUN_TIME }
      - { key: WEBSOCKET_GLOBAL_EVENTS, value: "true", scope: RUN_TIME }
      - { key: CONFIG_SESSION_PHONE_CLIENT, value: "Evolution API", scope: RUN_TIME }
      - { key: CONFIG_SESSION_PHONE_NAME, value: "Chrome", scope: RUN_TIME }
      - { key: QRCODE_LIMIT, value: "30", scope: RUN_TIME }
      - { key: QRCODE_COLOR, value: "#198754", scope: RUN_TIME }
      - { key: S3_ENABLED, value: "true", scope: RUN_TIME }
      - { key: S3_ACCESS_KEY, value: "<SPACES_STAGING_KEY>", scope: RUN_TIME, type: SECRET }
      - { key: S3_SECRET_KEY, value: "<SPACES_STAGING_SECRET>", scope: RUN_TIME, type: SECRET }
      - { key: S3_ENDPOINT, value: "nyc3.digitaloceanspaces.com", scope: RUN_TIME }
      - { key: S3_BUCKET, value: "craftedai-evolution-media-staging", scope: RUN_TIME }
      - { key: S3_PORT, value: "443", scope: RUN_TIME }
      - { key: S3_USE_SSL, value: "true", scope: RUN_TIME }
      - { key: S3_REGION, value: "nyc3", scope: RUN_TIME }
      - { key: TELEMETRY_ENABLED, value: "false", scope: RUN_TIME }
      - { key: EVENT_EMITTER_MAX_LISTENERS, value: "50", scope: RUN_TIME }

  - name: manager
    instance_count: 1
    instance_size_slug: basic-xxs
    http_port: 80
    image:
      registry_type: DOCKER_HUB
      registry: evoapicloud
      repository: evolution-manager
      tag: latest
    health_check:
      http_path: /
      initial_delay_seconds: 15
      period_seconds: 15
      timeout_seconds: 5
      failure_threshold: 3
      success_threshold: 1

ingress:
  rules:
    - component: { name: manager }
      match: { path: { prefix: /manager } }
      rewrite: /
    - component: { name: api }
      match: { path: { prefix: / } }
```

Notes for the engineer:
- `${APP_URL}` is an App Platform built-in variable that resolves to the default ingress URL (`https://*.ondigitalocean.app`) at runtime.
- Placeholders in angle brackets (`<...>`) get substituted at app-create time via `--set-env` or by editing the file with real values before submission — do NOT commit the substituted file.
- `S3_PORT=443` overrides the example's `9000` so the SDK uses the HTTPS port for Spaces.

- [ ] **Step 2: Validate the spec syntactically with `doctl`**

```bash
doctl apps spec validate .do/app.staging.yaml
```
Expected: `Spec is valid.` (or exit 0 with no errors). If errors, fix them inline before continuing.

- [ ] **Step 3: Commit the spec template (with placeholders intact)**

```bash
git add .do/app.staging.yaml
git commit -m "feat(deploy): add App Platform spec for staging"
```

---

## Task 8: Add the App Platform spec for prod

**Files:**
- Create: `.do/app.prod.yaml`

- [ ] **Step 1: Create `.do/app.prod.yaml`**

Same shape as the staging file, with these differences:
- `name: craftedai-evolution-api-prod`
- `vpc_uuid: 71038d79-53ae-421f-9bbb-8bc501ddd9f0`
- `github.branch: main`
- `CACHE_REDIS_PREFIX_KEY: "evo:prod:"`
- `DATABASE_CONNECTION_CLIENT_NAME: "evolution_prod"`
- `S3_BUCKET: "craftedai-evolution-media-prod"`
- Secrets reference the prod versions (`<PROD_DATABASE_CONNECTION_URI>`, `<PROD_REDIS_URI>`, `<PROD_API_KEY>`, `<SPACES_PROD_KEY>`, `<SPACES_PROD_SECRET>`).

Full file content:

```yaml
name: craftedai-evolution-api-prod
region: nyc
vpc_uuid: 71038d79-53ae-421f-9bbb-8bc501ddd9f0

services:
  - name: api
    instance_count: 1
    instance_size_slug: basic-xxs
    http_port: 8080
    dockerfile_path: Dockerfile
    source_dir: /
    github:
      repo: CraftedAISolutions/evolution-api
      branch: main
      deploy_on_push: true
    health_check:
      http_path: /
      initial_delay_seconds: 30
      period_seconds: 15
      timeout_seconds: 5
      failure_threshold: 3
      success_threshold: 1
    envs:
      - { key: SERVER_TYPE, value: "http", scope: RUN_TIME }
      - { key: SERVER_PORT, value: "8080", scope: RUN_TIME }
      - { key: SERVER_URL, value: "${APP_URL}", scope: RUN_TIME }
      - { key: SERVER_DISABLE_DOCS, value: "false", scope: RUN_TIME }
      - { key: SERVER_DISABLE_MANAGER, value: "true", scope: RUN_TIME }
      - { key: CORS_ORIGIN, value: "*", scope: RUN_TIME }
      - { key: CORS_METHODS, value: "POST,GET,PUT,DELETE", scope: RUN_TIME }
      - { key: CORS_CREDENTIALS, value: "true", scope: RUN_TIME }
      - { key: DATABASE_PROVIDER, value: "postgresql", scope: RUN_AND_BUILD_TIME }
      - { key: DATABASE_CONNECTION_URI, value: "<PROD_DATABASE_CONNECTION_URI>", scope: RUN_TIME, type: SECRET }
      - { key: DATABASE_CONNECTION_CLIENT_NAME, value: "evolution_prod", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_INSTANCE, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_NEW_MESSAGE, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_MESSAGE_UPDATE, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_CONTACTS, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_CHATS, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_HISTORIC, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_DATA_LABELS, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_IS_ON_WHATSAPP, value: "true", scope: RUN_TIME }
      - { key: DATABASE_SAVE_IS_ON_WHATSAPP_DAYS, value: "7", scope: RUN_TIME }
      - { key: DATABASE_DELETE_MESSAGE, value: "false", scope: RUN_TIME }
      - { key: CACHE_REDIS_ENABLED, value: "true", scope: RUN_TIME }
      - { key: CACHE_REDIS_URI, value: "<PROD_REDIS_URI>", scope: RUN_TIME, type: SECRET }
      - { key: CACHE_REDIS_PREFIX_KEY, value: "evo:prod:", scope: RUN_TIME }
      - { key: CACHE_REDIS_TTL, value: "604800", scope: RUN_TIME }
      - { key: CACHE_REDIS_SAVE_INSTANCES, value: "true", scope: RUN_TIME }
      - { key: CACHE_LOCAL_ENABLED, value: "true", scope: RUN_TIME }
      - { key: CACHE_LOCAL_TTL, value: "86400", scope: RUN_TIME }
      - { key: AUTHENTICATION_API_KEY, value: "<PROD_API_KEY>", scope: RUN_TIME, type: SECRET }
      - { key: AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES, value: "false", scope: RUN_TIME }
      - { key: LOG_LEVEL, value: "ERROR,WARN,INFO", scope: RUN_TIME }
      - { key: LOG_COLOR, value: "false", scope: RUN_TIME }
      - { key: LOG_BAILEYS, value: "error", scope: RUN_TIME }
      - { key: DEL_INSTANCE, value: "false", scope: RUN_TIME }
      - { key: DEL_TEMP_INSTANCES, value: "true", scope: RUN_TIME }
      - { key: LANGUAGE, value: "en", scope: RUN_TIME }
      - { key: WEBSOCKET_ENABLED, value: "true", scope: RUN_TIME }
      - { key: WEBSOCKET_GLOBAL_EVENTS, value: "true", scope: RUN_TIME }
      - { key: CONFIG_SESSION_PHONE_CLIENT, value: "Evolution API", scope: RUN_TIME }
      - { key: CONFIG_SESSION_PHONE_NAME, value: "Chrome", scope: RUN_TIME }
      - { key: QRCODE_LIMIT, value: "30", scope: RUN_TIME }
      - { key: QRCODE_COLOR, value: "#198754", scope: RUN_TIME }
      - { key: S3_ENABLED, value: "true", scope: RUN_TIME }
      - { key: S3_ACCESS_KEY, value: "<SPACES_PROD_KEY>", scope: RUN_TIME, type: SECRET }
      - { key: S3_SECRET_KEY, value: "<SPACES_PROD_SECRET>", scope: RUN_TIME, type: SECRET }
      - { key: S3_ENDPOINT, value: "nyc3.digitaloceanspaces.com", scope: RUN_TIME }
      - { key: S3_BUCKET, value: "craftedai-evolution-media-prod", scope: RUN_TIME }
      - { key: S3_PORT, value: "443", scope: RUN_TIME }
      - { key: S3_USE_SSL, value: "true", scope: RUN_TIME }
      - { key: S3_REGION, value: "nyc3", scope: RUN_TIME }
      - { key: TELEMETRY_ENABLED, value: "false", scope: RUN_TIME }
      - { key: EVENT_EMITTER_MAX_LISTENERS, value: "50", scope: RUN_TIME }

  - name: manager
    instance_count: 1
    instance_size_slug: basic-xxs
    http_port: 80
    image:
      registry_type: DOCKER_HUB
      registry: evoapicloud
      repository: evolution-manager
      tag: latest
    health_check:
      http_path: /
      initial_delay_seconds: 15
      period_seconds: 15
      timeout_seconds: 5
      failure_threshold: 3
      success_threshold: 1

ingress:
  rules:
    - component: { name: manager }
      match: { path: { prefix: /manager } }
      rewrite: /
    - component: { name: api }
      match: { path: { prefix: / } }
```

- [ ] **Step 2: Validate**

```bash
doctl apps spec validate .do/app.prod.yaml
```
Expected: `Spec is valid.`

- [ ] **Step 3: Commit**

```bash
git add .do/app.prod.yaml
git commit -m "feat(deploy): add App Platform spec for prod"
```

---

## Task 9: Create the staging app

We build a substituted copy of the spec in a temp file (never committed) and submit it.

- [ ] **Step 1: Materialize the staging spec with real secrets**

Set these env vars in your shell first (replace `<...>` with values from Tasks 2-6):

```bash
export STAGING_DATABASE_CONNECTION_URI="postgresql://evolution_api:$STAGING_DB_PASSWORD@crafted-ai-staging-pg-do-user-37042223-0.f.db.ondigitalocean.com:25060/evolution_api?sslmode=require"
export STAGING_REDIS_URI="<from Task 5 Step 2>"
export STAGING_API_KEY="<from Task 6>"
export SPACES_STAGING_KEY="<from Task 2 Step 1>"
export SPACES_STAGING_SECRET="<from Task 2 Step 1>"
```

Substitute and write to `/tmp/app.staging.resolved.yaml`:

```bash
sed \
  -e "s|<STAGING_DATABASE_CONNECTION_URI>|$STAGING_DATABASE_CONNECTION_URI|" \
  -e "s|<STAGING_REDIS_URI>|$STAGING_REDIS_URI|" \
  -e "s|<STAGING_API_KEY>|$STAGING_API_KEY|" \
  -e "s|<SPACES_STAGING_KEY>|$SPACES_STAGING_KEY|" \
  -e "s|<SPACES_STAGING_SECRET>|$SPACES_STAGING_SECRET|" \
  .do/app.staging.yaml > /tmp/app.staging.resolved.yaml
```

Sanity-check (without echoing the file — it now contains secrets):

```bash
grep -c '<.*>' /tmp/app.staging.resolved.yaml
```
Expected output: `0`. (No remaining placeholders.)

- [ ] **Step 2: Create the app**

```bash
doctl apps create --spec /tmp/app.staging.resolved.yaml --format ID,Spec.Name,DefaultIngress --wait
```
Expected: a row with the new app ID, name `craftedai-evolution-api-staging`, and a default ingress URL. `--wait` blocks until the first deployment completes (build + deploy can take 5-10 min on first push). Save the app ID as `STAGING_APP_ID`.

If `--wait` times out: poll manually with `doctl apps get $STAGING_APP_ID --format ActiveDeployment.Phase`.

- [ ] **Step 3: Clean up the resolved spec**

```bash
shred -u /tmp/app.staging.resolved.yaml 2>/dev/null || rm -P /tmp/app.staging.resolved.yaml
```

---

## Task 10: Allow the staging app on staging trusted sources

DO Managed Databases default-allow only known sources. Add the new App Platform app.

- [ ] **Step 1: Add staging app to Postgres trusted sources**

```bash
doctl databases firewalls append 1c712bb8-d951-4723-83cb-806417b1abad \
  --rule app:$STAGING_APP_ID
```
Expected: no error, exit 0. Verify:
```bash
doctl databases firewalls list 1c712bb8-d951-4723-83cb-806417b1abad
```
Output must include a row with type `app` and value `$STAGING_APP_ID`.

- [ ] **Step 2: Add staging app to Valkey trusted sources**

```bash
doctl databases firewalls append 7deda25f-27b4-420a-a885-13bc7e8d1572 \
  --rule app:$STAGING_APP_ID
doctl databases firewalls list 7deda25f-27b4-420a-a885-13bc7e8d1572
```
Expected: row with `app:$STAGING_APP_ID`.

- [ ] **Step 3: Force a redeploy so the app picks up DB connectivity**

```bash
doctl apps create-deployment $STAGING_APP_ID --wait
```
Expected: deployment completes with phase `ACTIVE`.

---

## Task 11: Verify staging deployment

- [ ] **Step 1: Fetch the default ingress URL**

```bash
STAGING_URL=$(doctl apps get $STAGING_APP_ID --format DefaultIngress --no-header)
echo "$STAGING_URL"
```

- [ ] **Step 2: Hit `GET /` and assert 200**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$STAGING_URL/"
```
Expected: `200`.

- [ ] **Step 3: Tail logs to confirm DB migrations ran clean**

```bash
doctl apps logs $STAGING_APP_ID --type run --component api --tail 200
```
Expected: log lines indicating Prisma migrations applied, server listening on port 8080, no `ECONNREFUSED` / `password authentication failed` errors.

- [ ] **Step 4: Create a test WhatsApp instance via the API**

```bash
curl -sS -X POST "$STAGING_URL/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: $STAGING_API_KEY" \
  -d '{"instanceName":"smoke-test","integration":"WHATSAPP-BAILEYS"}' | jq .
```
Expected: JSON response containing `instance.instanceName: "smoke-test"` and a status field. Note: this does NOT require scanning a QR — creating the instance is enough to validate that DB writes, Redis session creation, and the Baileys integration are wired correctly.

- [ ] **Step 5: Confirm the instance lives in Redis**

```bash
redis-cli -u "$STAGING_REDIS_URI" --scan --pattern 'evo:staging:*' | head -5
```
Expected: at least one key appears (instance metadata cached). If empty, sessions aren't being saved to Redis — investigate `CACHE_REDIS_SAVE_INSTANCES` env var on the deployed app via `doctl apps get $STAGING_APP_ID -o json | jq '.spec.services[0].envs'`.

- [ ] **Step 6: Restart the app and confirm reconnect**

```bash
doctl apps create-deployment $STAGING_APP_ID --force-rebuild=false --wait
curl -sS "$STAGING_URL/instance/fetchInstances" -H "apikey: $STAGING_API_KEY" | jq '.[] | .instance.instanceName'
```
Expected: after the redeploy, the `smoke-test` instance is still listed (proves Baileys session persistence works across deploys).

- [ ] **Step 7: Delete the smoke-test instance**

```bash
curl -sS -X DELETE "$STAGING_URL/instance/delete/smoke-test" -H "apikey: $STAGING_API_KEY" | jq .
```
Expected: success response.

- [ ] **Step 8: Verify manager UI is reachable**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$STAGING_URL/manager"
```
Expected: `200` (or `301`/`302` followed by 200 if you add `-L`). The Manager UI HTML loads.

If all eight steps pass, staging is green. Proceed to prod.

---

## Task 12: Create the prod app

Same pattern as Task 9.

- [ ] **Step 1: Materialize the prod spec**

```bash
export PROD_DATABASE_CONNECTION_URI="postgresql://evolution_api:$PROD_DB_PASSWORD@craftedai-prod-pg-do-user-37042223-0.l.db.ondigitalocean.com:25060/evolution_api?sslmode=require"
export PROD_REDIS_URI="<from Task 5 Step 1>"
export PROD_API_KEY="<from Task 6>"
export SPACES_PROD_KEY="<from Task 2 Step 1>"
export SPACES_PROD_SECRET="<from Task 2 Step 1>"

sed \
  -e "s|<PROD_DATABASE_CONNECTION_URI>|$PROD_DATABASE_CONNECTION_URI|" \
  -e "s|<PROD_REDIS_URI>|$PROD_REDIS_URI|" \
  -e "s|<PROD_API_KEY>|$PROD_API_KEY|" \
  -e "s|<SPACES_PROD_KEY>|$SPACES_PROD_KEY|" \
  -e "s|<SPACES_PROD_SECRET>|$SPACES_PROD_SECRET|" \
  .do/app.prod.yaml > /tmp/app.prod.resolved.yaml

grep -c '<.*>' /tmp/app.prod.resolved.yaml   # expect 0
```

- [ ] **Step 2: Create the app**

```bash
doctl apps create --spec /tmp/app.prod.resolved.yaml --format ID,Spec.Name,DefaultIngress --wait
```
Save the app ID as `PROD_APP_ID`.

- [ ] **Step 3: Clean up the resolved spec**

```bash
shred -u /tmp/app.prod.resolved.yaml 2>/dev/null || rm -P /tmp/app.prod.resolved.yaml
```

---

## Task 13: Allow the prod app on prod trusted sources

- [ ] **Step 1: Add prod app to Postgres trusted sources**

```bash
doctl databases firewalls append dc0f5397-25a0-4af9-8685-66d12ab131d5 \
  --rule app:$PROD_APP_ID
doctl databases firewalls list dc0f5397-25a0-4af9-8685-66d12ab131d5
```
Expected: row with `app:$PROD_APP_ID`.

- [ ] **Step 2: Add prod app to Valkey trusted sources**

```bash
doctl databases firewalls append 1f9703c1-9173-4456-8c33-74b0e96e72ed \
  --rule app:$PROD_APP_ID
doctl databases firewalls list 1f9703c1-9173-4456-8c33-74b0e96e72ed
```
Expected: row with `app:$PROD_APP_ID`.

- [ ] **Step 3: Force a redeploy**

```bash
doctl apps create-deployment $PROD_APP_ID --wait
```
Expected: phase `ACTIVE`.

---

## Task 14: Verify prod deployment

Repeat Task 11's eight steps verbatim, substituting:
- `$STAGING_APP_ID` → `$PROD_APP_ID`
- `$STAGING_URL` → `$PROD_URL` (`doctl apps get $PROD_APP_ID --format DefaultIngress --no-header`)
- `$STAGING_API_KEY` → `$PROD_API_KEY`
- `$STAGING_REDIS_URI` → `$PROD_REDIS_URI`
- Redis key pattern: `evo:prod:*`

- [ ] **Step 1: Run all verification steps**

Each of Task 11's eight expectations must hold. If any fail, stop and debug before declaring prod live.

---

## Task 15: Document deploy and rollback

**Files:**
- Create: `DEPLOYMENT.md`

- [ ] **Step 1: Write `DEPLOYMENT.md`**

```markdown
# Deployment

Evolution API runs on DigitalOcean App Platform in two envs.

## Apps

| Env | App name | URL | Source branch |
|-----|----------|-----|---------------|
| prod | `craftedai-evolution-api-prod` | <PROD_URL> | `main` |
| staging | `craftedai-evolution-api-staging` | <STAGING_URL> | `staging` |

Both apps live in DO project under account `<account>`. Specs are in `.do/app.prod.yaml` and `.do/app.staging.yaml` (committed with placeholders; real secrets live in App Platform encrypted env vars).

## Deploying a change

`deploy_on_push` is enabled. Pushing to `staging` or `main` triggers App Platform to build and deploy automatically.

To trigger a redeploy without a code change:

\`\`\`bash
doctl apps create-deployment <APP_ID> --wait
\`\`\`

## Rolling back

\`\`\`bash
doctl apps list-deployments <APP_ID>          # find a previous good deployment ID
doctl apps create-deployment <APP_ID> --force-rebuild=false  # redeploys current spec; for true rollback use the dashboard's "Rollback to previous"
\`\`\`

Or in the DO Control Panel: Apps → select app → Deployments → previous deployment → "Rollback".

## Secrets

All secrets are App Platform encrypted env vars. To rotate any of them: edit via the dashboard (Settings → Environment Variables) or:

\`\`\`bash
doctl apps update <APP_ID> --spec <updated-resolved-spec.yaml>
\`\`\`

Never commit a resolved spec (the one with substituted secrets).

## Trusted sources

Each app is whitelisted on its env's Postgres + Valkey cluster firewalls. If a cluster is rebuilt or trusted sources are reset:

\`\`\`bash
doctl databases firewalls append <CLUSTER_ID> --rule app:<APP_ID>
\`\`\`

## Disconnect during deploys (known behavior)

Every redeploy restarts the api service, which drops live WhatsApp Web sockets. Sessions reconnect from Redis (`CACHE_REDIS_SAVE_INSTANCES=true`) within seconds. Schedule deploys off-peak when possible.
```

Fill in `<PROD_URL>`, `<STAGING_URL>`, and `<account>` with the real values.

- [ ] **Step 2: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: add App Platform deployment and rollback runbook"
git push origin main
```

---

## Task 16: Distribute API keys to consumers and rotate the DO token

- [ ] **Step 1: Add `EVOLUTION_API_KEY_STAGING` and `EVOLUTION_API_KEY_PROD` to the secret stores of consuming services**

These are the same `STAGING_API_KEY` and `PROD_API_KEY` from Task 6. Typical consumers: `craftedai-core-api-staging` and `craftedai-core-api-prod` App Platform apps. Use:

```bash
doctl apps update <CONSUMER_APP_ID> --spec <consumer-spec-with-new-env>
```

Or edit via the DO dashboard. Also set `EVOLUTION_API_URL_STAGING` and `EVOLUTION_API_URL_PROD` to the default ingress URLs of the two Evolution API apps.

- [ ] **Step 2: Smoke-test from a consumer**

Once a consumer has been redeployed with the new env vars, exercise one Evolution API call end-to-end (e.g. fetch instances). Confirm the auth header is being sent and the call returns 200.

- [ ] **Step 3: Rotate the DO API token used for this work**

In the DO Control Panel → API → Tokens, revoke the token that was used during this deploy (it was exposed in chat). Generate a new token and store it in your password manager. Update any local `.envrc` or CI variables that referenced the old one.

---

## Done criteria

All of the following must be true before declaring this work complete:

- `staging` and `main` branches both auto-deploy on push.
- `GET /` on both prod and staging URLs returns 200.
- A test instance can be created, persists in Redis across a redeploy, and can be deleted via the API.
- Manager UI at `/manager` returns 200 on both envs.
- Both apps appear as trusted sources on their env's Postgres + Valkey clusters.
- `DEPLOYMENT.md` is committed and contains real URLs.
- Both API keys are in consumer secret stores; at least one consumer has been smoke-tested.
- The DO API token from this session has been rotated.

---

## Notes for the executor

- **Never commit a resolved spec.** The `.do/app.*.yaml` files in the repo always contain `<PLACEHOLDER>` strings, not real secrets.
- **Never log secrets.** Avoid `cat`, `echo`, or `printenv` on any var holding a key, password, or URI with embedded password.
- **`basic-xxs` is 512 MB.** Baileys is memory-hungry — if you see OOM kills in the logs, the first move is `instance_size_slug: basic-xs` (1 GB) via spec update.
- **App Platform auto-deploy** is on; pushing to the wrong branch will trigger a deploy. Coordinate with whoever else might push.
- **WhatsApp QR scanning** is not part of this plan — it's an operational step done by whoever owns each tenant, after the deploy is live.
