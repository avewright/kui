#!/bin/bash

echo "🧹 Cleaning up old folders..."

# Remove old duplicate folders
if [ -d "my-react-app" ]; then
    echo "Removing my-react-app (functionality moved to frontend/)"
    rm -rf my-react-app
fi

if [ -d "consolidated_api" ]; then
    echo "Removing consolidated_api (replaced by api/)"
    rm -rf consolidated_api
fi

if [ -d "consolidated_frontend" ]; then
    echo "Removing consolidated_frontend (replaced by frontend/)"
    rm -rf consolidated_frontend
fi

if [ -d "backend" ]; then
    echo "Removing backend (replaced by api/)"
    rm -rf backend
fi

# Remove unnecessary files
if [ -f "setup.sh" ]; then
    echo "Removing old setup.sh (new one in scripts/)"
    rm setup.sh
fi

if [ -f "setup.ps1" ]; then
    echo "Removing old setup.ps1 (new one in scripts/)"
    rm setup.ps1
fi

# Remove test files and artifacts
rm -f package-lock.json *.png *.pdf *.zip *_pdf_to_png 2>/dev/null

echo "✅ Cleanup complete!"
echo ""
echo "Your project now has a clean structure:"
echo "📁 api/       - Backend server"
echo "📁 frontend/  - React website" 
echo "📁 vllm/      - AI model deployment"
echo "📁 scripts/   - Easy setup & start"
echo ""
echo "To get started: ./scripts/setup.sh" 