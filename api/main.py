import asyncio
import base64
import hashlib
import io
import os
import time
import uuid
from datetime import datetime
from typing import Dict, Optional, List, Any
import logging

import fitz  # PyMuPDF
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
import httpx
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
VLLM_ENDPOINT = os.getenv("VLLM_ENDPOINT", "http://localhost:8000")
API_PORT = int(os.getenv("API_PORT", "8080"))

app = FastAPI(
    title="Consolidated Document Extraction API",
    description="Modern document extraction using vLLM vision models",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class ExtractionField(BaseModel):
    field_name: str
    description: str

class ExtractionRequest(BaseModel):
    fields: List[ExtractionField]
    temperature: float = 0.1
    max_tokens: int = 4000

class PageResult(BaseModel):
    page_number: int
    image_base64: str
    extracted_data: Dict[str, Any]
    processing_time: float

class ProcessingStatus(BaseModel):
    processing_id: str
    status: str  # "processing", "completed", "failed"
    total_pages: int
    completed_pages: int
    results: List[PageResult] = []

# In-memory storage (in production, use Redis or database)
processing_jobs: Dict[str, ProcessingStatus] = {}
pdf_storage: Dict[str, bytes] = {}

def pdf_to_images(pdf_bytes: bytes) -> List[tuple]:
    """Convert PDF pages to base64 encoded images."""
    images = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            
            # Convert to high-quality image
            mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            
            # Convert to base64
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            images.append((page_num + 1, img_base64))
            
        doc.close()
        return images
        
    except Exception as e:
        logger.error(f"Error converting PDF to images: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(e)}")

def create_extraction_prompt(fields: List[ExtractionField]) -> str:
    """Create a structured prompt for field extraction."""
    fields_description = "\n".join([
        f"- {field.field_name}: {field.description}"
        for field in fields
    ])
    
    prompt = f"""You are an expert document analyzer. Extract the following information from the provided document image:

{fields_description}

Instructions:
1. Analyze the document image carefully
2. Extract the requested information accurately
3. Return the results in valid JSON format only
4. Use null for fields that cannot be found or are unclear
5. Be precise and conservative - only extract information you are confident about

Return format (valid JSON only):
{{
{json.dumps({field.field_name: "extracted_value_or_null" for field in fields}, indent=2)[1:-1]}
}}

Do not include any explanatory text, only return the JSON object."""
    
    return prompt

async def process_with_vllm(image_base64: str, prompt: str) -> Dict[str, Any]:
    """Send image and prompt to vLLM vision model."""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Prepare payload for vLLM OpenAI-compatible API
            payload = {
                "model": "vision-model",  # This will be the model name loaded in vLLM
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 4000,
                "temperature": 0.1
            }
            
            # Send to vLLM server
            response = await client.post(
                f"{VLLM_ENDPOINT}/v1/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                logger.error(f"vLLM inference failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"vLLM inference error: {response.status_code}"
                )
            
            result = response.json()
            
            # Extract the text content from vLLM response
            content = result["choices"][0]["message"]["content"]
            
            # Try to parse as JSON
            try:
                extracted_data = json.loads(content)
                return extracted_data
            except json.JSONDecodeError:
                # If not valid JSON, return raw content
                logger.warning(f"vLLM returned non-JSON content: {content}")
                return {"raw_content": content}
            
    except httpx.TimeoutException:
        logger.error("vLLM inference request timed out")
        raise HTTPException(status_code=504, detail="vLLM inference timeout")
    except Exception as e:
        logger.error(f"Error communicating with vLLM: {str(e)}")
        raise HTTPException(status_code=500, detail=f"vLLM inference error: {str(e)}")

async def process_page(page_num: int, image_base64: str, fields: List[ExtractionField]) -> PageResult:
    """Process a single page with vLLM."""
    start_time = time.time()
    
    prompt = create_extraction_prompt(fields)
    extracted_data = await process_with_vllm(image_base64, prompt)
    
    processing_time = time.time() - start_time
    
    return PageResult(
        page_number=page_num,
        image_base64=image_base64,
        extracted_data=extracted_data,
        processing_time=processing_time
    )

async def process_document_background(processing_id: str, pdf_bytes: bytes, fields: List[ExtractionField]):
    """Background task to process all pages of a document."""
    try:
        # Update status to processing
        processing_jobs[processing_id].status = "processing"
        
        # Convert PDF to images
        images = pdf_to_images(pdf_bytes)
        processing_jobs[processing_id].total_pages = len(images)
        
        # Process each page
        for page_num, image_base64 in images:
            try:
                result = await process_page(page_num, image_base64, fields)
                processing_jobs[processing_id].results.append(result)
                processing_jobs[processing_id].completed_pages += 1
                
                logger.info(f"Completed page {page_num}/{len(images)} for job {processing_id}")
                
            except Exception as e:
                logger.error(f"Error processing page {page_num}: {str(e)}")
                # Continue with other pages even if one fails
                
        processing_jobs[processing_id].status = "completed"
        logger.info(f"Completed processing job {processing_id}")
        
    except Exception as e:
        logger.error(f"Error in background processing: {str(e)}")
        processing_jobs[processing_id].status = "failed"

# API Endpoints

@app.get("/")
async def root():
    return {
        "message": "Consolidated Document Extraction API",
        "version": "2.0.0",
        "vllm_endpoint": VLLM_ENDPOINT
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check if vLLM service is accessible
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{VLLM_ENDPOINT}/health")
            vllm_status = "ok" if response.status_code == 200 else "unavailable"
    except:
        vllm_status = "unavailable"
    
    return {
        "status": "ok",
        "vllm_status": vllm_status,
        "vllm_endpoint": VLLM_ENDPOINT
    }

@app.post("/extract/start")
async def start_extraction(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extraction_request: str = Form(...)
):
    """Start document extraction process."""
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Parse extraction request
    try:
        request_data = json.loads(extraction_request)
        fields = [ExtractionField(**field) for field in request_data["fields"]]
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid extraction request: {str(e)}")
    
    # Read PDF content
    pdf_content = await file.read()
    
    # Generate processing ID
    processing_id = str(uuid.uuid4())
    
    # Store PDF and create processing job
    pdf_storage[processing_id] = pdf_content
    processing_jobs[processing_id] = ProcessingStatus(
        processing_id=processing_id,
        status="initializing",
        total_pages=0,
        completed_pages=0
    )
    
    # Start background processing
    background_tasks.add_task(process_document_background, processing_id, pdf_content, fields)
    
    return {"processing_id": processing_id, "status": "started"}

@app.get("/extract/status/{processing_id}")
async def get_extraction_status(processing_id: str):
    """Get the status of a processing job."""
    if processing_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Processing job not found")
    
    job = processing_jobs[processing_id]
    return {
        "processing_id": processing_id,
        "status": job.status,
        "total_pages": job.total_pages,
        "completed_pages": job.completed_pages,
        "progress_percentage": (job.completed_pages / job.total_pages * 100) if job.total_pages > 0 else 0
    }

@app.get("/extract/results/{processing_id}")
async def get_extraction_results(processing_id: str):
    """Get the results of a completed processing job."""
    if processing_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Processing job not found")
    
    job = processing_jobs[processing_id]
    
    if job.status == "processing":
        return {
            "processing_id": processing_id,
            "status": "processing",
            "partial_results": job.results
        }
    elif job.status == "completed":
        return {
            "processing_id": processing_id,
            "status": "completed",
            "total_pages": job.total_pages,
            "results": job.results
        }
    elif job.status == "failed":
        return {
            "processing_id": processing_id,
            "status": "failed",
            "error": "Processing failed"
        }
    else:
        return {
            "processing_id": processing_id,
            "status": job.status
        }

@app.delete("/extract/{processing_id}")
async def cleanup_extraction(processing_id: str):
    """Clean up processing job and associated data."""
    if processing_id in processing_jobs:
        del processing_jobs[processing_id]
    if processing_id in pdf_storage:
        del pdf_storage[processing_id]
    
    return {"message": "Cleanup completed"}

@app.post("/extract/sync")
async def extract_document_sync(
    file: UploadFile = File(...),
    extraction_request: str = Form(...)
):
    """Synchronous document extraction for smaller documents."""
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Parse extraction request
    try:
        request_data = json.loads(extraction_request)
        fields = [ExtractionField(**field) for field in request_data["fields"]]
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid extraction request: {str(e)}")
    
    # Read PDF content
    pdf_content = await file.read()
    
    # Convert PDF to images
    images = pdf_to_images(pdf_content)
    
    # Process all pages
    results = []
    for page_num, image_base64 in images:
        result = await process_page(page_num, image_base64, fields)
        results.append(result)
    
    return {
        "total_pages": len(results),
        "results": results
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=API_PORT) 