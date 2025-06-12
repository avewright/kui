Write-Host "🧹 Cleaning up old folders..." -ForegroundColor Green

# Remove old duplicate folders
if (Test-Path "my-react-app") {
    Write-Host "Removing my-react-app (functionality moved to frontend/)" -ForegroundColor Yellow
    Remove-Item -Path "my-react-app" -Recurse -Force
}

if (Test-Path "consolidated_api") {
    Write-Host "Removing consolidated_api (replaced by api/)" -ForegroundColor Yellow
    Remove-Item -Path "consolidated_api" -Recurse -Force
}

if (Test-Path "consolidated_frontend") {
    Write-Host "Removing consolidated_frontend (replaced by frontend/)" -ForegroundColor Yellow
    Remove-Item -Path "consolidated_frontend" -Recurse -Force
}

if (Test-Path "backend") {
    Write-Host "Removing backend (replaced by api/)" -ForegroundColor Yellow
    Remove-Item -Path "backend" -Recurse -Force
}

# Remove unnecessary files
if (Test-Path "setup.sh") {
    Write-Host "Removing old setup.sh (new one in scripts/)" -ForegroundColor Yellow
    Remove-Item -Path "setup.sh" -Force
}

if (Test-Path "setup.ps1") {
    Write-Host "Removing old setup.ps1 (new one in scripts/)" -ForegroundColor Yellow
    Remove-Item -Path "setup.ps1" -Force
}

# Remove test files and artifacts
Remove-Item -Path "package-lock.json", "*.png", "*.pdf", "*.zip", "*_pdf_to_png" -Force -ErrorAction SilentlyContinue

Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your project now has a clean structure:" -ForegroundColor Blue
Write-Host "📁 api/       - Backend server" -ForegroundColor Cyan
Write-Host "📁 frontend/  - React website" -ForegroundColor Cyan
Write-Host "📁 vllm/      - AI model deployment" -ForegroundColor Cyan
Write-Host "📁 scripts/   - Easy setup & start" -ForegroundColor Cyan
Write-Host ""
Write-Host "To get started: .\scripts\setup.sh" -ForegroundColor Green 