//components/optimizer_results.jsx
import React, { useState, useEffect, useContext } from 'react';
import { ArrowLeftRight, TruckIcon, PackageCheck, BarChart3, Download, ArrowLeft, MapPin } from 'lucide-react';
import { OptimizationContext } from '../App'; // Update the path as needed
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import LogisticsFlowVisualization from './LogisticsFlowVisualization';
import { Button } from '@/components/ui/button';

const OptimizerResults = ({ setActiveTab }) => {
  const [allocationData, setAllocationData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showVisualization, setShowVisualization] = useState(false);
  const [findingRoutes, setFindingRoutes] = useState(false);
  const [routeProcessingSteps, setRouteProcessingSteps] = useState([]);
  
  // Access the optimization results from context
  // Change this line in OptimizerResults
  const { optimizationResults, updateOptimizationResults } = useContext(OptimizationContext) || {};
  
  // API base URL - change this to match your Flask server address
  const API_BASE_URL = 'http://localhost:5000';
  
  // Reference to the results container for PDF generation
  const resultsRef = React.createRef();

  const handleGoBack = () => {
    // Clear optimization results if updateOptimizationResults exists
    if (updateOptimizationResults) {
      updateOptimizationResults(null);
    }
    
    // Clear from storage
    sessionStorage.removeItem('optimizationResults');
    localStorage.removeItem('optimizationResults');
    
    // Reset component state
    setAllocationData([]);
    setSummary({});
    
    // Navigate back to upload section
    setActiveTab('upload');
  };

  const addRouteProcessingStep = (step) => {
    console.log(`Route processing step: ${step}`);
    setRouteProcessingSteps(prev => [...prev, { step, timestamp: new Date().toISOString() }]);
  };
  
  // Function to request route optimization
  const requestRouteOptimization = async () => {
    if (!allocationData || allocationData.length === 0) {
      setError('No allocation data available for route optimization.');
      return;
    }
    
    setFindingRoutes(true);
    addRouteProcessingStep('Preparing data for route optimization...');
    
    try {
      // Get the optimization job ID from stored optimization results
      let optimizationJobId;
      
      // Try to extract the job ID from various sources
      if (optimizationResults && optimizationResults.jobId) {
        optimizationJobId = optimizationResults.jobId;
      } else {
        // If not available directly, fetch from the server using the optimization history endpoint
        addRouteProcessingStep('Retrieving optimization job ID...');
        
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('Authentication token not found. Please log in again.');
        }
        
        // First try to get the latest optimization job ID from the history
        const historyResponse = await fetch(`${API_BASE_URL}/api/optimization-history`, {
          method: 'GET',
          headers: {
            'x-auth-token': token
          }
        });
        
        if (!historyResponse.ok) {
          throw new Error(`Failed to retrieve optimization history: ${historyResponse.statusText}`);
        }
        
        const historyData = await historyResponse.json();
        
        if (historyData && historyData.length > 0) {
          // Use the most recent optimization job ID
          optimizationJobId = historyData[0].jobId;
          addRouteProcessingStep(`Found optimization job ID: ${optimizationJobId}`);
        } else {
          throw new Error('No optimization history found. Please run an optimization first.');
        }
      }
      
      // Create the payload for the route API, including the optimization job ID
      const routeData = {
        routes: allocationData.map(item => ({
          source: item.source,
          destination: item.destination
        })),
        optimizationJobId: optimizationJobId // Include the optimization job ID
      };
      
      console.log('Sending route optimization request with data:', routeData);
      addRouteProcessingStep('Sending route request to server...');
      
      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');
      
      // Set up headers
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['x-auth-token'] = token;
      }
      
      // Send request to the find_route API
      fetch(`${API_BASE_URL}/api/find_route`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(routeData)
      })
      .then(response => {
        console.log(`Received route response with status: ${response.status}`);
        addRouteProcessingStep(`Server response received (status: ${response.status})`);
        
        if (!response.ok) {
          return response.json().then(data => {
            console.error("Server returned error:", data);
            throw new Error(data.error || `HTTP error! Status: ${response.status}`);
          });
        }
        
        return response.json();
      })
      .then(data => {
        console.log('Route API response:', data);
        
        if (data.jobId) {
          addRouteProcessingStep(`Route job submitted with ID: ${data.jobId}`);
          addRouteProcessingStep('Polling for results...');
          
          // Store the job ID for polling
          sessionStorage.setItem('routeJobId', data.jobId);
          
          // Start polling for results
          pollRouteStatus(data.jobId);
        } else if (data.routes) {
          // If we get immediate results
          addRouteProcessingStep('Route processing complete');
          handleRouteResults(data);
        } else {
          throw new Error("Invalid response from route API");
        }
      })
      .catch(error => {
        console.error('Error during route optimization:', error);
        addRouteProcessingStep(`Error: ${error.message}`);
        setError(`Route optimization error: ${error.message}`);
        setFindingRoutes(false);
      });
    } catch (error) {
      console.error('Error retrieving optimization job ID:', error);
      addRouteProcessingStep(`Error: ${error.message}`);
      setError(`Route optimization error: ${error.message}`);
      setFindingRoutes(false);
    }
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
        addRouteProcessingStep(`Route status: ${data.status}`);
        
        if (data.status === 'completed') {
          // Log the structure before storing
          console.log('Storing completed route data:', JSON.stringify(data));
          
          // Process and store the completed results
          handleRouteResults(data);
        } else if (data.status === 'failed') {
          throw new Error(`Route processing failed: ${data.error || 'Unknown error'}`);
        } else {
          // Still processing, check again after delay
          setTimeout(checkStatus, 2000); // Poll every 2 seconds
        }
      })
      .catch(error => {
        console.error('Error polling route status:', error);
        addRouteProcessingStep(`Error: ${error.message}`);
        setError(`Error checking route status: ${error.message}`);
        setFindingRoutes(false);
      });
    };

    // Start polling
    checkStatus();
  };
  
  // Handle successful route results
  const handleRouteResults = (data) => {
    // Store results in sessionStorage and localStorage
    sessionStorage.setItem('routeResults', JSON.stringify(data));
    localStorage.setItem('routeResults', JSON.stringify(data));
    
    addRouteProcessingStep('Route processing complete');
    addRouteProcessingStep('Redirecting to route results page...');
    
    // Redirect to route results page
    setActiveTab('Route_Result');
    setFindingRoutes(false);
  };
  
  const calculateSummary = (allocations) => {
    // Extract unique sources and destinations
    const sources = [...new Set(allocations.map(item => item.source))];
    const destinations = [...new Set(allocations.map(item => item.destination))];
    const customers = [...new Set(allocations.filter(item => item.destination_customer).map(item => item.destination_customer))];
    
    // Calculate total quantity moved
    const totalQuantity = allocations.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate quantity per source
    const sourceStats = sources.map(source => {
      const sourceAllocations = allocations.filter(item => item.source === source);
      const totalSourceQuantity = sourceAllocations.reduce((sum, item) => sum + item.quantity, 0);
      const destinationCount = new Set(sourceAllocations.map(item => item.destination)).size;
      const customerCount = new Set(sourceAllocations.filter(item => item.destination_customer).map(item => item.destination_customer)).size;
      
      return {
        source,
        totalQuantity: totalSourceQuantity,
        destinationCount,
        customerCount,
        percentOfTotal: ((totalSourceQuantity / totalQuantity) * 100).toFixed(1)
      };
    });
    
    // Calculate quantity per destination
    const destinationStats = destinations.map(destination => {
      const destAllocations = allocations.filter(item => item.destination === destination);
      const totalDestQuantity = destAllocations.reduce((sum, item) => sum + item.quantity, 0);
      const sourceCount = new Set(destAllocations.map(item => item.source)).size;
      const customer = destAllocations[0]?.destination_customer || 'Unknown';
      
      return {
        destination,
        customer,
        totalQuantity: totalDestQuantity,
        sourceCount,
        percentOfTotal: ((totalDestQuantity / totalQuantity) * 100).toFixed(1)
      };
    });
    
    // Calculate quantity per customer
    const customerStats = customers.map(customer => {
      const customerAllocations = allocations.filter(item => item.destination_customer === customer);
      const totalCustomerQuantity = customerAllocations.reduce((sum, item) => sum + item.quantity, 0);
      const sourceCount = new Set(customerAllocations.map(item => item.source)).size;
      const destinationCount = new Set(customerAllocations.map(item => item.destination)).size;
      
      return {
        customer,
        totalQuantity: totalCustomerQuantity,
        sourceCount,
        destinationCount,
        percentOfTotal: ((totalCustomerQuantity / totalQuantity) * 100).toFixed(1)
      };
    });
    
    return {
      totalAllocations: allocations.length,
      totalQuantity,
      sourceCount: sources.length,
      destinationCount: destinations.length,
      customerCount: customers.length,
      sourceStats: sourceStats.sort((a, b) => b.totalQuantity - a.totalQuantity),
      destinationStats: destinationStats.sort((a, b) => b.totalQuantity - a.totalQuantity),
      customerStats: customerStats.sort((a, b) => b.totalQuantity - a.totalQuantity)
    };
  };
  
  
  useEffect(() => {
    // Try to get results from context first, then fall back to sessionStorage
    fetchResults();
  }, [optimizationResults]); // Re-run when optimizationResults change
  
  const fetchResults = () => {
    try {
      setLoading(true);
      
      // First check if we have results from context
      let resultsData = optimizationResults;
      console.log('Context results:', resultsData);
      
      // If not, try to get from sessionStorage as fallback
      if (!resultsData || Object.keys(resultsData).length === 0) {
        const storedResults = sessionStorage.getItem('optimizationResults');
        if (storedResults) {
          try {
            resultsData = JSON.parse(storedResults);
            console.log('SessionStorage results:', resultsData);
          } catch (e) {
            console.error('Failed to parse sessionStorage data:', e);
          }
        }
      }
      
      // Also check localStorage as another fallback
      if (!resultsData || Object.keys(resultsData).length === 0) {
        const localResults = localStorage.getItem('optimizationResults');
        if (localResults) {
          try {
            resultsData = JSON.parse(localResults);
            console.log('LocalStorage results:', resultsData);
          } catch (e) {
            console.error('Failed to parse localStorage data:', e);
          }
        }
      }
      
      if (!resultsData) {
        setError('No optimization results found. Please run the optimizer again.');
        setLoading(false);
        return;
      }
      
      console.log('Processing resultsData:', resultsData);
      
      // Create a standard format for the data, handling all possible structures
      let allocations = null;
      
      if (resultsData.allocations && Array.isArray(resultsData.allocations)) {
        allocations = resultsData.allocations;
        console.log('Found allocations property:', allocations.length);
      } else if (Array.isArray(resultsData)) {
        allocations = resultsData;
        console.log('ResultsData is an array:', allocations.length);
      } else if (typeof resultsData === 'object') {
        // Log all top-level properties to help debugging
        console.log('ResultsData properties:', Object.keys(resultsData));
        
        // Try to extract any array property that might contain allocations
        const possibleArrayProps = Object.keys(resultsData)
          .filter(key => Array.isArray(resultsData[key]) && resultsData[key].length > 0);
        
        console.log('Possible array properties:', possibleArrayProps);
        
        if (possibleArrayProps.length > 0) {
          // Use the first array property found
          allocations = resultsData[possibleArrayProps[0]];
          console.log(`Found allocation data in property: ${possibleArrayProps[0]}`, allocations.length);
        } else {
          // Look for nested objects that might contain the allocations array
          for (const key of Object.keys(resultsData)) {
            if (typeof resultsData[key] === 'object' && resultsData[key] !== null) {
              console.log(`Checking nested object: ${key}`);
              if (resultsData[key].allocations && Array.isArray(resultsData[key].allocations)) {
                allocations = resultsData[key].allocations;
                console.log(`Found allocations in nested object ${key}:`, allocations.length);
                break;
              }
              
              // Look for array properties in the nested object
              const nestedArrayProps = Object.keys(resultsData[key])
                .filter(nestedKey => Array.isArray(resultsData[key][nestedKey]) && resultsData[key][nestedKey].length > 0);
              
              if (nestedArrayProps.length > 0) {
                allocations = resultsData[key][nestedArrayProps[0]];
                console.log(`Found allocations in nested array property ${key}.${nestedArrayProps[0]}:`, allocations.length);
                break;
              }
            }
          }
        }
      }
      
      // Validate allocation data structure (should have source, destination, quantity)
      if (allocations && allocations.length > 0) {
        console.log('First allocation entry:', allocations[0]);
        
        // Check for valid format properties
        const isValidFormat = allocations.every(item => 
          item.source !== undefined && 
          item.destination !== undefined && 
          item.quantity !== undefined
        );
        
        if (!isValidFormat) {
          console.warn('Allocation data found but in incorrect format:', allocations[0]);
          // Try to adapt the data format if possible
          const adaptedAllocations = allocations.map(item => {
            // Look for alternative property names
            const source = item.source || item.from || item.origin || item.src || '';
            const destination = item.destination || item.to || item.dest || item.dst || '';
            const quantity = parseFloat(item.quantity || item.amount || item.value || item.qty || 0);
            const destination_customer = item.destination_customer || item.customer || item.client || '';
            
            return { source, destination, quantity, destination_customer };
          });
          
          // Check if adaptation was successful
          const adaptedValid = adaptedAllocations.every(item => 
            item.source && item.destination && !isNaN(item.quantity)
          );
          
          if (adaptedValid) {
            console.log('Successfully adapted allocations to correct format');
            allocations = adaptedAllocations;
          } else {
            console.error('Failed to adapt allocations to correct format');
            setError('Allocation data found but could not be formatted correctly. Please check your input data.');
            setLoading(false);
            return;
          }
        }
        
        setAllocationData(allocations);
        const summaryStats = calculateSummary(allocations);
        setSummary(summaryStats);
        setError(null);
      } else {
        console.error('No allocation array found in results data');
        setError('No allocation data found in the optimization results. Please try running the optimizer again or check the format of your input data.');
      }
    } catch (err) {
      console.error('Error processing optimization results:', err);
      setError('Failed to load optimization results: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to generate and download PDF
  const downloadPDF = async () => {
    if (!resultsRef.current) return;
    
    try {
      setDownloading(true);
      
      const content = resultsRef.current;
      const canvas = await html2canvas(content, {
        scale: 1,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      
      // Add title to PDF
      pdf.setFontSize(16);
      pdf.text('Logistics Optimization Results', pdfWidth / 2, 15, { align: 'center' });
      pdf.setFontSize(10);
      
      // Add timestamp
      const timestamp = new Date().toLocaleString();
      pdf.text(`Generated: ${timestamp}`, pdfWidth / 2, 22, { align: 'center' });
      
      // Add image of the results
      pdf.addImage(imgData, 'PNG', imgX, 30, imgWidth * ratio, imgHeight * ratio);
      
      // Check if we need multiple pages
      if (imgHeight * ratio > pdfHeight - 40) {
        let heightLeft = imgHeight * ratio;
        let position = 30; // Initial position
        
        // Remove the first image that was added (we'll re-add it properly)
        pdf.deletePage(1);
        pdf.addPage();
        
        // Add title to first page
        pdf.setFontSize(16);
        pdf.text('Logistics Optimization Results', pdfWidth / 2, 15, { align: 'center' });
        pdf.setFontSize(10);
        pdf.text(`Generated: ${timestamp}`, pdfWidth / 2, 22, { align: 'center' });
        
        heightLeft = imgHeight * ratio;
        let page = 1;
        
        // Add the image in chunks across multiple pages if needed
        while (heightLeft > 0) {
          position = heightLeft - imgHeight * ratio;
          pdf.addImage(imgData, 'PNG', imgX, position + 30, imgWidth * ratio, imgHeight * ratio);
          heightLeft -= (pdfHeight - 40);
          
          if (heightLeft > 0) {
            pdf.addPage();
            page++;
            pdf.setFontSize(8);
            pdf.text(`Page ${page}`, pdfWidth - 20, pdfHeight - 10);
          }
        }
      }
      
      // Save the PDF
      pdf.save('logistics-optimization-results.pdf');
      
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading optimization results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-700 mb-2">Error Loading Results</h3>
        <p className="text-red-600">{error}</p>
        <p className="mt-4 text-gray-600">Please try running the optimizer again or check the format of your input data.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Back button */}
      <div className="mb-6">
        <Button 
          variant="outline" 
          className="flex items-center gap-2" 
          onClick={handleGoBack}
        >
          <ArrowLeft size={16} />
          Back to Upload
        </Button>
      </div>
    <div className="w-full p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Optimization Results</h2>
          <p className="text-gray-600">
            The logistics optimizer has generated the optimal allocation plan to minimize transportation costs.
          </p>
        </div>
        
        <div className="flex gap-3">
          {/* Find Routes Button */}
          <Button
            onClick={requestRouteOptimization}
            disabled={findingRoutes || allocationData.length === 0}
            className="flex items-center px-6 py-10 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
          >
            {findingRoutes ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                Finding Routes...
              </>
            ) : (
              <>
                <MapPin size={37} className="mr-2" />
                Find Best Routes
              </>
            )}
          </Button>
          
          {/* Download PDF Button */}
          <Button
            onClick={downloadPDF}
            disabled={downloading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {downloading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                Generating PDF...
              </>
            ) : (
              <>
                <Download size={18} className="mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Route Finding Status */}
      {findingRoutes && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-700 mb-2">Finding Best Routes</h3>
          <p className="text-green-600 mb-2">Planning optimal routes between {summary.sourceCount} sources and {summary.destinationCount} destinations...</p>
          <div className="text-sm text-green-500">
            {routeProcessingSteps.map((step, index) => (
              <div key={index} className="mb-1">
                <span className="font-medium">{new Date(step.timestamp).toLocaleTimeString()}: </span>
                {step.step}
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={resultsRef}>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-center mb-2">
              <TruckIcon size={20} className="text-blue-500 mr-2" />
              <h3 className="font-semibold">Total Shipments</h3>
            </div>
            <div className="text-2xl font-bold">{summary.totalAllocations}</div>
            <div className="text-sm text-gray-500">Optimized delivery paths</div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <div className="flex items-center mb-2">
              <PackageCheck size={20} className="text-green-500 mr-2" />
              <h3 className="font-semibold">Total Quantity</h3>
            </div>
            <div className="text-2xl font-bold">{summary.totalQuantity}</div>
            <div className="text-sm text-gray-500">Units allocated</div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <div className="flex items-center mb-2">
              <BarChart3 size={20} className="text-purple-500 mr-2" />
              <h3 className="font-semibold">Sources</h3>
            </div>
            <div className="text-2xl font-bold">{summary.sourceCount}</div>
            <div className="text-sm text-gray-500">Supply locations</div>
          </div>
          
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
            <div className="flex items-center mb-2">
              <ArrowLeftRight size={20} className="text-amber-500 mr-2" />
              <h3 className="font-semibold">Destinations</h3>
            </div>
            <div className="text-2xl font-bold">{summary.destinationCount}</div>
            <div className="text-sm text-gray-500">Demand locations</div>
          </div>
        </div>

        {/* Allocations Table */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Allocation Plan</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left border-b">Source</th>
                  <th className="py-3 px-4 text-left border-b">Destination</th>
                  <th className="py-3 px-4 text-left border-b">Customer</th>
                  <th className="py-3 px-4 text-right border-b">Quantity</th>
                  <th className="py-3 px-4 text-right border-b">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {allocationData.map((allocation, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-3 px-4 border-b">{allocation.source}</td>
                    <td className="py-3 px-4 border-b">{allocation.destination}</td>
                    <td className="py-3 px-4 border-b">{allocation.destination_customer || 'Unknown'}</td>
                    <td className="py-3 px-4 text-right border-b font-medium">{allocation.quantity}</td>
                    <td className="py-3 px-4 text-right border-b">
                      {((allocation.quantity / summary.totalQuantity) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribution Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Source Statistics */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Source Distribution</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left border-b">Source</th>
                    <th className="py-3 px-4 text-right border-b">Quantity</th>
                    <th className="py-3 px-4 text-right border-b">Destinations</th>
                    <th className="py-3 px-4 text-right border-b">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sourceStats && summary.sourceStats.map((stat, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-4 border-b">{stat.source}</td>
                      <td className="py-3 px-4 text-right border-b font-medium">{stat.totalQuantity}</td>
                      <td className="py-3 px-4 text-right border-b">{stat.destinationCount}</td>
                     <td className="py-3 px-4 text-right border-b">{stat.percentOfTotal}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        {/* Destination Statistics */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Destination Distribution</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left border-b">Destination</th>
                  <th className="py-3 px-4 text-right border-b">Quantity</th>
                  <th className="py-3 px-4 text-right border-b">Sources</th>
                  <th className="py-3 px-4 text-right border-b">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.destinationStats && summary.destinationStats.map((stat, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-3 px-4 border-b">{stat.destination}</td>
                    <td className="py-3 px-4 text-right border-b font-medium">{stat.totalQuantity}</td>
                    <td className="py-3 px-4 text-right border-b">{stat.sourceCount}</td>
                    <td className="py-3 px-4 text-right border-b">{stat.percentOfTotal}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Visualization Placeholder - You could add charts here in the future */}
      {/* Visualization with toggle */}
      {/* Button to toggle visualization modal */}
      <div className="mt-8 text-center">
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => setShowVisualization(true)}
        >
          View Network Flow Visualization
        </button>
      </div>

      {/* Modal - add this outside the results ref if you don't want it in PDF */}
      {showVisualization && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Allocation Visualization</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowVisualization(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <LogisticsFlowVisualization 
                allocationData={allocationData}
                summary={summary}
              />
            </div>
          </div>
        </div>
      )}
    </div>
    
    {/* Footer with download timestamp */}
    <div className="mt-6 text-sm text-gray-500 text-right">
      {downloading ? 'Generating PDF...' : `Results ready for download • Last updated: ${new Date().toLocaleString()}`}
    </div>
    </div>
    </div>
  );
};

export default OptimizerResults;