import React, { useState, useEffect } from 'react';
import { Upload, MapPin, Users, FileSpreadsheet, Route, Navigation, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import './App.css'; // Import the enhanced CSS

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapSection from './components/MapSection';
import UploadSection from './components/UploadSection';
import DriversSection from './components/DriversSection';
import RouteHistorySection from './components/RouteHistorySection';
import RouteResults from './components/Route_Result';
import OptimizerResults from './components/optimizer_result';

const API_BASE_URL = 'https://fleetmanager-react-webapp.onrender.com';


// Create a context for sharing optimization results across components
export const OptimizationContext = React.createContext();

const App = () => {
  const [activeTab, setActiveTab] = useState('upload');
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
    const storedRoutes = sessionStorage.getItem('appRoutes');
    if (storedRoutes) {
      try {
        const parsedRoutes = JSON.parse(storedRoutes);
        setRoutes(parsedRoutes);
        console.log('Loaded routes from sessionStorage', parsedRoutes);
      } catch (err) {
        console.error('Error loading routes from sessionStorage:', err);
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

  // Navigation items with enhanced icons and labels
  const navItems = [
    { id: 'upload', icon: Upload, label: 'Upload Data', description: 'Import Logistics related data' },
    { id: 'map', icon: MapPin, label: 'Route Map', description: 'View Routes and Track drivers' },
    { id: 'drivers', icon: Users, label: 'Manage Drivers', description: 'Add and update driver information' },
    { id: 'routes', icon: Route, label: 'Route History', description: 'Review past delivery routes' },
    // Add the optimizer results tab if we have results
    ...(optimizationResults && (
      (optimizationResults.allocations && optimizationResults.allocations.length > 0) || 
      (Array.isArray(optimizationResults) && optimizationResults.length > 0) ||
      (optimizationResults.routes && optimizationResults.routes.length > 0)
    ) ? [{ id: 'optimizer_result', icon: FileSpreadsheet, label: 'Allocation Results', description: 'View Inventory allocations' }] : []),
    // Add the route results tab if we have results with routes
    ...(optimizationResults && (
      (optimizationResults.routes && optimizationResults.routes.length > 0) ||
      (optimizationResults.results && optimizationResults.results.routes && optimizationResults.results.routes.length > 0)
    ) ? [{ id: 'Route_Result', icon: Navigation, label: 'Route Results', description: 'View optimized route details' }] : [])
  ];

  // Dashboard stats (these will be replaced by the actual fetched values in Sidebar)
  const dashboardStats = [
    { title: 'Active Routes', value: 12, icon: Route, color: '#3b82f6' },
    { title: 'Available Drivers', value: 8, icon: Users, color: '#10b981' },
    { title: 'Pending Deliveries', value: 24, icon: BarChart3, color: '#f59e0b' },
  ];
  const updateRoutes = (newRoutes) => {
    console.log('Updating routes in App.jsx', newRoutes);
    setRoutes(newRoutes);
    // Save to sessionStorage for persistence if needed
    sessionStorage.setItem('appRoutes', JSON.stringify(newRoutes));
  };

  // Get the active tab configuration
  const activeTabConfig = navItems.find(item => item.id === activeTab) || navItems[0];
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('activeTab', tab);
  };
  useEffect(() => {
    const storedActiveTab = sessionStorage.getItem('activeTab');
    if (storedActiveTab) {
      setActiveTab(storedActiveTab);
    }
  }, []); // Empty dependency array to run once on component mount
  
  return (
    <OptimizationContext.Provider value={{ optimizationResults, updateOptimizationResults }}>
      <div className="app-container">
        <Header />

        {/* Main Content */}
        <div className="app-content">
          <div className="content-grid">
            {/* Sidebar */}
            <div>
              <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                navItems={navItems} 
                dashboardStats={dashboardStats} 
              />
            </div>

            {/* Main Content Area */}
            <div>
              <div className="content-card">
                <div className="card-header">
                  <div className="card-title">
                    {activeTabConfig.label}
                    {activeTabConfig.description && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        {activeTabConfig.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="card-content">
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
                      updateRoutes={updateRoutes}
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
                      <RouteResults 
                        setActiveTab={setActiveTab} 
                        optimizationResults={optimizationResults}
                        updateRoutes={updateRoutes} // Add this prop here too
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OptimizationContext.Provider>
  );
};

export default App;