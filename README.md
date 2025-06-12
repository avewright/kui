# 🚀 Simple vLLM Document Extraction

A clean, modern document extraction system with vLLM vision models and React.

## 📁 Project Structure (Simple!)

```
├── api/                 # Backend FastAPI server
│   ├── main.py         # Main API code
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile      # For Docker deployment
├── frontend/            # React web interface
│   ├── src/            # React components & code
│   ├── package.json    # Node.js dependencies
│   └── Dockerfile      # For Docker deployment
├── vllm/               # Vision model deployment
│   ├── deploy.py       # Deploy vision models
│   └── config.yaml     # Model configuration
├── scripts/            # Easy deployment scripts
│   ├── setup.sh        # One-time setup
│   └── start.sh        # Start everything
├── docker-compose.yml  # Run everything with Docker
└── README.md          # This file
```

**That's it!** Only 4 main folders you need to care about.

## 🎯 What Each Folder Does

| Folder | Purpose | You Need This If... |
|--------|---------|---------------------|
| `api/` | Handles PDF processing and talks to AI models | Always (this is the backend) |
| `frontend/` | The website you see in your browser | Always (this is the UI) |
| `vllm/` | Deploys AI vision models for document reading | You want to run AI models locally |
| `scripts/` | Makes setup and starting easy | You want simple commands |

## 🚀 Super Easy Deployment

### Option 1: Automatic Setup (Recommended)
```bash
# Setup everything once
./scripts/setup.sh

# Start everything
./scripts/start.sh
```
**Done!** Go to http://localhost:3000

### Option 2: Docker (Even Easier)
```bash
# Start everything with one command
docker-compose up
```
**Done!** Go to http://localhost:3000

### Option 3: Manual (If you want control)
```bash
# 1. Start the AI model server
cd vllm
python deploy.py --model llava-1.5-7b

# 2. Start the backend (new terminal)
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py

# 3. Start the frontend (new terminal)
cd frontend
npm install
npm run dev
```

## 🎮 How to Use

1. **Open your browser** → http://localhost:3000
2. **Upload a PDF** → Drag & drop or click to select
3. **Configure fields** → Tell it what to extract (title, date, etc.)
4. **Click Process** → Watch it extract data using AI
5. **Download results** → Get JSON with extracted data

## 🔧 Configuration

### Change AI Model
Edit `vllm/config.yaml`:
```yaml
model: "llava-hf/llava-1.5-13b-hf"  # Use bigger model
gpu_memory_utilization: 0.95        # Use more GPU memory
```

### Change Ports
Edit `api/.env`:
```
VLLM_ENDPOINT=http://localhost:8000
API_PORT=8080
```

Edit `frontend/.env`:
```
REACT_APP_API_URL=http://localhost:8080
```

## 🛠️ Requirements

- **Python 3.8+** (for AI models)
- **Node.js 18+** (for web interface)
- **GPU** (optional, for local AI models)
- **Docker** (optional, for easy deployment)

## ❓ Need Help?

**Model won't start?** Check if you have enough GPU memory (8GB+ recommended)

**Can't access website?** Make sure ports 3000, 8080, and 8000 aren't in use

**Extraction not working?** Check that vLLM server is running at http://localhost:8000

**Want different model?** Run: `python vllm/deploy.py --list-models`

## 🔥 Features

- **Drag & drop PDFs** - Easy file upload
- **Custom fields** - Extract exactly what you need
- **Real-time processing** - See progress as it works
- **Multiple models** - Support for LLaVA, MiniCPM-V, Qwen-VL
- **Export results** - Download as JSON
- **Cloud ready** - Deploy anywhere

---

**That's it!** Simple, clean, and powerful document extraction with AI. 