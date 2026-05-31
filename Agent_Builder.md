# Pantheon Agent Builder — System Prompt

You are building a **Pantheon agent package**: a platform-specific directory bundle that Pantheon Hub installs, configures, and runs as one or more isolated **instances**.

This document is self-contained. You do not need any other Pantheon documentation to scaffold a valid agent.

---

## 1. Your role and constraints

**You build:** an agent package in **this repository** (binary, manifest, OpenAPI, optional MFE).

**Pantheon Hub provides:** install wizard, instance lifecycle (start/stop/restart), sandbox directory, secrets injection, telemetry dashboard, cron triggers, HITL queue routing to instance MFE, Docs tab (OpenAPI live test).

**Hard rules:**

1. The agent **never** talks to the Tauri webview or frontend dev server (e.g. Vite port 5173).
2. The agent **never** hardcodes Hub URL or port. Read `PANTHEON_HOST_URI` from the **process environment** at runtime.
3. Do **not** rely on a `.env` file as the primary contract. Pantheon injects env vars when it spawns your process (Docker-style).
4. Install is done by the user: Pantheon Hub → **Add Agent → local folder** pointing at your package root.
5. Declare only capabilities you need. Users approve them at install time.

---

## 2. Package layout

```
my-agent/
  manifest.json                 # Required — package contract
  bin/
    my-agent.exe                # Required on Windows — compiled binary (see runtime.binaryRelativePath)
  docs/
    openapi.json                # Required — OpenAPI 3.x spec for Docs tab + live test
  assets/
    icon.svg                    # Optional — branding.iconRelativePath
  dist_mfe/                     # Optional — only if manifest sets mfeDirectory
    index.html
    ...
```

**Windows v1 target:** ship `bin/my-agent.exe` (or path set in manifest). Hub validates `runtime.supportedPlatforms` includes `{ "os": "windows", "arch": "x86_64" }`.

---

## 3. manifest.json

Parsers **ignore unknown top-level keys**. Optional `manifestSchemaVersion` (integer, default `1`).

### 3.1 Required fields (minimum viable)

| Field | Type | Description |
| --- | --- | --- |
| `agentId` | string | Reverse-DNS id, e.g. `io.example.my_agent` |
| `packageName` | string | Display name |
| `version` | string | Semver |
| `description` | string | Short summary |
| `developer` | object | `{ "name": "..." }` required; `supportUrl` optional |
| `runtime` | object | See below |
| `capabilities` | array | May be empty `[]` |
| `instanceConfigSchema` | object | `{ "fields": [] }` if no user config |
| `customTelemetrySchema` | object | `{ "visualGrid": [] }` if no custom metrics |

**`runtime` required subfields:**

| Field | Description |
| --- | --- |
| `binaryRelativePath` | Path from package root, e.g. `"./bin/my-agent.exe"` |
| `openApiRelativePath` | Path to OpenAPI file, e.g. `"./docs/openapi.json"` |
| `defaultResourceTier` | `ECO` \| `PERFORMANCE` \| `OVERDRIVE` |
| `supportedPlatforms` | Array of `{ "os": "windows", "arch": "x86_64" }` |

### 3.2 Optional fields

| Field | Description |
| --- | --- |
| `manifestSchemaVersion` | Integer, default `1` |
| `minPantheonVersion` | Semver string |
| `branding.iconRelativePath` | Relative path to icon |
| `branding.accentColorHex` | e.g. `"#00E676"` |
| `mfeDirectory` | Relative path to static MFE build, e.g. `"./dist_mfe"`. **If absent, no MFE** — Hub does not show an App button. **Required when `features.hitl` is true.** |
| `features.hitl` | When `true`, agent may POST `/hitl/interrupt`. **MFE is mandatory** — humans resolve in the instance App. |
| `recommendedAutomation` | Cron suggestions (see section 10) |

### 3.3 Minimal manifest example

```json
{
  "agentId": "io.example.hello",
  "packageName": "HelloAgent",
  "version": "1.0.0",
  "description": "Minimal Pantheon agent.",
  "developer": { "name": "Example Dev" },
  "runtime": {
    "binaryRelativePath": "./bin/hello.exe",
    "openApiRelativePath": "./docs/openapi.json",
    "defaultResourceTier": "ECO",
    "supportedPlatforms": [{ "os": "windows", "arch": "x86_64" }]
  },
  "capabilities": [],
  "instanceConfigSchema": { "fields": [] },
  "customTelemetrySchema": { "visualGrid": [] }
}
```

### 3.4 Full manifest example

```json
{
  "manifestSchemaVersion": 1,
  "agentId": "io.example.email_intelligence",
  "packageName": "EmailIntelligence",
  "version": "1.0.0",
  "minPantheonVersion": "0.2.0",
  "description": "Sorts and summarizes inbox threads.",
  "developer": {
    "name": "Example Corp",
    "supportUrl": "https://example.com/support"
  },
  "branding": {
    "iconRelativePath": "./assets/icon.svg",
    "accentColorHex": "#00E676"
  },
  "runtime": {
    "binaryRelativePath": "./bin/email_intel.exe",
    "openApiRelativePath": "./docs/openapi.json",
    "defaultResourceTier": "PERFORMANCE",
    "supportedPlatforms": [{ "os": "windows", "arch": "x86_64" }]
  },
  "mfeDirectory": "./dist_mfe",
  "instanceConfigSchema": {
    "fields": [
      {
        "id": "OPENAI_API_KEY",
        "label": "OpenAI API Key",
        "type": "SECRET",
        "required": true
      },
      {
        "id": "IMAP_HOST",
        "label": "IMAP Host",
        "type": "STRING",
        "required": true
      }
    ]
  },
  "capabilities": [
    {
      "intent": "filesystem.read",
      "params": { "paths": ["~/Downloads/Invoices"] },
      "justification": "Read invoice attachments."
    },
    {
      "intent": "filesystem.write",
      "params": { "paths": ["~/PantheonData/EmailIntelligence"] },
      "justification": "Store processed metadata."
    },
    {
      "intent": "network.outbound",
      "params": { "domains": ["api.openai.com", "imap.gmail.com"] },
      "justification": "Model and mail access."
    },
    {
      "intent": "identity.keychain.read",
      "params": { "keys": ["GmailAppPassword"] },
      "justification": "Secure credential retrieval."
    }
  ],
  "recommendedAutomation": [
    {
      "name": "Every 10 minutes",
      "cronExpression": "0 */10 * * * *",
      "targetEndpoint": "/api/v1/process-queue",
      "payloadTemplate": "{\"forceRun\": false}"
    }
  ],
  "customTelemetrySchema": {
    "visualGrid": [
      {
        "metricKey": "processed_emails_total",
        "label": "Processed Emails",
        "type": "COUNTER",
        "format": "INT",
        "gridSpan": 6
      },
      {
        "metricKey": "queue_pressure",
        "label": "Queue Pressure",
        "type": "GAUGE",
        "format": "PERCENTAGE",
        "gridSpan": 6
      },
      {
        "metricKey": "throughput_spark",
        "label": "Throughput (24h)",
        "type": "SPARKLINE",
        "format": "FLOAT",
        "gridSpan": 12
      }
    ]
  }
}
```

---

## 4. Capability intent catalog

Every capability entry:

```json
{
  "intent": "<intent_key>",
  "params": { },
  "justification": "Human-readable reason shown in install wizard."
}
```

| Dimension | Intent key | params shape |
| --- | --- | --- |
| Observe | `desktop.screen.read` | `{}` |
| Observe | `desktop.audio.capture` | `{}` |
| Observe | `browser.chrome.read_session` | `{}` |
| Control | `desktop.keyboard.inject` | `{}` |
| Control | `desktop.mouse.control` | `{}` |
| Control | `applications.slack.control` | `{}` |
| Persist | `filesystem.read` | `{ "paths": ["~/path"] }` |
| Persist | `filesystem.write` | `{ "paths": ["~/path"] }` |
| Execute | `process.spawn` | `{ "binaries": ["ffmpeg"] }` |
| Network | `network.outbound` | `{ "domains": ["api.example.com"] }` |
| Network | `network.bind` | `{ "ports": [8080] }` |
| Identity | `identity.keychain.read` | `{ "keys": ["MySecretKey"] }` |

**Windows v1 enforcement (what Hub actually restricts today):**

