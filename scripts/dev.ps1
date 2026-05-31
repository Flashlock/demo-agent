$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv\Scripts\Activate.ps1")) {
    & (Join-Path $Root "scripts\setup.ps1")
}

. .\.venv\Scripts\Activate.ps1

$env:PANTHEON_HOST_URI = "pantheon+http://127.0.0.1:9470"
$env:PANTHEON_INSTANCE_TOKEN = "dev-token"
$env:PANTHEON_INSTANCE_ID = "00000000-0000-0000-0000-000000000001"
$env:AGENT_SERVICE_PORT = "8099"
$env:DEMO_GREETING = "Dev mode"

Write-Host "Starting Demo Agent on port $env:AGENT_SERVICE_PORT (dev-only env vars)"
python src/demo_agent/main.py
