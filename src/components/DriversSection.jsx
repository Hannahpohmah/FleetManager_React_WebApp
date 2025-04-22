import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ScheduleManager from './manage_schedules'; // Import the new component

const API_BASE_URL = 'https://fleetmanager-react-webapp.onrender.com';


const DriversSection = ({ API_BASE_URL: apiBaseUrlProp }) => {
  const apiBaseUrl = apiBaseUrlProp || API_BASE_URL;
  
  const [showForm, setShowForm] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [activeView, setActiveView] = useState('drivers'); // Add this for view switching
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    license: '',
    status: 'active'
  });

  // Function to open the modal with driver details
  const handleViewDetails = (driver) => {
    setSelectedDriver(driver);
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/drivers`);
      if (!response.ok) throw new Error('Failed to fetch drivers');
      const data = await response.json();
      setDrivers(data);
    } catch (err) {
      setError('Failed to load drivers. Please try again later.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const errors = [];
    if (!formData.name.trim()) errors.push('Name is required');
    if (!formData.email.trim()) errors.push('Email is required');
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) errors.push('Invalid email format');
    if (!formData.phone.trim()) errors.push('Phone number is required');
    if (!/^\+?[\d\s-]{10,}$/.test(formData.phone)) errors.push('Invalid phone number');
    
    return errors;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add driver');
      }

      // Successfully added driver; refresh the list
      await fetchDrivers();
      setSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        license: '',
        status: 'active'
      });
      setTimeout(() => {
        setShowForm(false);
        setSuccess(false);
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Define quick actions with unique ids for keys and updated onClick handlers
  const quickActions = [
    { id: 'add-driver', label: 'Add New Driver', onClick: () => {
      setActiveView('drivers'); 
      setShowForm(!showForm);
    }},
    { id: 'manage-schedules', label: 'Manage Schedules', onClick: () => {
      setActiveView('schedules');
      setShowForm(false);
    }},
    { id: 'view-reports', label: 'View Performance Reports', onClick: () => {}}
  ];

  // Render the appropriate view based on activeView state
  const renderView = () => {
    if (activeView === 'schedules') {
      return <ScheduleManager API_BASE_URL={apiBaseUrl} />;
    }

    // Default drivers view
    return (
      <div className="w-full p-6">
        <div className="mb-6">
          <p className="text-gray-500">Manage your delivery drivers and assignments</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
            Driver added successfully!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {drivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="text-gray-400" size={20} />
                      <div>
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-sm text-gray-500">Status: {driver.status}</p>
                      </div>
                    </div>
                    <button 
                      className="text-blue-600 text-sm hover:underline"
                      onClick={() => handleViewDetails(driver)}
                    >
                      View Details
                    </button>
                  </div>
                ))}
                
                {drivers.length === 0 && (
                  <div className="text-center p-4 text-gray-500">
                    No drivers available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    className="w-full p-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              {showForm && (
                <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">License Number</label>
                    <input
                      type="text"
                      name="license"
                      value={formData.license}
                      onChange={handleInputChange}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setError(null);
                        setSuccess(false);
                      }}
                      className="mr-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                      disabled={loading}
                    >
                      {loading ? 'Adding...' : 'Add Driver'}
                    </button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modal Popup for Viewing Driver Details */}
        {selectedDriver && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div
              className="fixed inset-0 bg-black opacity-50"
              onClick={() => setSelectedDriver(null)}
            ></div>
            <div className="bg-white p-6 rounded-lg z-10 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Driver Details</h2>
              <p><strong>Name:</strong> {selectedDriver.name}</p>
              <p><strong>Email:</strong> {selectedDriver.email}</p>
              <p><strong>Phone:</strong> {selectedDriver.phone}</p>
              <p><strong>License:</strong> {selectedDriver.license || 'N/A'}</p>
              <p><strong>Status:</strong> {selectedDriver.status}</p>
              <button
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => setSelectedDriver(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Render the appropriate view */}
      {renderView()}
    </>
  );
};

export default DriversSection;