| Intent | Enforced? |
| --- | --- |
| `filesystem.read` / `filesystem.write` | Partial — sandbox working directory; path checks when brokered |
| `process.spawn` | Allowlist checked when Hub spawns children for you |
| `identity.keychain.read` | Approved keys only injected as env at spawn |
| `network.outbound` | Audited/logged; hard firewall filter deferred |
| `network.bind` | Hub assigns `agent_service_port` |
| Observe / Control intents | Declare + audit only in v1 |

Only declare capabilities you use. Undeclared access may be logged or blocked as Hub enforcement matures.

---

## 5. instanceConfigSchema

Defines the install/create-instance form. Each field becomes an **environment variable** at spawn, keyed by `id`.

| type | UI behavior | Env value |
| --- | --- | --- |
| `STRING` | Plain text input | Literal string |
| `SECRET` | Password field | Literal string (Hub stores encrypted in config payload) |
| `PATH` | Directory picker | Absolute path string |

Example field:

```json
{
  "id": "OPENAI_API_KEY",
  "label": "OpenAI API Key",
  "type": "SECRET",
  "required": true
}
```

At runtime: `os.environ["OPENAI_API_KEY"]` (Python) or equivalent.

---

## 6. Runtime environment (process injection)

When Pantheon **starts** your binary, it sets these on the child process:

| Variable | Required | Description |
| --- | --- | --- |
| `PANTHEON_HOST_URI` | Yes | Hub Core base URI. Example: `pantheon+http://127.0.0.1:38472` |
| `PANTHEON_INSTANCE_TOKEN` | Yes | Bearer token for Hub API calls |
| `PANTHEON_INSTANCE_ID` | Yes | Instance UUID |
| Each `instanceConfigSchema` field `id` | Per manifest | User-configured values |

Also injected on every **RESTART**.

### Parsing PANTHEON_HOST_URI

Strip the `pantheon+` prefix:

- `pantheon+http://127.0.0.1:38472` → HTTP base `http://127.0.0.1:38472`
- `pantheon+unix:///path/to/hub.sock` → Unix socket (future; use HTTP client with UDS support)

**Never** hardcode port `38472` or any port in source code.

### Minimal Hub client (Python example)

```python
import os
import httpx

def hub_base_url() -> str:
    uri = os.environ["PANTHEON_HOST_URI"]
    if uri.startswith("pantheon+"):
        uri = uri[len("pantheon+"):]
    return uri.rstrip("/")

def hub_headers() -> dict:
    return {
        "X-Pantheon-Instance-Token": os.environ["PANTHEON_INSTANCE_TOKEN"],
        "Content-Type": "application/json",
    }
```

---

## 7. Hub API — agent → Hub

All routes are under `{hub_base_url}/api/v1/...`.

**Authentication:** header `X-Pantheon-Instance-Token: {PANTHEON_INSTANCE_TOKEN}` on every agent request.

### 7.1 POST /api/v1/telemetry/submit

Send metrics and optional model usage logs. Flush every ≥1 second; max 100 metrics + 20 model logs per request.

**Request:**

```json
{
  "timestamp": 1779845759,
  "metrics": [
    { "key": "processed_emails_total", "value": 1422.0 },
    { "key": "queue_pressure", "value": 68.4 }
  ],
  "modelLogs": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "inputTokens": 840,
      "outputTokens": 230,
      "estimatedCostUsd": 0.00535
    }
  ]
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 202 | `{ "status": "QUEUED", "recordsIngested": 3 }` |
| 401 | `{ "error": "INVALID_INSTANCE_TOKEN" }` |
| 413 | `{ "error": "BATCH_LIMIT_EXCEEDED", "maxMetrics": 100 }` |
| 429 | `{ "error": "RATE_LIMITED", "retryAfterMs": 1000 }` |

Metric `key` values **must** match `customTelemetrySchema.visualGrid[].metricKey` for dashboard widgets.

### 7.2 POST /api/v1/hitl/interrupt

Enqueue a human-in-the-loop event for this instance. This **does not pause the whole instance** — only the agent task that posted the interrupt should block (by polling status). Other agent HTTP endpoints keep serving.

**Requires:** If your manifest declares `"features": { "hitl": true }`, you **must** ship an MFE (`mfeDirectory` with `index.html`). Humans resolve HITL inside the instance App, not the Hub shell.

**Request:**

```json
{
  "breakpointId": "brk_99a8b11c_32e9",
  "urgency": "HIGH",
  "headline": "Approval required",
  "summary": "Agent needs confirmation before continuing.",
  "payloadContext": {},
  "interactiveFormSchema": {
    "fields": [
      {
        "id": "decision",
        "type": "DROPDOWN",
        "label": "Decision",
        "options": ["APPROVE", "DENY"],
        "default": "DENY"
      }
    ]
  }
}
```

**Responses:**

| Status | Body |
| --- | --- |
| 201 | `{ "status": "INTERRUPT_ACTIVE", "activeListenersNotifiedCount": 3 }` |
| 401 | `{ "error": "INVALID_INSTANCE_TOKEN" }` |
| 409 | `{ "error": "BREAKPOINT_ALREADY_ACTIVE", "breakpointId": "..." }` |

### 7.3 GET /api/v1/hitl/{breakpointId}/status

Poll while frozen until resolved.

**Response 200:**

```json
{
  "status": "RESOLVED",
  "resolution": {
    "decision": "APPROVE",
    "adminAnnotation": "Verified manually."
  }
}
```

`status` is `ACTIVE`, `RESOLVED`, or `ABORTED`. On `RESOLVED`, `resolution` keys match your `interactiveFormSchema` field ids.

**Who may call which HITL routes:**

| Route | Agent (instance token) | MFE (session) | Hub Desktop (IPC) |
| --- | --- | --- | --- |
| `POST /api/v1/hitl/interrupt` | Yes — raise events for this instance | No | No |
| `GET /api/v1/hitl/{breakpointId}/status` | Yes — poll own breakpoints only | No | No |
| `GET /api/v1/instances/{instanceId}/hitl/active` | Yes — **own instance only** | Yes — **own instance only** | Yes (admin) |
| `POST /api/v1/instances/{instanceId}/hitl/{id}/resolve` | Yes — **own instance only** | Yes — **own instance only** | Yes (relay) |

Pantheon manages one FIFO HITL queue per **instance**. Agents and MFEs interact with the queue only through these Hub endpoints. **Agent A shall not access Agent B's queue** — every list/resolve/status call validates that the authenticated caller's `instance_id` matches the path or breakpoint owner.

**HITL loop pattern:**

1. POST `/hitl/interrupt` (enqueue event; notify devices)
2. Poll GET `/hitl/{breakpointId}/status` every 1–2 seconds **from the waiting task only**, or subscribe to `GET /api/v1/events/stream` for `PANTHEON://HITL_RESOLVED`
3. When `status === "RESOLVED"`, read `resolution` and continue that task
4. Human resolution is typically done by the instance **MFE** via `POST /api/v1/instances/{instanceId}/hitl/{breakpointId}/resolve` (MFE session). Agents may also resolve their own queue when programmatic resolution is appropriate.

**MFE contract:**

- Hub injects `window.__PANTHEON__` including optional `hitl.focusedBreakpointId` when opening App from a notification/deep link
- MFE lists queue: `GET /api/v1/instances/{instanceId}/hitl/active` → `{ currentBreakpointId, queueLength, items[] }` (FIFO)
- Render UX from each item's `interactiveFormSchema` and `payloadContext`
- After resolving one event, fetch queue again and handle the next until empty

---

## 8. Agent HTTP service — Hub → agent

Your binary runs an HTTP server on a port **assigned by Pantheon** (`agent_service_port`). Hub reverse-proxies:

```
{PANTHEON_HOST_URI}/api/v1/agents/{agentId}/{instanceNickname}/{yourRoute}
```

→ your local service.

### OpenAPI requirements

- File at `runtime.openApiRelativePath` (OpenAPI 3.0+)
- Document all routes your service exposes
- Include request/response schemas so Pantheon **Docs tab** can render and live-test
- Use clear `operationId` and `tags`

**Minimal openapi.json example:**

```json
{
  "openapi": "3.0.3",
  "info": { "title": "Hello Agent", "version": "1.0.0" },
  "paths": {
    "/api/v1/health": {
      "get": {
        "operationId": "health",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": { "status": { "type": "string" } }
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/process-queue": {
      "post": {
        "operationId": "processQueue",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": { "forceRun": { "type": "boolean" } }
              }
            }
          }
        },
        "responses": { "200": { "description": "Processed" } }
      }
    }
  }
}
```

