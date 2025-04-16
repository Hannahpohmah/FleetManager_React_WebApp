import React, { useState, useEffect } from 'react';
import { Upload, MapPin, Users, FileSpreadsheet, Route, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapSection from './components/MapSection';
import UploadSection from './components/UploadSection';
import DriversSection from './components/DriversSection';
import RouteHistorySection from './components/RouteHistorySection';
import RouteResults from './components/Route_Result';
import OptimizerResults from './components/optimizer_result';

const API_BASE_URL = 'http://localhost:5000/api';

// Create a context for sharing optimization results across components
export const OptimizationContext = React.createContext();

const App = () => {
  const [activeTab, setActiveTab] = useState('map');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [directions, setDirections] = useState(null);
  const [map, setMap] = useState(null);
  
  // Add state for optimization results
  const [optimizationResults, setOptimizationResults] = useState(null);
  
  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
    
    // Load any existing optimization results from sessionStorage on initial load
    const storedResults = sessionStorage.getItem('optimizationResults');
    if (storedResults) {
      try {
        const parsedResults = JSON.parse(storedResults);
        setOptimizationResults(parsedResults);
        console.log('Loaded optimization results from sessionStorage', parsedResults);
      } catch (err) {
        console.error('Error loading optimization results from sessionStorage:', err);
      }
    }
  }, []);

  // Function to update optimization results
  const updateOptimizationResults = (results) => {
    console.log('Updating optimization results in App.jsx', results);
    setOptimizationResults(results);
    
    // Also save to sessionStorage for persistence across page refreshes
    if (results) {
      sessionStorage.setItem('optimizationResults', JSON.stringify(results));
      localStorage.setItem('optimizationResults', JSON.stringify(results));
    } else {
      // Clear storage if results are null
      sessionStorage.removeItem('optimizationResults');
      localStorage.removeItem('optimizationResults');
    }
  };

  // Navigation items
  // Replace the current navigation items logic with this:
  const navItems = [
    { id: 'map', icon: MapPin, label: 'Route Map' },
    { id: 'upload', icon: Upload, label: 'Upload Data' },
    { id: 'drivers', icon: Users, label: 'Manage Drivers' },
    { id: 'routes', icon: Route, label: 'Route History' },
    // Add the optimizer results tab if we have results
    ...(optimizationResults && (
      (optimizationResults.allocations && optimizationResults.allocations.length > 0) || 
      (Array.isArray(optimizationResults) && optimizationResults.length > 0) ||
      (optimizationResults.routes && optimizationResults.routes.length > 0)
    ) ? [{ id: 'optimizer_result', icon: FileSpreadsheet, label: 'Allocation Results' }] : []),
    // Add the route results tab if we have results with routes
    ...(optimizationResults && (
      (optimizationResults.routes && optimizationResults.routes.length > 0) ||
      (optimizationResults.results && optimizationResults.results.routes && optimizationResults.results.routes.length > 0)
    ) ? [{ id: 'Route_Result', icon: Navigation, label: 'Route Results' }] : [])
  ];

  // Dashboard stats
  const dashboardStats = [
    { title: 'Active Routes', value: 12 },
    { title: 'Available Drivers', value: 8 },
    { title: 'Pending Deliveries', value: 24 },
  ];

  return (
    <OptimizationContext.Provider value={{ optimizationResults, updateOptimizationResults }}>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Header />

        {/* Main Content */}
        <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="md:col-span-1">
              <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                navItems={navItems} 
                dashboardStats={dashboardStats} 
              />
            </div>

            {/* Main Content Area */}
            <div className="md:col-span-3">
              <Card className="min-h-[600px]">
                <CardHeader className="border-b">
                  <CardTitle>
                    {activeTab === 'map' && 'Route Map'}
                    {activeTab === 'upload' && 'Upload Data'}
                    {activeTab === 'drivers' && 'Driver Management'}
                    {activeTab === 'routes' && 'Route History'}
                    {activeTab === 'Route_Result' && 'Route Results'}
                    {activeTab === 'optimizer_result' && 'Optimization Results'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                {activeTab === 'map' && (
                <MapSection 
                  routes={routes} 
                  render={true}
                  setDirections={setDirections}
                  currentLocation={currentLocation}
                />  
                  )}
                  {activeTab === 'upload' && (
                    <UploadSection 
                      setRoutes={setRoutes} 
                      setActiveTab={setActiveTab}
                      updateOptimizationResults={updateOptimizationResults}
                    />
                  )}
                  {activeTab === 'drivers' && (
                    <DriversSection 
                      API_BASE_URL={API_BASE_URL} 
                    />
                  )}
                  {activeTab === 'routes' && (
                    <RouteHistorySection />
                  )}
                  {activeTab === 'Route_Result' && (
                    <RouteResults 
                      setActiveTab={setActiveTab} 
                      optimizationResults={optimizationResults}
                    />
                  )}
                  {activeTab === 'optimizer_result' && (
                    <OptimizerResults setActiveTab={setActiveTab} />
                  )}
                  
                  {/* Invisible instance of OptimizerResults that's always rendered to maintain state */}
                  {optimizationResults && activeTab !== 'optimizer_result' && (
                    <div style={{ display: 'none' }}>
                      <OptimizerResults setActiveTab={setActiveTab} />
                    </div>
                  )}
                  
                  {/* Invisible instance of RouteResults that's always rendered to maintain state */}
                  {optimizationResults && activeTab !== 'Route_Result' && (
                    <div style={{ display: 'none' }}>
                      <RouteResults setActiveTab={setActiveTab} optimizationResults={optimizationResults} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </OptimizationContext.Provider>
  );
};

export default App;