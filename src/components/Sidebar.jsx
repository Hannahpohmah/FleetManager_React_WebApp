import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
const API_BASE_URL = 'https://fleetmanager-react-webapp.onrender.com';

const fetchDashboardStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/drivers/stats`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    // Log the full response for debugging
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Check if the response is OK
    if (!response.ok) {
      // Try to get error message from response
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    // Parse JSON
    const data = await response.json();

    // Validate the data structure
    return [
      { 
        title: 'Total Drivers', 
        value: data.totalDrivers !== undefined ? data.totalDrivers : 'N/A',
        icon: 'Users',
        color: '#3b82f6'
      },
      { 
        title: 'Active Drivers', 
        value: data.activeDrivers !== undefined ? data.activeDrivers : 'N/A',
        icon: 'UserCheck',
        color: '#10b981'
      },
      { 
        title: 'Inactive Drivers', 
        value: data.inactiveDrivers !== undefined ? data.inactiveDrivers : 'N/A',
        icon: 'UserMinus',
        color: '#f59e0b'
      }
    ];
  } catch (error) {
    console.error('Detailed fetch error:', error);
    
    // More informative error handling
    return [
      { title: 'Total Drivers', value: 'N/A', icon: 'Users', color: '#3b82f6' },
      { title: 'Active Drivers', value: 'N/A', icon: 'UserCheck', color: '#10b981' },
      { title: 'Inactive Drivers', value: 'N/A', icon: 'UserMinus', color: '#f59e0b' }
    ];
  }
};

const Sidebar = ({ activeTab, setActiveTab, navItems }) => {
  const [dashboardStats, setDashboardStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const stats = await fetchDashboardStats();
        setDashboardStats(stats);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Stats loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();

    // Set up a refresh interval for real-time updates
    const intervalId = setInterval(loadStats, 60000); // Refresh every minute

    // Clean up the interval when component unmounts
    return () => clearInterval(intervalId);
  }, []);

  // Error rendering in an attractive way
  if (error) {
    return (
      <div className="sidebar-nav p-4">
        <div className="bg-red-50 text-red-500 p-4 rounded-md border border-red-200">
          <h3 className="font-medium mb-2">Unable to load stats</h3>
          <p className="text-sm text-red-600">Please check your connection and try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sidebar-nav">
        <nav className="py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item w-full ${activeTab === item.id ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="stats-container">
        {isLoading ? (
          <div className="stat-card">
            <div className="loading-spinner p-6">
              <Loader2 className="h-8 w-8 spin text-blue-500" />
              <span className="ml-2">Loading stats...</span>
            </div>
          </div>
        ) : (
          dashboardStats.map((stat, index) => (
            <div className="stat-card" key={index}>
              <div className="stat-header">
                <div className="stat-title">{stat.title}</div>
              </div>
              <div className="stat-content">
                {/* Create a colored circle with the value inside */}
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mr-3" 
                  style={{ 
                    backgroundColor: `${stat.color}15`, // Very light version of the color
                    color: stat.color 
                  }}
                >
                  <span className="text-lg font-bold">{typeof stat.value === 'number' ? stat.value : '-'}</span>
                </div>
                <div className="stat-value">
                  {stat.value}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default Sidebar;