Bind your server to `0.0.0.0:{PORT}` where `PORT` comes from env `AGENT_SERVICE_PORT` if Hub injects it, or a fixed port declared via `network.bind` capability (Hub assigns in practice — prefer reading assigned port from Hub-injected env when available).

---

## 9. customTelemetrySchema

Defines dashboard widgets. Types: `COUNTER`, `GAUGE`, `SPARKLINE`.

| type | Submit behavior |
| --- | --- |
| COUNTER | Monotonically increasing value |
| GAUGE | Point-in-time value (0–100 for PERCENTAGE format) |
| SPARKLINE | Time-series samples; submit repeated keys over time |

**visualGrid entry:**

```json
{
  "metricKey": "processed_emails_total",
  "label": "Processed Emails",
  "type": "COUNTER",
  "format": "INT",
  "gridSpan": 6
}
```

Submit matching keys in `POST /telemetry/submit` → `metrics[].key`.

---

## 10. recommendedAutomation

Cron-only in v1 (no webhooks). Six-field cron with seconds:

```
{sec} {min} {hour} {dom} {month} {dow}
```

Example: `0 */10 * * * *` = every 10 minutes.

```json
{
  "name": "Hourly sync",
  "cronExpression": "0 0 * * * *",
  "targetEndpoint": "/api/v1/sync",
  "payloadTemplate": "{}"
}
```

`targetEndpoint` is invoked on **your agent HTTP service** (Hub cron fires proxy to instance).

---

## 11. Optional MFE (micro-frontend)

If `mfeDirectory` is set (e.g. `"./dist_mfe"`), build static assets (HTML/JS/CSS) into that folder. Pantheon serves them in a native **App** window.

If `mfeDirectory` is **omitted**, you have no MFE. Do not add placeholder UI unless needed.

---

## 12. Resource tiers

Hub enforces soft limits via Windows Job Objects (v1):

| Tier | CPU cap | RAM cap | Disk quota |
| --- | --- | --- | --- |
| ECO | 10% | 512 MB | 1 GB |
| PERFORMANCE | 40% | 2 GB | 10 GB |
| OVERDRIVE | 80% | 8 GB | 50 GB |

Set `runtime.defaultResourceTier` in manifest. User may override at install.

---

## 13. Logging and the Hub log panel

Pantheon captures agent **stdout** and **stderr** line-by-line into `instance_event_log` and displays them in the Hub **Logs** panel on the agent instance card. Follow this contract so operators are not flooded with false “errors.”

### Stream contract

| Stream | Allowed levels | Purpose |
| --- | --- | --- |
| **stdout** | DEBUG, INFO, WARNING | Normal operation, diagnostics, recoverable issues |
| **stderr** | ERROR, CRITICAL only | Failures requiring operator attention |

**Do not** use Python’s default `logging.basicConfig()` without splitting streams — it writes INFO to stderr and makes healthy agents look broken in the Hub.

**Telemetry / heartbeat loops** (e.g. periodic `POST /telemetry/submit`) must log at **DEBUG**, not INFO. They are hidden in the Hub’s default log view unless the operator enables **Show debug logs**.

**Third-party loggers** (httpx, httpcore, uvicorn access): set to WARNING or higher in production. Never emit INFO on every successful HTTP request.

### Python reference setup

```python
import logging
import os
import sys

def configure_logging() -> None:
    level_name = os.environ.get("PANTHEON_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(logging.DEBUG)
    stdout_handler.addFilter(lambda record: record.levelno < logging.ERROR)
    stdout_handler.setFormatter(fmt)

    stderr_handler = logging.StreamHandler(sys.stderr)
    stderr_handler.setLevel(logging.ERROR)
    stderr_handler.setFormatter(fmt)

    logging.basicConfig(level=level, handlers=[stdout_handler, stderr_handler], force=True)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
```

Optional: set `PANTHEON_LOG_LEVEL=DEBUG` during local debugging to emit DEBUG lines (Hub **Show debug logs** toggle reveals them when captured).

### Telemetry worker example

```python
logger = logging.getLogger(__name__)

async def _loop(self) -> None:
    while True:
        try:
            await self._hub.submit_telemetry(metrics)
            logger.debug("Telemetry submitted (%d metrics)", len(metrics))
        except Exception as exc:
            logger.warning("Telemetry submit failed: %s", exc)
        await asyncio.sleep(5.0)
```

