import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import axios from 'axios';

const FlippableHistoryPage = () => {
  const [showRouteHistory, setShowRouteHistory] = useState(true);
  const [routeHistory, setRouteHistory] = useState([]);
  const [optimizationHistory, setOptimizationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentRoutePage, setCurrentRoutePage] = useState(0);
  const [currentOptimizationPage, setCurrentOptimizationPage] = useState(0);
  const ITEMS_PER_PAGE = 3;

  useEffect(() => {
    const fetchHistoryData = async () => {
      try {
        setLoading(true);
        // Get auth token from localStorage
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers['x-auth-token'] = token;
        }
        
        // Use the correct API base URL for your environment
        const API_BASE_URL = 'https://fleetmanager-react-webapp.onrender.com';

        // Fetch data sequentially to better identify issues
        console.log('Fetching route history...');
        const routeResponse = await axios.get(`${API_BASE_URL}/api/route_history`, { headers });
        console.log('Route history data:', routeResponse.data);
        setRouteHistory(routeResponse.data);
        
        console.log('Fetching optimization history...');
        const optimizationResponse = await axios.get(`${API_BASE_URL}/api/optimization-history`, { headers });
        console.log('Optimization history data:', optimizationResponse.data);
        setOptimizationHistory(optimizationResponse.data);
        
        setError(null);
      } catch (err) {
        console.error('Failed to fetch history data:', err.response || err);
        setError(`Failed to load history data: ${err.response?.data?.message || err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const nextRoutePage = () => {
    if ((currentRoutePage + 1) * ITEMS_PER_PAGE < routeHistory.length) {
      setCurrentRoutePage(currentRoutePage + 1);
    }
  };
  
  const prevRoutePage = () => {
    if (currentRoutePage > 0) {
      setCurrentRoutePage(currentRoutePage - 1);
    }
  };
  
  const nextOptimizationPage = () => {
    if ((currentOptimizationPage + 1) * ITEMS_PER_PAGE < optimizationHistory.length) {
      setCurrentOptimizationPage(currentOptimizationPage + 1);
    }
  };
  
  const prevOptimizationPage = () => {
    if (currentOptimizationPage > 0) {
      setCurrentOptimizationPage(currentOptimizationPage - 1);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 30) {
      return formatDate(dateString);
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMins > 0) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else {
      return 'just now';
    }
  };

  const viewRouteDetails = (jobId) => {
    window.location.href = `/routes/details/${jobId}`;
  };

  const viewOptimizationDetails = (optimizationId) => {
    window.location.href = `/optimization/details/${optimizationId}`;
  };

  // Generate a friendly job name from the job ID
  const generateFriendlyJobName = (jobId, createdAt) => {
    if (!jobId) return "Unnamed Job";
    
    // Extract date component
    const date = new Date(createdAt);
    const month = date.toLocaleString('default', { month: 'short' });
    const day = date.getDate();
    
    // Get the first 4 characters of the job ID to make it identifiable but shorter
    const shortId = jobId.substring(0, 4);
    
    return `Job-${month}${day}-${shortId}`;
  };

  // Count routes and gather metrics from route results
  const getRouteInfo = (route) => {
    // Initialize counters and metrics
    let totalDistance = 0;
    let routeCount = 0;
    let uniqueDestinations = new Set();
    let uniqueSources = new Set();
    let uniqueCustomers = new Set();
    
    // Process results if they exist
    if (route.results && route.results.routes && Array.isArray(route.results.routes)) {
      // Count actual route objects in the results
      routeCount = route.results.routes.length;
      
      // Sum total distance and collect sources/destinations
      route.results.routes.forEach(r => {
        // Add distance
        totalDistance += r.distance || 0;
        
        // Count sources
        if (r.source) {
          uniqueSources.add(r.source);
        }
        
        // Count direct destinations
        if (r.destination) {
          uniqueDestinations.add(r.destination);
        }
        
        // Count array destinations
        if (r.destinations && Array.isArray(r.destinations)) {
          r.destinations.forEach(d => uniqueDestinations.add(d));
        }
      });
    }
    
    // Count customers if they exist
    if (route.customers && Array.isArray(route.customers)) {
      route.customers.forEach(c => {
        if (c.customer) {
          uniqueCustomers.add(c.customer);
        }
      });
    }
    
    // Format execution time
    let executionTimeText = '';
    if (route.executionTime) {
      executionTimeText = `${(route.executionTime / 1000).toFixed(2)} seconds`;
    }
    
    // Format total distance
    const formattedDistance = totalDistance > 0 
      ? `${(totalDistance / 1000).toFixed(2)} km` 
      : '';
    
    return {
      routeCount: routeCount || 0,
      sourceCount: uniqueSources.size || route.results?.sourceCount || 0,
      destinationCount: uniqueDestinations.size || route.results?.destinationCount || 0,
      executionTimeText,
      skippedPairs: route.skippedPairs || 0,
      customerCount: uniqueCustomers.size || (route.customers ? route.customers.length : 0),
      totalDistance: totalDistance,
      formattedDistance
    };
  };

  // Get optimization info with unique counts
  const getOptimizationInfo = (optimization) => {
    // Count unique sources and destinations from allocations
    const uniqueSources = new Set();
    const uniqueDestinations = new Set();
    const uniqueCustomers = new Set();
    
    // First check allocations data
    if (optimization.allocations && Array.isArray(optimization.allocations)) {
      optimization.allocations.forEach(allocation => {
        if (allocation.source) uniqueSources.add(allocation.source);
        if (allocation.destination) uniqueDestinations.add(allocation.destination);
        if (allocation.destination_customer) uniqueCustomers.add(allocation.destination_customer);
      });
    }
    
    // Also check destination_customer data for customer counting
    if (optimization.destination_customer && Array.isArray(optimization.destination_customer)) {
      optimization.destination_customer.forEach(item => {
        if (item.customer) uniqueCustomers.add(item.customer);
        if (item.destination) uniqueDestinations.add(item.destination);
      });
    }
    
    let executionTimeText = '';
    if (optimization.executionTimeMs) {
      executionTimeText = `${(optimization.executionTimeMs / 1000).toFixed(2)} seconds`;
    }
    
    return {
      sourceCount: uniqueSources.size || optimization.sourceCount || 0,
      destinationCount: uniqueDestinations.size || optimization.destinationCount || 0,
      allocationCount: optimization.allocations?.length || 0,
      customerCount: uniqueCustomers.size || 0,
      executionTimeText
    };
  };

  const flipPage = () => {
    setShowRouteHistory(!showRouteHistory);
  };

  const renderRouteHistory = () => {
    const startIndex = currentRoutePage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedRoutes = routeHistory.slice(startIndex, endIndex);
    
    return (
      <div className="space-y-4">
        {paginatedRoutes.length > 0 ? (
          paginatedRoutes.map((route) => {
            const { routeCount, formattedDistance, executionTimeText, skippedPairs, customerCount } = getRouteInfo(route);
            const friendlyJobName = generateFriendlyJobName(route.jobId, route.createdAt);
            
            return (
              <Card key={route.jobId} className="hover:shadow-md transition-shadow duration-200">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center">
                      <p className="font-medium">{friendlyJobName}</p>
                      <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                        route.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : route.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">Created: {formatDate(route.createdAt)}</p>
                    {route.completedAt && (
                      <p className="text-sm text-gray-500">
                        Completed: {formatDate(route.completedAt)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {routeCount} Route{routeCount !== 1 ? 's' : ''}
                      </span>
                      {formattedDistance && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          {formattedDistance} total
                        </span>
                      )}
                      {skippedPairs > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                          {skippedPairs} Skipped
                        </span>
                      )}
                      {customerCount > 0 && (
                        <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-full">
                          {customerCount} Customer{customerCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {executionTimeText && (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                          ({executionTimeText})
                        </span>
                      )}
                    </div>
                    {route.inputMethod && (
                      <span className="mt-1 block text-xs text-gray-500">
                        Input: {route.inputMethod.charAt(0).toUpperCase() + route.inputMethod.slice(1)}
                        {route.inputMethod === 'file' && route.fileUpload?.originalFilename && 
                          ` (${route.fileUpload.originalFilename})`}
                      </span>
                    )}
                  </div>
                  <button 
                    className="text-blue-600 text-sm font-medium hover:underline"
                    onClick={() => viewRouteDetails(route.jobId)}
                  >
                    View Details
                  </button>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-8 text-center">
            <p className="text-gray-500">No route history found.</p>
          </div>
        )}
        
        {paginatedRoutes.length > 0 && (
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1}-{Math.min(endIndex, routeHistory.length)} of {routeHistory.length}
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={prevRoutePage}
                disabled={currentRoutePage === 0}
                className={`px-3 py-1 rounded ${
                  currentRoutePage === 0 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Previous
              </button>
              <button 
                onClick={nextRoutePage}
                disabled={(currentRoutePage + 1) * ITEMS_PER_PAGE >= routeHistory.length}
                className={`px-3 py-1 rounded ${
                  (currentRoutePage + 1) * ITEMS_PER_PAGE >= routeHistory.length 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOptimizationHistory = () => {
    const startIndex = currentOptimizationPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedOptimizations = optimizationHistory.slice(startIndex, endIndex);
    
    return (
      <div className="space-y-4">
        {paginatedOptimizations.length > 0 ? (
          paginatedOptimizations.map((optimization) => {
            const { allocationCount, customerCount, executionTimeText } = 
              getOptimizationInfo(optimization);
            
            // Create friendly job identifier
            const friendlyJobName = generateFriendlyJobName(optimization.jobId, optimization.createdAt);
            
            return (
              <Card key={optimization.jobId} className="hover:shadow-md transition-shadow duration-200">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center">
                      <p className="font-medium">{friendlyJobName}</p>
                      <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                        optimization.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : optimization.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {optimization.status?.charAt(0).toUpperCase() + optimization.status?.slice(1) || 'Unknown'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-500">Created: {formatDate(optimization.createdAt)}</p>
                    {optimization.completedAt && (
                      <p className="text-sm text-gray-500">Completed: {formatDate(optimization.completedAt)}</p>
                    )}
                    
                    <div className="mt-2 flex flex-wrap gap-2">
                      {allocationCount > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                          {allocationCount} Allocation{allocationCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {customerCount > 0 && (
                        <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-full">
                          {customerCount} Customer{customerCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {executionTimeText && (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                          ({executionTimeText})
                        </span>
                      )}
                    </div>
                    
                    {/* Show sample customer data if available */}
                    {optimization.destination_customer && optimization.destination_customer.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium">Customer sample: </span>
                        {optimization.destination_customer.slice(0, 2).map((item, idx) => (
                          <span key={idx}>
                            {item.customer}{idx < Math.min(optimization.destination_customer.length, 2) - 1 ? ', ' : ''}
                          </span>
                        ))}
                        {optimization.destination_customer.length > 2 && '...'}
                      </div>
                    )}
                  </div>
                  <button 
                    className="text-blue-600 text-sm font-medium hover:underline"
                    onClick={() => viewOptimizationDetails(optimization.jobId)}
                  >
                    View Details
                  </button>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-8 text-center">
            <p className="text-gray-500">No optimization history found.</p>
          </div>
        )}
        
        {paginatedOptimizations.length > 0 && (
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1}-{Math.min(endIndex, optimizationHistory.length)} of {optimizationHistory.length}
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={prevOptimizationPage}
                disabled={currentOptimizationPage === 0}
                className={`px-3 py-1 rounded ${
                  currentOptimizationPage === 0 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Previous
              </button>
              <button 
                onClick={nextOptimizationPage}
                disabled={(currentOptimizationPage + 1) * ITEMS_PER_PAGE >= optimizationHistory.length}
                className={`px-3 py-1 rounded ${
                  (currentOptimizationPage + 1) * ITEMS_PER_PAGE >= optimizationHistory.length 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">
            {showRouteHistory ? 'Recent Route History' : 'Recent Allocation History'}
          </h3>
          <p className="text-gray-500">
            {showRouteHistory 
              ? `Showing route finding operations (${routeHistory.length} total)` 
              : `Showing fleet optimization operations (${optimizationHistory.length} total)`}
          </p>
        </div>
        <button
          onClick={flipPage}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Show {showRouteHistory ? 'Optimization' : 'Route'} History
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <p className="text-gray-500">Loading history data...</p>
        </div>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        <div className="perspective-1000">
          <div className={`relative transition-transform duration-800 ${showRouteHistory ? '' : 'rotate-y-180'}`}>
            <div className={`w-full ${!showRouteHistory && 'hidden'}`}>
              {renderRouteHistory()}
            </div>
            <div className={`w-full ${showRouteHistory && 'hidden'}`}>
              {renderOptimizationHistory()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlippableHistoryPage;