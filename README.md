# PDF Viewer Application

A full-stack application for uploading and viewing PDF files, featuring a FastAPI backend and React frontend.

## Features

- Upload PDFs via drag and drop
- View PDFs page by page
- Responsive design

## Project Structure

- `/backend` - FastAPI backend for handling file uploads and serving PDF pages
- `/frontend` - React frontend for user interaction and PDF viewing

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Start the FastAPI server:
   ```
   uvicorn main:app --reload
   ```

The backend will start at http://localhost:8000.

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the React development server:
   ```
   npm start
   ```

The frontend will start at http://localhost:3000.

## Usage

1. Open your browser and go to http://localhost:3000
2. Upload a PDF by dragging and dropping it onto the upload area
3. Use the navigation buttons to browse through the PDF pages

## Technologies Used

- **Backend**: FastAPI, PyPDF2
- **Frontend**: React, React PDF, React Dropzone, Axios 