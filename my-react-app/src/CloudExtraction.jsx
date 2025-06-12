import React, { useState, useRef } from 'react';

const CloudExtraction = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [selectedFields, setSelectedFields] = useState([
    { document_field: 'drawing title', return_field: 'drawing_title' },
    { document_field: 'drawing number', return_field: 'drawing_number' },
    { document_field: 'revision', return_field: 'revision' },
    { document_field: 'date', return_field: 'date' }
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
    setSelectedFields([...selectedFields, { document_field: '', return_field: '' }]);
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
      const customFields = {
        field_names: selectedFields.filter(f => f.document_field && f.return_field)
      };

      formData.append('file', file);
      formData.append('custom_fields', JSON.stringify(customFields));

      const response = await fetch('http://localhost:8080/ai_metadata_cloud/start', {
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
        const response = await fetch(`http://localhost:8080/ai_metadata_cloud/${id}/status`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.status === 'completed') {
          setResults(result);
          setIsProcessing(false);
        } else if (result.status === 'error') {
          setError(result.error || 'Processing failed');
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
    
    const exportFileDefaultName = `cloud_extraction_results_${results.processing_id}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>🌥️ Cloud MM Inference Extraction</h2>
      <p>Extract information using your cloud mm_inference pod</p>

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
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr auto', 
                gap: '5px', 
                marginBottom: '8px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Document field"
                  value={field.document_field}
                  onChange={(e) => updateField(index, 'document_field', e.target.value)}
                  style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="text"
                  placeholder="Return as"
                  value={field.return_field}
                  onChange={(e) => updateField(index, 'return_field', e.target.value)}
                  style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button 
                  onClick={() => removeField(index)}
                  disabled={selectedFields.length <= 1}
                  style={{
                    background: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    padding: '6px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button 
              onClick={addField}
              style={{
                background: '#51cf66',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '8px'
              }}
            >
              + Add Field
            </button>
          </div>

          {/* Start Button */}
          <button 
            onClick={startExtraction}
            disabled={!file || isProcessing || selectedFields.filter(f => f.document_field && f.return_field).length === 0}
            style={{
              background: isProcessing ? '#ccc' : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              width: '100%',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {isProcessing ? '🔄 Processing...' : '🚀 Start Cloud Extraction'}
          </button>
        </div>

        {/* Right Panel - Results */}
        <div style={{ 
          background: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
          padding: '20px' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>📊 Results</h3>
            {results && (
              <button 
                onClick={downloadResults}
                style={{
                  background: '#4299e1',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                📥 Download JSON
              </button>
            )}
          </div>

          {isProcessing ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
              }}></div>
              <p>Processing with cloud mm_inference...</p>
              {processingId && <p style={{ color: '#666', fontSize: '12px' }}>ID: {processingId}</p>}
            </div>
          ) : error ? (
            <div style={{ 
              background: '#fed7d7', 
              color: '#c53030', 
              padding: '20px', 
              borderRadius: '8px' 
            }}>
              <h4>❌ Error</h4>
              <p>{error}</p>
            </div>
          ) : results ? (
            <div>
              {/* Summary */}
              <div style={{ 
                background: '#f7fafc', 
                padding: '15px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <strong>Pages</strong><br/>
                  {results.total_pages}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <strong>Completed</strong><br/>
                  {results.completed_pages}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <strong>Progress</strong><br/>
                  {results.progress?.toFixed(1)}%
                </div>
              </div>

              {/* Page Results */}
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {results.pages.map((page) => (
                  <div key={page.page_number} style={{ 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    marginBottom: '16px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      background: '#667eea', 
                      color: 'white', 
                      padding: '12px',
                      fontWeight: 'bold'
                    }}>
                      Page {page.page_number} - {page.status}
                    </div>
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '200px 1fr', 
                      gap: '16px', 
                      padding: '16px' 
                    }}>
                      {page.image_data_url && (
                        <div>
                          <img 
                            src={page.image_data_url}
                            alt={`Page ${page.page_number}`}
                            style={{ 
                              width: '100%', 
                              height: 'auto', 
                              borderRadius: '6px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                          />
                        </div>
                      )}
                      
                      <div>
                        <h4>Extracted Data:</h4>
                        <pre style={{ 
                          background: '#f7fafc', 
                          padding: '12px', 
                          borderRadius: '6px', 
                          fontSize: '12px',
                          overflow: 'auto',
                          border: '1px solid #e2e8f0'
                        }}>
                          {JSON.stringify(page.result || page.error, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              color: '#a0aec0' 
            }}>
              <p>Upload a PDF and start extraction to see results here.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CloudExtraction; 