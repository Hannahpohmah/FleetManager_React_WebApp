import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Navigation } from 'lucide-react';
import RouteMap from './routemap'; // Import the new RouteMap component

const RouteResults = ({ setActiveTab, optimizationResults }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMap, setShowMap] = useState(true);
  
  useEffect(() => {
    loadRouteData();
    // Add Leaflet CSS and JS
    loadLeaflet();
  }, [optimizationResults]);

  // Load Leaflet dynamically
  const loadLeaflet = () => {
    if (window.L) return; // Skip if already loaded
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
    document.head.appendChild(link);
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const loadRouteData = () => {
    // ... [Your existing loadRouteData function remains unchanged]
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Find the results data from all possible sources
      const resultsData = findResultsData();
      
      console.log('Route resultsData found:', resultsData);
      
      if (!resultsData) {
        setError('No route results found. Please run the route finder again.');
        setLoading(false);
        return;
      }
      
      // Step 2: Extract routes from the results data
      const routesData = extractRoutesData(resultsData);
      
      if (!routesData || routesData.length === 0) {
        setError('No valid routes found in the results. Please try again.');
        setLoading(false);
        return;
      }
      
      console.log('Successfully extracted routes data:', routesData.length);
      
      // Step 3: Normalize the routes data
      const normalizedRoutes = normalizeRoutesData(routesData);
      console.log('Normalized routes:', normalizedRoutes);
      setRoutes(normalizedRoutes);
    } catch (err) {
      console.error('Error processing route results:', err);
      setError('Failed to load route results: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // [All your existing helper functions remain unchanged]
  // findResultsData, extractRoutesData, hasRouteProperties, normalizeRoutesData, etc.

  const findResultsData = () => {
    console.log('Searching for route results data...');
    
    // First check specific route results sources
    try {
      const routeResults = sessionStorage.getItem('routeResults');
      if (routeResults) {
        const parsedRouteResults = JSON.parse(routeResults);
        if (parsedRouteResults && Object.keys(parsedRouteResults).length > 0) {
          console.log('Using route results from sessionStorage:', parsedRouteResults);
          return parsedRouteResults;
        }
      }
      
      const localRouteResults = localStorage.getItem('routeResults');
      if (localRouteResults) {
        const parsedLocalRouteResults = JSON.parse(localRouteResults);
        if (parsedLocalRouteResults && Object.keys(parsedLocalRouteResults).length > 0) {
          console.log('Using route results from localStorage:', parsedLocalRouteResults);
          return parsedLocalRouteResults;
        }
      }
    } catch (e) {
      console.error('Error parsing route results data:', e);
    }
    
    // Then check props
    if (optimizationResults && Object.keys(optimizationResults).length > 0) {
      console.log('Using results from props:', optimizationResults);
      return optimizationResults;
    }
    
    // Then check generic optimization results
    try {
      const storedResults = sessionStorage.getItem('optimizationResults');
      if (storedResults) {
        const parsedResults = JSON.parse(storedResults);
        if (parsedResults && Object.keys(parsedResults).length > 0) {
          console.log('Using results from sessionStorage:', parsedResults);
          return parsedResults;
        }
      }
      
      const localResults = localStorage.getItem('optimizationResults');
      if (localResults) {
        const parsedLocalResults = JSON.parse(localResults);
        if (parsedLocalResults && Object.keys(parsedLocalResults).length > 0) {
          console.log('Using results from localStorage:', parsedLocalResults);
          return parsedLocalResults;
        }
      }
    } catch (e) {
      console.error('Error parsing generic results data:', e);
    }
    
    return null;
  };

  // Helper function to extract routes data from the results
  const extractRoutesData = (resultsData) => {
    console.log('Extracting routes from:', resultsData);
    
    // Check common top-level structures first
    if (resultsData.routes && Array.isArray(resultsData.routes)) {
      console.log('Found routes in top-level routes property');
      return resultsData.routes;
    }
    
    if (resultsData.results && resultsData.results.routes && Array.isArray(resultsData.results.routes)) {
      console.log('Found routes in results.routes property');
      return resultsData.results.routes;
    }
    
    // Check for top-level array
    if (Array.isArray(resultsData)) {
      // Make sure it looks like route data
      if (resultsData.length > 0 && hasRouteProperties(resultsData[0])) {
        console.log('Found routes in top-level array');
        return resultsData;
      }
    }
    
    // Based on the API response format, also check these patterns
    if (resultsData.status === 'completed' && resultsData.routes && Array.isArray(resultsData.routes)) {
      console.log('Found routes in status completed response');
      return resultsData.routes;
    }
    
    // Look for any array property that might contain routes
    if (typeof resultsData === 'object' && resultsData !== null) {
      for (const key in resultsData) {
        if (Array.isArray(resultsData[key]) && resultsData[key].length > 0) {
          // Check if array items have route-like properties
          if (hasRouteProperties(resultsData[key][0])) {
            console.log(`Found routes in property: ${key}`, resultsData[key].length);
            return resultsData[key];
          }
        }
      }
      
      // Handle nested data structures
      for (const key in resultsData) {
        if (typeof resultsData[key] === 'object' && resultsData[key] !== null) {
          console.log(`Checking nested object: ${key}`);
          const nestedResult = extractRoutesData(resultsData[key]);
          if (nestedResult && nestedResult.length > 0) {
            return nestedResult;
          }
        }
      }
    }
    
    console.warn('Could not find routes data in any expected location');
    return null;
  };

  // Helper function to check if an object has route-like properties
  const hasRouteProperties = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    
    // Log the object to help debug
    console.log('Checking if object has route properties:', obj);
    
    // Check for typical route properties
    const hasSourceDest = (
      (obj.source !== undefined || obj.start !== undefined || obj.origin !== undefined) &&
      (obj.destination !== undefined || obj.end !== undefined || obj.dest !== undefined)
    );
    
    const hasRouteDetails = (
      obj.distance !== undefined || 
      obj.time !== undefined || 
      obj.duration !== undefined ||
      obj.streets !== undefined || 
      obj.path !== undefined || 
      obj.segments !== undefined
    );
    
    return hasSourceDest || hasRouteDetails;
  };

  // Helper function to normalize routes data
  const normalizeRoutesData = (routesData) => {
    return routesData.map(route => {
      // Create a standardized route object with more fallback options
      const normalizedRoute = {
        start: getPropertyValue(route, ['start', 'source', 'origin', 'from']),
        end: getPropertyValue(route, ['end', 'destination', 'dest', 'to']),
        distance: getNumericValue(route, ['distance', 'dist', 'length']),
        time: getNumericValue(route, ['time', 'duration', 'travelTime']),
        streets: getArrayValue(route, ['streets', 'path', 'segments', 'route']),
        traffic: route.traffic || route.trafficConditions || {},
        error: route.error || null
      };
      
      // If segments exist but not as an array, try to extract street names
      if (!Array.isArray(normalizedRoute.streets) || normalizedRoute.streets.length === 0) {
        if (route.segments && typeof route.segments === 'object') {
          normalizedRoute.streets = Object.values(route.segments)
            .filter(segment => segment && segment.name)
            .map(segment => segment.name);
        }
      }
      
      // Process segments if they exist but need transformation
      if (Array.isArray(normalizedRoute.streets) && 
          normalizedRoute.streets.length > 0 && 
          typeof normalizedRoute.streets[0] === 'object') {
        // Extract street names from segment objects
        normalizedRoute.streets = normalizedRoute.streets.map(segment => {
          if (typeof segment === 'string') return segment;
          return segment.name || segment.street || segment.id || 'Unknown Street';
        });
      }
      
      return normalizedRoute;
    });
  };

  // Helper function to get a property value from multiple possible keys
  const getPropertyValue = (obj, keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) {
        return String(obj[key]).trim();
      }
    }
    return '';
  };

  // Helper function to get a numeric value from multiple possible keys
  const getNumericValue = (obj, keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) {
        const value = obj[key];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
    return 0;
  };

  // Helper function to get an array value from multiple possible keys
  const getArrayValue = (obj, keys) => {
    for (const key of keys) {
      if (Array.isArray(obj[key])) {
        return obj[key];
      }
    }
    
    // Special handling for segments that might be an object or need transformation
    for (const key of keys) {
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        // Try to convert an object of segments to an array
        return Object.values(obj[key]).map(item => {
          if (typeof item === 'string') return item;
          return item.name || item.id || String(item);
        });
      }
    }
    
    return [];
  };

  // Helper function to format traffic data display
  const formatTrafficData = (traffic) => {
    if (!traffic || Object.keys(traffic).length === 0) return [];
    
    return Object.entries(traffic).map(([state, percentage]) => {
      // Handle different formats (decimal vs percentage)
      const value = percentage > 1 ? percentage : percentage * 100;
      
      // Map traffic states to human-readable labels
      let label = "Unknown";
      switch (state) {
        case "0":
          label = "Normal Traffic";
          break;
        case "1":
          label = "High Traffic";
          break;
        case "2":
          label = "Heavy Traffic";
          break;
        case "3":
          label = "Congestion";
          break;
        default:
          label = `Traffic Type ${state}`;
      }
      
      return { label, value };
    });
  };

  // Helper function to format time in minutes/hours
  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes.toFixed(0)} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}min`;
    }
  };

  return (
    <div className="w-full p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Upload
          </button>
          <h3 className="text-xl font-semibold ml-4">Route Planning Results</h3>
        </div>

        {loading && (
          <div className="text-center py-10">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>Loading route results...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            <p>{error}</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="mt-2 text-sm underline"
            >
              Return to upload
            </button>
          </div>
        )}

        {!loading && !error && routes.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500">No routes found</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && routes.length > 0 && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600">
                Showing results for {routes.length} route{routes.length !== 1 ? 's' : ''}
              </p>
              <div className="mt-2">
                <button
                  onClick={() => setShowMap(!showMap)}
                  className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  {showMap ? 'Hide Map' : 'Show Map'}
                </button>
              </div>
            </div>

            {/* Map Component */}
            {showMap && (
              <div className="mb-6">
                <RouteMap routes={routes} />
              </div>
            )}

            <div className="space-y-6">
              {routes.map((route, index) => (
                <div key={index} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="bg-blue-600 text-white px-4 py-3">
                    <h4 className="font-medium flex items-center text-lg">
                      <MapPin size={18} className="mr-2" />
                      {route.start} to {route.end}
                    </h4>
                  </div>
                  
                  {route.error ? (
                    <div className="p-4 bg-red-50 text-red-600">
                      <p>{route.error}</p>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="text-sm text-gray-500">Distance</div>
                          <div className="text-lg font-semibold">
                            {route.distance.toFixed(2)} km
                          </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="text-sm text-gray-500">Est. Time</div>
                          <div className="text-lg font-semibold flex items-center">
                            <Clock size={16} className="mr-1" />
                            {formatTime(route.time)}
                          </div>
                        </div>
                      </div>
                      
                      {route.streets && route.streets.length > 0 && (
                        <div className="mb-4">
                          <h5 className="font-medium mb-2 flex items-center">
                            <Navigation size={16} className="mr-1" />
                            Route Path
                          </h5>
                          <div className="bg-gray-50 p-3 rounded-lg text-sm">
                            {route.streets.map((street, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && <span className="mx-2 text-gray-400">→</span>}
                                <span>{street}</span>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {route.traffic && Object.keys(route.traffic).length > 0 && (
                        <div>
                          <h5 className="font-medium mb-2">Traffic Conditions</h5>
                          <div className="grid grid-cols-2 gap-2">
                            {formatTrafficData(route.traffic).map((item, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span>{item.label}:</span>
                                <span className="font-medium">{item.value.toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RouteResults;