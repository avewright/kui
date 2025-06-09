import os
import shutil
import tempfile
from typing import List
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import PyPDF2
import uuid

app = FastAPI(title="PDF Viewer API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Create directories for storing uploaded PDFs and extracted pages
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
PAGES_DIR = os.path.join(os.path.dirname(__file__), "pages")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PAGES_DIR, exist_ok=True)

# Mount static directories
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/pages", StaticFiles(directory=PAGES_DIR), name="pages")

@app.post("/upload/")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    # Generate unique ID for this upload
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    
    # Save the uploaded file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Process the PDF to extract information about pages
    try:
        with open(file_path, "rb") as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            num_pages = len(pdf_reader)
            
            # Create directory for this PDF's pages
            pdf_pages_dir = os.path.join(PAGES_DIR, file_id)
            os.makedirs(pdf_pages_dir, exist_ok=True)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")
    
    return {
        "file_id": file_id,
        "filename": file.filename,
        "num_pages": num_pages
    }

@app.get("/pdfs/{file_id}/pages/{page_number}")
async def get_pdf_page(file_id: str, page_number: int):
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF not found")
    
    try:
        # Extract the specified page as a separate PDF
        output_path = os.path.join(PAGES_DIR, file_id, f"page_{page_number}.pdf")
        
        # Only create the page if it doesn't exist yet
        if not os.path.exists(output_path):
            with open(file_path, "rb") as pdf_file:
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                
                if page_number < 1 or page_number > len(pdf_reader):
                    raise HTTPException(status_code=400, detail="Invalid page number")
                
                # Create a new PDF with just the requested page
                pdf_writer = PyPDF2.PdfWriter()
                pdf_writer.add_page(pdf_reader.pages[page_number - 1])  # Pages are 0-indexed
                
                with open(output_path, "wb") as output_file:
                    pdf_writer.write(output_file)
        
        return FileResponse(output_path, media_type="application/pdf")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get page: {str(e)}")

@app.get("/pdfs/{file_id}")
async def get_pdf_info(file_id: str):
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF not found")
    
    try:
        with open(file_path, "rb") as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            num_pages = len(pdf_reader)
        
        return {
            "file_id": file_id,
            "num_pages": num_pages
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get PDF info: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 