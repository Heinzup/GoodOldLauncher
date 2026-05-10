param(
  [string]$Version,
  [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
  Write-Host "Usage:"
  Write-Host "  npm run local-release"
  Write-Host "  npm run local-release -- -Version 0.1.3"
  exit 0
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "[local-release] Reading package version..."
$packageJsonPath = Join-Path $repoRoot "package.json"
$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$originalVersion = $packageJson.version
if ([string]::IsNullOrWhiteSpace($originalVersion)) {
  throw "package.json version is empty"
}

$targetVersion = if ([string]::IsNullOrWhiteSpace($Version)) { $originalVersion } else { $Version.Trim() }
if ($targetVersion -notmatch '^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$') {
  throw "Invalid version format: $targetVersion"
}

$versionOverridden = $false
try {
  if ($targetVersion -ne $originalVersion) {
    Write-Host "[local-release] Temporarily setting package version to $targetVersion..."
    npm version $targetVersion --no-git-tag-version --allow-same-version
    $versionOverridden = $true
  }

  $expectedInstallerName = "Good-Old-Launcher-Setup-$targetVersion.exe"
  $localOutDir = Join-Path $repoRoot ("local-release/$targetVersion")
  $expectedInstallerPath = Join-Path $localOutDir $expectedInstallerName
  $latestYmlPath = Join-Path $localOutDir "latest.yml"
  $legacyInstallerPath = Join-Path $repoRoot ("dist-electron/$expectedInstallerName")

  if (Test-Path $legacyInstallerPath) {
    Remove-Item -Path $legacyInstallerPath -Force
  }

  if (Test-Path $localOutDir) {
    Remove-Item -Path $localOutDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $localOutDir -Force | Out-Null

  Write-Host "[local-release] Building renderer..."
  npm run build:renderer

  Write-Host "[local-release] Building Windows installer (no publish) to $localOutDir..."
  $env:ELECTRON_BUILDER_CACHE = ".cache/electron-builder"
  npx electron-builder --win nsis --publish never --config.directories.output="$localOutDir"

  if (-not (Test-Path $expectedInstallerPath)) {
    throw "Expected installer not found: $expectedInstallerPath"
  }
  if (-not (Test-Path $latestYmlPath)) {
    throw "latest.yml not found: $latestYmlPath"
  }

  $latestContent = Get-Content $latestYmlPath -Raw
  $pathMatch = [regex]::Match($latestContent, "(?m)^path:\s*(.+)$")
  if (-not $pathMatch.Success) {
    throw "Cannot find path entry in latest.yml"
  }

  $ymlInstallerName = $pathMatch.Groups[1].Value.Trim()
  if ($ymlInstallerName -ne $expectedInstallerName) {
    throw "latest.yml path mismatch. Expected: $expectedInstallerName, got: $ymlInstallerName"
  }

  Write-Host "[local-release] OK"
  Write-Host "Installer: $expectedInstallerPath"
  Write-Host "Metadata:  $latestYmlPath"
}
finally {
  if ($versionOverridden) {
    Write-Host "[local-release] Restoring package version to $originalVersion..."
    npm version $originalVersion --no-git-tag-version --allow-same-version | Out-Null
  }
}
