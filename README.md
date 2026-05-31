# Demo Agent

Reference Pantheon agent package for validating the Hub install → instance → telemetry loop.

Built with **FastAPI** (PyInstaller `.exe` on Windows), **React + Vite** MFE, and a local **Python venv** (never install dependencies globally).

## Package layout

```
demo-agent/
  manifest.json
  bin/demo-agent.exe          # built artifact
  docs/openapi.json
  assets/icon.svg
  dist_mfe/                   # built MFE static files
  src/demo_agent/             # Python source
  mfe/                        # React MFE source
  scripts/
    setup.ps1                 # create .venv + pip install
    build.ps1                 # build MFE + Windows exe
    dev.ps1                   # local dev with mock env vars
  requirements.txt
  .venv/                      # gitignored
```

## First-time setup

```powershell
cd demo-agent
.\scripts\setup.ps1
```

This creates `demo-agent/.venv` and installs `requirements.txt` **only inside the venv**.

## Build for Pantheon Hub

```powershell
.\scripts\build.ps1
```

Outputs:

- `bin/demo-agent.exe`
- `dist_mfe/`

To produce an installable zip locally (same layout as CI):

```powershell
.\scripts\build.ps1
.\scripts\package-release.ps1
```

Creates `release/demo-agent-v{version}.zip` with `manifest.json`, `bin/`, `docs/`, `assets/`, and `dist_mfe/` at the archive root.

## CI releases

Pushes to `master` run [`.github/workflows/release.yml`](.github/workflows/release.yml):

1. Build the Windows exe and MFE on `windows-latest`
2. Package `release/demo-agent-v{version}.zip` (version from `manifest.json`)
3. Publish a GitHub Release tagged `v{version}` with the zip asset

Bump `manifest.json` → `version` before merging when you want a new release tag. Re-pushes to `master` with the same version replace the zip on the existing release.

Install in Pantheon Hub via **Add Agent → GitHub release** using a URL like `github.com/<org>/demo-agent/releases/tag/v1.0.3`.

## Install in Pantheon Hub

1. Run `.\scripts\build.ps1`
2. Open Pantheon Hub → **Agents → Add Agent → local folder**
3. Select the `demo-agent` directory (this folder, containing `manifest.json`)
4. Complete the wizard (approve capabilities, optional greeting config)
5. Create an instance and **Start**

## What the agent does

| Feature | Endpoint / behavior |
|---------|---------------------|
| Health | `GET /api/v1/health` |
| Status | `GET /api/v1/status` |
| Work queue | `POST /api/v1/process-queue` (cron target) |
| HITL demo | `POST /api/v1/request-approval` — queued in Hub; resolve in instance **App** (MFE). OS notification click opens App focused on the event. |
| Telemetry | Background flush every 5s to Hub |
| MFE | `dist_mfe/` — **App** button in Hub (requires `dist_mfe/index.html`; run `build.ps1` before install) |

### Telemetry metrics

- `tasks_processed_total` (COUNTER)
- `queue_pressure` (GAUGE)
- `throughput_spark` (SPARKLINE)

### Environment variables (injected by Hub)

| Variable | Purpose |
|----------|---------|
| `PANTHEON_HOST_URI` | Hub Core base URI |
| `PANTHEON_INSTANCE_TOKEN` | Bearer token for Hub API |
| `PANTHEON_INSTANCE_ID` | Instance UUID |
| `PANTHEON_PROXY_SECRET` | Per-start secret for agent HTTP ingress (Hub proxy/cron only) |
| `AGENT_SERVICE_PORT` | Port for this agent HTTP server |
| `DEMO_GREETING` | Optional user config from install wizard |

## Local dev (without Hub)

```powershell
.\scripts\dev.ps1
```

Uses dev-only env vars documented in `Agent_Builder.md` section 13.

## Pre-ship checklist

See `Agent_Builder.md` section 14. After `build.ps1`, verify:

- `bin/demo-agent.exe` exists
- `docs/openapi.json` matches live routes
- `dist_mfe/index.html` exists
- Hub install wizard accepts the folder

## Security / tenancy updates

After changing the MFE source or Hub proxy behavior, rebuild and **reinstall** the demo agent folder in Pantheon Hub so `dist_mfe/` and `bin/demo-agent.exe` pick up:

- Hub-injected `window.__PANTHEON__` bootstrap (run ID, hub port, MFE session)
- Removal of editable proxy settings from the demo MFE UI
- HITL approvals handled inside the instance MFE (open **App** while the agent is waiting)
- Instance cards show **HITL** badge when queue non-empty; click routes to Agent page and auto-opens App
- `features.hitl: true` in manifest requires built `dist_mfe/`
- `PANTHEON_PROXY_SECRET` validation on agent HTTP routes (except `/api/v1/health`)

If you previously ran `cargo test -p pantheon-hub-api` before this fix, remove stale **Tenancy Test** agents and resolve any **Cross-tenant probe** HITL entries from the Hub Agents list / instance App.
