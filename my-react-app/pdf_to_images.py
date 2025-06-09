from PIL import Image
import fastapi
from fastapi import File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io
import fitz  # PyMuPDF
import base64
import asyncio
import hashlib
import tempfile
import os
import httpx
from typing import Dict

app = fastapi.FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Store PDF files temporarily using hash as key
pdf_storage: Dict[str, bytes] = {}

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/pdf_info")
async def get_pdf_info(file: UploadFile = File(...)):
    """Get basic PDF information including page count"""
    try:
        contents = await file.read()
        
        # Create a hash for this PDF to use as a temporary key
        pdf_hash = hashlib.md5(contents).hexdigest()
        
        # Store the PDF temporarily
        pdf_storage[pdf_hash] = contents
        
        # Get page count
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
    """Get a specific page from a PDF as base64 image"""
    try:
        if pdf_id not in pdf_storage:
            raise HTTPException(status_code=404, detail="PDF not found. Please upload again.")
        
        pdf_bytes = pdf_storage[pdf_id]
        
        # Convert specific page to image
        image = await convert_pdf_page_to_image(pdf_bytes, page_number)
        
        # Convert image to base64
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return {
            "page_number": page_number,
            "image": img_str,
            "pdf_id": pdf_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing page {page_number}: {str(e)}")

@app.delete("/pdf/{pdf_id}")
async def cleanup_pdf(pdf_id: str):
    """Clean up stored PDF data"""
    if pdf_id in pdf_storage:
        del pdf_storage[pdf_id]
        return {"message": "PDF cleaned up successfully"}
    return {"message": "PDF not found"}

@app.post("/tbe")
async def tbe_endpoint(file: UploadFile = File(...)):
    """TBE endpoint for PDF processing"""
    try:
        contents = await file.read()
        
        # Create a hash for this PDF to use as a temporary key
        pdf_hash = hashlib.md5(contents).hexdigest()
        
        # Store the PDF temporarily
        pdf_storage[pdf_hash] = contents
        
        # Get page count and basic info
        pdf_stream = io.BytesIO(contents)
        doc = fitz.open(stream=pdf_stream, filetype="pdf")
        page_count = len(doc)
        doc.close()
        
        # Convert first page to image as preview
        first_page_image = await convert_pdf_page_to_image(contents, 0)
        buffered = io.BytesIO()
        first_page_image.save(buffered, format="PNG")
        preview_img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return {
            "pdf_id": pdf_hash,
            "page_count": page_count,
            "filename": file.filename,
            "preview_image": preview_img_str,
            "message": "PDF processed successfully",
            "endpoints": {
                "get_page": f"/pdf_page/{pdf_hash}/{{page_number}}",
                "cleanup": f"/pdf/{pdf_hash}"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(e)}")

@app.post("/ai_metadata/start")
async def start_ai_metadata_extraction(file: UploadFile = File(...)):
    """Start sequential AI metadata extraction from the multimodal model"""
    try:
        # Read the file
        contents = await file.read()
        
        # Create a new form data for the AI model
        files = {"file": (file.filename, contents, file.content_type)}
        
        # Make request to AI model sequential start endpoint
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "http://127.0.0.1:5000/tbe/sequential/start",
                files=files
            )
        
        if response.status_code == 200:
            ai_data = response.json()
            return ai_data
        else:
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"AI model returned error: {response.text}"
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="AI model request timed out")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="AI model service unavailable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling AI model: {str(e)}")

@app.get("/ai_metadata/{processing_id}/{page_number}")
async def get_ai_metadata_page(processing_id: str, page_number: int):
    """Get AI metadata for a specific page from sequential processing"""
    try:
        # Make request to AI model sequential get endpoint
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.get(
                f"http://127.0.0.1:5000/tbe/sequential/{processing_id}/{page_number}"
            )
        
        print(f"AI model response for page {page_number}: Status {response.status_code}")
        
        if response.status_code == 200:
            ai_data = response.json()
            return ai_data
        elif response.status_code == 404:
            # Page not ready yet - this is expected, return 404 to client
            raise HTTPException(status_code=404, detail="Page not ready yet")
        else:
            # Log the actual error from AI model
            error_text = response.text
            print(f"AI model error for page {page_number}: {response.status_code} - {error_text}")
            
            # Return a structured error that the client can handle
            raise HTTPException(
                status_code=422,  # Use 422 to distinguish from our server errors
                detail={
                    "error": "ai_model_error",
                    "message": f"AI model returned error for page {page_number}",
                    "status_code": response.status_code,
                    "ai_error": error_text
                }
            )
            
    except httpx.TimeoutException:
        print(f"Timeout requesting AI metadata for page {page_number}")
        raise HTTPException(
            status_code=408, 
            detail={
                "error": "timeout",
                "message": f"AI model request timed out for page {page_number}"
            }
        )
    except httpx.ConnectError:
        print(f"Connection error requesting AI metadata for page {page_number}")
        raise HTTPException(
            status_code=503, 
            detail={
                "error": "connection_error",
                "message": "AI model service unavailable"
            }
        )
    except Exception as e:
        print(f"Unexpected error requesting AI metadata for page {page_number}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail={
                "error": "unexpected_error",
                "message": f"Error calling AI model: {str(e)}"
            }
        )

async def convert_pdf_page_to_image(pdf_bytes: bytes, page_number: int) -> Image.Image:
    """Convert a specific PDF page to an image"""
    pdf_stream = io.BytesIO(pdf_bytes)
    doc = fitz.open(stream=pdf_stream, filetype="pdf")
    
    if page_number >= len(doc) or page_number < 0:
        doc.close()
        raise ValueError(f"Page number {page_number} out of range")
    
    page = doc.load_page(page_number)
    mat = fitz.Matrix(2.0, 2.0)  # zoom=4.0
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    doc.close()
    return img

# Keep the original endpoint for backward compatibility
@app.post("/pdf_to_images")
async def pdf_to_images_endpoint(file: UploadFile = File(...)):
    # Read the uploaded PDF file
    contents = await file.read()
    
    # Convert PDF to images
    images = await convert_pdf_to_images(contents)
    
    # Convert images to base64 for JSON response
    image_data = []
    for img in images:
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        image_data.append(img_str)
    
    return {"images": image_data}

async def convert_pdf_to_images(pdf_bytes) -> list[Image.Image]:
    images = []
    # Create a BytesIO object from the PDF bytes
    pdf_stream = io.BytesIO(pdf_bytes)
    doc = fitz.open(stream=pdf_stream, filetype="pdf")
    
    # Convert each page sequentially
    for i in range(len(doc)):
        page = doc.load_page(i)
        mat = fitz.Matrix(2.0, 2.0)  # zoom=4.0
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)
    
    doc.close()
    return images

if __name__ == "__main__":
    uvicorn.run("pdf_to_images:app", host="127.0.0.1", port=8080, reload=True)