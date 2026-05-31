$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python not found on PATH. Install Python 3.11+ and retry."
}

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment at demo-agent/.venv ..."
    python -m venv .venv
}

$venvPython = Join-Path $Root ".venv\Scripts\python.exe"
$venvPip = Join-Path $Root ".venv\Scripts\pip.exe"

Write-Host "Installing Python dependencies into .venv (not global) ..."
& $venvPython -m pip install --upgrade pip
& $venvPip install -r (Join-Path $Root "requirements.txt")

Write-Host "Setup complete. Activate with: .\.venv\Scripts\Activate.ps1"
