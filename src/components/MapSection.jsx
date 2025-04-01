import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { GoogleMap, LoadScript, DirectionsRenderer, InfoWindow } from "@react-google-maps/api";
import axios from "axios";

// Define libraries outside component to prevent reloading
// Use a reference to ensure it doesn't change
const libraries = ["places", "marker"];

const DriverTrackingMap = ({ currentLocation, directions, setMap }) => {
  const [driverLocations, setDriverLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const prevLocationsRef = useRef({});
  const animationRefs = useRef({});
  const markerRefs = useRef({});

  const defaultCenter = {
    lat: 6.5244,
    lng: 3.3792,
  };

  const mapContainerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '8px',
  };

  // Use useMemo to prevent the mapOptions object from being recreated on each render
  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    clickableIcons: false,
    scrollwheel: true,
    zoomControl: true,
    mapId: "dfbcfa95a8e9ab2e",  // Using your provided Map ID
    
  }), []); // Empty dependency array means this only runs once

  // Create driver marker
  const createDriverMarker = (driver, map) => {
    if (!window.google || !window.google.maps || !map) return null;
    
    try {
      // Create the marker element
      const { AdvancedMarkerElement } = window.google.maps.marker;
      
      // Create a marker content element
      const markerContent = document.createElement('div');
      markerContent.innerHTML = `
        <div style="position: relative; width: 40px; height: 40px;">
          <svg viewBox="0 0 24 24" style="position: absolute; width: 100%; height: 100%; transform: rotate(${driver.heading || 0}deg);">
            <path d="M20,8h-3V4H3C1.9,4,1,4.9,1,6v11h2c0,1.66,1.34,3,3,3s3-1.34,3-3h6c0,1.66,1.34,3,3,3s3-1.34,3-3h2v-5L20,8z M6,19.5c-0.83,0-1.5-0.67-1.5-1.5s0.67-1.5,1.5-1.5s1.5,0.67,1.5,1.5S6.83,19.5,6,19.5z M19,19.5c-0.83,0-1.5-0.67-1.5-1.5s0.67-1.5,1.5-1.5s1.5,0.67,1.5,1.5S19.83,19.5,19,19.5z M17,12V9.5h2.5l1.96,2.5H17z" 
            fill="#4CAF50" stroke="#1B5E20" stroke-width="0.5" />
          </svg>
        </div>
      `;

      // Create the advanced marker
      const marker = new AdvancedMarkerElement({
        position: { lat: driver.latitude, lng: driver.longitude },
        map: map,
        title: `Driver ${driver.driverName || driver.driver || driver.driverId || "Unknown"}`,
        content: markerContent
      });

      // Add click listener
      marker.addListener("click", () => {
        setSelectedDriver(driver);
      });

      // Store reference to this marker
      markerRefs.current[driver.driverId] = marker;
      
      return marker;
    } catch (error) {
      console.error("Error creating advanced marker:", error);
      return null;
    }
  };

  // Create current location marker
  const createCurrentLocationMarker = (position, map) => {
    if (!window.google || !window.google.maps || !map) return null;

    try {
      const { AdvancedMarkerElement } = window.google.maps.marker;
      
      // Create a marker content element
      const markerContent = document.createElement('div');
      markerContent.innerHTML = `
        <div style="background-color: #2196F3; border: 2px solid #0b5ed7; width: 20px; height: 20px; border-radius: 50%;"></div>
      `;

      // Create the advanced marker
      const marker = new AdvancedMarkerElement({
        position: position,
        map: map,
        title: "Your Location",
        content: markerContent
      });

      return marker;
    } catch (error) {
      console.error("Error creating current location marker:", error);
      return null;
    }
  };

  // Calculate heading between two points
  const calculateHeading = (prevPos, newPos) => {
    if (!prevPos || !newPos) return 0;
    
    // Convert to radians
    const lat1 = prevPos.lat * Math.PI / 180;
    const lat2 = newPos.lat * Math.PI / 180;
    const lng1 = prevPos.lng * Math.PI / 180;
    const lng2 = newPos.lng * Math.PI / 180;
    
    // Calculate heading
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - 
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    const heading = Math.atan2(y, x) * 180 / Math.PI;
    
    return (heading + 360) % 360;
  };

  // Animate marker movement
  const animateMarkerMovement = (driverId, prevPos, newPos, duration = 2000) => {
    // Validate inputs
    if (!prevPos || !newPos || !mapInstance) {
      console.warn(`Invalid position data for driver ${driverId}`, { prevPos, newPos });
      return;
    }
    
    // Ensure we have valid latitude and longitude values
    if (!isFinite(prevPos.lat) || !isFinite(prevPos.lng) || 
        !isFinite(newPos.lat) || !isFinite(newPos.lng)) {
      console.warn(`Invalid coordinate values for driver ${driverId}`, { prevPos, newPos });
      return;
    }
    
    // Cancel any existing animation for this driver
    if (animationRefs.current[driverId]) {
      cancelAnimationFrame(animationRefs.current[driverId]);
    }
    
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Calculate intermediate position
      const lat = prevPos.lat + (newPos.lat - prevPos.lat) * progress;
      const lng = prevPos.lng + (newPos.lng - prevPos.lng) * progress;
      
      // Calculate heading
      const heading = calculateHeading(prevPos, newPos);
      
      // Update driver location
      setDriverLocations(prev => 
        prev.map(d => 
          d.driverId === driverId 
            ? { ...d, latitude: lat, longitude: lng, heading: heading }
            : d
        )
      );
      
      // Update marker position if it exists
      const marker = markerRefs.current[driverId];
      if (marker) {
        marker.position = { lat, lng };
        
        // Update rotation in the SVG
        if (marker.content) {
          const svg = marker.content.querySelector('svg');
          if (svg) {
            svg.style.transform = `rotate(${heading}deg)`;
          }
        }
      }
      
      // Continue animation if not complete
      if (progress < 1) {
        animationRefs.current[driverId] = requestAnimationFrame(animate);
      }
    };
    
    animationRefs.current[driverId] = requestAnimationFrame(animate);
  };

  // Fetch driver locations
  const fetchDriverLocations = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('http://localhost:5000/api/drivers/locations');
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log("Driver locations fetched:", response.data);
        
        // Process driver data with proper validation
        const validDrivers = response.data.map(driver => {
          // Ensure coordinates are numbers
          const lat = parseFloat(driver.latitude);
          const lng = parseFloat(driver.longitude);
          
          // Return validated driver object
          return {
            ...driver,
            latitude: isNaN(lat) ? 0 : lat,
            longitude: isNaN(lng) ? 0 : lng
          };
        });
        
        // Process each driver location and animate as needed
        validDrivers.forEach(driver => {
          const newLocation = {
            lat: driver.latitude,
            lng: driver.longitude
          };
          
          // Skip if coordinates are invalid (0,0)
          if (driver.latitude === 0 && driver.longitude === 0) return;
          
          // Get previous location for this driver
          const prevLocation = prevLocationsRef.current[driver.driverId];
          
          // If marker doesn't exist yet, create it
          if (!markerRefs.current[driver.driverId] && mapInstance) {
            createDriverMarker(driver, mapInstance);
          }
          
          // Animate movement if this isn't the first update
          if (prevLocation) {
            animateMarkerMovement(driver.driverId, prevLocation, newLocation);
          } else if (markerRefs.current[driver.driverId]) {
            // Just update position without animation for first update
            markerRefs.current[driver.driverId].position = newLocation;
          }
          
          // Update previous location reference
          prevLocationsRef.current[driver.driverId] = newLocation;
        });
        
        setDriverLocations(validDrivers);
        setError(null);
        
        // Center map on first driver if map is ready
        if (validDrivers.length > 0 && mapInstance && 
            validDrivers[0].latitude !== 0 && validDrivers[0].longitude !== 0) {
          mapInstance.panTo({
            lat: validDrivers[0].latitude,
            lng: validDrivers[0].longitude
          });
          mapInstance.setZoom(14);
        }
      } else {
        console.error("Invalid driver data format:", response.data);
        setError("Could not locate any drivers");
      }
    } catch (err) {
      console.error("Error fetching driver locations:", err);
      setError("Failed to load driver locations");
    } finally {
      setIsLoading(false);
    }
  };

  // Map load handler
  const onMapLoad = useCallback((map) => {
    console.log("Map loaded successfully");
    setMapInstance(map);
    if (setMap) setMap(map);
    
    // Create current location marker if available
    if (currentLocation) {
      createCurrentLocationMarker(currentLocation, map);
    }
  }, [currentLocation, setMap]);

  // Google Maps script load handler
  const handleGoogleMapsLoaded = useCallback(() => {
    console.log("Google Maps loaded successfully");
    setGoogleMapsLoaded(true);
  }, []);

  // Effect to update markers when driver locations change
  useEffect(() => {
    if (mapInstance && googleMapsLoaded) {
      // Update existing markers or create new ones
      driverLocations.forEach(driver => {
        if (!driver.latitude || !driver.longitude || 
            driver.latitude === 0 || driver.longitude === 0) {
          return;
        }
        
        if (!markerRefs.current[driver.driverId]) {
          createDriverMarker(driver, mapInstance);
        }
      });
    }
  }, [driverLocations, mapInstance, googleMapsLoaded]);

  // Set up driver location tracking
  useEffect(() => {
    console.log("Starting to track all active drivers");
    // Only fetch locations once Google Maps is loaded
    if (googleMapsLoaded) {
      fetchDriverLocations();
      
      // Set up polling to refresh driver locations
      const intervalId = setInterval(() => {
        console.log("Fetching updated locations for all drivers");
        fetchDriverLocations();
      }, 50000);
      
      return () => {
        clearInterval(intervalId);
        // Cancel all animations
        Object.values(animationRefs.current).forEach(animId => {
          cancelAnimationFrame(animId);
        });
        // Remove all markers from the map
        Object.values(markerRefs.current).forEach(marker => {
          marker.map = null;
        });
      };
    }
  }, [googleMapsLoaded]);

  return (
    <div className="w-full relative">
      {isLoading && driverLocations.length === 0 && (
        <div className="absolute top-2 left-2 bg-white p-2 rounded shadow z-10">
          Locating drivers...
        </div>
      )}
      
      {error && (
        <div className="absolute top-2 left-2 bg-white p-2 rounded shadow z-10 text-red-500">
          {error}
        </div>
      )}
      
      <div className="absolute top-2 right-2 z-10 flex space-x-2">
        <button
          onClick={fetchDriverLocations}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Refresh Locations
        </button>
      </div>
      
      <LoadScript
        googleMapsApiKey="AIzaSyDqRZ9Qf0-HNt4TJMceigN4_12GLJ8crGE"
        libraries={libraries}
        onLoad={handleGoogleMapsLoaded}
        onError={(error) => console.error("Error loading Google Maps:", error)}
        loadingElement={<div className="flex items-center justify-center h-full">Loading maps...</div>}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={currentLocation || defaultCenter}
          zoom={14}
          options={mapOptions}
          onLoad={onMapLoad}
        >
          {/* We're no longer using the Marker component directly */}
          {/* Instead, markers are created imperatively with AdvancedMarkerElement */}
          
          {/* Selected Driver Info Window */}
          {selectedDriver && googleMapsLoaded && window.google && (
            <InfoWindow
              position={{ 
                lat: selectedDriver.latitude, 
                lng: selectedDriver.longitude 
              }}
              onCloseClick={() => setSelectedDriver(null)}
            >
              <div className="p-2 max-w-xs">
                <h3 className="font-bold text-lg mb-2">Driver Information</h3>
                <p><strong>ID:</strong> {selectedDriver.driverId}</p>
                {selectedDriver.driverName && <p><strong>Name:</strong> {selectedDriver.driverName}</p>}
                {selectedDriver.vehicleType && <p><strong>Vehicle:</strong> {selectedDriver.vehicleType}</p>}
                {selectedDriver.licensePlate && <p><strong>License:</strong> {selectedDriver.licensePlate}</p>}
                <p><strong>Last Updated:</strong> {new Date(selectedDriver.timestamp).toLocaleTimeString()}</p>
                <button 
                  className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                  onClick={() => {/* Add functionality to select this driver */}}
                >
                  Track This Driver
                </button>
              </div>
            </InfoWindow>
          )}
          
          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>
      </LoadScript>
      
      {/* Driver List */}
      {driverLocations.length > 0 && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">Active Drivers ({driverLocations.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {driverLocations.map(driver => (
              <div 
                key={driver.driverId || Math.random().toString()}
                className="border rounded-lg p-3 flex items-center cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  setSelectedDriver(driver);
                  if (mapInstance && driver.latitude && driver.longitude) {
                    mapInstance.panTo({ 
                      lat: driver.latitude, 
                      lng: driver.longitude 
                    });
                    mapInstance.setZoom(16);
                  }
                }}
              >
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-3">
                  {driver.driverName ? driver.driverName.charAt(0) : '🚘'}
                </div>
                <div>
                  <h4 className="font-bold">{driver.driverName || `Driver #${driver.driverId ? driver.driverId.substring(0, 6) : 'Unknown'}`}</h4>
                  <p className="text-sm text-gray-600">
                    {driver.vehicleType || 'Vehicle'} 
                    {driver.licensePlate && ` • ${driver.licensePlate}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverTrackingMap;