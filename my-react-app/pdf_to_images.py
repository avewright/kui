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
        async with httpx.AsyncClient(timeout=30.0) as client:  # Reduced timeout
            response = await client.post(
                "http://127.0.0.1:5000/tbe/sequential/start",
                files=files
            )
        
        if response.status_code == 200:
            ai_data = response.json()
            return ai_data
        else:
            print(f"AI service error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"AI model returned error: {response.text}"
            )
            
    except httpx.TimeoutException:
        print("AI service timeout on start")
        raise HTTPException(status_code=408, detail="AI model request timed out")
    except httpx.ConnectError:
        print("AI service connection error - service may not be running on port 5000")
        raise HTTPException(status_code=503, detail="AI model service unavailable - ensure AI service is running on port 5000")
    except Exception as e:
        print(f"Unexpected error calling AI service: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calling AI model: {str(e)}")

@app.get("/ai_metadata/{processing_id}/{page_number}")
async def get_ai_metadata_page(processing_id: str, page_number: int):
    """Proxy to the AI-model sequential endpoint and _wait_ until the page is ready.

    Instead of bailing out after a handful of fast retries (which caused premature 500s),
    we poll the model every `poll_delay` seconds until either a success response is
    received or an overall timeout is reached. While the request remains pending the
    HTTP connection stays open, so the React front-end can simply `await` this call
    and does **not** need its own retry loop.
    """

    poll_delay = 2         # seconds between polls to the AI service
    max_wait_seconds = 300  # overall patience (5 min) – tweak as needed

    deadline = time.time() + max_wait_seconds

    while True:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"http://127.0.0.1:5000/tbe/sequential/{processing_id}/{page_number}"
                )

            if response.status_code == 200:
                return response.json()

            if response.status_code == 404:
                # Page not ready – wait then poll again (as long as we haven't timed out)
                if time.time() < deadline:
                    await asyncio.sleep(poll_delay)
                    continue
                raise HTTPException(status_code=504, detail="Timed out waiting for AI metadata")

            # Any other status from the AI model is surfaced directly
            raise HTTPException(status_code=response.status_code, detail=response.text)

        except httpx.TimeoutException:
            # Treat a timeout contacting the AI service like a temporary hiccup – retry unless we're out of time
            if time.time() < deadline:
                await asyncio.sleep(poll_delay)
                continue
            raise HTTPException(status_code=504, detail="Timed out waiting for AI metadata (network)")
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="AI model service unavailable – is it running on port 5000?")
        except HTTPException:
            # Re-raise our own HTTP exceptions untouched so FastAPI returns the intended status
            raise
        except Exception as exc:
            print(f"Unexpected error when querying AI metadata for page {page_number}: {exc}")
            raise HTTPException(status_code=500, detail="Unexpected server error while querying AI metadata")

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