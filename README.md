# KUI PDF Processing Application

A modern web application for PDF processing with AI-powered metadata extraction. Built with React frontend and FastAPI backend.

## 🏗️ Project Structure

```
kui/
├── README.md                     # Project documentation
├── .gitignore                    # Git ignore rules
│
├── frontend/                     # React Application (PDF Viewer UI)
│   ├── package.json             # Frontend dependencies
│   ├── public/                  # Static assets
│   └── src/                     # React source code
│       ├── App.js               # Main application component
│       ├── App.css              # Application styles
│       └── ...                  # Other React components
│
├── backend/                      # FastAPI Backend (PDF Processing)
│   ├── main.py                  # FastAPI application entry point
│   ├── requirements.txt         # Python dependencies
│   ├── app/                     # Application modules (future structure)
│   │   ├── api/                 # API route handlers
│   │   ├── services/            # Business logic services
│   │   ├── models/              # Data models
│   │   └── utils/               # Utility functions
│   └── legacy_main.py           # Original implementation (for reference)
│
├── engine/                      # Native PDF Processing Engine
│   ├── pdf_to_image.c          # C implementation for fast PDF→image conversion
│   └── fast_pdf_to_png         # Compiled binary
│
├── scripts/                     # Development Scripts
│   ├── start-dev.ps1           # Start development environment (Windows)
│   └── start-dev.sh            # Start development environment (Unix/Linux)
│
└── docs/                       # Documentation
    └── ... (development guides, API docs)
```

## ✨ Features

- **PDF Upload & Processing**: Drag-and-drop PDF upload with real-time processing
- **AI Metadata Extraction**: Automatic extraction of titles, drawing numbers, and revision history
- **Interactive PDF Viewer**: Page-by-page navigation with zoom and pan capabilities
- **Metadata Editing**: Manual editing and refinement of extracted metadata
- **Modern UI**: Beautiful, responsive interface built with React
- **Fast Processing**: Native C engine for high-performance PDF to image conversion

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **AI Service** (optional, for metadata extraction)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kui
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd ../backend
   pip install -r requirements.txt
   ```

4. **Start Development Environment**
   
   **Windows:**
   ```powershell
   .\scripts\start-dev.ps1
   ```
   
   **Unix/Linux:**
   ```bash
   ./scripts/start-dev.sh
   ```

### Manual Start (Alternative)

**Terminal 1 - Backend API:**
```bash
cd backend
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Documentation**: http://localhost:8080/docs

## 🔌 API Endpoints

### Core PDF Processing
- `POST /pdf_info` - Upload PDF and get basic information
- `GET /pdf_page/{pdf_id}/{page_number}` - Get specific page as base64 image
- `DELETE /pdf/{pdf_id}` - Cleanup stored PDF data

### AI Metadata Extraction
- `POST /ai_metadata/start` - Start AI processing for a PDF
- `GET /ai_metadata/{processing_id}/{page_number}` - Get AI metadata for a page

## 🤖 AI Integration

The application integrates with an external AI service for metadata extraction:

- **AI Service URL**: http://localhost:5000
- **Model**: Multimodal AI for document understanding
- **Extraction**: Drawing titles, numbers, revision history

To enable AI features, ensure your AI service is running on port 5000.

## 🛠️ Development

### Project Philosophy

This project follows a **clean architecture** pattern:

- **Frontend**: Pure React UI, handles user interactions and API calls
- **Backend**: FastAPI service, handles PDF processing and AI integration
- **Engine**: Native performance layer for CPU-intensive operations
- **AI Service**: External microservice for machine learning inference

### Code Organization

- **Separation of Concerns**: Each component has a clear responsibility
- **API-First**: Backend exposes REST APIs for all functionality
- **Modular**: Components can be developed and deployed independently
- **Scalable**: Architecture supports horizontal scaling

## 📚 Documentation

- **API Documentation**: Available at `/docs` when backend is running
- **Development Guide**: Coming soon
- **Deployment Guide**: Coming soon

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure ports 3000, 8080, and 5000 are available
2. **Python Dependencies**: Use a virtual environment for backend
3. **AI Service**: AI features require external service on port 5000

### Debug Mode

Add environment variables for debug mode:
```bash
# Backend
export DEBUG=true

# Frontend  
export REACT_APP_DEBUG=true
```

## 🤝 Contributing

1. Follow the established project structure
2. Keep frontend and backend concerns separated
3. Add tests for new functionality
4. Update documentation for API changes

## 📄 License

[Your License Here] 