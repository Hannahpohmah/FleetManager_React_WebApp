//uploadsection.jsx
import React, { useState } from 'react';
import { FileSpreadsheet, CheckCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

const UploadSection = ({ setActiveTab, updateOptimizationResults }) => {
  const [uploadAccepted, setUploadAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingType, setUploadingType] = useState(null); // null, 'route', or 'optimizer'
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingSteps, setProcessingSteps] = useState([]);
  const [customerColumnName, setCustomerColumnName] = useState(null);
  const navigate = useNavigate();
  // API base URL - change this to match your Flask server address
  const API_BASE_URL = 'https://fleetmanager-react-webapp.onrender.com';


  // Customer column keywords - any column containing these words will be treated as customer data
  const CUSTOMER_KEYWORDS = ['customer', 'retailer', 'distributor'];

  const addProcessingStep = (step) => {
    console.log(`Processing step: ${step}`);
    setProcessingSteps(prev => [...prev, { step, timestamp: new Date().toISOString() }]);
    setProcessingStatus(step);
  };

  // Helper function to check if a column name contains any customer keywords
  const isCustomerColumn = (columnName) => {
    const normalizedCol = columnName.toLowerCase().trim();
    return CUSTOMER_KEYWORDS.some(keyword => normalizedCol.includes(keyword));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log(`File selected: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    setSelectedFile(file);
    setCustomerColumnName(null); // Reset customer column name

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log("File loaded into memory, parsing Excel data...");
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        console.log(`Excel workbook loaded. Sheets: ${workbook.SheetNames.join(', ')}`);
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        console.log(`Converted sheet to JSON. Found ${jsonData.length} rows`);
        
        // Validate file structure
        if (!jsonData || jsonData.length === 0) {
          console.error("Excel file is empty");
          setErrorMsg("Excel file is empty.");
          setUploadAccepted(false);
          return;
        }

        // Debug information
        const firstRow = jsonData[0];
        const availableColumns = Object.keys(firstRow);
        
        setDebugInfo({
          availableColumns,
          availableColumnsEncoded: availableColumns.map(col => 
            Array.from(col).map(c => c.charCodeAt(0).toString(16)).join(' ')
          ),
          rowCount: jsonData.length,
          firstRowData: firstRow
        });
        
        console.log("Available columns:", availableColumns);
        console.log("First row data:", firstRow);
        console.log("Column encodings:", availableColumns.map(col => 
          `${col}: ${Array.from(col).map(c => c.charCodeAt(0).toString(16)).join(' ')}`
        ));

        // Improved column validation - normalize by trimming whitespace and ignoring case
        const requiredColumns = ["Source", "Capacity", "Destination", "Demand"];
        const normalizedAvailableColumns = availableColumns.map(col => 
          col.trim().toLowerCase()
        );
        
        console.log("Normalized columns:", normalizedAvailableColumns);
        
        const missingColumns = requiredColumns.filter(reqCol => 
          !normalizedAvailableColumns.includes(reqCol.toLowerCase())
        );

        console.log("Missing columns (first check):", missingColumns);

        if (missingColumns.length > 0) {
          // Try a second approach - strip all non-alphabetic characters
          const alphaOnlyAvailable = availableColumns.map(col => 
            col.replace(/[^a-zA-Z]/g, '').toLowerCase()
          );
          
          console.log("Alpha-only columns:", alphaOnlyAvailable);
          
          const alphaOnlyMissing = requiredColumns.filter(reqCol => 
            !alphaOnlyAvailable.includes(reqCol.replace(/[^a-zA-Z]/g, '').toLowerCase())
          );
          
          console.log("Missing columns (second check):", alphaOnlyMissing);
          
          if (alphaOnlyMissing.length === 0) {
            // We found all columns when ignoring special characters
            console.log("Found all columns when ignoring special characters");
            // Continue as if all columns were found
          } else {
            console.error(`Missing required columns: ${missingColumns.join(", ")}`);
            setErrorMsg(`Excel file is missing the following required columns: ${missingColumns.join(", ")}`);
            setUploadAccepted(false);
            return;
          }
        }
        
        // Check for customer column (look for any column name containing customer keywords)
        const customerCol = availableColumns.find(col => isCustomerColumn(col));
        
        if (customerCol) {
          setCustomerColumnName(customerCol);
          console.log(`Customer column found: "${customerCol}" - will process customer data`);
          addProcessingStep(`Customer information column detected: "${customerCol}"`);
        } else {
          console.log("No customer column found - will proceed without customer data");
        }
        
        // Format is accepted
        console.log("File format validation passed");
        setUploadAccepted(true);
        setErrorMsg("");
      } catch (error) {
        console.error("Error processing file:", error);
        setErrorMsg(`Error processing file: ${error.message}. Please check the format.`);
        setUploadAccepted(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };


  
  const handleOptimization = (type) => {
    if (!selectedFile) {
      console.error("No file selected for optimization");
      setErrorMsg("No file selected. Please upload a file first.");
      return;
    }
    
    console.log(`Starting ${type} optimization with file: ${selectedFile.name}`);
    setUploadingType(type);
    setProcessingSteps([]);
    addProcessingStep(`Initializing ${type} process...`);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    // Add customer data processing information if a customer column was found
    if (customerColumnName) {
      formData.append('process_customer_data', 'true');
      formData.append('customer_column_name', customerColumnName);
      addProcessingStep(`Including customer data from column "${customerColumnName}"`);
    }
    
    console.log("FormData created with file and customer data settings");
    
    // Determine the API endpoint based on the optimization type
    let endpoint = '';
    if (type === 'route') {
      endpoint = '/api/find_route';
    } else if (type === 'optimizer') {
      endpoint = '/api/upload';
    }
    
    console.log(`Sending request to: ${API_BASE_URL}${endpoint}`);
    addProcessingStep(`Uploading file to server...`);
    
    // Get the authentication token from localStorage
    const token = localStorage.getItem('token');
    
    // Set up headers with authentication token
    const headers = {};
    if (token) {
      headers['x-auth-token'] = token;
    }
    
    // Use the full URL for the API request
    fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: formData,
    })
      .then(response => {
        console.log(`Received response with status: ${response.status}`);
        addProcessingStep(`Server response received (status: ${response.status})`);
        
        if (!response.ok) {
          return response.json().then(data => {
            console.error("Server returned error:", data);
            throw new Error(data.error || `HTTP error! Status: ${response.status}`);
          });
        }
        
        addProcessingStep(`Parsing server response...`);
        return response.json();
      })
      .then(data => {
        console.log('Detailed response structure:', JSON.stringify(data));
        
        if (type === 'route') {
          // Route finding returns a job ID that needs to be polled
          if (data.jobId) {
            addProcessingStep(`Route job submitted with ID: ${data.jobId}`);
            addProcessingStep(`Polling for results...`);
            
            // Store the job ID for polling
            sessionStorage.setItem('routeJobId', data.jobId);
            
            // Option 1: Redirect to a polling page that checks status
            setActiveTab('Route_Polling');
            
            // Option 2: Or start polling here until completion
            pollRouteStatus(data.jobId);
          } else {
            throw new Error("No job ID received from route optimization");
          }
        } else if (type === 'optimizer') {
          // Allocations come back directly
          addProcessingStep(`Processing optimization results...`);
          
          // Log allocation details if available
          if (data.allocations) {
            console.log(`Received ${data.allocations.length} allocations`);
            if (data.allocations.length > 0) {
              console.log("First allocation sample:", data.allocations[0]);
            }
            
            // Store results in sessionStorage/localStorage
            sessionStorage.setItem('optimizationResults', JSON.stringify(data));
            localStorage.setItem('optimizationResults', JSON.stringify(data));
            
            if (updateOptimizationResults) {
              updateOptimizationResults(data);
              console.log('Updated optimization results in parent component');
            }
            
            addProcessingStep(`Navigating to results view...`);
            setActiveTab('optimizer_result');
          } else {
            // The optimizer might also return a job ID for async processing
            if (data.jobId) {
              addProcessingStep(`Optimization job submitted with ID: ${data.jobId}`);
              sessionStorage.setItem('optimizerJobId', data.jobId);
              
              // Navigate to a polling page or start polling
              setActiveTab('Optimizer_Polling');
              // Or: pollOptimizerStatus(data.jobId);
            } else {
              throw new Error("No results or job ID received from optimization");
            }
          }
        }
      })
      .catch(error => {
        console.error('Error during optimization process:', error);
        addProcessingStep(`Error: ${error.message}`);
        setErrorMsg(`Error: ${error.message}`);
      })
      .finally(() => {
        console.log('Optimization process completed');
        setUploadingType(null);
      });
  };

  // Helper function to poll for route results
  const pollRouteStatus = (jobId) => {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['x-auth-token'] = token;
    }

    const checkStatus = () => {
      fetch(`${API_BASE_URL}/api/route_status/${jobId}`, {
        method: 'GET',
        headers: headers
      })
      .then(response => response.json())
      .then(data => {
        addProcessingStep(`Route status: ${data.status}`);
        
        if (data.status === 'completed') {
          // Log the structure before storing
          console.log('Storing completed route data:', JSON.stringify(data));
          
          // Process and store the completed results
          sessionStorage.setItem('routeResults', JSON.stringify(data));
          localStorage.setItem('routeResults', JSON.stringify(data));
          
          if (updateOptimizationResults) {
            updateOptimizationResults(data);
          }
          
          addProcessingStep(`Route processing complete`);
          setActiveTab('Route_Result');
        
        } else if (data.status === 'failed') {
          throw new Error(`Route processing failed: ${data.error || 'Unknown error'}`);
        } else {
          // Still processing, check again after delay
          setTimeout(checkStatus, 2000); // Poll every 2 seconds
        }
      })
      .catch(error => {
        console.error('Error polling route status:', error);
        addProcessingStep(`Error: ${error.message}`);
        setErrorMsg(`Error: ${error.message}`);
      });
    };

    // Start polling
    checkStatus();
  };

  return (
    <div className="w-full p-6 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-2">Upload Excel Data</h3>
          <p className="text-gray-500">
            Upload your Excel file containing the columns: Source, Capacity, Destination, and Demand.
          </p>
          <p className="text-gray-500 mt-1">
            <span className="font-medium">Optional:</span> Include a "Customer", "Retailer", or "Distributor" 
            column to track customer information at each destination.
          </p>
        </div>
        <label className="flex flex-col items-center px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <FileSpreadsheet size={48} className="text-gray-400 mb-4" />
          <span className="text-sm text-gray-500 mb-2">Drop Excel file here or click to upload</span>
          <span className="text-xs text-gray-400">Supported formats: .xlsx, .xls</span>
          <input 
            type="file" 
            className="hidden" 
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
          />
        </label>
        {errorMsg && <div className="text-red-500 mt-4">{errorMsg}</div>}
        
        {debugInfo && !uploadAccepted && (
          <div className="mt-4 p-4 bg-gray-50 rounded border">
            <h4 className="font-semibold mb-2">Debug Information</h4>
            <p className="text-sm">Found {debugInfo.rowCount} rows</p>
            <p className="text-sm">Available columns:</p>
            <ul className="text-xs list-disc pl-5">
              {debugInfo.availableColumns.map((col, idx) => (
                <li key={idx}>
                  "{col}" 
                  <span className="text-gray-400">({debugInfo.availableColumnsEncoded[idx]})</span>
                  {isCustomerColumn(col) && <span className="text-green-500 ml-1">(customer column)</span>}
                </li>
              ))}
            </ul>
            <p className="text-xs mt-2">
              First row data:
            </p>
            <pre className="text-xs mt-1 bg-gray-100 p-2 overflow-auto max-h-32">
              {JSON.stringify(debugInfo.firstRowData, null, 2)}
            </pre>
            <p className="text-xs mt-2">
              Required columns: Source, Capacity, Destination, Demand
            </p>
            <p className="text-xs">
              Optional columns: Any column containing "Customer", "Retailer", or "Distributor"
            </p>
            <button 
              onClick={forceAccept}
              className="mt-2 text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
            >
              Force Accept (Debug)
            </button>
          </div>
        )}
        
        {uploadAccepted && (
          <div className="mt-4 flex flex-col items-center">
            <CheckCircle size={64} className="text-green-500" />
            <div className="mt-2 text-green-600 font-semibold">File accepted!</div>
            {customerColumnName && (
              <div className="mt-1 text-blue-600">
                Customer information will be processed from "{customerColumnName}" column
              </div>
            )}
            <div className="mt-4 flex space-x-4">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
                onClick={() => handleOptimization('optimizer')}
                disabled={uploadingType !== null}
              >
                {uploadingType === 'optimizer' ? (
                  <span className="flex items-center">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Logistics Optimizer"
                )}
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
                onClick={() => handleOptimization('route')}
                disabled={uploadingType !== null}
              >
                {uploadingType === 'route' ? (
                  <span className="flex items-center">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Route Planner"
                )}
              </button>
            </div>
            
            {uploadingType && (
              <div className="mt-4 text-center w-full">
                <p className="text-blue-600">{processingStatus}</p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full animate-pulse w-full"></div>
                </div>
                
                {/* Processing steps log */}
                <div className="mt-4 w-full p-3 bg-gray-50 rounded border text-left">
                  <h4 className="font-semibold text-sm mb-2">Processing Log:</h4>
                  <div className="max-h-40 overflow-y-auto">
                    {processingSteps.map((item, idx) => (
                      <div key={idx} className="text-xs mb-1">
                        <span className="text-gray-500 mr-2">[{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                        <span>{item.step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadSection;