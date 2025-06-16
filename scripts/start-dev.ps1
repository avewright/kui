# Development startup script for KUI PDF Processing App
Write-Host "🚀 Starting KUI Development Environment..." -ForegroundColor Green

# Function to check if a command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

if (-not (Test-Command "node")) {
    Write-Error "Node.js is not installed. Please install Node.js first."
    exit 1
}

if (-not (Test-Command "python")) {
    Write-Error "Python is not installed. Please install Python first."
    exit 1
}

# Set working directory to project root
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "📂 Project root: $ProjectRoot" -ForegroundColor Cyan

# Start Backend API Server
Write-Host "🐍 Starting Backend API Server (port 8080)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\backend'; python main.py" -WindowStyle Normal

# Give backend time to start
Start-Sleep -Seconds 3

# Start Frontend Development Server  
Write-Host "⚛️ Starting Frontend Development Server (port 3000)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\frontend'; npm start" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Development servers starting..." -ForegroundColor Green
Write-Host "📱 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔗 Backend API: http://localhost:8080" -ForegroundColor Cyan
Write-Host "📚 API Docs: http://localhost:8080/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Note: AI service on port 5000 is optional - will use dummy data if unavailable" -ForegroundColor Yellow
Write-Host "📁 Logs will be saved to backend/logs/ directory" -ForegroundColor Cyan
Write-Host "🛑 Press Ctrl+C in each terminal to stop the services" -ForegroundColor Yellow 