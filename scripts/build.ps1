$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host 'Virtual env missing - running setup.ps1 first'
    & (Join-Path $Root "scripts\setup.ps1")
}

$venvPython = Join-Path $Root ".venv\Scripts\python.exe"

Write-Host "Building React MFE ..."
Push-Location mfe
if (-not (Test-Path "node_modules")) {
    npm install
}
npm run build
Pop-Location

if (Test-Path "dist_mfe") { Remove-Item -Recurse -Force "dist_mfe" }
Copy-Item -Recurse "mfe\dist" "dist_mfe"

Write-Host "Building Windows binary with PyInstaller ..."
& $venvPython -m PyInstaller demo-agent.spec --noconfirm --clean

New-Item -ItemType Directory -Force -Path "bin" | Out-Null
Copy-Item "dist\demo-agent.exe" "bin\demo-agent.exe" -Force

Write-Host "Build complete:"
Write-Host "  bin/demo-agent.exe"
Write-Host "  dist_mfe/"
Write-Host 'Install in Pantheon Hub: Add Agent, local folder, select demo-agent'
