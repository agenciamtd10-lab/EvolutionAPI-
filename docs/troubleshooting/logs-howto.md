# Azure Logs How-To (Evolution/Prospek)

Quick commands to pull container logs without guesswork. Uses existing Azure CLI auth; sets `AZURE_CONFIG_DIR` to the repo-local `.azure` copy.

## Prereqs
- Subscription: `Microsoft Azure Sponsorship` (`51f055c6-9754-46dc-82a8-e746d43afec5`)
- Resource groups / apps:
  - Evolution: `evolution-prod` / `evolution-prod`
  - Prospek: `prospek-prod` / `prospek-prod`
- Managed environment (both apps): `/subscriptions/51f055c6-9754-46dc-82a8-e746d43afec5/resourceGroups/n8n/providers/Microsoft.App/managedEnvironments/managedEnvironment-n8n-88b2`
- Log Analytics workspace ID: `3aaf7750-6587-4814-99ce-72558b7dde41`

## Setup (once per shell)
```bash
# use the repo-local Azure config (copied from ~/.azure)
export AZURE_CONFIG_DIR="$(pwd)/.azure"

# verify account
az account list --output table
az account set --subscription "51f055c6-9754-46dc-82a8-e746d43afec5"
```

## Fetch console logs via Log Analytics
- Adjust timespan as needed (ISO range `start/end`).
- Output is a JSON array (`TimeGenerated`, `Log_s`).

Evolution (example Dec 1, 2025 UTC):
```bash
az monitor log-analytics query \
  --workspace 3aaf7750-6587-4814-99ce-72558b7dde41 \
  --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == 'evolution-prod' | where TimeGenerated between (datetime(2025-12-01 00:00:00Z) .. datetime(2025-12-02 00:00:00Z)) | project TimeGenerated, Log_s | order by TimeGenerated asc" \
  --output json > docs/troubleshooting/logs-evolution-prod-2025-12-01.json
```

Prospek:
```bash
az monitor log-analytics query \
  --workspace 3aaf7750-6587-4814-99ce-72558b7dde41 \
  --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == 'prospek-prod' | where TimeGenerated between (datetime(2025-12-01 00:00:00Z) .. datetime(2025-12-02 00:00:00Z)) | project TimeGenerated, Log_s | order by TimeGenerated asc" \
  --output json > docs/troubleshooting/logs-prospek-prod-2025-12-01.json
```

## Quick filtering helpers
```bash
# count rows
python3 - <<'PY'
import json, sys
for f in sys.argv[1:]:
    data=json.loads(open(f).read())
    print(f, len(data))
PY docs/troubleshooting/logs-evolution-prod-2025-12-01.json docs/troubleshooting/logs-prospek-prod-2025-12-01.json

# filter Evolution logs for a specific instance/id substring
python3 - <<'PY'
import json, sys, re
needle=sys.argv[1]; src=sys.argv[2]; dst=sys.argv[3]
data=json.loads(open(src).read())
lines=[f"{r['TimeGenerated']} | {r['Log_s']}" for r in data if needle in r['Log_s']]
open(dst,'w').write("\\n".join(lines))
print("matches", len(lines))
PY 999e9d24 docs/troubleshooting/logs-evolution-prod-2025-12-01.json docs/troubleshooting/logs-evolution-prod-2025-12-01-mamafirst.txt
```

## Notes
- Azure CLI DNS may be blocked in sandbox; rerun with elevated permissions if needed.
- Do not commit raw secrets shown by `az containerapp show` output. Keep logs in `docs/troubleshooting/`.
