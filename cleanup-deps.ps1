# Dependency Cleanup Script for PowerShell

Write-Host "=== Dependency Analysis and Cleanup ===" -ForegroundColor Cyan
Write-Host

# Check current size
if (Test-Path "node_modules") {
    $size = (Get-ChildItem "node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum
    $sizeGB = [math]::Round($size / 1GB, 2)
    Write-Host "Current node_modules size: $sizeGB GB" -ForegroundColor Yellow
} else {
    Write-Host "node_modules not found" -ForegroundColor Red
    exit
}

Write-Host

# Check for large packages
Write-Host "Large packages (>50MB):" -ForegroundColor Yellow
Get-ChildItem "node_modules" | Where-Object { $_.PSIsContainer } | ForEach-Object {
    $pkgSize = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    if ($pkgSize -gt 50MB) {
        $sizeMB = [math]::Round($pkgSize / 1MB, 1)
        Write-Host "  $sizeMB MB - $($_.Name)"
    }
} | Sort-Object -Property { $_ -split ' ' -replace '[^0-9.]' } -Descending

Write-Host
Write-Host "Suggestions for cleanup:" -ForegroundColor Green
Write-Host

# Check for common cleanup candidates
$candidates = @(
    "@storybook",
    "jest",
    "vitest",
    "@testing-library",
    "eslint",
    "prettier",
    "@types"
)

$foundCandidates = @()
foreach ($candidate in $candidates) {
    $path = "node_modules/$candidate"
    if (Test-Path $path) {
        $foundCandidates += $candidate
    }
}

if ($foundCandidates.Count -gt 0) {
    Write-Host "Found development dependencies that might not be needed in production:"
    foreach ($candidate in $foundCandidates) {
        Write-Host "  - $candidate"
    }
    Write-Host
    Write-Host "To remove these (if not needed):" -ForegroundColor Yellow
    Write-Host "  npm uninstall $([string]::Join(' ', $foundCandidates)) --save-dev"
} else {
    Write-Host "No obvious cleanup candidates found"
}

Write-Host
Write-Host "Other cleanup options:" -ForegroundColor Green
Write-Host "1. npm prune --production  # Remove devDependencies"
Write-Host "2. npm cache clean --force  # Clear npm cache"
Write-Host "3. Remove node_modules and reinstall: rm -rf node_modules && npm install"

Write-Host
Write-Host "Warning: Only remove dependencies you're sure aren't needed!" -ForegroundColor Red