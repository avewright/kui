import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [imageResults, setImageResults] = useState([]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
      } else {
        alert('Please upload a PDF file');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
      } else {
        alert('Please upload a PDF file');
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  const uploadFileToAPI = async () => {
    if (!file) return;
  
    const formData = new FormData();
    formData.append('file', file);
  
    try {
      const response = await fetch('http://127.0.0.1:8000/pdf_to_images', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) throw new Error("Upload failed");
  
      const data = await response.json();
      setImageResults(data.images);
      console.log("Received images:", data.images); // base64 PNGs
      // Optional: show images on the page
      // setImageResults(data.images); 
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };
  

  return (
    <div className="App">
      <div className="container">
        <h1>PDF Uploader</h1>
        <div 
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="upload-icon">
            {file ? 
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              :
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            }
          </div>
          
          <div className="upload-text">
            {file ? (
              <div className="file-info">
                <p className="file-name">{file.name}</p>
                <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <p>Drag & drop your PDF here or</p>
            )}
            
            <button className="browse-button" onClick={handleBrowseClick}>
              {file ? 'Choose Different File' : 'Browse Files'}
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".pdf,application/pdf" 
              style={{ display: 'none' }} 
            />
          </div>
        </div>
        
        {file && (
          <div className="action-buttons">
            <button className="view-button">View PDF</button>
            <button className="upload-button" onClick={uploadFileToAPI}>Upload to API</button>
            <button className="clear-button" onClick={() => setFile(null)}>Clear</button>
          </div>
        )}
      </div>
      {imageResults.length > 0 && (
        <div className="image-results">
          <h2>Converted Images</h2>
          {imageResults.map((img, idx) => (
            <img 
              key={idx} 
              src={`data:image/png;base64,${img}`} 
              alt={`Page ${idx + 1}`} 
              style={{ maxWidth: "100%", marginBottom: "1rem" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
