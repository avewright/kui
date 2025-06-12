# Cloud MM Inference Integration Endpoints
# Add these endpoints to your existing fast_api.py

import os
import json
import httpx
import asyncio
from datetime import datetime

# Add this configuration variable to your existing config section
MM_INFERENCE_URL = os.getenv("MM_INFERENCE_URL", "http://your-cloud-pod-url:5000")

# Add this method to your existing FastAIClient class:
async def process_with_mm_inference(self, image_data_url: str, custom_prompt: str, db) -> dict:
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

# Add these new endpoints to your app:

@app.post("/ai_metadata_cloud/start")
async def start_cloud_ai_extraction(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    custom_fields: str = ""
):
    """Start AI extraction using cloud mm_inference pod with custom field extraction"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    pdf_bytes = await file.read()
    processing_id = hashlib.md5(pdf_bytes + str(time.time()).encode()).hexdigest()
    
    # Store PDF
    pdf_storage[processing_id] = pdf_bytes
    
    # Initialize results storage
    doc = fitz.open(stream=io.BytesIO(pdf_bytes), filetype="pdf")
    total_pages = len(doc)
    doc.close()
    
    page_results[processing_id] = {
        "total_pages": total_pages,
        "completed_pages": 0,
        "pages": {},
        "status": "processing",
        "custom_fields": custom_fields,
        "source": "mm_inference_cloud"
    }
    
    # Start background processing
    background_tasks.add_task(process_all_pages_cloud, pdf_bytes, processing_id, custom_fields)
    
    return {
        "processing_id": processing_id,
        "total_pages": total_pages,
        "status": "started",
        "message": "Cloud AI extraction started",
        "source": "mm_inference_cloud"
    }

async def process_all_pages_cloud(pdf_bytes: bytes, processing_id: str, custom_fields: str = ""):
    """Process all pages using cloud mm_inference with custom field extraction"""
    db = next(get_db())
    
    try:
        doc = fitz.open(stream=io.BytesIO(pdf_bytes), filetype="pdf")
        total_pages = len(doc)
        doc.close()
        
        # Create custom prompt based on fields
        if custom_fields:
            try:
                fields_data = json.loads(custom_fields)
                field_descriptions = "\n".join([
                    f"- Extract '{field.get('document_field', '')}' and return it as '{field.get('return_field', '')}'"
                    for field in fields_data.get('field_names', [])
                ])
                
                custom_prompt = f"""
Extract the following specific information from this document image:

{field_descriptions}

Instructions:
1. Analyze the document image carefully
2. Extract only the requested information
3. Return the results in valid JSON format
4. Use null for fields that cannot be found
5. Be precise and accurate

Return format should be JSON with the specified field names.
"""
            except:
                custom_prompt = ai_client.get_tbe_prompt()
        else:
            custom_prompt = ai_client.get_tbe_prompt()
        
        # Process pages in parallel
        tasks = []
        for page_num in range(total_pages):
            task = process_page_cloud(pdf_bytes, page_num, processing_id, custom_prompt, db)
            tasks.append(task)
        
        # Execute all tasks
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Mark as completed
        if processing_id in page_results:
            page_results[processing_id]["status"] = "completed"
            
    except Exception as e:
        logger.error(f"Error in cloud processing: {e}")
        if processing_id in page_results:
            page_results[processing_id]["status"] = "error"
            page_results[processing_id]["error"] = str(e)
    finally:
        db.close()

async def process_page_cloud(pdf_bytes: bytes, page_num: int, processing_id: str, custom_prompt: str, db):
    """Process a single page using cloud mm_inference"""
    try:
        # Convert page to image
        image_data_url = pdf_to_image_data_url_fast(pdf_bytes, page_num)
        
        # Process with cloud mm_inference
        result = await ai_client.process_with_mm_inference(image_data_url, custom_prompt, db)
        
        # Store result
        if processing_id in page_results:
            page_results[processing_id]["pages"][page_num] = {
                "result": result,
                "image_data_url": image_data_url,
                "status": "completed",
                "page_number": page_num + 1
            }
            page_results[processing_id]["completed_pages"] += 1
            
    except Exception as e:
        logger.error(f"Error processing page {page_num} with cloud service: {e}")
        if processing_id in page_results:
            page_results[processing_id]["pages"][page_num] = {
                "error": str(e),
                "status": "error",
                "page_number": page_num + 1
            }

@app.get("/ai_metadata_cloud/{processing_id}/{page_number}")
async def get_cloud_ai_metadata(processing_id: str, page_number: int):
    """Get cloud AI extraction results for a specific page"""
    if processing_id not in page_results:
        raise HTTPException(status_code=404, detail="Processing ID not found")
    
    page_index = page_number - 1
    if page_index not in page_results[processing_id]["pages"]:
        raise HTTPException(status_code=404, detail="Page not processed yet")
    
    page_data = page_results[processing_id]["pages"][page_index]
    return {
        "processing_id": processing_id,
        "page_number": page_number,
        "status": page_data["status"],
        "result": page_data.get("result"),
        "error": page_data.get("error"),
        "image_data_url": page_data.get("image_data_url"),
        "source": "mm_inference_cloud"
    }

@app.get("/ai_metadata_cloud/{processing_id}/status")
async def get_cloud_processing_status(processing_id: str):
    """Get cloud processing status with all results"""
    if processing_id not in page_results:
        raise HTTPException(status_code=404, detail="Processing ID not found")
    
    data = page_results[processing_id]
    
    # Prepare all page results
    all_pages = []
    for page_num in range(data["total_pages"]):
        if page_num in data["pages"]:
            page_data = data["pages"][page_num]
            all_pages.append({
                "page_number": page_num + 1,
                "status": page_data["status"],
                "result": page_data.get("result"),
                "error": page_data.get("error"),
                "image_data_url": page_data.get("image_data_url")
            })
        else:
            all_pages.append({
                "page_number": page_num + 1,
                "status": "pending"
            })
    
    return {
        "processing_id": processing_id,
        "status": data["status"],
        "total_pages": data["total_pages"],
        "completed_pages": data["completed_pages"],
        "progress": (data["completed_pages"] / data["total_pages"]) * 100,
        "pages": all_pages,
        "source": "mm_inference_cloud"
    }

# Update your health check to include mm_inference status:
# Replace your existing health check with this enhanced version:

@app.get("/health")
async def health_check():
    """Enhanced health check with cloud mm_inference status"""
    mm_status = "unknown"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{MM_INFERENCE_URL}/health")
            mm_status = "ok" if response.status_code == 200 else "error"
    except:
        mm_status = "unreachable"
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "ai_model_url": AI_MODEL_BASE_URL,
        "model_name": AI_MODEL_NAME,
        "mm_inference_url": MM_INFERENCE_URL,
        "mm_inference_status": mm_status,
        "pdf_storage_count": len(pdf_storage),
        "active_processes": len(page_results)
    } 