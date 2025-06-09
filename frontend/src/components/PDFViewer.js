import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import './PDFViewer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function PDFViewer({ pdfData }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(600);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Adjust page width based on container size
    const handleResize = () => {
      const containerWidth = document.querySelector('.pdf-container')?.clientWidth || 600;
      setPageWidth(containerWidth - 40); // Add some padding
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load the PDF. Please try again.');
    setIsLoading(false);
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => {
      const newPageNumber = prevPageNumber + offset;
      return Math.min(Math.max(1, newPageNumber), numPages);
    });
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <div className="page-navigation">
          <button 
            onClick={previousPage} 
            disabled={pageNumber <= 1 || isLoading}
            className="nav-button"
          >
            &#8592; Previous
          </button>
          
          <span className="page-info">
            {isLoading ? 'Loading...' : `Page ${pageNumber} of ${numPages}`}
          </span>
          
          <button 
            onClick={nextPage} 
            disabled={pageNumber >= numPages || isLoading}
            className="nav-button"
          >
            Next &#8594;
          </button>
        </div>
      </div>

      <div className="pdf-container">
        {error ? (
          <div className="pdf-error">{error}</div>
        ) : (
          <Document
            file={pdfData.originalFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="loading">Loading PDF...</div>}
          >
            <Page 
              pageNumber={pageNumber} 
              width={pageWidth}
              loading={<div className="loading">Loading page...</div>}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        )}
      </div>
    </div>
  );
}

export default PDFViewer; 