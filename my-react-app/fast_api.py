import asyncio
import base64
import hashlib
import io
import os
import time
from datetime import datetime
from typing import Dict, Optional, List
import logging
import httpx
import json
import uuid
from fastapi import Form

import fitz  # PyMuPDF
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from PIL import Image
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class InferenceMetrics(Base):
    __tablename__ = "inference_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    input_token_count = Column(Integer)
    output_token_count = Column(Integer)
    request_time = Column(DateTime)
    model_name = Column(String)
    prompt_tokens = Column(Integer)
    total_tokens = Column(Integer)
    latency_ms = Column(Float)
    error_message = Column(Text, nullable=True)

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="Fast Unified PDF & AI API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
AI_MODEL_BASE_URL = os.getenv("AI_MODEL_BASE_URL", "http://localhost:8000/v1")
AI_MODEL_NAME = os.getenv("AI_MODEL_NAME", "kai-vision-05-13")
MM_INFERENCE_URL = os.getenv("MM_INFERENCE_URL", "http://your-cloud-pod-url:8000")

# Storage for PDFs and processing results  
pdf_storage: Dict[str, bytes] = {}
page_results: Dict[str, Dict[str, any]] = {}

class FastAIClient:
    """High-performance AI client with connection pooling"""
    
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key="EMPTY",
            base_url=AI_MODEL_BASE_URL,
            max_retries=3,
            timeout=60.0
        )
        self._prompt_cache = {}
    
    def get_tbe_prompt(self) -> str:
        """Cached TBE prompt"""
        if "tbe" not in self._prompt_cache:
            self._prompt_cache["tbe"] = """Extract the following information from this document image:

1. **Document Type**: Identify what type of document this is (e.g., invoice, receipt, contract, form, etc.)

2. **Key Information**: Extract the most important information including:
   - Names, addresses, phone numbers, emails
   - Dates and amounts
   - Reference numbers or IDs
   - Any signatures or stamps

3. **Text Content**: Provide all readable text content in a structured format

4. **Tables/Lists**: If there are tables or lists, structure them clearly

5. **Special Elements**: Note any logos, stamps, watermarks, or other special visual elements

Please provide your response in a clear, structured JSON format with the extracted information."""
        
        return self._prompt_cache["tbe"]
    
    async def process_image_fast(self, image_data_url: str, db: Session) -> dict:
        """Fast image processing with optimized settings"""
        start_time = time.time()
        prompt = self.get_tbe_prompt()
        
        try:
            response = await self.client.chat.completions.create(
                model=AI_MODEL_NAME,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                }],
                max_tokens=4000,  # Optimize token usage
                temperature=0.1   # More deterministic responses
            )
            
            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000
            
            # Record metrics
            metrics = InferenceMetrics(
                input_token_count=response.usage.prompt_tokens,
                output_token_count=response.usage.completion_tokens,
                request_time=datetime.utcnow(),
                model_name=AI_MODEL_NAME,
                prompt_tokens=response.usage.prompt_tokens,
                total_tokens=response.usage.total_tokens,
                latency_ms=latency_ms,
            )
            db.add(metrics)
            db.commit()
            
            return {
                "content": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "latency_ms": latency_ms
            }
            
        except Exception as e:
            # Record error metrics
            metrics = InferenceMetrics(
                input_token_count=0,
                output_token_count=0,
                request_time=datetime.utcnow(),
                model_name=AI_MODEL_NAME,
                error_message=str(e),
            )
            db.add(metrics)
            db.commit()
            logger.error(f"AI model error: {e}")
            raise HTTPException(status_code=500, detail=f"AI model error: {str(e)}")
    
    async def process_with_mm_inference(self, image_data_url: str, custom_prompt: str, db: Session) -> dict:
        """Process image using cloud mm_inference pod directly"""
        start_time = time.time()
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Prepare payload for mm_inference
                payload = {
                    "prompt": custom_prompt,
                    "image": image_data_url,
                    "max_tokens": 4000,
                    "temperature": 0.1
                }
                
                # Send to cloud mm_inference pod
                response = await client.post(
                    f"{MM_INFERENCE_URL}/tbe",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=500, 
                        detail=f"MM inference error: {response.status_code} - {response.text}"
                    )
                
                result = response.json()
                end_time = time.time()
                latency_ms = (end_time - start_time) * 1000
                
                # Record metrics for mm_inference
                metrics = InferenceMetrics(
                    input_token_count=0,  # mm_inference might not return token counts
                    output_token_count=0,
                    request_time=datetime.utcnow(),
                    model_name="mm_inference_cloud",
                    latency_ms=latency_ms,
                )
                db.add(metrics)
                db.commit()
                
                return {
                    "content": result.get("content", result),
                    "usage": result.get("usage", {}),
                    "latency_ms": latency_ms,
                    "source": "mm_inference_cloud"
                }
                
        except httpx.TimeoutException:
            logger.error("MM inference request timed out")
            raise HTTPException(status_code=504, detail="MM inference service timeout")
        except Exception as e:
            # Record error metrics
            metrics = InferenceMetrics(
                input_token_count=0,
                output_token_count=0,
                request_time=datetime.utcnow(),
                model_name="mm_inference_cloud",
                error_message=str(e),
            )
            db.add(metrics)
            db.commit()
            logger.error(f"MM inference error: {e}")
            raise HTTPException(status_code=500, detail=f"MM inference error: {str(e)}")

