#!/bin/bash

echo "🚀 Starting Consolidated vLLM Document Extraction System"
echo "========================================================"

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

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start services in background
start_vllm() {
    print_info "Starting vLLM server..."
    cd vllm
    python deploy.py --model llava-1.5-7b &
    VLLM_PID=$!
    cd ..
    echo $VLLM_PID > .vllm.pid
    print_status "vLLM server started (PID: $VLLM_PID)"
}

start_api() {
    print_info "Starting API server..."
    cd api
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
    python main.py &
    API_PID=$!
    cd ..
    echo $API_PID > .api.pid
    print_status "API server started (PID: $API_PID)"
}

start_frontend() {
    print_info "Starting frontend..."
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    echo $FRONTEND_PID > .frontend.pid
    print_status "Frontend started (PID: $FRONTEND_PID)"
}

# Function to stop all services
stop_services() {
    print_info "Stopping all services..."
    
    if [ -f .vllm.pid ]; then
        VLLM_PID=$(cat .vllm.pid)
        kill $VLLM_PID 2>/dev/null && print_status "vLLM server stopped"
        rm .vllm.pid
    fi
    
    if [ -f .api.pid ]; then
        API_PID=$(cat .api.pid)
        kill $API_PID 2>/dev/null && print_status "API server stopped"
        rm .api.pid
    fi
    
    if [ -f .frontend.pid ]; then
        FRONTEND_PID=$(cat .frontend.pid)
        kill $FRONTEND_PID 2>/dev/null && print_status "Frontend stopped"
        rm .frontend.pid
    fi
    
    # Kill any remaining processes on our ports
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    lsof -ti:8080 | xargs kill -9 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    
    print_status "All services stopped"
    exit 0
}

# Set up signal handling
trap stop_services SIGINT SIGTERM

# Check command line arguments
case "${1:-start}" in
    "start")
        # Check if ports are available
        if check_port 8000; then
            print_warning "Port 8000 is already in use (vLLM)"
        fi
        
        if check_port 8080; then
            print_warning "Port 8080 is already in use (API)"
        fi
        
        if check_port 3000; then
            print_warning "Port 3000 is already in use (Frontend)"
        fi
        
        # Start services
        start_vllm
        sleep 5  # Wait for vLLM to start
        
        start_api
        sleep 3  # Wait for API to start
        
        start_frontend
        
        echo ""
        print_status "🎉 All services started!"
        echo ""
        print_info "Access the application at: http://localhost:3000"
        print_info "API documentation at: http://localhost:8080/docs"
        print_info "vLLM server at: http://localhost:8000"
        echo ""
        print_warning "Press Ctrl+C to stop all services"
        
        # Wait for user to stop
        while true; do
            sleep 1
        done
        ;;
        
    "stop")
        stop_services
        ;;
        
    "status")
        print_info "Checking service status..."
        
        if check_port 8000; then
            print_status "vLLM server is running on port 8000"
        else
            print_error "vLLM server is not running"
        fi
        
        if check_port 8080; then
            print_status "API server is running on port 8080"
        else
            print_error "API server is not running"
        fi
        
        if check_port 3000; then
            print_status "Frontend is running on port 3000"
        else
            print_error "Frontend is not running"
        fi
        ;;
        
    *)
        echo "Usage: $0 {start|stop|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services"
        echo "  stop    - Stop all services" 
        echo "  status  - Check service status"
        exit 1
        ;;
esac 