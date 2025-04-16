import React, { useState, useEffect } from 'react';
import { Calendar, Truck, Users, MapPin, AlertTriangle, FileText, Package, Store, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ScheduleManager = () => {
  const [drivers, setDrivers] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [driverNotes, setDriverNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [conflictErrors, setConflictErrors] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [routeJobId, setRouteJobId] = useState('');

  const API_BASE_URL = 'http://localhost:5000';

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  useEffect(() => {
    console.log('Driver data:', drivers);
  }, [drivers]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setConflictErrors([]);
    try {
      // Get the route job ID from sessionStorage
      const jobId = sessionStorage.getItem('routeJobId');
      console.log('Route Job ID from sessionStorage:', jobId);
      setRouteJobId(jobId || '');

      // Fetch drivers from API
      console.log('Fetching drivers from API...');
      const driversResponse = await fetch(`${API_BASE_URL}/api/drivers`);
      if (!driversResponse.ok) throw new Error('Failed to fetch drivers');
      const driversData = await driversResponse.json();
      console.log(`Successfully fetched ${driversData.length} drivers`);
      setDrivers(driversData);

      // Get routes from sessionStorage
      console.log('Retrieving routes from sessionStorage...');
      const routesDataRaw = sessionStorage.getItem('routeResults');
      const routesData = routesDataRaw ? JSON.parse(routesDataRaw) : { routes: [] };
      console.log(`Found ${routesData.routes?.length || 0} routes in sessionStorage`);
      setRoutes(routesData.routes || []);

      // Get allocations from sessionStorage
      console.log('Retrieving allocations from sessionStorage...');
      const allocationsDataRaw = sessionStorage.getItem('optimizationResults');
      const allocationsData = allocationsDataRaw ? JSON.parse(allocationsDataRaw) : { allocations: [] };
      console.log(`Found ${allocationsData.allocations?.length || 0} allocations in sessionStorage`);
      setAllocations(allocationsData.allocations || []);

      // Fetch existing assignments for the selected date
      console.log(`Fetching assignments for date: ${selectedDate}...`);
      const assignmentsResponse = await fetch(
        `${API_BASE_URL}/api/assignments/date/${selectedDate}`,
        {
          headers: {
            'x-auth-token': localStorage.getItem('token')
          }
        }
      );
      
      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json();
        console.log(`Successfully fetched ${assignmentsData.length} assignments for ${selectedDate}`);
        
        // Initialize assignments object and driver notes
        const initialAssignments = {};
        const initialNotes = {};
        
        if (routesData.routes) {
          routesData.routes.forEach((route, index) => {
            // Generate consistent route ID
            const routeId = route.id || `${jobId}-${index}`;
            
            // Check if this route is already assigned
            const existingAssignment = assignmentsData.find(a => 
              a.routeId === routeId && 
              new Date(a.date).toISOString().split('T')[0] === selectedDate
            );
            
            initialAssignments[routeId] = existingAssignment ? 
              existingAssignment.driverId : '';
            
            // Get any existing notes
            initialNotes[routeId] = existingAssignment?.notes || '';
          });
        }
        setAssignments(initialAssignments);
        setDriverNotes(initialNotes);
      } else {
        console.warn(`Failed to fetch assignments for date ${selectedDate}:`, assignmentsResponse.status);
      }
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      console.log('Data fetching completed');
      setLoading(false);
    }
  };

  const handleAssignmentChange = (routeId, driverId) => {
    console.log(`Assigning route #${routeId} to driver ID: ${driverId}`);
    setAssignments(prev => ({
      ...prev,
      [routeId]: driverId
    }));
  };

  const handleNotesChange = (routeId, notes) => {
    console.log(`Updating notes for route #${routeId}: ${notes}`);
    setDriverNotes(prev => ({
      ...prev,
      [routeId]: notes
    }));
  };

  const handleSaveAssignments = async () => {
    setError(null);
    setSuccess(false);
    setConflictErrors([]);
    
    try {
      // Format the data for API - Only include notes if they exist
      const assignmentData = Object.keys(assignments).map(routeId => {
        console.log(`Preparing assignment for route ${routeId} with driver ${assignments[routeId]}`);
        
        // Create the assignment object with required fields
        const assignment = {
          routeId,
          driverId: assignments[routeId],
          date: selectedDate,
        };
        
        // Only add notes if they exist and aren't empty
        const notes = driverNotes[routeId];
        if (notes && notes.trim() !== '') {
          assignment.notes = notes;
        }
        
        return assignment;
      }).filter(item => item.driverId); // Only include routes that have been assigned
      
      console.log(`Saving ${assignmentData.length} assignments for date ${selectedDate}`);
      
      if (assignmentData.length === 0) {
        setError('No assignments to save. Please assign at least one route to a driver.');
        return;
      }
      
      // Send to API
      console.log('Posting assignments to API...');
      const response = await fetch(`${API_BASE_URL}/api/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': localStorage.getItem('token')
        },
        body: JSON.stringify({ assignments: assignmentData }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 409) {
          // Handle conflict errors
          console.warn('Conflict detected when saving assignments:', data.conflicts);
          setConflictErrors(data.conflicts || []);
          throw new Error('Some routes already have assignments for this date');
        }
        console.error('Failed to save assignments:', data.message);
        throw new Error(data.message || 'Failed to save assignments');
      }

      console.log('Assignments saved successfully:', data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error in handleSaveAssignments:', err);
      setError(err.message);
    }
  };

  // Find matching allocations for a source and destination
  const findMatchingAllocations = (source, destinations) => {
    if (!source || !destinations || destinations.length === 0) {
      return [];
    }
    
    return allocations.filter(allocation => 
      allocation.source === source && 
      destinations.includes(allocation.destination)
    );
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    console.log(`Date changed to: ${newDate}`);
    setSelectedDate(newDate);
  };

  // Find driver name by ID
  const getDriverNameById = (driverId) => {
    const driver = drivers.find(d => d._id === driverId);
    return driver ? driver.name : 'Unknown';
  };

  // Calculate total packages for a route
  const calculateTotalPackages = (source, destinations) => {
    const routeAllocations = findMatchingAllocations(source, destinations);
    return routeAllocations.reduce((total, allocation) => total + (allocation.quantity || 0), 0);
  };

  // Format distance for display
  const formatDistance = (distance) => {
    if (distance === undefined || distance === null) return 'N/A';
    return (distance / 1000).toFixed(1) + ' km';
  };

  // Format time for display
  const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null) return 'N/A';
    return Math.ceil(seconds / 60) + ' min';
  };

  // Ensure destinations is always an array
  const normalizeDestinations = (route) => {
    if (!route) return [];
    
    // If destinations is already an array, use it
    if (route.destinations && Array.isArray(route.destinations)) {
      return route.destinations;
    }
    
    // If there's a single destination property
    if (route.destination) {
      return [route.destination];
    }
    
    // If there's a dest property
    if (route.dest) {
      return [route.dest];
    }
    
    // If there's an end property
    if (route.end) {
      return [route.end];
    }
    
    return [];
  };

  // Handle edge cases for routes with missing data
  const processRouteData = (routes) => {
    return routes.map(route => {
      const destinations = normalizeDestinations(route);
      return {
        ...route,
        source: route.source || route.start || route.origin || 'Unknown Source',
        destinations,
        distance: route.distance || 0,
        time: route.time || route.duration || 0
      };
    });
  };

  const processedRoutes = processRouteData(routes);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading scheduling data...</p>
      </div>
    );
  }

  return (
    <div className="w-full p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Manage Route Schedules</h2>
        <p className="text-gray-500">Assign routes to available drivers</p>
      </div>
      
      <div className="mb-6">
        <label htmlFor="scheduleDate" className="block text-sm font-medium text-gray-700 mb-1">
          Schedule Date
        </label>
        <input
          id="scheduleDate"
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          className="p-2 border border-gray-300 rounded-md w-full max-w-xs"
        />
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {conflictErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md mb-4">
          <div className="flex">
            <AlertTriangle className="mr-2" size={20} />
            <div>
              <p className="font-medium">The following routes already have assignments:</p>
              <ul className="mt-2 list-disc list-inside">
                {conflictErrors.map((conflict, index) => (
                  <li key={index}>
                    Route #{conflict.routeId} - Already assigned to {conflict.existingDriver}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
          Schedules saved successfully!
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2" size={20} />
            Assign Drivers to Routes for {selectedDate}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {processedRoutes.length > 0 ? (
            <div className="space-y-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2" style={{ width: "700px" }}>Stops</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Assignment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <FileText className="mr-1" size={14} />
                        Driver Instructions
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {processedRoutes.map((route, index) => {
                    // Generate consistent route ID
                    const routeId = route.id || `${routeJobId}-${index}`;
                    
                    // Get normalized destinations
                    const destinations = route.destinations || [];
                    
                    // Find all matching allocations for this route
                    const routeAllocations = findMatchingAllocations(route.source, destinations);
                    
                    // Calculate total packages for this route
                    const totalPackages = calculateTotalPackages(route.source, destinations);
                    
                    return (
                      <tr key={routeId}>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-900 font-medium">
                            Route #{index + 1}
                          </div>
                          <div className="flex items-center text-sm text-gray-600 mt-1">
                            <MapPin className="inline mr-1" size={14} />
                            <span className="font-medium">Source:</span> {route.source || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDistance(route.distance)} · Est. {formatTime(route.time)}
                          </div>
                          
                          <div className="flex items-center text-sm mt-2">
                            <Navigation className="mr-1" size={14} />
                            <span className="font-medium">Stops:</span> {destinations.length || 0}
                          </div>
                          
                          <div className="flex items-center text-sm mt-1">
                            <Package className="inline mr-1" size={14} />
                            <span className="font-medium">Total Packages:</span> {totalPackages}
                          </div>
                          
                          {route.traffic && (
                            <div className="text-sm mt-1">
                              <span className="font-medium">Traffic Conditions:</span>
                              <div className="mt-1 flex items-center">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-green-500 h-2 rounded-full" 
                                    style={{ width: `${route.traffic['0'] || 0}%` }}
                                  ></div>
                                </div>
                                <span className="ml-2 text-xs">
                                  {Math.round(route.traffic['0'] || 0)}% clear
                                </span>
                              </div>
                            </div>
                          )}
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {destinations.length > 0 ? (
                              destinations.map((destination, destIndex) => {
                                const matchingAllocation = allocations.find(a => 
                                  a.source === route.source && a.destination === destination
                                );
                                
                                return (
                                  <div key={destIndex} className="border-l-2 border-gray-200 pl-3 py-1">
                                    <div className="flex items-center text-sm font-medium">
                                      <span className="mr-1 bg-gray-100 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center text-xs">
                                        {destIndex + 1}
                                      </span>
                                      {destination}
                                    </div>
                                    
                                    {matchingAllocation && (
                                      <>
                                        <div className="flex items-center text-sm text-gray-600 mt-1">
                                          <Store className="inline mr-1" size={14} />
                                          {matchingAllocation.destination_customer || 'Unknown Customer'}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 mt-1">
                                          <Package className="inline mr-1" size={14} />
                                          {matchingAllocation.quantity || 0} packages
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-sm text-gray-500 italic">
                                No destinations found for this route
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={assignments[routeId] || ''}
                            onChange={(e) => handleAssignmentChange(routeId, e.target.value)}
                            className="block w-full p-2 border border-gray-300 rounded-md"
                          >
                            <option value="">-- Select Driver --</option>
                            {drivers.map((driver) => (
                              <option key={driver._id} value={driver._id}>
                                {driver.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        
                        <td className="px-6 py-4">
                          <textarea
                            value={driverNotes[routeId] || ''}
                            onChange={(e) => handleNotesChange(routeId, e.target.value)}
                            placeholder="Add special instructions for driver (optional)..."
                            className="block w-full p-2 border border-gray-300 rounded-md text-sm"
                            rows="3"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSaveAssignments}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Truck className="mr-2" size={16} />
                  Save Assignments
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              <div className="flex flex-col items-center">
                <Navigation size={48} className="text-gray-300 mb-4" />
                <h3 className="text-lg font-medium mb-2">No routes available for assignment</h3>
                <p>Please optimize routes first to enable driver scheduling.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleManager;