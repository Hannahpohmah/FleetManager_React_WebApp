import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import axios from 'axios';

// CSS-in-JS styling using object syntax
const styles = {
  flipContainer: {
    perspective: '1000px',
    width: '100%',
  },
  flipCard: {
    width: '100%',
    height: '100%',
    transition: 'transform 0.8s',
    transformStyle: 'preserve-3d',
  },
  flipped: {
    transform: 'rotateY(180deg)',
  },
  flipCardFront: {
    width: '100%',
    backfaceVisibility: 'hidden',
    transform: 'rotateY(0deg)',
  },
  flipCardBack: {
    width: '100%',
    backfaceVisibility: 'hidden',
    transform: 'rotateY(180deg)',
    position: 'absolute',
    top: 0,
    left: 0,
  }
};

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
    const API_BASE_URL = 'http://localhost:5000';
    
    const fetchHistoryData = async () => {
      try {
        setLoading(true);
        // Get auth token from localStorage
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers['x-auth-token'] = token;
        }
        
        // Fetch both route history and optimization history in parallel
        const [routeResponse, optimizationResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/route_history`, { headers }),
          axios.get(`${API_BASE_URL}/api/optimization-history`, { headers })
        ]);
        
        setRouteHistory(routeResponse.data);
        setOptimizationHistory(optimizationResponse.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch history data:', err);
        setError('Failed to load history data. Please try again later.');
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
      day: 'numeric' 
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

  const getRouteInfo = (route) => {
    const pairCount = route.pairCount || 
      (route.sources && route.destinations ? 
        Math.min(route.sources.length, route.destinations.length) : 0);
    
    let executionTimeText = '';
    if (route.executionTime) {
      executionTimeText = ` (${typeof route.executionTime === 'string' ? 
        route.executionTime : 
        `${(route.executionTime / 1000).toFixed(2)} seconds`})`;
    }
    
    return {
      pairCount,
      executionTimeText
    };
  };

  const getOptimizationInfo = (optimization) => {
    const vehicleCount = optimization.vehicles?.length || 0;
    const locationCount = optimization.locations?.length || 0;
    
    let executionTimeText = '';
    if (optimization.executionTime) {
      executionTimeText = ` (${typeof optimization.executionTime === 'string' ? 
        optimization.executionTime : 
        `${(optimization.executionTime / 1000).toFixed(2)} seconds`})`;
    }
    
    return {
      vehicleCount,
      locationCount,
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
        {paginatedRoutes.map((route) => {
          const { pairCount, executionTimeText } = getRouteInfo(route);
          return (
            <Card key={route.jobId} className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">Job ID: {route.jobId.substring(0, 8)}...</p>
                  <p className="text-sm text-gray-500">Created {formatTimeAgo(route.createdAt)}</p>
                  <p className="text-sm text-gray-500">
                    {route.completedAt ? `Completed ${formatTimeAgo(route.completedAt)}` : 'In progress'}
                  </p>
                  <div className="mt-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {pairCount} Routes{executionTimeText}
                    </span>
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
        })}
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
      </div>
    );
  };

  const renderOptimizationHistory = () => {
    const startIndex = currentOptimizationPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedOptimizations = optimizationHistory.slice(startIndex, endIndex);
    
    return (
      <div className="space-y-4">
        {paginatedOptimizations.map((optimization) => {
          const { vehicleCount, locationCount, executionTimeText } = getOptimizationInfo(optimization);
          return (
            <Card key={optimization._id} className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">Optimization ID: {optimization._id.substring(0, 8)}...</p>
                  <p className="text-sm text-gray-500">Created {formatTimeAgo(optimization.createdAt)}</p>
                  <p className="text-sm text-gray-500">
                    {optimization.completedAt ? `Completed ${formatTimeAgo(optimization.completedAt)}` : 'In progress'}
                  </p>
                  <div className="mt-2">
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                      {vehicleCount} Vehicles
                    </span>
                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                      {locationCount} Locations{executionTimeText}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                      optimization.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : optimization.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {optimization.status.charAt(0).toUpperCase() + optimization.status.slice(1)}
                    </span>
                  </div>
                </div>
                <button 
                  className="text-blue-600 text-sm font-medium hover:underline"
                  onClick={() => viewOptimizationDetails(optimization._id)}
                >
                  View Details
                </button>
              </CardContent>
            </Card>
          );
        })}
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
      ) : showRouteHistory && routeHistory.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-500">No route history found.</p>
        </div>
      ) : !showRouteHistory && optimizationHistory.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-500">No optimization history found.</p>
        </div>
      ) : (
        <div style={styles.flipContainer}>
          <div style={{
            ...styles.flipCard,
            ...(showRouteHistory ? {} : styles.flipped)
          }}>
            <div style={styles.flipCardFront}>
              {renderRouteHistory()}
            </div>
            <div style={styles.flipCardBack}>
              {renderOptimizationHistory()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlippableHistoryPage;
