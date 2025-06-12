import React, { useState, useRef } from 'react';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const CloudExtraction = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [selectedFields, setSelectedFields] = useState([
    { field_name: 'drawing_title', description: 'The main title of the drawing or document' },
    { field_name: 'drawing_number', description: 'The reference or identification number' },
    { field_name: 'revision', description: 'Revision number or letter' },
    { field_name: 'date', description: 'Date on the document' }
  ]);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
      setError(null);
      setProcessingId(null);
    }
  };

  const addField = () => {
    setSelectedFields([...selectedFields, { field_name: '', description: '' }]);
  };

  const updateField = (index, key, value) => {
    const newFields = [...selectedFields];
    newFields[index][key] = value;
    setSelectedFields(newFields);
  };

  const removeField = (index) => {
    setSelectedFields(selectedFields.filter((_, i) => i !== index));
  };

  const startExtraction = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      const requestData = {
        fields: selectedFields.filter(f => f.field_name && f.description)
      };

      formData.append('file', file);
      formData.append('extraction_request', JSON.stringify(requestData));

      // Use the consolidated API endpoint
      const response = await fetch(`${API_BASE_URL}/extract/start`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setProcessingId(result.processing_id);
      
      // Start polling for results
      pollForResults(result.processing_id);

    } catch (error) {
      console.error('Extraction error:', error);
      setError(error.message || 'Error starting extraction. Please try again.');
      setIsProcessing(false);
    }
  };

  const pollForResults = async (id) => {
    const pollInterval = 2000; // Poll every 2 seconds
    
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/extract/status/${id}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const status = await response.json();
        
        if (status.status === 'completed') {
          // Fetch the full results
          const resultsResponse = await fetch(`${API_BASE_URL}/extract/results/${id}`);
          if (resultsResponse.ok) {
            const finalResults = await resultsResponse.json();
            setResults(finalResults);
            setIsProcessing(false);
          }
        } else if (status.status === 'failed') {
          setError('Processing failed');
          setIsProcessing(false);
        } else {
          // Still processing, continue polling
          setTimeout(poll, pollInterval);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setError('Error checking processing status');
        setIsProcessing(false);
      }
    };

    poll();
  };

  const downloadResults = () => {
    if (!results) return;
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `cloud_extraction_results_${results.processing_id || 'unknown'}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>☁️ Cloud vLLM Extraction</h2>
      <p>Extract information using the vLLM vision model server</p>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '20px', marginTop: '20px' }}>
        {/* Left Panel - Configuration */}
        <div style={{ 
          background: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
          padding: '20px' 
        }}>
          {/* File Upload */}
          <div style={{ marginBottom: '20px' }}>
            <h3>📁 Upload PDF</h3>
            <div style={{ 
              border: '2px dashed #ccc', 
              borderRadius: '8px', 
              padding: '20px', 
              textAlign: 'center',
              cursor: 'pointer'
            }} onClick={() => fileInputRef.current.click()}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/pdf"
                style={{ display: 'none' }}
              />
              <button style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}>
                Choose PDF File
              </button>
              <div style={{ marginTop: '10px', color: '#666' }}>
                {file ? file.name : 'No file selected'}
              </div>
            </div>
          </div>

          {/* Field Configuration */}
          <div style={{ marginBottom: '20px' }}>
            <h3>🔍 Fields to Extract</h3>
            {selectedFields.map((field, index) => (
              <div key={index} style={{ 
                marginBottom: '12px',
                padding: '8px',
                border: '1px solid #eee',
                borderRadius: '4px'
              }}>
                <input
                  type="text"
                  placeholder="Field name"
                  value={field.field_name}
                  onChange={(e) => updateField(index, 'field_name', e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '6px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    marginBottom: '4px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={field.description}
                  onChange={(e) => updateField(index, 'description', e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '6px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    marginBottom: '4px'
                  }}
                />
                <button 
                  onClick={() => removeField(index)}
                  disabled={selectedFields.length <= 1}
                  style={{
                    background: '#ff4757',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button 
              onClick={addField}
              style={{
                background: '#2ed573',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Add Field
            </button>
          </div>

          {/* Start Processing */}
          <div>
            <button 
              onClick={startExtraction}
              disabled={!file || isProcessing}
              style={{
                background: isProcessing ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                width: '100%',
                fontSize: '16px'
              }}
            >
              {isProcessing ? '🔄 Processing...' : '🚀 Start Extraction'}
            </button>
          </div>

          {error && (
            <div style={{
              background: '#ffebee',
              color: '#c62828',
              padding: '12px',
              borderRadius: '4px',
              marginTop: '12px'
            }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* Right Panel - Results */}
        <div style={{ 
          background: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
          padding: '20px' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>📊 Extraction Results</h3>
            {results && (
              <button 
                onClick={downloadResults}
                style={{
                  background: '#2ed573',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                💾 Download JSON
              </button>
            )}
          </div>

          {isProcessing && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
              }}></div>
              <p>Processing your document with vLLM...</p>
              {processingId && <p style={{ color: '#666' }}>Processing ID: {processingId}</p>}
            </div>
          )}

          {results && (
            <div>
              <div style={{ marginBottom: '20px', padding: '12px', background: '#f8f9fa', borderRadius: '4px' }}>
                <p><strong>Processing ID:</strong> {results.processing_id}</p>
                <p><strong>Total Pages:</strong> {results.total_pages || results.results?.length || 0}</p>
                <p><strong>Status:</strong> {results.status}</p>
              </div>

              {results.results && results.results.map((page, index) => (
                <div key={index} style={{ 
                  marginBottom: '24px', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '12px', 
                    fontWeight: 'bold',
                    borderBottom: '1px solid #ddd'
                  }}>
                    📄 Page {page.page_number} 
                    <span style={{ float: 'right', fontWeight: 'normal', color: '#666' }}>
                      ⏱️ {page.processing_time?.toFixed(2)}s
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '16px' }}>
                    {/* Page Image */}
                    <div>
                      <img 
                        src={`data:image/png;base64,${page.image_base64}`} 
                        alt={`Page ${page.page_number}`}
                        style={{ 
                          width: '100%', 
                          height: 'auto', 
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                    
                    {/* Extracted Data */}
                    <div>
                      <h4 style={{ marginTop: 0 }}>Extracted Information</h4>
                      {page.extracted_data && Object.keys(page.extracted_data).length > 0 ? (
                        <div style={{ 
                          display: 'grid', 
                          gap: '8px'
                        }}>
                          {Object.entries(page.extracted_data).map(([field, value]) => (
                            <div key={field} style={{
                              padding: '8px',
                              background: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e9ecef'
                            }}>
                              <strong style={{ color: '#495057' }}>{field}:</strong>
                              <div style={{ marginTop: '4px' }}>
                                {value !== null ? (
                                  <span style={{ color: '#212529' }}>{String(value)}</span>
                                ) : (
                                  <em style={{ color: '#6c757d' }}>Not found</em>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#6c757d', fontStyle: 'italic' }}>No data extracted from this page</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isProcessing && !results && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px',
              color: '#6c757d'
            }}>
              <p>Upload a PDF and configure extraction fields to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CloudExtraction; 