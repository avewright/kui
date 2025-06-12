#!/bin/bash

echo "🚀 Setting up Consolidated vLLM Document Extraction System"
echo "========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed."
    exit 1
fi

print_status "Prerequisites check passed"

# Ask for vLLM endpoint
echo ""
read -p "Enter your vLLM endpoint URL (default: http://localhost:8000): " VLLM_ENDPOINT
VLLM_ENDPOINT=${VLLM_ENDPOINT:-http://localhost:8000}

echo ""
print_info "Setting up backend API..."

# Setup backend
cd api

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    source venv/Scripts/activate
else
    # macOS/Linux
    source venv/bin/activate
fi

# Install dependencies
print_info "Installing Python dependencies..."
pip install -r requirements.txt

# Create .env file
echo "VLLM_ENDPOINT=$VLLM_ENDPOINT" > .env
echo "API_PORT=8080" >> .env

cd ..

print_status "Backend setup complete"

echo ""
print_info "Setting up frontend..."

# Setup frontend
cd frontend

# Install dependencies
print_info "Installing Node.js dependencies..."
npm install

# Create .env file for frontend
echo "REACT_APP_API_URL=http://localhost:8080" > .env

cd ..

print_status "Frontend setup complete"

echo ""
print_info "Setting up vLLM deployment..."

# Create vLLM requirements
cd vllm
echo "vllm>=0.2.0" > requirements.txt
echo "transformers>=4.35.0" >> requirements.txt
echo "torch>=2.0.0" >> requirements.txt
echo "pyyaml>=6.0" >> requirements.txt

cd ..

print_status "vLLM setup complete"

echo ""
print_status "🎉 Setup complete!"
echo ""
print_info "To start the system:"
echo ""
echo "1. Deploy vLLM model server:"
echo "   cd vllm"
echo "   python deploy.py --model llava-1.5-7b"
echo ""
echo "2. Start the backend API:"
echo "   cd api"
echo "   source venv/bin/activate  # (or venv\\Scripts\\activate on Windows)"
echo "   python main.py"
echo ""
echo "3. In a new terminal, start the frontend:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
print_info "Your vLLM endpoint is set to: $VLLM_ENDPOINT"
print_info "You can change this later by editing api/.env"
echo ""
print_warning "Make sure you have sufficient GPU memory for the vision model!"
print_info "For help with model deployment, run: python vllm/deploy.py --help" 