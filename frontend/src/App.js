import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import logo from './logo.png'; // Import the logo

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
  const carouselRef = useRef(null);
  
  // New state for model selection
  const [selectedModel, setSelectedModel] = useState(null);
  const [showModelSelection, setShowModelSelection] = useState(false);
  
  // New state for field configuration
  const [showFieldConfiguration, setShowFieldConfiguration] = useState(false);
  const [extractionFields, setExtractionFields] = useState([
    { field_name: 'asset_number', field_type: 'text', field_mapping: 'asset_number_field' },
    { field_name: 'model', field_type: 'text', field_mapping: 'model_field' },
    { field_name: 'serial_number', field_type: 'text', field_mapping: 'serial_number_field' }
  ]);
  const [fileType, setFileType] = useState(null); // 'pdf', 'image'

  // Helper function to check if file is image
  const isImageFile = (file) => {
    return file && ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type);
  };

  // Helper function to check if file is PDF
  const isPdfFile = (file) => {
    return file && file.type === 'application/pdf';
  };

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
      if (isPdfFile(droppedFile)) {
        setFile(droppedFile);
        setFileType('pdf');
        setShowModelSelection(true);
        setSelectedModel(null);
        setShowFieldConfiguration(false);
        // Clear any previous results
        setImageResults([]);
        setMetadata([]);
        setError(null);
      } else if (isImageFile(droppedFile)) {
        setFile(droppedFile);
        setFileType('image');
        setShowModelSelection(true);
        setSelectedModel(null);
        setShowFieldConfiguration(false);
        // Clear any previous results
        setImageResults([]);
        setMetadata([]);
        setError(null);
      } else {
        alert('Please upload a PDF file or image (PNG, JPG, JPEG)');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (isPdfFile(selectedFile)) {
        setFile(selectedFile);
        setFileType('pdf');
        setShowModelSelection(true);
        setSelectedModel(null);
        setShowFieldConfiguration(false);
        // Clear any previous results
        setImageResults([]);
        setMetadata([]);
        setError(null);
      } else if (isImageFile(selectedFile)) {
        setFile(selectedFile);
        setFileType('image');
        setShowModelSelection(true);
        setSelectedModel(null);
        setShowFieldConfiguration(false);
        // Clear any previous results
        setImageResults([]);
        setMetadata([]);
        setError(null);
      } else {
        alert('Please upload a PDF file or image (PNG, JPG, JPEG)');
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

  const handleModelSelect = (modelType) => {
    setSelectedModel(modelType);
  };

  const startInference = () => {
    if (!selectedModel) {
      setError("Please select a model type before starting inference.");
      return;
    }
    
    // If asset extraction is selected, show field configuration
    if (selectedModel === 'asset') {
      setShowModelSelection(false);
      setShowFieldConfiguration(true);
    } else {
      // For drawing extraction, go directly to processing
      setShowModelSelection(false);
      uploadFileToAPI(selectedModel);
    }
  };

  // Field configuration functions
  const addField = () => {
    setExtractionFields([...extractionFields, { 
      field_name: '', 
      field_type: 'text', 
      field_mapping: '' 
    }]);
  };

  const removeField = (index) => {
    setExtractionFields(extractionFields.filter((_, i) => i !== index));
  };

  const updateField = (index, property, value) => {
    const updated = [...extractionFields];
    updated[index][property] = value;
    setExtractionFields(updated);
  };

  const addPresetField = (preset) => {
    const presets = {
      asset_number: { field_name: 'asset_number', field_type: 'text', field_mapping: 'asset_number_field' },
      model: { field_name: 'model', field_type: 'text', field_mapping: 'model_field' },
      serial_number: { field_name: 'serial_number', field_type: 'text', field_mapping: 'serial_number_field' },
      manufacturer: { field_name: 'manufacturer', field_type: 'text', field_mapping: 'manufacturer_field' },
      description: { field_name: 'description', field_type: 'text', field_mapping: 'description_field' },
      asset_type: { field_name: 'asset_type', field_type: 'text', field_mapping: 'asset_type_field' }
    };
    
    if (presets[preset]) {
      setExtractionFields([...extractionFields, presets[preset]]);
    }
  };

  const startAssetExtraction = () => {
    if (extractionFields.length === 0) {
      setError("Please add at least one field to extract.");
      return;
    }
    
    // Validate fields
    const isValid = extractionFields.every(field => 
      field.field_name.trim() && field.field_mapping.trim()
    );
    
    if (!isValid) {
      setError("Please fill in all field names and mappings.");
      return;
    }
    
    setShowFieldConfiguration(false);
    uploadFileToAPI('asset');
  };

  const uploadFileToAPI = async (modelType = 'drawing') => {
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
      // Handle different file types
      if (fileType === 'image') {
        // For images, process directly with asset extraction
        if (modelType === 'asset') {
          console.log("🚀 Starting Asset extraction on image...");
          await processImageAssetExtraction();
        } else {
          throw new Error("Drawing metadata extraction is only available for PDF files.");
        }
      } else {
        // For PDFs, get basic PDF info first
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
        
        // Handle different model types for PDFs
        if (modelType === 'asset') {
          // For asset/receipt extraction, process each page individually
          console.log("🚀 Starting Asset/Receipt extraction...");
          await processAssetExtraction(info);
        } else {
          // Original drawing metadata extraction flow
          console.log("🚀 Starting Drawing metadata extraction...");
          await processDrawingExtraction(info, formData);
        }
      }

    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "Failed to process the file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const processAssetExtraction = async (info) => {
    // Initialize arrays for the expected number of pages
    const initialResults = new Array(info.page_count).fill(null);
    const initialMetadata = new Array(info.page_count).fill(null);
    const initialLoadingStates = new Array(info.page_count).fill(true);
    
    setImageResults(initialResults);
    setMetadata(initialMetadata);
    setPageLoadingStates(initialLoadingStates);
    setLoadingProgress({ loaded: 0, total: info.page_count });

    // Load all pages with asset extraction
    for (let pageIndex = 0; pageIndex < info.page_count; pageIndex++) {
      try {
        await loadPageWithAssetData(info.pdf_id, pageIndex);
        setLoadingProgress(prev => ({ ...prev, loaded: pageIndex + 1 }));
      } catch (error) {
        console.error(`Error loading page ${pageIndex}:`, error);
        setPageLoadingStates(prev => {
          const updated = [...prev];
          updated[pageIndex] = 'error';
          return updated;
        });
      }
    }
  };

  const processImageAssetExtraction = async () => {
    console.log("🚀 Starting image asset extraction...");
    
    // For images, we have a single "page"
    setImageResults([null]);
    setMetadata([null]);
    setPageLoadingStates([true]);
    setLoadingProgress({ loaded: 0, total: 1 });

    try {
      // Convert file to base64 for display
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1]; // Remove data URL prefix
        
        console.log("📷 Image converted to base64, length:", base64Data.length);
        
        // Set the image for display
        setImageResults([base64Data]);
        
        // Extract asset metadata
        console.log("🔍 Calling extractAssetMetadata...");
        const assetData = await extractAssetMetadata(base64Data);
        
        console.log("📊 Asset data received:", assetData);
        
        // Convert asset response to our internal format
        const pageMetadata = {
          type: 'asset',
          fields: assetData || {},
          isEdited: false,
          isAiGenerated: true
        };

        console.log("📋 Final metadata object:", pageMetadata);

        setMetadata([pageMetadata]);
        setPageLoadingStates([false]);
        setLoadingProgress({ loaded: 1, total: 1 });
        
        console.log("✅ Image asset extraction completed");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("❌ Error processing image:", error);
      setPageLoadingStates([false]);
      setError("Failed to process the image. Please try again.");
    }
  };

  const processDrawingExtraction = async (info, formData) => {
    // Try to start AI sequential processing with timeout
    let firstPageAiData = null;
    let processingId = null;
    
    try {
      // Add timeout to AI request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const aiStartResponse = await fetch('http://127.0.0.1:8080/ai_metadata/start', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (aiStartResponse.ok) {
        const aiStartData = await aiStartResponse.json();
        processingId = aiStartData.processing_id;
        firstPageAiData = aiStartData.result;
        setAiProcessingId(processingId);
        console.log("AI processing started:", aiStartData);
      } else {
        console.warn("AI metadata extraction failed to start, will use fallback data");
      }
    } catch (aiError) {
      console.warn("AI service unavailable or timed out, proceeding with fallback data:", aiError.message);
    }
    
    // Initialize arrays for the expected number of pages
    const initialResults = new Array(info.page_count).fill(null);
    const initialMetadata = new Array(info.page_count).fill(null);
    const initialLoadingStates = new Array(info.page_count).fill(true);
    
    setImageResults(initialResults);
    setMetadata(initialMetadata);
    setPageLoadingStates(initialLoadingStates);
    setLoadingProgress({ loaded: 0, total: info.page_count });

    // Process all pages consistently using the same logic
    console.log(`📚 Starting sequential processing of ${info.page_count} pages...`);
    
    let failedPages = [];
    let successfulPages = 0;
    
    // Process all pages sequentially starting from page 1
    for (let pageIndex = 0; pageIndex < info.page_count; pageIndex++) {
      const pageNumber = pageIndex + 1;
      
      try {
        console.log(`🔄 Processing page ${pageNumber}...`);
        
        // Get AI metadata for this page (with proper retry logic)
        const aiData = await fetchAiMetadataForPage(processingId, pageNumber);
        
        if (aiData) {
          // Success - got real AI data
          await loadPageWithData(info.pdf_id, pageIndex, aiData);
          successfulPages++;
          console.log(`✅ Page ${pageNumber} processed successfully with AI data`);
        } else {
          // Failed to get AI data - mark as failed and use fallback
          failedPages.push(pageNumber);
          await loadPageWithData(info.pdf_id, pageIndex, null);
          console.warn(`⚠️ Page ${pageNumber} failed AI processing - using fallback data`);
        }
        
        // Small delay between pages to not overwhelm the system
        if (pageIndex < info.page_count - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`❌ Error processing page ${pageNumber}:`, error);
        failedPages.push(pageNumber);
        // Continue with next page even if this one fails
        await loadPageWithData(info.pdf_id, pageIndex, null);
      }
    }
    
    // Report processing results to user
    if (failedPages.length === 0) {
      console.log(`🎉 All ${info.page_count} pages processed successfully!`);
    } else if (successfulPages > 0) {
      console.warn(`⚠️ Processing completed with issues: ${successfulPages}/${info.page_count} pages successful`);
      console.warn(`📋 Failed pages (using fallback data): ${failedPages.join(', ')}`);
      
      // Show user-friendly error message
      setError(`AI processing partially failed. ${successfulPages}/${info.page_count} pages processed successfully. Pages ${failedPages.join(', ')} are showing placeholder data. The AI service may be overloaded - you can try re-processing or use the extracted images.`);
    } else {
      console.error(`❌ All pages failed AI processing - using fallback data for entire document`);
      setError(`AI processing failed for all pages. The AI service may be unavailable. All pages are showing placeholder data. You can still view the extracted images.`);
    }
  };

  const fetchAiMetadataForPage = async (processingId, pageNumber) => {
    if (!processingId) {
      console.warn(`❌ No processing ID available for page ${pageNumber} - skipping AI processing`);
      return null;
    }
    
    // Enhanced retry logic with exponential backoff
    const maxRetries = 3;
    const baseRetryDelay = 2000; // Start with 2 seconds
    const maxRetryDelay = 10000; // Cap at 10 seconds
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🔍 Fetching AI metadata for page ${pageNumber} (attempt ${attempt + 1}/${maxRetries})...`);
        
        const response = await fetch(`http://127.0.0.1:8080/ai_metadata/${processingId}/${pageNumber}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ AI metadata received for page ${pageNumber}`);
          return data.result;
        } else if (response.status === 404) {
          // Page not ready yet - common during processing
          console.log(`⏳ Page ${pageNumber} still processing... (attempt ${attempt + 1}/${maxRetries})`);
          if (attempt < maxRetries - 1) {
            const delay = Math.min(baseRetryDelay * Math.pow(2, attempt), maxRetryDelay);
            console.log(`   Waiting ${delay/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          console.warn(`⏱️ Page ${pageNumber} processing timeout after ${maxRetries} attempts`);
          return null;
        } else if (response.status === 422) {
          // AI model error - don't retry, fall back immediately
          const errorData = await response.json();
          console.error(`🤖 AI model failed for page ${pageNumber}:`, errorData.detail);
          return null;
        } else if (response.status === 503) {
          // Service unavailable - AI service is down
          console.error(`🔌 AI service unavailable for page ${pageNumber}`);
          return null;
        } else if (response.status === 408) {
          // Request timeout - retry with backoff
          console.warn(`⏱️ Request timeout for page ${pageNumber} (attempt ${attempt + 1}/${maxRetries})`);
          if (attempt < maxRetries - 1) {
            const delay = Math.min(baseRetryDelay * Math.pow(2, attempt), maxRetryDelay);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return null;
        } else {
          console.error(`❌ Unexpected AI service error for page ${pageNumber}: HTTP ${response.status}`);
          return null;
        }
      } catch (error) {
        console.error(`🔗 Network error for page ${pageNumber} (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        if (attempt < maxRetries - 1) {
          const delay = Math.min(baseRetryDelay * Math.pow(2, attempt), maxRetryDelay);
          console.log(`   Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }
    
    console.error(`❌ Gave up on page ${pageNumber} after ${maxRetries} attempts - will use placeholder data`);
    return null;
  };

  const loadPageWithAssetData = async (pdfId, pageIndex) => {
    try {
      // Get the image for this page
      const pageData = await fetchPageImage(pdfId, pageIndex);
      
      // Update the image
      setImageResults(prev => {
        const updated = [...prev];
        updated[pageIndex] = pageData.image;
        return updated;
      });

      // For asset extraction, call the asset plate extraction API
      const assetData = await extractAssetMetadata(pageData.image);
      console.log("🔍 FRONTEND Asset data returned from extraction:", assetData);
      console.log("📊 FRONTEND Asset data type:", typeof assetData);
      console.log("📊 FRONTEND Asset data is null?", assetData === null);
      console.log("📊 FRONTEND Asset data is undefined?", assetData === undefined);
      
      // Convert asset response to our internal format
      const pageMetadata = {
        type: 'asset',
        fields: assetData || {},
        isEdited: false,
        isAiGenerated: true
      };
      
      console.log("🔍 FRONTEND Page metadata created:", pageMetadata);
      console.log("📊 FRONTEND Page metadata fields:", pageMetadata.fields);
      console.log("📊 FRONTEND Page metadata fields type:", typeof pageMetadata.fields);
      console.log("📊 FRONTEND Page metadata fields keys:", Object.keys(pageMetadata.fields));
      console.log("📊 FRONTEND Page metadata fields count:", Object.keys(pageMetadata.fields).length);

      setMetadata(prev => {
        const updated = [...prev];
        updated[pageIndex] = pageMetadata;
        console.log("🔍 FRONTEND Updated metadata array at index", pageIndex, ":", updated[pageIndex]);
        return updated;
      });

      // Update loading state for this page
      setPageLoadingStates(prev => {
        const updated = [...prev];
        updated[pageIndex] = false;
        return updated;
      });

    } catch (error) {
      console.error(`Error loading asset data for page ${pageIndex}:`, error);
      setPageLoadingStates(prev => {
        const updated = [...prev];
        updated[pageIndex] = 'error';
        return updated;
      });
    }
  };

  const extractAssetMetadata = async (imageBase64) => {
    try {
      // Convert base64 to blob for upload
      const byteCharacters = atob(imageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {type: 'image/png'});
      
      const formData = new FormData();
      formData.append('file', blob, 'page.png');
      
      // Use configured fields for asset extraction
      const assetInput = {
        fields: extractionFields.map(field => ({
          field_name: field.field_name,
          field_type: field.field_type,
          field_mapping: field.field_mapping
        }))
      };

      console.log("🔍 Sending asset extraction request with fields:", assetInput);

      // Add the input fields as JSON string in form data (based on API design)
      formData.append('input', JSON.stringify(assetInput));

      const response = await fetch('http://127.0.0.1:8080/asset_plate_extract', {
        method: 'POST',
        body: formData
      });

      console.log("📡 Asset extraction response status:", response.status);

      if (response.ok) {
        const responseText = await response.text();
        console.log("📄 FRONTEND Raw response text:", responseText);
        console.log("📏 FRONTEND Response length:", responseText.length);
        
        let parsedData;
        
        // The response is a JSON string containing a Python dict string
        // We need to first parse the JSON to get the actual dict string, then parse that
        try {
          console.log("🔍 FRONTEND Raw response analysis:");
          console.log("📄 Type:", typeof responseText);
          console.log("📄 First char:", responseText[0]);
          console.log("📄 Last char:", responseText[responseText.length - 1]);
          console.log("📄 First 50 chars:", responseText.substring(0, 50));
          
          // Check if response is a JSON-encoded string containing a Python dict
          if (responseText.startsWith('"') && responseText.endsWith('"')) {
            // It's a JSON string, parse it to get the actual content
            const actualContent = JSON.parse(responseText);
            console.log("🔧 FRONTEND Extracted content from JSON string:", actualContent);
            console.log("🔧 FRONTEND Content type:", typeof actualContent);
            
            // Now convert Python dict format to JSON
            const cleanedResponse = actualContent.replace(/'/g, '"');
            parsedData = JSON.parse(cleanedResponse);
            console.log("✅ FRONTEND Parsed Python dict as JSON:", parsedData);
          } else {
            // Try direct parsing first
            try {
              parsedData = JSON.parse(responseText);
              console.log("✅ FRONTEND Parsed as direct JSON:", parsedData);
            } catch (jsonError) {
              console.log("⚠️ FRONTEND Not valid JSON, trying Python dict format...");
              // Convert Python dict format to JSON
              const cleanedResponse = responseText.replace(/'/g, '"');
              parsedData = JSON.parse(cleanedResponse);
              console.log("✅ FRONTEND Parsed as Python dict:", parsedData);
            }
          }
          
          console.log("📊 FRONTEND Parsed data type:", typeof parsedData);
          console.log("📊 FRONTEND Parsed data keys:", Object.keys(parsedData));
          console.log("📊 FRONTEND Parsed data key count:", Object.keys(parsedData).length);
          
          // Log current extraction fields configuration
          console.log("🔍 FRONTEND Current extraction fields:", extractionFields);
          
          // Convert field mappings back to field names for display
          const displayData = {};
          extractionFields.forEach((field, index) => {
            const mappingKey = field.field_mapping;
            const displayKey = field.field_name;
            console.log(`🔄 FRONTEND Processing field ${index}: mapping='${mappingKey}' -> display='${displayKey}'`);
            
            if (parsedData.hasOwnProperty(mappingKey)) {
              displayData[displayKey] = parsedData[mappingKey];
              console.log(`✅ FRONTEND Found data: '${displayKey}' = '${parsedData[mappingKey]}'`);
            } else {
              console.log(`❌ FRONTEND Missing mapping key '${mappingKey}' in response`);
              console.log(`🔍 FRONTEND Available keys:`, Object.keys(parsedData));
            }
          });
          
          console.log("🔄 FRONTEND Converted to display format:", displayData);
          console.log("📊 FRONTEND Display data keys:", Object.keys(displayData));
          console.log("📊 FRONTEND Display data key count:", Object.keys(displayData).length);
          return displayData;
          
        } catch (parseError) {
          console.error("❌ Failed to parse response:", parseError);
          console.log("📄 Raw response was:", responseText);
          console.log("📏 Response length:", responseText.length);
          console.log("📋 Response first 100 chars:", responseText.substring(0, 100));
          
          // If all parsing fails, return as a simple text response
          return { extracted_text: responseText };
        }
      } else {
        const errorText = await response.text();
        console.error("❌ Asset extraction failed with status:", response.status, "Error:", errorText);
        return null;
      }
    } catch (error) {
      console.error("❌ Error extracting asset metadata:", error);
      return null;
    }
  };

  const loadPageWithData = async (pdfId, pageIndex, aiData) => {
    try {
      // Get the image for this page
      const pageData = await fetchPageImage(pdfId, pageIndex);
      
      // Update the image
      setImageResults(prev => {
        const updated = [...prev];
        updated[pageIndex] = pageData.image;
        return updated;
      });

      // Process AI metadata for this specific page
      let pageMetadata;
      if (aiData) {
        // Convert AI response format to our internal format
        pageMetadata = {
          type: 'drawing',
          title: aiData.drawing_title || '',
          drawingNumber: aiData.drawing_number || '',
          revisions: aiData.revision_history ? aiData.revision_history.map((rev, idx) => ({
            id: rev.revision_id || '',
            description: rev.revision_description || '',
            date: rev.revision_date || ''
          })) : [],
          isEdited: false,
          isAiGenerated: true
        };
      } else {
        // Fallback to dummy data
        pageMetadata = {
          type: 'drawing',
          title: ``,
          drawingNumber: ``,
          revisions: [],
          isEdited: false,
          isAiGenerated: false
        };
      }

      setMetadata(prev => {
        const updated = [...prev];
        updated[pageIndex] = pageMetadata;
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

      console.log(`✅ Page ${pageIndex + 1} loaded successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to load page ${pageIndex + 1}:`, error);
      
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
    }
  };

  const cleanupPdf = async () => {
    if (pdfInfo?.pdf_id) {
      try {
        await fetch(`http://127.0.0.1:8080/pdf/${pdfInfo.pdf_id}`, {
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

  const handleAssetFieldEdit = (index, fieldKey, value) => {
    const updatedMetadata = [...metadata];
    const currentItem = updatedMetadata[index];
    updatedMetadata[index] = {
      ...currentItem,
      fields: {
        ...currentItem.fields,
        [fieldKey]: value
      },
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
    setShowModelSelection(false);
    setSelectedModel(null);
  };

  const goToNextPage = () => {
    if (currentVisiblePage < imageResults.length - 1) {
      setCurrentVisiblePage(prev => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentVisiblePage > 0) {
      setCurrentVisiblePage(prev => prev - 1);
    }
  };

  const goToPage = (pageIndex) => {
    if (pageIndex >= 0 && pageIndex < imageResults.length) {
      setCurrentVisiblePage(pageIndex);
    }
  };

  return (
    <div className={`App ${imageResults.length > 0 ? 'with-images' : ''}`}>
      <div className={`container ${showFieldConfiguration ? 'field-config-mode' : ''}`}>
        {/* <div className="logo-container">
        </div> */}
        <h1><img src={logo} className="kahua-logo" style={{width: "66%", height: "66%"}} alt="Kahua Logo" /></h1>
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
              <p>Drag & drop your PDF or image here or</p>
            )}
            
            <button className="browse-button" onClick={handleBrowseClick}>
              {file ? 'Choose Different File' : 'Browse Files'}
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".pdf,application/pdf,.png,image/png,.jpg,.jpeg,image/jpeg" 
              style={{ display: 'none' }} 
            />
          </div>
        </div>
        
        {file && imageResults.length === 0 && !showModelSelection && (
          <div className="action-buttons">
            <button 
              className="upload-button" 
              onClick={() => uploadFileToAPI('drawing')}
              disabled={isUploading}
            >
              {isUploading ? 'Processing...' : 'Extract Metadata'}
            </button>
            <button className="clear-button" onClick={clearFile}>Clear</button>
          </div>
        )}

        {/* Model Selection UI */}
        {file && showModelSelection && !isUploading && (
          <div className="model-selection">
            <h2>Choose Processing Model</h2>
            <p>Select the type of extraction you want to perform on your {fileType === 'image' ? 'image' : 'PDF'}:</p>
            
            <div className="model-options">
              <div 
                className={`model-option ${selectedModel === 'drawing' ? 'selected' : ''} ${fileType === 'image' ? 'disabled' : ''}`}
                onClick={() => fileType !== 'image' && handleModelSelect('drawing')}
                style={{ opacity: fileType === 'image' ? 0.5 : 1, cursor: fileType === 'image' ? 'not-allowed' : 'pointer' }}
              >
                <div className="model-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <h3>Drawing Metadata</h3>
                <p>{fileType === 'image' ? 'Only available for PDF files' : 'Extract technical drawing information including titles, drawing numbers, and revision history.'}</p>
              </div>
              
              <div 
                className={`model-option ${selectedModel === 'asset' ? 'selected' : ''}`}
                onClick={() => handleModelSelect('asset')}
              >
                <div className="model-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </div>
                <h3>Asset Plate/Receipt</h3>
                <p>Extract asset information from plates, tags, and receipts including asset numbers and details.</p>
              </div>
            </div>
            
            <div className="model-selection-actions">
              <button 
                className="start-inference-button" 
                onClick={startInference}
                disabled={!selectedModel}
              >
                <span>Start Inference</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
              <button className="clear-button" onClick={clearFile}>Clear</button>
            </div>
          </div>
        )}

        {/* Field Configuration UI */}
        {file && showFieldConfiguration && !isUploading && (
          <div className="field-configuration">
            <h2>Configure Extraction Fields</h2>
            <p>Specify which fields you want to extract from your asset plate or receipt:</p>
            
            <div className="preset-fields">
              <h3>Quick Add Presets:</h3>
              <div className="preset-buttons">
                {['asset_number', 'model', 'serial_number', 'manufacturer', 'description', 'asset_type'].map(preset => (
                  <button 
                    key={preset}
                    className="preset-button"
                    onClick={() => addPresetField(preset)}
                  >
                    Add {preset.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            <div className="extraction-fields">
              <h3>Extraction Fields:</h3>
              {extractionFields.map((field, index) => (
                <div key={index} className="field-row">
                  <div className="field-inputs">
                    <div className="field-input-group">
                      <label>Field Name:</label>
                      <input
                        type="text"
                        value={field.field_name}
                        onChange={(e) => updateField(index, 'field_name', e.target.value)}
                        placeholder="e.g., asset_number"
                        className="field-input"
                      />
                    </div>
                    <div className="field-input-group">
                      <label>Field Type:</label>
                      <select
                        value={field.field_type}
                        onChange={(e) => updateField(index, 'field_type', e.target.value)}
                        className="field-select"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                    <div className="field-input-group">
                      <label>Field Mapping:</label>
                      <input
                        type="text"
                        value={field.field_mapping}
                        onChange={(e) => updateField(index, 'field_mapping', e.target.value)}
                        placeholder="e.g., asset_number_field"
                        className="field-input"
                      />
                    </div>
                  </div>
                  <button 
                    className="remove-field-button"
                    onClick={() => removeField(index)}
                    title="Remove field"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
              
              <button className="add-field-button" onClick={addField}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Custom Field
              </button>
            </div>

            <div className="field-configuration-actions">
              <button 
                className="start-extraction-button" 
                onClick={startAssetExtraction}
                disabled={extractionFields.length === 0}
              >
                <span>Start Extraction</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
              <button 
                className="back-button" 
                onClick={() => {
                  setShowFieldConfiguration(false);
                  setShowModelSelection(true);
                }}
              >
                Back
              </button>
              <button className="clear-button" onClick={clearFile}>Clear</button>
            </div>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {/* Action buttons for when images are loaded */}
        {imageResults.length > 0 && (
          <div className="loaded-state-actions">
            <button 
              className="upload-button" 
              onClick={() => uploadFileToAPI(selectedModel || 'drawing')}
              disabled={isUploading}
            >
              {isUploading ? 'Processing...' : 'Re-extract Metadata'}
            </button>
            <button className="clear-button" onClick={clearResults}>
              Clear Results
            </button>
          </div>
        )}
        
        {isUploading && pdfInfo && (
          <div className="loading-indicator" style={{
            marginTop: '2rem',
            textAlign: 'center'
          }}>
            {/* <p>Processing PDF: {pdfInfo.filename}</p> */}
            {/* <p>Pages loaded: {loadingProgress.loaded} of {loadingProgress.total}</p> */}
            {/* <div className="progress-bar" style={{
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
            </div> */}
            {/* <div className="spinner"></div> */}
          </div>
        )}
      </div>
      {imageResults.length > 0 && (
        <div className="image-results">
          {/* Remove the action buttons from here */}
          
          <div className="image-carousel" ref={carouselRef}>
            {/* Show only the current page */}
            {imageResults[currentVisiblePage] !== undefined && (
              <div className="image-container" data-page-index={currentVisiblePage}>
                {pageLoadingStates[currentVisiblePage] === true ? (
                  <div className="page-content-card">
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '3rem',
                      minHeight: '400px',
                      justifyContent: 'center'
                    }}>
                      <div className="spinner" style={{ marginBottom: '1rem' }}></div>
                      <p>Loading page {currentVisiblePage + 1}...</p>
                    </div>
                  </div>
                ) : pageLoadingStates[currentVisiblePage] === 'error' ? (
                  <div className="page-content-card">
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '3rem',
                      minHeight: '400px',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(231, 76, 60, 0.1)'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                      <p style={{ color: 'var(--danger)' }}>Failed to load page {currentVisiblePage + 1}</p>
                      <button 
                        className="small-button" 
                        onClick={() => {
                          setPageLoadingStates(prev => {
                            const updated = [...prev];
                            updated[currentVisiblePage] = true;
                            return updated;
                          });
                          fetchPageImage(pdfInfo.pdf_id, currentVisiblePage)
                            .then(pageData => {
                              setImageResults(prev => {
                                const updated = [...prev];
                                updated[currentVisiblePage] = pageData.image;
                                return updated;
                              });
                              setPageLoadingStates(prev => {
                                const updated = [...prev];
                                updated[currentVisiblePage] = false;
                                return updated;
                              });
                            })
                            .catch(() => {
                              setPageLoadingStates(prev => {
                                const updated = [...prev];
                                updated[currentVisiblePage] = 'error';
                                return updated;
                              });
                            });
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : imageResults[currentVisiblePage] ? (
                  <div className="page-content-card">
                    <div className="image-metadata-container">
                      <div className="image-section">
                        <div className="image-wrapper">
                          <img 
                            src={`data:image/png;base64,${imageResults[currentVisiblePage]}`} 
                            alt={`Page ${currentVisiblePage + 1}`}
                            loading="lazy"
                          />
                        </div>
                      </div>
                      
                      {metadata[currentVisiblePage] && (
                        <div className="metadata-section">
                          <div className="metadata-panel">
                            <div className="metadata-header">
                              <h3>
                                {metadata[currentVisiblePage]?.type === 'asset' ? 'Asset Information' : 'Drawing Metadata'}
                              </h3>
                              <div className="header-actions">
                                {metadata[currentVisiblePage]?.type === 'asset' && (
                                  <div className="status-badge">
                                    ✓ {metadata[currentVisiblePage]?.isAiGenerated ? 'AI Extracted' : 'Manual Entry'}
                                  </div>
                                )}
                                {editingIndex === currentVisiblePage ? (
                                  <button className="small-button" onClick={stopEditing}>Done</button>
                                ) : (
                                  <button className="small-button" onClick={() => startEditing(currentVisiblePage)}>Edit</button>
                                )}
                              </div>
                            </div>
                            
                            {metadata[currentVisiblePage]?.type === 'asset' ? (
                              <div className="metadata-content">
                                {Object.entries(metadata[currentVisiblePage]?.fields || {}).map(([key, value]) => (
                                  <div key={key} className="metadata-field">
                                    <label>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                                    {editingIndex === currentVisiblePage ? (
                                      <input
                                        type="text"
                                        value={value || ''}
                                        onChange={(e) => handleAssetFieldEdit(currentVisiblePage, key, e.target.value)}
                                        className="metadata-input"
                                        placeholder={`Enter ${key.replace(/_/g, ' ').toLowerCase()}...`}
                                      />
                                    ) : (
                                      <div className="metadata-value-container">
                                        <p className={metadata[currentVisiblePage]?.isEdited ? 'edited-value' : ''}>
                                          {value || 'Not detected'}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {(!metadata[currentVisiblePage]?.fields || Object.keys(metadata[currentVisiblePage].fields).length === 0) && (
                                  <div className="no-data-message">
                                    <p>No asset information was extracted from this image.</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="metadata-content">
                                <div className="metadata-field">
                                  <label>Title</label>
                                  {editingIndex === currentVisiblePage ? (
                                    <input
                                      type="text"
                                      value={metadata[currentVisiblePage]?.title || ''}
                                      onChange={(e) => handleMetadataEdit(currentVisiblePage, 'title', e.target.value)}
                                      className="metadata-input"
                                    />
                                  ) : (
                                    <div className="metadata-value-container">
                                      <p className={metadata[currentVisiblePage]?.isEdited ? 'edited-value' : ''}>
                                        {metadata[currentVisiblePage]?.title || ''}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="metadata-field">
                                  <label>Drawing Number</label>
                                  {editingIndex === currentVisiblePage ? (
                                    <input
                                      type="text"
                                      value={metadata[currentVisiblePage]?.drawingNumber || ''}
                                      onChange={(e) => handleMetadataEdit(currentVisiblePage, 'drawingNumber', e.target.value)}
                                      className="metadata-input"
                                    />
                                  ) : (
                                    <div className="metadata-value-container">
                                      <p className={metadata[currentVisiblePage]?.isEdited ? 'edited-value' : ''}>
                                        {metadata[currentVisiblePage]?.drawingNumber || ''}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="metadata-field">
                                  <label>Revisions</label>
                                  {editingIndex === currentVisiblePage ? (
                                    <div className="revision-table">
                                      <div className="revision-row">
                                        <div className="revision-cell table-header">ID</div>
                                        <div className="revision-cell table-header">Description</div>
                                        <div className="revision-cell table-header">Date</div>
                                        <div className="revision-cell table-header">Actions</div>
                                      </div>
                                      {metadata[currentVisiblePage].revisions.map((revision, revisionIndex) => (
                                        <div key={revisionIndex} className="revision-row">
                                          <div className="revision-cell">
                                            <input
                                              type="text"
                                              value={revision.id}
                                              onChange={(e) => handleRevisionEdit(currentVisiblePage, revisionIndex, 'id', e.target.value)}
                                              className="revision-input"
                                            />
                                          </div>
                                          <div className="revision-cell">
                                            <input
                                              type="text"
                                              value={revision.description}
                                              onChange={(e) => handleRevisionEdit(currentVisiblePage, revisionIndex, 'description', e.target.value)}
                                              className="revision-input"
                                            />
                                          </div>
                                          <div className="revision-cell">
                                            <input
                                              type="date"
                                              value={revision.date}
                                              onChange={(e) => handleRevisionEdit(currentVisiblePage, revisionIndex, 'date', e.target.value)}
                                              className="revision-input"
                                            />
                                          </div>
                                          <div className="revision-cell">
                                            <button 
                                              className="small-button" 
                                              style={{ backgroundColor: 'var(--danger)' }}
                                              onClick={() => removeRevisionRow(currentVisiblePage, revisionIndex)}
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                      <div className="revision-actions" style={{ marginTop: '0.5rem' }}>
                                        <button className="small-button" onClick={() => addRevisionRow(currentVisiblePage)}>Add Revision</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="revision-table">
                                      <div className="revision-row">
                                        <div className="revision-cell table-header">ID</div>
                                        <div className="revision-cell table-header">Description</div>
                                        <div className="revision-cell table-header">Date</div>
                                      </div>
                                      {metadata[currentVisiblePage].revisions.map((revision, revisionIndex) => (
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
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            
            {/* Navigation Controls */}
            {imageResults.length > 1 && (
              <div className="carousel-navigation">
                <button 
                  className="nav-arrow nav-arrow-left" 
                  onClick={goToPreviousPage}
                  disabled={currentVisiblePage === 0}
                  title="Previous page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                
                <button 
                  className="nav-arrow nav-arrow-right" 
                  onClick={goToNextPage}
                  disabled={currentVisiblePage === imageResults.length - 1}
                  title="Next page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            )}
          </div>
          
          {/* Floating Page Navigation */}
          {imageResults.filter(img => img !== null).length > 1 && (
            <div className="floating-page-nav">
              {/* <div className="page-nav-content"> */}
                {/* <span className="current-page-indicator">
                  Page {currentVisiblePage + 1} of {pdfInfo?.page_count || imageResults.length}
                </span> */}
                <div className="page-nav-buttons">
                  {/* <button 
                    className="nav-button" 
                    onClick={goToPreviousPage}
                    disabled={currentVisiblePage === 0}
                  >
                    ←
                  </button> */}
                  <select 
                    value={currentVisiblePage} 
                    onChange={(e) => goToPage(parseInt(e.target.value))}
                    className="page-select"
                  >
                    {imageResults.map((_, idx) => (
                      imageResults[idx] && (
                        <option key={idx} value={idx}>
                          Page {idx + 1} of {imageResults.length}
                        </option>
                      )
                    ))}
                  </select>
                  {/* <button 
                    className="nav-button" 
                    onClick={goToNextPage}
                    disabled={currentVisiblePage === imageResults.length - 1}
                  >
                    →
                  </button> */}
                </div>
              </div>
            // </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
