//route_result.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Navigation, Flag, ChevronDown, ChevronUp, Car } from 'lucide-react';
import RouteMap from './routemap'; // Import the RouteMap component
import MapSection from './MapSection';

const RouteResults = ({ setActiveTab, optimizationResults }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMap, setShowMap] = useState(true);
  const [expandedRoutes, setExpandedRoutes] = useState({});
  
  useEffect(() => {
    loadRouteData();
    // Add Leaflet CSS and JS
    loadLeaflet();
  }, [optimizationResults]);

  // Toggle route expansion
  const toggleRouteExpansion = (index) => {
    setExpandedRoutes(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

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
      
      // Step 3: Normalize the routes data with improved multi-destination support
      const normalizedRoutes = normalizeRoutesData(routesData);
      console.log('Normalized routes:', normalizedRoutes);
      setRoutes(normalizedRoutes);
      
      // Initialize expanded state for all routes
      const initialExpandedState = {};
      normalizedRoutes.forEach((_, index) => {
        initialExpandedState[index] = index === 0; // Expand only first route by default
      });
      setExpandedRoutes(initialExpandedState);
    } catch (err) {
      console.error('Error processing route results:', err);
      setError('Failed to load route results: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const hasRouteProperties = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    
    // Log the object to help debug
    console.log('Checking if object has route properties:', obj);
    
    // Check for typical route properties
    const hasSourceDest = (
      (obj.source !== undefined || obj.start !== undefined || obj.origin !== undefined) &&
      (obj.destination !== undefined || obj.destinations !== undefined || obj.end !== undefined || obj.dest !== undefined)
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

  const normalizeRoutesData = (routesData) => {
    return routesData.map(route => {
      // Get the source/start location
      const start = getPropertyValue(route, ['start', 'source', 'origin', 'from']);
      
      // Handle multiple destinations
      let destinations = [];
      let isMultiStop = false;
      
      // Check for an array of destinations first
      if (route.destinations && Array.isArray(route.destinations)) {
        destinations = route.destinations;
        // Only set as multi-stop if there are multiple destinations
        isMultiStop = destinations.length > 1;
      } else {
        // Check for a single destination
        const singleDestination = getPropertyValue(route, ['end', 'destination', 'dest', 'to']);
        if (singleDestination) {
          destinations = [singleDestination];
          isMultiStop = false;
        }
      }
      
      // Get distance in meters and convert to kilometers
      const distanceInMeters = getNumericValue(route, ['distance', 'dist', 'length']);
      const distanceInKm = distanceInMeters / 1000;
      
      // Get time in seconds and keep as seconds (will be converted to minutes/hours in display function)
      const timeInSeconds = getNumericValue(route, ['time', 'duration', 'travelTime']);
      
      // Create a standardized route object with support for multiple destinations
      const normalizedRoute = {
        start,
        destinations,
        isMultiStop,
        distance: distanceInKm,
        time: timeInSeconds,
        streets: getArrayValue(route, ['streets', 'path', 'segments', 'route']),
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
  
  const getPropertyValue = (obj, keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) {
        return String(obj[key]).trim();
      }
    }
    return '';
  };

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

  const formatTime = (seconds) => {
    // Convert seconds to minutes for calculation
    const minutes = seconds / 60;
    
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}min`;
    }
  };

  // Get final destination based on the route path or destinations list
  const getFinalDestination = (route) => {
    // For routes with streets data, use the last street as the final destination
    if (route.streets && route.streets.length > 0) {
      return route.streets[route.streets.length - 1];
    }
    
    // Otherwise fall back to destinations array
    if (route.isMultiStop && route.destinations && route.destinations.length > 0) {
      return route.destinations[route.destinations.length - 1];
    }
    
    return 'Multiple Stops';
  };

  // Determine the ETA based on the calculated time
  const calculateETA = (seconds) => {
    const now = new Date();
    now.setSeconds(now.getSeconds() + seconds);
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="w-full p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Upload
          </button>
          
        </div>

        {loading && (
          <div className="text-center py-16 bg-white rounded-xl shadow-lg">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-lg font-medium text-gray-600">Planning your routes...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 text-red-600 p-8 rounded-xl shadow-lg">
            <h4 className="text-xl font-bold mb-2">Route Planning Error</h4>
            <p className="mb-4">{error}</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && routes.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl shadow-lg">
            <p className="text-xl text-gray-500 mb-6">No routes found</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && routes.length > 0 && (
          <>
            <div className="mb-6 bg-gradient-to-r from-blue-500 to-blue-700 text-white p-6 rounded-xl shadow-lg">
              <div className="flex flex-wrap justify-between items-center">
                <div>
                  <h4 className="text-2xl font-bold mb-2">Route Summary</h4>
                  <p className="text-blue-100">
                    {routes.length} optimized route{routes.length !== 1 ? 's' : ''} found for your journey
                  </p>
                </div>
                <button
                  onClick={() => setShowMap(!showMap)}
                  className="mt-4 md:mt-0 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors shadow-md font-medium flex items-center"
                >
                  {showMap ? (
                    <>
                      <span className="mr-1">Hide Map</span>
                      <ChevronUp size={16} />
                    </>
                  ) : (
                    <>
                      <span className="mr-1">Show Map</span>
                      <ChevronDown size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Map Component */}
            {showMap && (
              <div className="mb-6 rounded-xl overflow-hidden shadow-lg border-4 border-white">
                <RouteMap routes={routes} />
              </div>
            )}
            <MapSection routes={routes} render={false} />
            <div className="space-y-6">
              {routes.map((route, index) => (
                <div key={index} className="bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300">
                  {/* Route Header - Always visible */}
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 cursor-pointer"
                    onClick={() => toggleRouteExpansion(index)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="bg-white text-blue-700 rounded-full h-10 w-10 flex items-center justify-center mr-3 shadow-md">
                          <Car size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg flex items-center">
                            {route.start}
                            <span className="mx-2">→</span>
                            {route.isMultiStop ? getFinalDestination(route) : 
                              route.destinations && route.destinations.length === 1 ? route.destinations[0] : "Destination"}
                          </h4>
                          <div className="flex items-center text-blue-100 text-sm mt-1">
                            <span className="flex items-center mr-4">
                              <Clock size={14} className="mr-1" />
                              {formatTime(route.time)}
                            </span>
                            <span>
                              {route.distance.toFixed(2)} km
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="bg-blue-800 text-white px-3 py-1 rounded-lg shadow-inner mr-3">
                          <span className="font-bold">ETA: {calculateETA(route.time)}</span>
                        </div>
                        {expandedRoutes[index] ? (
                          <ChevronUp size={24} className="text-blue-100" />
                        ) : (
                          <ChevronDown size={24} className="text-blue-100" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded content */}
                  {expandedRoutes[index] && (
                    <div className="p-6">
                      {route.error ? (
                        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                          <p>{route.error}</p>
                        </div>
                      ) : (
                        <>
                          {/* Journey summary cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg shadow-md">
                              <div className="text-sm text-blue-600 mb-1">Total Distance</div>
                              <div className="text-2xl font-bold text-blue-800">
                                {route.distance.toFixed(2)} km
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg shadow-md">
                              <div className="text-sm text-blue-600 mb-1">Travel Time</div>
                              <div className="text-2xl font-bold text-blue-800 flex items-center">
                                {formatTime(route.time)}
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg shadow-md">
                              <div className="text-sm text-blue-600 mb-1">Arrival</div>
                              <div className="text-2xl font-bold text-blue-800">
                                {calculateETA(route.time)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Destinations/Stops Section - Only for multi-stop routes */}
                          {route.isMultiStop && route.destinations && route.destinations.length > 1 && (
                            <div className="mb-6">
                              <h5 className="font-bold mb-3 flex items-center text-gray-800">
                                <Flag size={18} className="mr-2 text-blue-600" />
                                Waypoints
                              </h5>
                              <div className="bg-gray-50 rounded-lg shadow-inner">
                                <ol className="list-none">
                                  {route.destinations.map((destination, i) => (
                                    <li key={i} className="flex items-center py-3 px-4 border-b border-gray-200 last:border-0">
                                      <div className="bg-blue-600 text-white h-6 w-6 rounded-full flex items-center justify-center mr-3 text-sm font-bold">
                                        {i + 1}
                                      </div>
                                      <span className="font-medium">{destination}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          )}
                          
                          {/* Turn-by-turn directions */}
                          {route.streets && route.streets.length > 0 && (
                            <div>
                              <h5 className="font-bold mb-3 flex items-center text-gray-800">
                                <Navigation size={18} className="mr-2 text-blue-600" />
                                Turn-by-Turn Directions
                              </h5>
                              <div className="bg-gray-50 rounded-lg shadow-inner p-4 max-h-60 overflow-y-auto">
                                <div className="space-y-2">
                                  {route.streets.map((street, i) => (
                                    <div key={i} className="flex items-center">
                                      {i > 0 && <div className="h-6 border-l-2 border-blue-300 mx-3"></div>}
                                      <div className="flex-1 py-1 px-3 bg-white rounded-lg shadow-sm">
                                        <div className="font-medium">{street}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
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