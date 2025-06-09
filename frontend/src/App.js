import React, { useState } from 'react';
import PDFUploader from './components/PDFUploader';
import PDFViewer from './components/PDFViewer';
import './App.css';

function App() {
  const [currentPDF, setCurrentPDF] = useState(null);

  return (
    <div className="App">
      <header className="App-header">
        <h1>PDF Viewer</h1>
      </header>
      <main>
        {!currentPDF ? (
          <PDFUploader onPDFUploaded={setCurrentPDF} />
        ) : (
          <div className="viewer-container">
            <button 
              className="back-button" 
              onClick={() => setCurrentPDF(null)}
            >
              ← Upload Another PDF
            </button>
            <PDFViewer pdfData={currentPDF} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 