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
  const [pdfInfo, setPdfInfo] = useState(null);
  const [pageLoadingStates, setPageLoadingStates] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });

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

  const fetchPageImage = async (pdfId, pageNumber) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/pdf_page/${pdfId}/${pageNumber}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load page ${pageNumber + 1}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching page ${pageNumber}:`, error);
      throw error;
    }
  };

  const uploadFileToAPI = async () => {
    if (!file) return;
  
    const formData = new FormData();
    formData.append('file', file);
    setIsUploading(true);
    setImageResults([]);
    setMetadata([]);
    setError(null);
    setPdfInfo(null);
    setPageLoadingStates([]);
    setLoadingProgress({ loaded: 0, total: 0 });
  
    try {
      // First, get PDF info (page count and PDF ID)
      const infoResponse = await fetch('http://127.0.0.1:8000/pdf_info', {
        method: 'POST',
        body: formData,
      });

      if (!infoResponse.ok) {
        const errorData = await infoResponse.text();
        throw new Error(errorData || "Failed to get PDF info");
      }
      
      const info = await infoResponse.json();
      setPdfInfo(info);
      
      // Initialize arrays for the expected number of pages
      const initialResults = new Array(info.page_count).fill(null);
      const initialMetadata = new Array(info.page_count).fill(null);
      const initialLoadingStates = new Array(info.page_count).fill(true);
      
      setImageResults(initialResults);
      setMetadata(initialMetadata);
      setPageLoadingStates(initialLoadingStates);
      setLoadingProgress({ loaded: 0, total: info.page_count });

      // Create promises for all pages
      const pagePromises = Array.from({ length: info.page_count }, (_, pageIndex) => 
        fetchPageImage(info.pdf_id, pageIndex)
          .then(pageData => {
            // Update the specific page when it completes
            setImageResults(prev => {
              const updated = [...prev];
              updated[pageIndex] = pageData.image;
              return updated;
            });

            // Generate metadata for this page
            const dummyMetadata = {
              title: `Drawing Title ${pageIndex + 1}`,
              drawingNumber: `DWG-${10000 + pageIndex}`,
              revisions: [
                {
                  id: `REV-${pageIndex + 1}-001`,
                  description: `Initial release`,
                  date: new Date().toISOString().split('T')[0]
                }
              ],
              isEdited: false
            };

            setMetadata(prev => {
              const updated = [...prev];
              updated[pageIndex] = dummyMetadata;
              return updated;
            });

            // Update loading state for this page
            setPageLoadingStates(prev => {
              const updated = [...prev];
              updated[pageIndex] = false;
              return updated;
            });

            // Update progress
            setLoadingProgress(prev => ({
              loaded: prev.loaded + 1,
              total: prev.total
            }));

            return pageData;
          })
          .catch(error => {
            console.error(`Failed to load page ${pageIndex + 1}:`, error);
            
            // Mark this page as failed
            setPageLoadingStates(prev => {
              const updated = [...prev];
              updated[pageIndex] = 'error';
              return updated;
            });

            // Still update progress count
            setLoadingProgress(prev => ({
              loaded: prev.loaded + 1,
              total: prev.total
            }));

            return null;
          })
      );

      // Wait for all pages to complete (or fail)
      await Promise.allSettled(pagePromises);

    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "Failed to process the PDF. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const cleanupPdf = async () => {
    if (pdfInfo?.pdf_id) {
      try {
        await fetch(`http://127.0.0.1:8000/pdf/${pdfInfo.pdf_id}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Error cleaning up PDF:', error);
      }
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

  const clearResults = async () => {
    await cleanupPdf();
    setImageResults([]);
    setMetadata([]);
    setPdfInfo(null);
    setPageLoadingStates([]);
    setLoadingProgress({ loaded: 0, total: 0 });
  };

  const clearFile = async () => {
    await cleanupPdf();
    setFile(null);
    setImageResults([]);
    setMetadata([]);
    setPdfInfo(null);
    setPageLoadingStates([]);
    setLoadingProgress({ loaded: 0, total: 0 });
    setError(null);
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
            <button className="clear-button" onClick={clearFile}>Clear</button>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {isUploading && pdfInfo && (
          <div className="loading-indicator" style={{
            marginTop: '2rem',
            textAlign: 'center'
          }}>
            <p>Processing PDF: {pdfInfo.filename}</p>
            <p>Pages loaded: {loadingProgress.loaded} of {loadingProgress.total}</p>
            <div className="progress-bar" style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--border-color)',
              borderRadius: '4px',
              margin: '1rem 0',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%`,
                height: '100%',
                backgroundColor: 'var(--primary)',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            <div className="spinner"></div>
          </div>
        )}
      </div>
      {imageResults.length > 0 && (
        <div className="image-results">
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
            {pdfInfo ? `${pdfInfo.filename} (${imageResults.filter(img => img !== null).length}/${pdfInfo.page_count} pages loaded)` : 'PDF Preview'}
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
                {pageLoadingStates[idx] === true ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '3rem',
                    minHeight: '400px',
                    justifyContent: 'center'
                  }}>
                    <div className="spinner" style={{ marginBottom: '1rem' }}></div>
                    <p>Loading page {idx + 1}...</p>
                  </div>
                ) : pageLoadingStates[idx] === 'error' ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '3rem',
                    minHeight: '400px',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderRadius: 'var(--radius)'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <p style={{ color: 'var(--danger)' }}>Failed to load page {idx + 1}</p>
                    <button 
                      className="small-button" 
                      onClick={() => {
                        setPageLoadingStates(prev => {
                          const updated = [...prev];
                          updated[idx] = true;
                          return updated;
                        });
                        fetchPageImage(pdfInfo.pdf_id, idx)
                          .then(pageData => {
                            setImageResults(prev => {
                              const updated = [...prev];
                              updated[idx] = pageData.image;
                              return updated;
                            });
                            setPageLoadingStates(prev => {
                              const updated = [...prev];
                              updated[idx] = false;
                              return updated;
                            });
                          })
                          .catch(() => {
                            setPageLoadingStates(prev => {
                              const updated = [...prev];
                              updated[idx] = 'error';
                              return updated;
                            });
                          });
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : img ? (
                  <>
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
                    
                    {metadata[idx] && (
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
                    )}
                    
                    <p className="page-number">
                      Page {idx + 1}
                    </p>
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <div style={{ 
            textAlign: 'center',
            marginTop: '1rem' 
          }}>
            <button onClick={clearResults} className="clear-button">
              Clear Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
