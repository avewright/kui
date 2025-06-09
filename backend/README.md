# PDF Viewer Backend

This is a FastAPI-based backend for the PDF Viewer application.

## Setup

1. Create a virtual environment (recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run the server:
   ```
   uvicorn main:app --reload
   ```

The server will start at http://localhost:8000.

## API Endpoints

- `POST /upload/`: Upload a PDF file
- `GET /pdfs/{file_id}`: Get information about a specific PDF
- `GET /pdfs/{file_id}/pages/{page_number}`: Get a specific page from a PDF

## API Documentation

FastAPI provides automatic API documentation at:
- http://localhost:8000/docs
- http://localhost:8000/redoc 