$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$manifest = Get-Content "manifest.json" -Raw | ConvertFrom-Json
$version = $manifest.version
$zipName = "demo-agent-v$version.zip"

$required = @(
    "manifest.json",
    "bin/demo-agent.exe",
    "docs/openapi.json",
    "assets/icon.svg",
    "dist_mfe/index.html"
)

foreach ($path in $required) {
    if (-not (Test-Path $path)) {
        throw "Missing required release file: $path (run build.ps1 first)"
    }
}

$staging = Join-Path $Root "release-staging"
if (Test-Path $staging) {
    Remove-Item -Recurse -Force $staging
}
New-Item -ItemType Directory -Force -Path $staging | Out-Null

Copy-Item "manifest.json" $staging
Copy-Item -Recurse "bin" (Join-Path $staging "bin")
Copy-Item -Recurse "docs" (Join-Path $staging "docs")
Copy-Item -Recurse "assets" (Join-Path $staging "assets")
Copy-Item -Recurse "dist_mfe" (Join-Path $staging "dist_mfe")

New-Item -ItemType Directory -Force -Path "release" | Out-Null
$zipPath = Join-Path (Join-Path $Root "release") $zipName
if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
}

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $staging

Write-Host "Release package ready:"
Write-Host "  $zipPath"
