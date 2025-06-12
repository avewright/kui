#!/bin/bash

echo "🤖 vLLM Vision Model Deployment"
echo "==============================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Default values
MODEL=${1:-"llava-hf/llava-1.5-7b-hf"}
PORT=${2:-8000}
CONFIG_FILE="vllm/config.yaml"

print_info "Deploying vLLM vision model server..."
print_info "Model: $MODEL"
print_info "Port: $PORT"

# Check if vLLM is installed
if ! python -c "import vllm" 2>/dev/null; then
    print_warning "vLLM not found. Installing..."
    pip install vllm
fi

# Check if config file exists
if [ -f "$CONFIG_FILE" ]; then
    print_info "Using configuration from $CONFIG_FILE"
    cd vllm
    python deploy.py --config config.yaml
else
    print_info "Using command line parameters"
    cd vllm
    python deploy.py --model "$MODEL" --port "$PORT"
fi 