# Initialize AI client
ai_client = FastAIClient()

def pdf_to_image_data_url_fast(pdf_bytes: bytes, page_number: int) -> str:
    """Fast PDF to image conversion with optimized settings"""
    pdf_stream = io.BytesIO(pdf_bytes)
    doc = fitz.open(stream=pdf_stream, filetype="pdf")
    
    if page_number >= len(doc) or page_number < 0:
        doc.close()
        raise ValueError(f"Page number {page_number} out of range")
    
    page = doc.load_page(page_number)
    # Optimized matrix for balance of quality and speed
    mat = fitz.Matrix(1.5, 1.5)  # Reduced from 2.0 for speed
    pix = page.get_pixmap(matrix=mat, alpha=False)  # No alpha for speed
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    # Fast compression
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=85, optimize=True)  # JPEG faster than PNG
    img_str = base64.b64encode(buffered.getvalue()).decode()
    data_url = f"data:image/jpeg;base64,{img_str}"
    
    doc.close()
    return data_url

async def process_page_fast(pdf_bytes: bytes, page_num: int, db: Session) -> Optional[dict]:
    """Ultra-fast page processing"""
    try:
        # Convert page to optimized image
        image_data_url = pdf_to_image_data_url_fast(pdf_bytes, page_num)
        
        # Process with AI model
        result = await ai_client.process_image_fast(image_data_url, db)
        
        return {
            "page_number": page_num + 1,
            "result": result["content"],
            "usage": result["usage"],
            "latency_ms": result["latency_ms"]
        }
        
    except Exception as e:
        logger.error(f"Error processing page {page_num}: {e}")
        return None

async def process_all_pages_parallel(pdf_bytes: bytes, processing_id: str):
    """Process all pages in parallel for maximum speed"""
    pdf_stream = io.BytesIO(pdf_bytes)
    doc = fitz.open(stream=pdf_stream, filetype="pdf")
    total_pages = len(doc)
    doc.close()
    
    # Get database session
    db = next(get_db())
    
    try:
        # Process pages in parallel batches of 5 to avoid overwhelming the AI service
        batch_size = 5
        for i in range(0, total_pages, batch_size):
            batch_pages = range(i, min(i + batch_size, total_pages))
            
            # Process batch in parallel
            tasks = [process_page_fast(pdf_bytes, page_num, db) for page_num in batch_pages]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Store successful results
            for page_num, result in zip(batch_pages, results):
                if result and not isinstance(result, Exception):
                    page_results[processing_id]['results'][page_num] = result
                    logger.info(f"Processed page {page_num + 1} successfully")
        
        page_results[processing_id]['status'] = 'completed'
        logger.info(f"Completed processing all {total_pages} pages for {processing_id}")
        
    except Exception as e:
        logger.error(f"Error in parallel processing: {e}")
        page_results[processing_id]['status'] = 'error'
    finally:
        db.close()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/pdf_info")
async def get_pdf_info(file: UploadFile = File(...)):
    """Get PDF info and start background processing"""
    try:
        contents = await file.read()
        pdf_hash = hashlib.md5(contents).hexdigest()
        pdf_storage[pdf_hash] = contents
        
        pdf_stream = io.BytesIO(contents)
        doc = fitz.open(stream=pdf_stream, filetype="pdf")
        page_count = len(doc)
        doc.close()
        
        return {
            "pdf_id": pdf_hash,
            "page_count": page_count,
            "filename": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(e)}")

