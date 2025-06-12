# Integration Guide: Adding Cloud MM Inference to Your Existing Setup

Since you already have a working `my-react-app` with FastAPI and React frontend, here's how to enhance it with cloud mm_inference capabilities instead of creating new folders.

## 🔧 Quick Integration Steps

### 1. Update Your FastAPI Backend

Your existing `fast_api.py` already has most of what we need. Just add the cloud integration:

**Add these lines to your existing imports at the top of `fast_api.py`:**
```python
import httpx
import json
```

**Add this configuration variable after your existing config:**
```python
MM_INFERENCE_URL = os.getenv("MM_INFERENCE_URL", "http://your-cloud-pod-url:5000")
```

**Copy the cloud methods from `cloud_endpoints.py` into your existing `FastAIClient` class:**
- The `process_with_mm_inference` method
- The new endpoints: `/ai_metadata_cloud/start`, etc.
- The helper functions: `process_all_pages_cloud`, `process_page_cloud`

### 2. Update Your React Frontend

**Add the new React component:**
- Copy `my-react-app/src/CloudExtraction.jsx` into your existing `src/` folder
- Import and use it in your main App component

**Example integration in your existing App.js:**
```jsx
import CloudExtraction from './CloudExtraction';

function App() {
  return (
    <div>
      {/* Your existing components */}
      
      {/* Add the cloud extraction component */}
      <CloudExtraction />
    </div>
  );
}
```

### 3. Set Your Cloud MM Inference URL

Create a `.env` file in your `my-react-app` directory:
```
MM_INFERENCE_URL=http://your-actual-cloud-pod-url:5000
```

Or set it as an environment variable:
```bash
# Windows
set MM_INFERENCE_URL=http://your-cloud-pod-url:5000

# Mac/Linux
export MM_INFERENCE_URL=http://your-cloud-pod-url:5000
```

## 🚀 Testing Your Integration

1. **Start your existing FastAPI server:**
   ```bash
   cd my-react-app
   python fast_api.py
   ```

2. **Start your existing React app:**
   ```bash
   cd my-react-app
   npm start
   ```

3. **Test the new cloud endpoints:**
   - Visit your React app (usually `http://localhost:3000`)
   - Look for the new "Cloud MM Inference Extraction" section
   - Upload a PDF and test the cloud extraction

## 📊 What You Get

### New API Endpoints (added to your existing FastAPI):
- `POST /ai_metadata_cloud/start` - Start cloud processing
- `GET /ai_metadata_cloud/{id}/status` - Get processing status
- `GET /ai_metadata_cloud/{id}/{page}` - Get specific page results
- `GET /health` - Enhanced health check with cloud status

### Enhanced Frontend:
- Cloud extraction component with field customization
- Real-time progress tracking
- Side-by-side image and extraction results
- JSON export functionality

## 🔄 How It Works

1. **PDF Upload** → Your existing PDF processing
2. **Image Conversion** → Your existing `pdf_to_image_data_url_fast` function
3. **Cloud Processing** → New: Sends to your mm_inference pod via HTTP
4. **Results Display** → New: Enhanced UI showing images + extractions
5. **Database Metrics** → Your existing metrics tracking (enhanced for cloud)

## 🎯 Benefits vs Starting From Scratch

✅ **Keep your existing work** - No need to migrate  
✅ **Database & metrics** - Your existing SQLite tracking continues  
✅ **Dual processing** - Local AI model + Cloud mm_inference  
✅ **Gradual migration** - Test cloud processing while keeping existing functionality  
✅ **Same React app** - Just adds new components  

## 🔧 Advanced Configuration

### Custom Field Extraction
The cloud component supports dynamic field configuration:
```javascript
const customFields = {
  field_names: [
    { document_field: 'drawing title', return_field: 'drawing_title' },
    { document_field: 'project number', return_field: 'project_number' },
    // Add more fields as needed
  ]
}
```

### Error Handling
The integration includes comprehensive error handling:
- Network timeout handling
- Cloud service unavailability
- Processing failures with detailed error messages
- Automatic retry logic

### Performance
- Parallel page processing for multi-page documents
- Real-time progress updates
- Optimized image conversion (your existing JPEG optimization)
- Connection pooling for cloud requests

## 🏗️ Architecture After Integration

```
Your my-react-app/
├── fast_api.py (enhanced with cloud endpoints)
├── Your existing React frontend (enhanced with CloudExtraction)
├── Your existing database & metrics
└── New: Direct connection to your cloud mm_inference pod
```

## 🚨 Important Notes

1. **Backwards Compatibility**: All your existing endpoints remain unchanged
2. **Database**: New cloud processing metrics are stored alongside existing ones
3. **Port**: Keep using your existing port (8080)
4. **Dependencies**: `httpx` was already in your requirements.txt

## 🔍 Troubleshooting

### If cloud processing fails:
1. Check your `MM_INFERENCE_URL` environment variable
2. Verify your cloud pod is accessible: `GET /health`
3. Check the enhanced health endpoint for cloud status
4. Review the console logs for detailed error messages

### If integration conflicts:
1. The new endpoints use different routes (`/ai_metadata_cloud/*`)
2. New React component is self-contained
3. Database schema additions are backward compatible

This integration approach lets you enhance your existing setup without losing any of your current functionality while adding powerful cloud processing capabilities! 