import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './PDFUploader.css';

function PDFUploader({ onPDFUploaded }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = async (acceptedFiles) => {
    // Only accept PDF files
    const file = acceptedFiles[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onPDFUploaded({
        ...response.data,
        originalFile: file,
      });
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload PDF. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
  });

  return (
    <div className="uploader-container">
      <div 
        {...getRootProps()} 
        className={`dropzone ${isDragActive ? 'active' : ''} ${isUploading ? 'uploading' : ''}`}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <p>Uploading...</p>
        ) : isDragActive ? (
          <p>Drop the PDF file here...</p>
        ) : (
          <div>
            <p>Drag and drop a PDF file here, or click to select a file</p>
            <p className="small-text">(Only PDF files are accepted)</p>
          </div>
        )}
      </div>
      
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default PDFUploader; 