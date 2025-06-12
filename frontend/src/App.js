import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import logo from './logo.png'; // Import the logo
import CloudExtraction from './CloudExtraction';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

function App() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [currentVisiblePage, setCurrentVisiblePage] = useState(0);
  const [activeTab, setActiveTab] = useState('vllm'); // 'vllm' or 'cloud'
  const [processingId, setProcessingId] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  
  // Default extraction fields for vLLM
  const [extractionFields, setExtractionFields] = useState([
    { field_name: 'document_title', description: 'The main title or heading of the document' },
    { field_name: 'document_number', description: 'Any reference, ID, or tracking number' },
    { field_name: 'date', description: 'Any dates mentioned in the document' },
    { field_name: 'author', description: 'Author, creator, or company name' }
  ]);

  // Reset current page when new results load
  useEffect(() => {
    if (results.length > 0) {
      setCurrentVisiblePage(0);
    }
  }, [results.length]);

  // Poll for processing status
  useEffect(() => {
    let interval;
    if (processingId && isProcessing) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/extract/status/${processingId}`);
          if (response.ok) {
            const status = await response.json();
            setProcessingStatus(status);
            
            if (status.status === 'completed') {
              // Fetch final results
              const resultsResponse = await fetch(`${API_BASE_URL}/extract/results/${processingId}`);
              if (resultsResponse.ok) {
                const finalResults = await resultsResponse.json();
                setResults(finalResults.results || []);
                setIsProcessing(false);
                setProcessingId(null);
              }
            } else if (status.status === 'failed') {
              setError('Processing failed');
              setIsProcessing(false);
              setProcessingId(null);
            }
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [processingId, isProcessing]);

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
        setError('Please upload a PDF file');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a PDF file');
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  const updateExtractionField = (index, field, value) => {
    const newFields = [...extractionFields];
    newFields[index][field] = value;
    setExtractionFields(newFields);
  };

  const addExtractionField = () => {
    setExtractionFields([...extractionFields, { field_name: '', description: '' }]);
  };

  const removeExtractionField = (index) => {
    if (extractionFields.length > 1) {
      setExtractionFields(extractionFields.filter((_, i) => i !== index));
    }
  };

  const startVLLMExtraction = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);
    setProcessingStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const requestData = {
        fields: extractionFields.filter(f => f.field_name && f.description)
      };
      formData.append('extraction_request', JSON.stringify(requestData));

      const response = await fetch(`${API_BASE_URL}/extract/start`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to start extraction");
      }
      
      const result = await response.json();
      setProcessingId(result.processing_id);
      
    } catch (error) {
      console.error("Extraction error:", error);
      setError(error.message || "Failed to process the PDF. Please try again.");
      setIsProcessing(false);
    }
  };

  const startSyncExtraction = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const requestData = {
        fields: extractionFields.filter(f => f.field_name && f.description)
      };
      formData.append('extraction_request', JSON.stringify(requestData));

      const response = await fetch(`${API_BASE_URL}/extract/sync`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to process document");
      }
      
      const result = await response.json();
      setResults(result.results || []);
      
    } catch (error) {
      console.error("Sync extraction error:", error);
      setError(error.message || "Failed to process the PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearResults = async () => {
    if (processingId) {
      try {
        await fetch(`${API_BASE_URL}/extract/${processingId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Error cleaning up:', err);
      }
    }
    setResults([]);
    setProcessingId(null);
    setProcessingStatus(null);
    setCurrentVisiblePage(0);
    setError(null);
  };

  const clearFile = async () => {
    await clearResults();
    setFile(null);
    setError(null);
  };

  const goToNextPage = () => {
    if (currentVisiblePage < results.length - 1) {
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

  const downloadResults = () => {
    if (results.length === 0) return;
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `vllm_extraction_results_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="logo-section">
            <img src={logo} className="App-logo" alt="logo" />
            <div className="title-section">
              <h1>vLLM Document Extraction</h1>
              <p>Modern AI-powered document processing with vision models</p>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button 
              className={`tab-button ${activeTab === 'vllm' ? 'active' : ''}`}
              onClick={() => setActiveTab('vllm')}
            >
              🤖 vLLM Processing
            </button>
            <button 
              className={`tab-button ${activeTab === 'cloud' ? 'active' : ''}`}
              onClick={() => setActiveTab('cloud')}
            >
              ☁️ Cloud Processing
            </button>
          </div>
        </div>
      </header>

      <main className="App-main">
        {activeTab === 'vllm' ? (
          // vLLM Processing UI
          <div className="vllm-processing-container">
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
                      <button 
                        onClick={startVLLMExtraction} 
                        disabled={isProcessing} 
                        className="process-btn"
                      >
                        {isProcessing ? '🔄 Processing...' : '🚀 Process with vLLM'}
                      </button>
                      <button 
                        onClick={startSyncExtraction} 
                        disabled={isProcessing} 
                        className="process-btn secondary"
                      >
                        ⚡ Quick Process
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

              {/* Extraction Fields Configuration */}
              <div className="extraction-config">
                <h3>🔍 Fields to Extract</h3>
                <div className="fields-container">
                  {extractionFields.map((field, index) => (
                    <div key={index} className="field-row">
                      <input
                        type="text"
                        placeholder="Field name (e.g., title)"
                        value={field.field_name}
                        onChange={(e) => updateExtractionField(index, 'field_name', e.target.value)}
                        className="field-input"
                      />
                      <input
                        type="text"
                        placeholder="Description (e.g., main document title)"
                        value={field.description}
                        onChange={(e) => updateExtractionField(index, 'description', e.target.value)}
                        className="field-input description"
                      />
                      <button 
                        onClick={() => removeExtractionField(index)}
                        disabled={extractionFields.length <= 1}
                        className="remove-field-btn"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                  <button onClick={addExtractionField} className="add-field-btn">
                    ➕ Add Field
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  <p>❌ {error}</p>
                </div>
              )}

              {isProcessing && processingStatus && (
                <div className="processing-status">
                  <p>🔄 Processing your document...</p>
                  <div className="progress-details">
                    <p>Status: {processingStatus.status}</p>
                    <p>Pages: {processingStatus.completed_pages} / {processingStatus.total_pages}</p>
                    {processingStatus.total_pages > 0 && (
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${processingStatus.progress_percentage}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Results Display */}
            {results.length > 0 && (
              <div className="results-section">
                <div className="results-header">
                  <h2>📊 Extraction Results</h2>
                  <div className="results-actions">
                    <span>📄 {results.length} pages processed</span>
                    <button onClick={downloadResults} className="download-btn">
                      💾 Download JSON
                    </button>
                    <button onClick={clearResults} className="clear-results-btn">
                      🗑️ Clear Results
                    </button>
                  </div>
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
                    Page {currentVisiblePage + 1} of {results.length}
                  </div>
                  
                  <button 
                    onClick={goToNextPage}
                    disabled={currentVisiblePage === results.length - 1}
                    className="nav-btn"
                  >
                    Next →
                  </button>
                </div>

                <div className="page-thumbnails">
                  {results.map((result, index) => (
                    <button
                      key={index}
                      className={`thumbnail ${index === currentVisiblePage ? 'active' : ''}`}
                      onClick={() => goToPage(index)}
                    >
                      <img 
                        src={`data:image/png;base64,${result.image_base64}`} 
                        alt={`Page ${result.page_number}`} 
                      />
                      <span>Page {result.page_number}</span>
                    </button>
                  ))}
                </div>

                {/* Current Page Display */}
                {results[currentVisiblePage] && (
                  <div className="current-page-display">
                    <div className="page-content">
                      <div className="page-image">
                        <img 
                          src={`data:image/png;base64,${results[currentVisiblePage].image_base64}`}
                          alt={`Page ${results[currentVisiblePage].page_number}`}
                        />
                      </div>
                      
                      <div className="page-metadata">
                        <h3>📋 Extracted Data - Page {results[currentVisiblePage].page_number}</h3>
                        <div className="processing-time">
                          ⏱️ Processing time: {results[currentVisiblePage].processing_time?.toFixed(2)}s
                        </div>
                        
                        <div className="extracted-fields">
                          {Object.entries(results[currentVisiblePage].extracted_data || {}).map(([key, value]) => (
                            <div key={key} className="field-result">
                              <label>{key}:</label>
                              <div className="field-value">
                                {value !== null ? String(value) : <em>Not found</em>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Cloud Processing UI (existing CloudExtraction component)
          <CloudExtraction />
        )}
      </main>
    </div>
  );
}

export default App;