@app.get("/pdf_page/{pdf_id}/{page_number}")
async def get_pdf_page(pdf_id: str, page_number: int):
    """Get PDF page as image"""
    try:
        if pdf_id not in pdf_storage:
            raise HTTPException(status_code=404, detail="PDF not found. Please upload again.")
        
        pdf_bytes = pdf_storage[pdf_id]
        image_data_url = pdf_to_image_data_url_fast(pdf_bytes, page_number)
        
        # Extract just the base64 part
        img_str = image_data_url.split(",")[1]
        
        return {
            "page_number": page_number,
            "image": img_str,
            "pdf_id": pdf_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing page {page_number}: {str(e)}")

@app.post("/ai_metadata/start")
async def start_fast_ai_extraction(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Start ultra-fast AI extraction with background processing"""
    try:
        contents = await file.read()
        pdf_hash = hashlib.md5(contents).hexdigest()
        pdf_storage[pdf_hash] = contents
        
        pdf_stream = io.BytesIO(contents)
        doc = fitz.open(stream=pdf_stream, filetype="pdf")
        page_count = len(doc)
        doc.close()
        
        # Initialize processing
        processing_id = pdf_hash  # Use PDF hash as processing ID for consistency
        page_results[processing_id] = {
            'results': {},
            'total_pages': page_count,
            'status': 'processing'
        }
        
        # Process first page immediately for preview
        db = next(get_db())
        try:
            first_page_result = await process_page_fast(contents, 0, db)
            if first_page_result:
                page_results[processing_id]['results'][0] = first_page_result
        finally:
            db.close()
        
        # Start background processing for remaining pages
        background_tasks.add_task(process_all_pages_parallel, contents, processing_id)
        
        return {
            "processing_id": processing_id,
            "total_pages": page_count,
            "filename": file.filename,
            "first_page_result": first_page_result,
            "status": "processing"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting AI extraction: {str(e)}")

@app.get("/ai_metadata/{processing_id}/{page_number}")
async def get_fast_ai_metadata(processing_id: str, page_number: int):
    """Get AI metadata for specific page - ultra fast"""
    try:
        if processing_id not in page_results:
            raise HTTPException(status_code=404, detail="Processing ID not found")
        
        processing_data = page_results[processing_id]
        
        # Check if page already processed
        if page_number in processing_data['results']:
            return processing_data['results'][page_number]
        
        # If not processed yet, try to process it immediately
        if processing_id not in pdf_storage:
            raise HTTPException(status_code=404, detail="PDF data not found")
        
        pdf_bytes = pdf_storage[processing_id]
        
        db = next(get_db())
        try:
            result = await process_page_fast(pdf_bytes, page_number, db)
            if result:
                processing_data['results'][page_number] = result
                return result
            else:
                raise HTTPException(status_code=422, detail="Failed to process page")
        finally:
            db.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing page {page_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing page: {str(e)}")

@app.get("/ai_metadata/{processing_id}/status")
async def get_processing_status(processing_id: str):
    """Get processing status and completed pages"""
    if processing_id not in page_results:
        raise HTTPException(status_code=404, detail="Processing ID not found")
    
    data = page_results[processing_id]
    completed_pages = len(data['results'])
    
    return {
        "processing_id": processing_id,
        "status": data['status'],
        "total_pages": data['total_pages'],
        "completed_pages": completed_pages,
        "progress_percent": (completed_pages / data['total_pages']) * 100
    }

@app.delete("/pdf/{pdf_id}")
async def cleanup_pdf(pdf_id: str):
    """Clean up stored PDF data"""
    cleaned_pdf = pdf_id in pdf_storage
    cleaned_results = pdf_id in page_results
    
    if cleaned_pdf:
        del pdf_storage[pdf_id]
    if cleaned_results:
        del page_results[pdf_id]
    
    return {
        "message": "Cleanup completed", 
        "cleaned_pdf": cleaned_pdf,
        "cleaned_results": cleaned_results
    }

@app.get("/health")
async def health_check():
    """Health check with performance metrics"""
    return {
        "status": "healthy",
        "ai_model_url": AI_MODEL_BASE_URL,
        "ai_model_name": AI_MODEL_NAME,
        "pdf_storage_count": len(pdf_storage),
        "active_processing": len(page_results),
        "performance": "optimized"
    }

@app.post("/ai_metadata_cloud/start")
async def start_cloud_extraction(
    file: UploadFile = File(...),
    fields: str = Form(...)
):
    """Start cloud-based metadata extraction with custom fields"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    pdf_id = str(uuid.uuid4())
    processing_id = str(uuid.uuid4())
    
    try:
        # Parse requested fields
        field_list = [f.strip() for f in fields.split(',') if f.strip()]
        
        # Convert PDF to images
        pdf_bytes = await file.read()
        images_info = await convert_pdf_to_images_internal(pdf_bytes, pdf_id)
        
        # Store processing info
        processing_jobs[processing_id] = {
            "pdf_id": pdf_id,
            "status": "processing",
            "total_pages": len(images_info["images"]),
            "completed_pages": 0,
            "pages": {},
            "fields": field_list,
            "created_at": datetime.utcnow()
        }
        
        # Start background processing
        asyncio.create_task(process_cloud_extraction(processing_id, images_info, field_list))
        
        return {
            "processing_id": processing_id,
            "pdf_id": pdf_id,
            "total_pages": len(images_info["images"]),
            "status": "processing",
            "message": "Cloud extraction started"
        }
        
    except Exception as e:
        logger.error(f"Error starting cloud extraction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start cloud extraction: {str(e)}")

@app.get("/ai_metadata_cloud/status/{processing_id}")
async def get_cloud_extraction_status(processing_id: str):
    """Get status of cloud processing job"""
    if processing_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Processing job not found")
    
    job = processing_jobs[processing_id]
    return {
        "processing_id": processing_id,
        "status": job["status"],
        "total_pages": job["total_pages"],
        "completed_pages": job["completed_pages"],
        "progress": job["completed_pages"] / job["total_pages"] if job["total_pages"] > 0 else 0
    }

@app.get("/ai_metadata_cloud/page/{processing_id}/{page_number}")
async def get_cloud_page_result(processing_id: str, page_number: int):
    """Get results for a specific page from cloud processing"""
    if processing_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Processing job not found")
    
    job = processing_jobs[processing_id]
    page_key = str(page_number)
    
    if page_key not in job["pages"]:
        raise HTTPException(status_code=404, detail="Page not ready yet")
    
    page_data = job["pages"][page_key]
    if page_data["status"] == "error":
        raise HTTPException(status_code=422, detail=page_data["error"])
    
    return {
        "page_number": page_number,
        "image_data_url": page_data["image"],
        "extraction_result": page_data["result"],
        "processing_time": page_data.get("processing_time", 0)
    }

async def process_cloud_extraction(processing_id: str, images_info: dict, fields: list):
    """Background task to process images with cloud MM inference"""
    job = processing_jobs[processing_id]
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            for i, (image_b64, _) in enumerate(images_info["images"]):
                page_number = i + 1
                page_key = str(page_number)
                
                try:
                    # Store image data
                    job["pages"][page_key] = {
                        "image": f"data:image/jpeg;base64,{image_b64}",
                        "status": "processing"
                    }
                    
                    # Create prompt for cloud inference
                    field_prompt = ", ".join(fields) if fields else "drawing title, drawing number, revision information"
                    prompt = f"Extract the following information from this technical drawing: {field_prompt}. Return as JSON."
                    
                    # Send to cloud MM inference
                    payload = {
                        "image": image_b64,
                        "prompt": prompt,
                        "max_tokens": 500,
                        "temperature": 0.1
                    }
                    
                    # Check cloud health first
                    try:
                        health_response = await client.get(f"{MM_INFERENCE_URL}/health", timeout=10.0)
                        if health_response.status_code != 200:
                            raise Exception("Cloud service not healthy")
                    except:
                        # Cloud not available, use fallback
                        job["pages"][page_key] = {
                            "image": f"data:image/jpeg;base64,{image_b64}",
                            "result": {"error": "Cloud service unavailable", "extracted_fields": {}},
                            "status": "completed",
                            "processing_time": 0
                        }
                        job["completed_pages"] += 1
                        continue
                    
                    start_time = time.time()
                    response = await client.post(f"{MM_INFERENCE_URL}/inference", json=payload)
                    processing_time = time.time() - start_time
                    
                    if response.status_code == 200:
                        result = response.json()
                        job["pages"][page_key] = {
                            "image": f"data:image/jpeg;base64,{image_b64}",
                            "result": result,
                            "status": "completed",
                            "processing_time": processing_time
                        }
                    else:
                        job["pages"][page_key] = {
                            "image": f"data:image/jpeg;base64,{image_b64}",
                            "result": {"error": f"Cloud inference failed: {response.status_code}", "extracted_fields": {}},
                            "status": "completed",
                            "processing_time": processing_time
                        }
                    
                except Exception as e:
                    logger.error(f"Error processing page {page_number} with cloud: {str(e)}")
                    job["pages"][page_key] = {
                        "image": f"data:image/jpeg;base64,{image_b64}",
                        "result": {"error": str(e), "extracted_fields": {}},
                        "status": "error",
                        "error": str(e)
                    }
                
                job["completed_pages"] += 1
                
                # Small delay between requests
                await asyncio.sleep(0.5)
        
        job["status"] = "completed"
        
    except Exception as e:
        logger.error(f"Fatal error in cloud processing: {str(e)}")
        job["status"] = "error"
        job["error"] = str(e)

@app.get("/health/cloud")
async def check_cloud_health():
    """Check if cloud MM inference service is available"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{MM_INFERENCE_URL}/health")
            return {
                "cloud_available": response.status_code == 200,
                "cloud_url": MM_INFERENCE_URL,
                "status": "healthy" if response.status_code == 200 else "unhealthy"
            }
    except Exception as e:
        return {
            "cloud_available": False,
            "cloud_url": MM_INFERENCE_URL,
            "status": "unreachable",
            "error": str(e)
        }

if __name__ == "__main__":
    uvicorn.run(
        "fast_api:app",
        host="127.0.0.1",
        port=8080,
        reload=True,
        log_level="info",
        workers=1  # Single worker for shared memory
    ) 