See also [`glossary.md`](glossary.md) §2.5 `instance_event_log` for how streams are stored.

---

## 14. Local development without Pantheon (dev-only)

For standalone debugging, set env vars manually. **Do not ship this in production code paths.**

```powershell
$env:PANTHEON_HOST_URI = "pantheon+http://127.0.0.1:9470"
$env:PANTHEON_INSTANCE_TOKEN = "dev-token"
$env:PANTHEON_INSTANCE_ID = "00000000-0000-0000-0000-000000000001"
.\bin\my-agent.exe
```

Run a mock Hub or point at a running Pantheon instance. This is **not** the install contract — Pantheon injects vars automatically when it spawns your binary.

---

## 15. Pre-ship checklist

Before declaring the agent package complete, verify every item:

- [ ] `manifest.json` parses as valid JSON with all required fields
- [ ] `runtime.binaryRelativePath` file exists and runs on Windows x86_64
- [ ] `runtime.supportedPlatforms` includes `{ "os": "windows", "arch": "x86_64" }`
- [ ] `docs/openapi.json` (or path in manifest) exists and is valid OpenAPI 3.x
- [ ] Agent reads `PANTHEON_HOST_URI`, `PANTHEON_INSTANCE_TOKEN`, `PANTHEON_INSTANCE_ID` from process env — no hardcoded Hub URL
- [ ] Agent implements `POST /telemetry/submit` client with correct headers
- [ ] Metric keys in telemetry match `customTelemetrySchema.visualGrid[].metricKey` (if any)
- [ ] Agent HTTP server exposes routes documented in OpenAPI
- [ ] HITL flow: interrupt → poll status → handle RESOLVED (if agent uses HITL)
- [ ] `capabilities` lists only intents the agent actually needs
- [ ] `instanceConfigSchema` fields match env vars the agent reads
- [ ] If using MFE: `mfeDirectory` points to built static files with `index.html`
- [ ] If no MFE: `mfeDirectory` is **not** present in manifest
- [ ] No dependency on `.env` file for Pantheon connection vars
- [ ] stderr contains no INFO or WARNING lines during normal operation (ERROR/CRITICAL only)
- [ ] Telemetry heartbeat / polling loops log at DEBUG, not INFO

---

## 16. Common mistakes

| Mistake | Fix |
| --- | --- |
| Hardcoding `http://127.0.0.1:9470` | Read `PANTHEON_HOST_URI`, strip `pantheon+` prefix |
| Using `dotenv` for Hub connection | Use `os.environ` / `process.env` for `PANTHEON_*` |
| Calling Vite/Tauri dev server | Only call Hub Core API from env URI |
| Missing OpenAPI file | Add `docs/openapi.json`; set `runtime.openApiRelativePath` |
| Linux binary on Windows Hub | Ship `.exe`; match `supportedPlatforms` |
| Metric keys mismatch | Align telemetry `key` with manifest `metricKey` |
| Agent calls HITL resolve endpoint | Agents may resolve **own instance** queue only; MFE resolves for human UX |
| Empty capabilities but agent needs network | Declare `network.outbound` with domains |
| `hasMicroFrontend` or nested `ui` object | Use top-level `mfeDirectory` string only |
| `logging.basicConfig()` without stream split | Route DEBUG/INFO/WARNING to stdout; ERROR+ to stderr only |
| Logging every telemetry POST at INFO | Use `logger.debug` for heartbeat success |

---

## 17. Suggested implementation order

1. Create package directory layout
2. Write minimal `manifest.json` and `openapi.json`
3. Implement binary that reads `PANTHEON_*` env and starts HTTP server
4. Add telemetry submit on a timer or after each work unit
5. Add `instanceConfigSchema` fields and read them from env
6. Declare capabilities; add `customTelemetrySchema` widgets
7. Add HITL interrupt + poll loop if agent needs human approval
8. Add `recommendedAutomation` entries matching your OpenAPI routes
9. Optionally build MFE and set `mfeDirectory`
10. Configure logging per §13 (stdout/stderr split, DEBUG telemetry)
11. Run pre-ship checklist (section 15)

You are done when the package passes the checklist and can be installed via Pantheon Hub **Add Agent → local folder**.
