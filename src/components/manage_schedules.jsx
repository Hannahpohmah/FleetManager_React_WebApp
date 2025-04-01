import React, { useState, useEffect } from 'react';
import { Calendar, Truck, Users, MapPin, AlertTriangle, FileText, Package, Store } from 'lucide-react';
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

  // Add this effect to debug driver data
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
      console.log('Driver data structure:', JSON.stringify(driversData, null, 2));
      setDrivers(driversData);

      // Get routes from sessionStorage
      console.log('Retrieving routes from sessionStorage...');
      const routesDataRaw = sessionStorage.getItem('routeResults');
      console.log('Raw routes data from session:', routesDataRaw ? 'Found' : 'Not found');
      
      const routesData = JSON.parse(routesDataRaw || '{"routes":[]}');
      console.log(`Found ${routesData.routes?.length || 0} routes in sessionStorage`);
      console.log('Routes data structure:', JSON.stringify(routesData, null, 2));
      
      if (routesData.routes && routesData.routes.length > 0) {
        console.log('Sample route data:', routesData.routes[0]);
      } else {
        console.warn('No routes found in sessionStorage');
      }
      setRoutes(routesData.routes || []);

      // Get allocations from sessionStorage
      console.log('Retrieving allocations from sessionStorage...');
      const allocationsDataRaw = sessionStorage.getItem('optimizationResults');
      console.log('Raw allocations data from session:', allocationsDataRaw ? 'Found' : 'Not found');
      
      const allocationsData = JSON.parse(allocationsDataRaw || '{"allocations":[]}');
      console.log(`Found ${allocationsData.allocations?.length || 0} allocations in sessionStorage`);
      console.log('Allocations data structure:', JSON.stringify(allocationsData, null, 2));
      
      if (allocationsData.allocations && allocationsData.allocations.length > 0) {
        console.log('Sample allocation data:', allocationsData.allocations[0]);
      } else {
        console.warn('No allocations found in sessionStorage');
      }
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
              
            if (existingAssignment) {
              console.log(`Route #${routeId} already assigned to driver ${existingAssignment.driverId}`);
              if (existingAssignment.notes) {
                console.log(`Route #${routeId} has notes: ${existingAssignment.notes}`);
              }
            }
          });
        }
        console.log('Initial assignments mapping:', initialAssignments);
        console.log('Initial notes mapping:', initialNotes);
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
    console.log('Driver ID type and format:', typeof driverId, driverId);
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
      console.log('Assignment data to save:', assignmentData);
      
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

  // Improved allocation matching function that handles partial matches
  const findMatchingAllocation = (route) => {
    if (!route || !route.start || !route.end) {
      console.warn('Route is missing start or end:', route);
      return null;
    }
    
    console.log(`Trying to match route: ${route.start} -> ${route.end}`);
    
    // Exact match on both source and destination
    const exactMatch = allocations.find(allocation => 
      allocation.source === route.start && allocation.destination === route.end
    );
    
    if (exactMatch) {
      console.log(`Found exact matching allocation for route ${route.start} -> ${route.end}`);
      return exactMatch;
    }
    
    // Partial match strategies
    const partialMatches = allocations.filter(allocation => 
      allocation.source === route.start || 
      allocation.destination === route.end ||
      allocation.source === route.end ||
      allocation.destination === route.start
    );
    
    if (partialMatches.length > 0) {
      console.log(`Found ${partialMatches.length} partial matching allocations`);
      
      // Prioritize matches that have either start or end matching
      const priorityMatch = partialMatches.find(allocation => 
        (allocation.source === route.start && allocation.destination.includes(route.end)) ||
        (allocation.destination === route.end && allocation.source.includes(route.start))
      );
      
      if (priorityMatch) {
        console.log(`Found priority partial match:`, priorityMatch);
        return priorityMatch;
      }
      
      // If no priority match, return the first partial match
      console.log(`Returning first partial match:`, partialMatches[0]);
      return partialMatches[0];
    }
    
    console.warn(`No matching allocation found for route ${route.start} -> ${route.end}`);
    return null;
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    console.log(`Date changed to: ${newDate}`);
    setSelectedDate(newDate);
  };

  if (loading) {
    return <div className="p-6 text-center">Loading scheduling data...</div>;
  }

  // Find driver name by ID
  const getDriverNameById = (driverId) => {
    const driver = drivers.find(d => d._id === driverId);
    return driver ? driver.name : 'Unknown';
  };

  // Debug what data we have available for matching
  console.log('Routes for matching:', routes.map(r => ({ id: r.id, start: r.start, end: r.end })));
  console.log('Allocations for matching:', allocations);

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
          {routes.length > 0 ? (
            <div className="space-y-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Assignment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <FileText className="mr-1" size={14} />
                        Driver Instructions (Optional)
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {routes.map((route, index) => {
                    // Generate consistent route ID
                    const routeId = route.id || `${routeJobId}-${index}`;
                    
                    // Find matching allocation using the improved function
                    const allocation = findMatchingAllocation(route);
                    
                    console.log(`Route ${index}: id=${routeId}, start=${route.start}, end=${route.end}`);
                    console.log(`Matched allocation:`, allocation);
                    
                    return (
                      <tr key={routeId}>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-600 mt-1">
                            <MapPin className="inline mr-1" size={14} />
                            <span className="font-medium">From:</span> {route.start || 'N/A'}
                          </div>
                          <div className="flex items-center text-sm text-gray-600 mt-1">
                            <MapPin className="inline mr-1" size={14} />
                            <span className="font-medium">To:</span> {route.end || 'N/A'}
                          </div>
                          {allocation && allocation.destination_customer && (
                            <div className="flex items-center text-sm text-gray-600 mt-1">
                              <Store className="inline mr-1" size={14} />
                              <span className="font-medium">Customer:</span> {allocation.destination_customer}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">Stops: {route.stops?.length || 0}</div>
                          <div className="text-sm text-gray-500">
                            Distance: {route.distance ? `${(route.distance / 1000).toFixed(1)} km` : 'N/A'}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Package className="inline mr-1" size={14} />
                            <span>Packages:</span> {allocation ? allocation.quantity || 'N/A' : 'N/A'}
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Assignments
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center p-4 text-gray-500">
              No routes available for assignment. Please optimize routes first.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleManager;