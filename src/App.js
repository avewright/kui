import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [imageResults, setImageResults] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);

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
    setIsUploading(true);
    setImageResults([]);
    setError(null);
  
    try {
      const response = await fetch('http://127.0.0.1:8000/pdf_to_images', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Upload failed");
      }
      
      const data = await response.json();
      if (data && data.images && data.images.length > 0) {
        setImageResults(data.images);
        
        // Generate dummy metadata for each image
        const dummyMetadata = data.images.map((_, index) => ({
          title: `Drawing Title ${index + 1}`,
          drawingNumber: `DWG-${10000 + index}`,
          revisions: [
            {
              id: `REV-${index + 1}-001`,
              description: `Initial release`,
              date: new Date().toISOString().split('T')[0]
            }
          ],
          isEdited: false
        }));
        setMetadata(dummyMetadata);
      } else {
        throw new Error("No images were extracted from the PDF");
      }

    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "Failed to process the PDF. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleMetadataEdit = (index, field, value) => {
    const updatedMetadata = [...metadata];
    updatedMetadata[index] = {
      ...updatedMetadata[index],
      [field]: value,
      isEdited: true
    };
    setMetadata(updatedMetadata);
  };

  const handleRevisionEdit = (pageIndex, revisionIndex, field, value) => {
    const updatedMetadata = [...metadata];
    const updatedRevisions = [...updatedMetadata[pageIndex].revisions];
    updatedRevisions[revisionIndex] = {
      ...updatedRevisions[revisionIndex],
      [field]: value
    };
    updatedMetadata[pageIndex] = {
      ...updatedMetadata[pageIndex],
      revisions: updatedRevisions,
      isEdited: true
    };
    setMetadata(updatedMetadata);
  };

  const addRevisionRow = (pageIndex) => {
    const updatedMetadata = [...metadata];
    const currentRevisions = updatedMetadata[pageIndex].revisions;
    const newRevision = {
      id: `REV-${pageIndex + 1}-${String(currentRevisions.length + 1).padStart(3, '0')}`,
      description: '',
      date: new Date().toISOString().split('T')[0]
    };
    
    updatedMetadata[pageIndex] = {
      ...updatedMetadata[pageIndex],
      revisions: [...currentRevisions, newRevision],
      isEdited: true
    };
    setMetadata(updatedMetadata);
  };

  const removeRevisionRow = (pageIndex, revisionIndex) => {
    const updatedMetadata = [...metadata];
    const updatedRevisions = updatedMetadata[pageIndex].revisions.filter((_, idx) => idx !== revisionIndex);
    updatedMetadata[pageIndex] = {
      ...updatedMetadata[pageIndex],
      revisions: updatedRevisions,
      isEdited: true
    };
    setMetadata(updatedMetadata);
  };

  const startEditing = (index) => {
    setEditingIndex(index);
  };

  const stopEditing = () => {
    setEditingIndex(null);
  };

  return (
    <div className={`App ${imageResults.length > 0 ? 'with-images' : ''}`}>
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
            <button 
              className="upload-button" 
              onClick={uploadFileToAPI}
              disabled={isUploading}
            >
              {isUploading ? 'Processing...' : 'Convert to Images'}
            </button>
            <button className="clear-button" onClick={() => {
              setFile(null);
              setImageResults([]);
              setError(null);
            }}>Clear</button>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {isUploading && (
          <div className="loading-indicator" style={{
            marginTop: '2rem',
            textAlign: 'center'
          }}>
            <p>Converting PDF to images...</p>
            <div className="spinner"></div>
          </div>
        )}
      </div>
      {imageResults.length > 0 && (
        <div className="image-results">
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
            {imageResults.length > 1 ? `PDF Pages (${imageResults.length})` : 'PDF Preview'}
          </h2>
          
          {/* {metadata.some(item => item.isEdited) && (
            <div className="metadata-summary">
              <div className="summary-header">
                <h3>Edited Fields Summary</h3>
                <span className="edit-count">
                  {metadata.filter(item => item.isEdited).length} of {metadata.length} pages edited
                </span>
              </div>
              <div className="summary-content">
                <p>
                  The following fields have been manually corrected:
                </p>
                <ul className="edit-list">
                  {metadata.map((item, idx) => 
                    item.isEdited && (
                      <li key={idx}>
                        <span className="page-badge">Page {idx + 1}</span>
                        {item.title && <span className="field-badge">Title</span>}
                        {item.drawingNumber && <span className="field-badge">Drawing #</span>}
                        {item.revisions && <span className="field-badge">Revisions</span>}
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div className="summary-actions">
                <button className="verify-button">Verify All Changes</button>
              </div>
            </div>
          )} */}
          
          <div className="image-carousel">
            {imageResults.map((img, idx) => (
              <div key={idx} className="image-container">
                <div className="image-wrapper">
                  <img 
                    src={`data:image/png;base64,${img}`} 
                    alt={`Page ${idx + 1}`}
                    loading="lazy"
                    style={{
                      width: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>
                
                <div className="metadata-panel">
                  <div className="metadata-header">
                    <h3>Metadata</h3>
                    {editingIndex === idx ? (
                      <button className="small-button" onClick={stopEditing}>Done</button>
                    ) : (
                      <button className="small-button" onClick={() => startEditing(idx)}>Edit</button>
                    )}
                  </div>
                  
                  <div className="metadata-content">
                    <div className="metadata-field">
                      <label>Title</label>
                      {editingIndex === idx ? (
                        <input
                          type="text"
                          value={metadata[idx]?.title || ''}
                          onChange={(e) => handleMetadataEdit(idx, 'title', e.target.value)}
                          className="metadata-input"
                        />
                      ) : (
                        <div className="metadata-value-container">
                          <p className={metadata[idx]?.isEdited ? 'edited-value' : ''}>
                            {metadata[idx]?.title || 'Unknown Title'}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="metadata-field">
                      <label>Drawing Number</label>
                      {editingIndex === idx ? (
                        <input
                          type="text"
                          value={metadata[idx]?.drawingNumber || ''}
                          onChange={(e) => handleMetadataEdit(idx, 'drawingNumber', e.target.value)}
                          className="metadata-input"
                        />
                      ) : (
                        <div className="metadata-value-container">
                          <p className={metadata[idx]?.isEdited ? 'edited-value' : ''}>
                            {metadata[idx]?.drawingNumber || 'Unknown Number'}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="metadata-field">
                      <label>Revisions</label>
                      {editingIndex === idx ? (
                        <div className="revision-table">
                          <div className="revision-row">
                            <div className="revision-cell">ID</div>
                            <div className="revision-cell">Description</div>
                            <div className="revision-cell">Date</div>
                            <div className="revision-cell">Actions</div>
                          </div>
                          {metadata[idx].revisions.map((revision, revisionIndex) => (
                            <div key={revisionIndex} className="revision-row">
                              <div className="revision-cell">
                                <input
                                  type="text"
                                  value={revision.id}
                                  onChange={(e) => handleRevisionEdit(idx, revisionIndex, 'id', e.target.value)}
                                  className="revision-input"
                                />
                              </div>
                              <div className="revision-cell">
                                <input
                                  type="text"
                                  value={revision.description}
                                  onChange={(e) => handleRevisionEdit(idx, revisionIndex, 'description', e.target.value)}
                                  className="revision-input"
                                />
                              </div>
                              <div className="revision-cell">
                                <input
                                  type="date"
                                  value={revision.date}
                                  onChange={(e) => handleRevisionEdit(idx, revisionIndex, 'date', e.target.value)}
                                  className="revision-input"
                                />
                              </div>
                              <div className="revision-cell">
                                <button 
                                  className="small-button" 
                                  style={{ backgroundColor: 'var(--danger)' }}
                                  onClick={() => removeRevisionRow(idx, revisionIndex)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="revision-actions" style={{ marginTop: '0.5rem' }}>
                            <button className="small-button" onClick={() => addRevisionRow(idx)}>Add Revision</button>
                          </div>
                        </div>
                      ) : (
                        <div className="revision-table">
                          <div className="revision-row">
                            <div className="revision-cell">ID</div>
                            <div className="revision-cell">Description</div>
                            <div className="revision-cell">Date</div>
                          </div>
                          {metadata[idx].revisions.map((revision, revisionIndex) => (
                            <div key={revisionIndex} className="revision-row">
                              <div className="revision-cell">
                                <p>{revision.id}</p>
                              </div>
                              <div className="revision-cell">
                                <p>{revision.description}</p>
                              </div>
                              <div className="revision-cell">
                                <p>{revision.date}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <p className="page-number">
                  Page {idx + 1}
                </p>
              </div>
            ))}
          </div>
          <div style={{ 
            textAlign: 'center',
            marginTop: '1rem' 
          }}>
            <button onClick={() => {
              setImageResults([]);
              setMetadata([]);
            }} className="clear-button">
              Clear Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
