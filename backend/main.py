from PIL import Image
import fastapi
from fastapi import File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io
import fitz  # PyMuPDF provides the 'fitz' module
import base64
import asyncio
import hashlib
import tempfile
import os
import httpx
from typing import Dict
import time  # for simple timeout loop

# Import our custom modules
from app.utils.logging import setup_logging, get_logger
from app.services.ai_client import ai_client
from config import DEBUG, HOST, PORT, ALLOWED_ORIGINS, validate_production_config, ALLOW_DUMMY_DATA, IS_PRODUCTION

# Setup logging
logger = setup_logging(
    level="DEBUG" if DEBUG else "INFO",
    log_to_file=True,
    log_to_console=True
)

# Create FastAPI app
app = fastapi.FastAPI(
    title="PDF Processing API", 
    description="Advanced PDF processing with AI metadata extraction",
    version="1.0.0",
    debug=DEBUG
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store PDF files temporarily using hash as key
pdf_storage: Dict[str, bytes] = {}

@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    logger.info("🚀 Starting PDF Processing API")
    
    # Validate production configuration
    try:
        config_status = validate_production_config()
        logger.info(f"🔧 Environment: {config_status['environment']}")
        logger.info(f"🔧 Debug mode: {config_status['debug']}")
        logger.info(f"🎭 Allow dummy data: {config_status['allow_dummy_data']}")
        logger.info(f"🎭 Force dummy data: {config_status['force_dummy_data']}")
        logger.info(f"🌐 Allowed origins: {ALLOWED_ORIGINS}")
        
        if IS_PRODUCTION and ALLOW_DUMMY_DATA:
            logger.critical("🚨 PRODUCTION SAFETY CHECK FAILED!")
        elif IS_PRODUCTION:
            logger.info("✅ Production safety checks passed")
        
    except ValueError as e:
        logger.critical(str(e))
        raise
    
    # Check AI service availability on startup
    await ai_client.check_service_health()

@app.on_event("shutdown") 
async def shutdown_event():
    """Application shutdown event"""
    logger.info("🛑 Shutting down PDF Processing API")

@app.get("/")
async def root():
    """Health check endpoint"""
    logger.debug("📋 Health check requested")
    return {
        "message": "PDF Processing API", 
        "version": "1.0.0",
        "status": "healthy",
        "debug": DEBUG
    }

@app.post("/pdf_info")
async def get_pdf_info(file: UploadFile = File(...)):
    """Get basic PDF information including page count"""
    logger.info(f"📄 Processing PDF info for: {file.filename} ({file.size} bytes)")
    
    try:
        contents = await file.read()
        
        # Create a hash for this PDF to use as a temporary key
        pdf_hash = hashlib.md5(contents).hexdigest()
        logger.debug(f"🔐 Generated PDF hash: {pdf_hash}")
        
        # Store the PDF temporarily
        pdf_storage[pdf_hash] = contents
        logger.debug(f"💾 Stored PDF in memory cache")
        
        # Get page count
        pdf_stream = io.BytesIO(contents)
        doc = fitz.open(stream=pdf_stream, filetype="pdf")
        page_count = len(doc)
        doc.close()
        
        logger.info(f"✅ PDF processed - {page_count} pages")
        
        return {
            "pdf_id": pdf_hash,
            "page_count": page_count,
            "filename": file.filename
        }
    except Exception as e:
        logger.error(f"❌ Error processing PDF {file.filename}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(e)}")

@app.get("/pdf_page/{pdf_id}/{page_number}")
async def get_pdf_page(pdf_id: str, page_number: int):
    """Get a specific page from a PDF as base64 image"""
    logger.debug(f"🖼️ Converting page {page_number} for PDF {pdf_id[:8]}...")
    
    try:
        if pdf_id not in pdf_storage:
            logger.warning(f"⚠️ PDF not found in cache: {pdf_id}")
            raise HTTPException(status_code=404, detail="PDF not found. Please upload again.")
        
        pdf_bytes = pdf_storage[pdf_id]
        
        # Convert specific page to image
        image = await convert_pdf_page_to_image(pdf_bytes, page_number)
        
        # Convert image to base64
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        logger.debug(f"✅ Page {page_number} converted successfully ({len(img_str)} chars base64)")
        
        return {
            "page_number": page_number,
            "image": img_str,
            "pdf_id": pdf_id
        }
    except Exception as e:
        logger.error(f"❌ Error processing page {page_number}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing page {page_number}: {str(e)}")

@app.delete("/pdf/{pdf_id}")
async def cleanup_pdf(pdf_id: str):
    """Clean up stored PDF data"""
    logger.info(f"🧹 Cleaning up PDF: {pdf_id[:8]}...")
    
    if pdf_id in pdf_storage:
        del pdf_storage[pdf_id]
        logger.info(f"✅ PDF {pdf_id[:8]} cleaned up successfully")
        return {"message": "PDF cleaned up successfully"}
    
    logger.warning(f"⚠️ PDF not found for cleanup: {pdf_id}")
    return {"message": "PDF not found"}

@app.post("/ai_metadata/start")
async def start_ai_metadata_extraction(file: UploadFile = File(...)):
    """Start sequential AI metadata extraction from the multimodal model"""
    logger.info(f"🤖 Starting AI metadata extraction for: {file.filename}")
    
    try:
        # Read the file
        contents = await file.read()
        logger.debug(f"📖 Read {len(contents)} bytes from {file.filename}")
        
        # Use AI client with fallback
        result = await ai_client.start_processing(contents, file.filename)
        
        logger.info(f"✅ AI processing started: {result.get('processing_id', 'unknown')}")
        return result
            
    except Exception as e:
        logger.error(f"❌ Unexpected error in AI metadata start: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error starting AI processing: {str(e)}")

@app.get("/ai_metadata/{processing_id}/{page_number}")
async def get_ai_metadata_page(processing_id: str, page_number: int):
    """Get AI metadata for a specific page, with automatic fallback to dummy data"""
    logger.debug(f"🤖 Getting AI metadata for page {page_number} (ID: {processing_id[:8]}...)")
    
    try:
        result = await ai_client.get_page_metadata(processing_id, page_number)
        logger.debug(f"✅ Got metadata for page {page_number}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error getting AI metadata for page {page_number}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting metadata: {str(e)}")

async def convert_pdf_page_to_image(pdf_bytes: bytes, page_number: int) -> Image.Image:
    """Convert a specific PDF page to PIL Image"""
    logger.debug(f"🔄 Converting page {page_number} to image")
    
    try:
        # Use PyMuPDF to convert PDF page to image
        pdf_stream = io.BytesIO(pdf_bytes)
        doc = fitz.open(stream=pdf_stream, filetype="pdf")
        
        if page_number >= len(doc):
            raise ValueError(f"Page {page_number} does not exist (PDF has {len(doc)} pages)")
        
        page = doc.load_page(page_number)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
        img_data = pix.tobytes("png")
        doc.close()
        
        # Convert to PIL Image
        image = Image.open(io.BytesIO(img_data))
        logger.debug(f"✅ Page {page_number} converted to {image.size} image")
        return image
    except Exception as e:
        logger.error(f"❌ Failed to convert page {page_number}: {str(e)}")
        raise Exception(f"Failed to convert page {page_number}: {str(e)}")

if __name__ == "__main__":
    logger.info(f"🌟 Starting server on {HOST}:{PORT}")
    uvicorn.run(app, host=HOST, port=PORT) 