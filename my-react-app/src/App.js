import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import logo from './logo.png'; // Import the logo
import CloudExtraction from './CloudExtraction';

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
  const [currentVisiblePage, setCurrentVisiblePage] = useState(0);
  const [activeTab, setActiveTab] = useState('local'); // 'local' or 'cloud'
  const carouselRef = useRef(null);

  // Reset current page when new images load
  useEffect(() => {
    if (imageResults.length > 0) {
      setCurrentVisiblePage(0);
    }
  }, [imageResults.length]);

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
      const response = await fetch(`http://127.0.0.1:8080/pdf_page/${pdfId}/${pageNumber}`);
      
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

  const [aiProcessingId, setAiProcessingId] = useState(null);

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
    setAiProcessingId(null);
  
    try {
      // Start AI sequential processing first
      console.log("🚀 Starting AI sequential processing...");
      const aiStartResponse = await fetch('http://127.0.0.1:8080/ai_metadata/start', {
        method: 'POST',
        body: formData,
      });

      // Also get basic PDF info for image conversion
      const infoResponse = await fetch('http://127.0.0.1:8080/pdf_info', {
        method: 'POST',
        body: formData,
      });

      if (!infoResponse.ok) {
        const errorData = await infoResponse.text();
        throw new Error(errorData || "Failed to get PDF info");
      }
      
      const info = await infoResponse.json();
      setPdfInfo(info);
      
      // Get AI processing ID and first page metadata
      let firstPageAiData = null;
      let processingId = null;
      if (aiStartResponse.ok) {
        const aiStartData = await aiStartResponse.json();
        processingId = aiStartData.processing_id;
        firstPageAiData = aiStartData.result;
        setAiProcessingId(processingId);
        console.log("AI processing started:", aiStartData);
      } else {
        console.warn("AI metadata extraction failed to start, will use fallback data");
      }
      
      // Initialize arrays for the expected number of pages
      const initialResults = new Array(info.page_count).fill(null);
      const initialMetadata = new Array(info.page_count).fill(null);
      const initialLoadingStates = new Array(info.page_count).fill(true);
      
      setImageResults(initialResults);
      setMetadata(initialMetadata);
      setPageLoadingStates(initialLoadingStates);
      setLoadingProgress({ loaded: 0, total: info.page_count });

      // Load first page immediately with AI data
      if (firstPageAiData) {
        console.log("📄 Loading first page with AI data...");
        await loadPageWithData(info.pdf_id, 0, firstPageAiData);
      }

      // Start background loading of remaining pages
      console.log(`📚 Starting background loading of ${info.page_count - 1} remaining pages...`);
      loadRemainingPagesSequentially(info.pdf_id, info.page_count, processingId);

    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "Failed to process the PDF. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchAiMetadataForPage = async (processingId, pageNumber) => {
    if (!processingId) return null;
    
    // Retry logic for getting AI metadata
    const maxRetries = 8; // Reduced retries to fail faster
    const retryDelay = 3000; // 3 seconds between retries
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:8080/ai_metadata/${processingId}/${pageNumber}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ AI metadata loaded for page ${pageNumber}`);
          return data.result;
        } else if (response.status === 404) {
          // Page not ready yet, wait and retry
          console.log(`⏳ Page ${pageNumber} not ready yet, attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else if (response.status === 422) {
          // AI model error - don't retry, fall back immediately
          const errorData = await response.json();
          console.warn(`❌ AI model failed for page ${pageNumber}:`, errorData.detail);
          return null;
        } else if (response.status === 408 || response.status === 503) {
          // Timeout or service unavailable - try a few more times
          console.warn(`⚠️ AI service issue for page ${pageNumber}: ${response.status}, attempt ${attempt + 1}/${maxRetries}`);
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          return null;
        } else {
          console.warn(`❌ Unexpected error for page ${pageNumber}: ${response.status}`);
          return null;
        }
      } catch (error) {
        console.warn(`🔗 Network error fetching AI metadata for page ${pageNumber}, attempt ${attempt + 1}:`, error);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        return null;
      }
    }
    
    console.log(`💤 Giving up on AI metadata for page ${pageNumber} after ${maxRetries} attempts`);
    return null;
  };

  const loadPageWithData = async (pdfId, pageIndex, aiData) => {
    try {
      // Fetch page image
      const pageData = await fetchPageImage(pdfId, pageIndex);
      
      if (pageData) {
        setImageResults(prevResults => {
          const newResults = [...prevResults];
          newResults[pageIndex] = pageData.image_data_url;
          return newResults;
        });
        
        // Process AI data if available
        if (aiData) {
          try {
            let extractedInfo = null;
            
            if (typeof aiData.content === 'string') {
              try {
                // Try parsing as JSON first
                extractedInfo = JSON.parse(aiData.content);
              } catch {
                // If not valid JSON, use as text content
                extractedInfo = { raw_content: aiData.content };
              }
            } else {
              extractedInfo = aiData.content || aiData;
            }
            
            // Generate metadata structure
            const metadataEntry = {
              document_type: extractedInfo.document_type || extractedInfo.Document_Type || 'Unknown',
              key_information: extractedInfo.key_information || extractedInfo.Key_Information || {},
              text_content: extractedInfo.text_content || extractedInfo.Text_Content || '',
              tables_lists: extractedInfo.tables_lists || extractedInfo.Tables_Lists || [],
              special_elements: extractedInfo.special_elements || extractedInfo.Special_Elements || [],
              raw_ai_response: aiData,
              revisions: []
            };
            
            setMetadata(prevMetadata => {
              const newMetadata = [...prevMetadata];
              newMetadata[pageIndex] = metadataEntry;
              return newMetadata;
            });
            
          } catch (error) {
            console.warn(`Error processing AI data for page ${pageIndex + 1}:`, error);
            // Set fallback metadata
            setMetadata(prevMetadata => {
              const newMetadata = [...prevMetadata];
              newMetadata[pageIndex] = {
                document_type: 'Processing Error',
                key_information: {},
                text_content: 'AI processing failed for this page',
                tables_lists: [],
                special_elements: [],
                raw_ai_response: aiData,
                revisions: []
              };
              return newMetadata;
            });
          }
        }
        
        // Mark this page as loaded
        setPageLoadingStates(prevStates => {
          const newStates = [...prevStates];
          newStates[pageIndex] = false;
          return newStates;
        });
        
        // Update progress
        setLoadingProgress(prevProgress => ({
          ...prevProgress,
          loaded: prevProgress.loaded + 1
        }));
        
        console.log(`✅ Page ${pageIndex + 1} loaded successfully`);
      }
    } catch (error) {
      console.error(`Error loading page ${pageIndex + 1}:`, error);
      
      // Mark page as failed
      setPageLoadingStates(prevStates => {
        const newStates = [...prevStates];
        newStates[pageIndex] = false;
        return newStates;
      });
      
      setMetadata(prevMetadata => {
        const newMetadata = [...prevMetadata];
        newMetadata[pageIndex] = {
          document_type: 'Error',
          key_information: {},
          text_content: `Failed to load page: ${error.message}`,
          tables_lists: [],
          special_elements: [],
          raw_ai_response: null,
          revisions: []
        };
        return newMetadata;
      });
    }
  };

  const loadRemainingPagesSequentially = async (pdfId, totalPages, aiProcessingId) => {
    // Load pages sequentially with AI data
    for (let pageIndex = 1; pageIndex < totalPages; pageIndex++) {
      console.log(`📄 Loading page ${pageIndex + 1}/${totalPages}...`);
      
      // Try to get AI metadata for this page
      const aiData = await fetchAiMetadataForPage(aiProcessingId, pageIndex + 1);
      
      // Load the page (with or without AI data)
      await loadPageWithData(pdfId, pageIndex, aiData);
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log("🎉 All pages loaded!");
  };

  const cleanupPdf = async () => {
    if (pdfInfo && pdfInfo.pdf_id) {
      try {
        await fetch(`http://127.0.0.1:8080/pdf/${pdfInfo.pdf_id}`, {
          method: 'DELETE',
        });
        console.log("🗑️ PDF cleaned up from server");
      } catch (error) {
        console.warn("Failed to cleanup PDF:", error);
      }
    }
  };

  const handleMetadataEdit = (index, field, value) => {
    setMetadata(prevMetadata => {
      const newMetadata = [...prevMetadata];
      if (newMetadata[index]) {
        newMetadata[index][field] = value;
      }
      return newMetadata;
    });
  };

  const handleRevisionEdit = (pageIndex, revisionIndex, field, value) => {
    setMetadata(prevMetadata => {
      const newMetadata = [...prevMetadata];
      if (newMetadata[pageIndex] && newMetadata[pageIndex].revisions) {
        newMetadata[pageIndex].revisions[revisionIndex][field] = value;
      }
      return newMetadata;
    });
  };

  const addRevisionRow = (pageIndex) => {
    setMetadata(prevMetadata => {
      const newMetadata = [...prevMetadata];
      if (newMetadata[pageIndex]) {
        if (!newMetadata[pageIndex].revisions) {
          newMetadata[pageIndex].revisions = [];
        }
        newMetadata[pageIndex].revisions.push({
          revision_number: '',
          revision_date: '',
          revision_description: ''
        });
      }
      return newMetadata;
    });
  };

  const removeRevisionRow = (pageIndex, revisionIndex) => {
    setMetadata(prevMetadata => {
      const newMetadata = [...prevMetadata];
      if (newMetadata[pageIndex] && newMetadata[pageIndex].revisions) {
        newMetadata[pageIndex].revisions.splice(revisionIndex, 1);
      }
      return newMetadata;
    });
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
    setCurrentVisiblePage(0);
    setAiProcessingId(null);
    setError(null);
  };

  const clearFile = async () => {
    await clearResults();
    setFile(null);
    setError(null);
  };

  const goToNextPage = () => {
    if (currentVisiblePage < imageResults.length - 1) {
      setCurrentVisiblePage(currentVisiblePage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentVisiblePage > 0) {
      setCurrentVisiblePage(currentVisiblePage - 1);
    }
  };

  const goToPage = (pageIndex) => {
    setCurrentVisiblePage(pageIndex);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="logo-section">
            <img src={logo} className="App-logo" alt="logo" />
            <div className="title-section">
              <h1>AI Document Extraction Demo</h1>
              <p>Upload PDFs and extract structured information using AI models</p>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button 
              className={`tab-button ${activeTab === 'local' ? 'active' : ''}`}
              onClick={() => setActiveTab('local')}
            >
              🖥️ Local AI Processing
            </button>
            <button 
              className={`tab-button ${activeTab === 'cloud' ? 'active' : ''}`}
              onClick={() => setActiveTab('cloud')}
            >
              ☁️ Cloud MM Inference
            </button>
          </div>
        </div>
      </header>

      <main className="App-main">
        {activeTab === 'local' ? (
          // Your existing local processing UI
          <div className="local-processing-container">
            <div className="upload-section">
              <div 
                className={`upload-area ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  style={{ display: 'none' }}
                />
                
                {file ? (
                  <div className="file-selected">
                    <p>📄 <strong>{file.name}</strong> selected</p>
                    <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <div className="file-actions">
                      <button onClick={uploadFileToAPI} disabled={isUploading} className="process-btn">
                        {isUploading ? '🔄 Processing...' : '🚀 Process with Local AI'}
                      </button>
                      <button onClick={clearFile} className="clear-btn">🗑️ Clear</button>
                    </div>
                  </div>
                ) : (
                  <div className="upload-prompt">
                    <div className="upload-icon">📁</div>
                    <p>Drag and drop a PDF file here</p>
                    <p>or</p>
                    <button onClick={handleBrowseClick} className="browse-btn">
                      Browse Files
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="error-message">
                  <p>❌ {error}</p>
                </div>
              )}

              {isUploading && (
                <div className="upload-progress">
                  <p>🔄 Processing your document...</p>
                  <div className="progress-details">
                    <p>Pages loaded: {loadingProgress.loaded} / {loadingProgress.total}</p>
                    {loadingProgress.total > 0 && (
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Results Display */}
            {imageResults.length > 0 && (
              <div className="results-section">
                <div className="results-header">
                  <h2>📊 Extraction Results</h2>
                  {pdfInfo && (
                    <div className="pdf-info">
                      <span>📄 {pdfInfo.page_count} pages</span>
                      <button onClick={clearResults} className="clear-results-btn">
                        🗑️ Clear Results
                      </button>
                    </div>
                  )}
                </div>

                <div className="page-navigation">
                  <button 
                    onClick={goToPreviousPage}
                    disabled={currentVisiblePage === 0}
                    className="nav-btn"
                  >
                    ← Previous
                  </button>
                  
                  <div className="page-indicator">
                    Page {currentVisiblePage + 1} of {imageResults.length}
                  </div>
                  
                  <button 
                    onClick={goToNextPage}
                    disabled={currentVisiblePage === imageResults.length - 1}
                    className="nav-btn"
                  >
                    Next →
                  </button>
                </div>

                <div className="page-thumbnails">
                  {imageResults.map((imageUrl, index) => (
                    <button
                      key={index}
                      className={`thumbnail ${index === currentVisiblePage ? 'active' : ''}`}
                      onClick={() => goToPage(index)}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt={`Page ${index + 1}`} />
                      ) : (
                        <div className="thumbnail-loading">
                          {pageLoadingStates[index] ? '⏳' : '❌'}
                        </div>
                      )}
                      <span>Page {index + 1}</span>
                    </button>
                  ))}
                </div>

                {/* Current Page Display */}
                {imageResults[currentVisiblePage] && (
                  <div className="current-page-display">
                    <div className="page-content">
                      <div className="page-image">
                        <img 
                          src={imageResults[currentVisiblePage]} 
                          alt={`Page ${currentVisiblePage + 1}`}
                        />
                      </div>
                      
                      <div className="page-metadata">
                        <h3>📋 Extracted Metadata - Page {currentVisiblePage + 1}</h3>
                        
                        {metadata[currentVisiblePage] ? (
                          <div className="metadata-content">
                            <div className="metadata-field">
                              <label>Document Type:</label>
                              <input
                                type="text"
                                value={metadata[currentVisiblePage].document_type || ''}
                                onChange={(e) => handleMetadataEdit(currentVisiblePage, 'document_type', e.target.value)}
                                placeholder="Enter document type..."
                              />
                            </div>

                            <div className="metadata-field">
                              <label>Text Content:</label>
                              <textarea
                                value={metadata[currentVisiblePage].text_content || ''}
                                onChange={(e) => handleMetadataEdit(currentVisiblePage, 'text_content', e.target.value)}
                                placeholder="Extracted text content..."
                                rows="6"
                              />
                            </div>

                            <div className="key-information">
                              <label>Key Information:</label>
                              <div className="key-info-content">
                                {metadata[currentVisiblePage].key_information && 
                                 typeof metadata[currentVisiblePage].key_information === 'object' ? (
                                  Object.entries(metadata[currentVisiblePage].key_information).map(([key, value]) => (
                                    <div key={key} className="key-info-item">
                                      <strong>{key}:</strong> {String(value)}
                                    </div>
                                  ))
                                ) : (
                                  <p>No key information extracted</p>
                                )}
                              </div>
                            </div>

                            {/* Raw AI Response (collapsible) */}
                            <details className="raw-response">
                              <summary>🔍 Raw AI Response</summary>
                              <pre>{JSON.stringify(metadata[currentVisiblePage].raw_ai_response, null, 2)}</pre>
                            </details>
                          </div>
                        ) : (
                          <div className="metadata-loading">
                            {pageLoadingStates[currentVisiblePage] ? (
                              <p>⏳ Loading metadata...</p>
                            ) : (
                              <p>❌ No metadata available for this page</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Cloud processing component
          <CloudExtraction />
        )}
      </main>
    </div>
  );
}

export default App;
