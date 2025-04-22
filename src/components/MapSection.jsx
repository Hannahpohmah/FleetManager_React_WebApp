import { useState, useEffect } from 'react';
import axios from 'axios';
import RouteMap from './routemap';

const API_BASE_URL = 'https://fleetmanager-react-webapp.onrender.com';

const MapSection = ({ routes, render = true, currentLocation }) => {
  const [driverLocations, setDriverLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storedRoutes, setStoredRoutes] = useState([]);
  const [fleetManagerLocation, setFleetManagerLocation] = useState(null);

  // Use currentLocation from props if available, otherwise fetch from browser
  useEffect(() => {
    if (currentLocation) {
      // Convert from {lat, lng} format to {latitude, longitude} format
      setFleetManagerLocation({
        latitude: currentLocation.lat,
        longitude: currentLocation.lng
      });
    } else {
      fetchFleetManagerLocation();
    }
  }, [currentLocation]);

  // Get fleet manager's location (from browser as backup)
  const fetchFleetManagerLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFleetManagerLocation({ latitude, longitude });
        },
        (error) => {
          console.error("Error getting fleet manager location:", error);
          setFleetManagerLocation(null);
        }
      );
    } else {
      console.warn("Geolocation not supported by this browser.");
      setFleetManagerLocation(null);
    }
  };

  // Fetch driver locations from your API
  const fetchDriverLocations = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/drivers/locations`);
      
      if (response.data && Array.isArray(response.data)) {
        // Process driver data with proper validation
        const validDrivers = response.data.map(driver => {
          // Ensure coordinates are numbers
          const lat = parseFloat(driver.latitude);
          const lng = parseFloat(driver.longitude);
          
          // Return validated driver object
          return {
            ...driver,
            latitude: isNaN(lat) ? 0 : lat,
            longitude: isNaN(lng) ? 0 : lng,
            driverId: driver.driverId || `driver-${Math.random().toString(36).substring(2, 10)}`
          };
        }).filter(driver => {
          // Filter out drivers with invalid coordinates
          return driver.latitude !== 0 || driver.longitude !== 0;
        });
        
        setDriverLocations(validDrivers);
        setError(null);
      } else {
        setDriverLocations([]);
        setError("Could not locate any drivers");
      }
    } catch (err) {
      console.error("Error fetching driver locations:", err);
      setError("Failed to load driver locations");
      setDriverLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up polling interval to fetch driver locations
  useEffect(() => {
    // Only fetch driver locations if we're actually rendering
    if (render) {
      fetchDriverLocations();
      
      const interval = setInterval(fetchDriverLocations, 10000); // Update every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [render]);
  
  // Process incoming routes and save to state and storage
  useEffect(() => {
    if (routes && routes.length > 0) {
      console.log("MapSection received routes data:", routes);
      
      // Update the local state
      setStoredRoutes(routes);
      
      // Store routes in sessionStorage for persistence
      sessionStorage.setItem('mapSectionRoutes', JSON.stringify(routes));
    } else {
      // If no new routes are passed in, try to load them from storage
      const storedRoutesData = sessionStorage.getItem('mapSectionRoutes');
      if (storedRoutesData && (!storedRoutes || storedRoutes.length === 0)) {
        try {
          const parsedRoutes = JSON.parse(storedRoutesData);
          if (parsedRoutes && parsedRoutes.length > 0) {
            console.log("MapSection loaded routes from storage:", parsedRoutes);
            setStoredRoutes(parsedRoutes);
          }
        } catch (err) {
          console.error("Error parsing stored routes:", err);
        }
      }
    }
  }, [routes]);

  // If render is false, still process data but don't render UI
  if (!render) {
    return null;
  }

  // Determine which routes to display - passed in routes or stored routes
  const displayRoutes = routes && routes.length > 0 ? routes : storedRoutes;

  // Only render UI if render prop is true
  return (
    <div className="mb-6 rounded-xl overflow-hidden shadow-lg border-4 border-white">
      <RouteMap
        routes={displayRoutes}
        driverLocations={driverLocations}
        fleetManagerLocation={fleetManagerLocation}
      />

      {isLoading && (
        <div className="text-center py-2 bg-gray-100">
          <p className="text-sm text-gray-600">Updating driver locations...</p>
        </div>
      )}
      {error && (
        <div className="text-center py-2 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default MapSection;