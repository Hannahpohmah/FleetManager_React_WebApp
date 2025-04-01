import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const fetchDashboardStats = async () => {
  try {
    const response = await fetch('/api/drivers/stats', {
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
        value: data.totalDrivers !== undefined ? data.totalDrivers : 'N/A' 
      },
      { 
        title: 'Active Drivers', 
        value: data.activeDrivers !== undefined ? data.activeDrivers : 'N/A' 
      },
      { 
        title: 'Inactive Drivers', 
        value: data.inactiveDrivers !== undefined ? data.inactiveDrivers : 'N/A' 
      }
    ];
  } catch (error) {
    console.error('Detailed fetch error:', error);
    
    // More informative error handling
    return [
      { title: 'Total Drivers', value: 'Fetch Error' },
      { title: 'Active Drivers', value: 'Fetch Error' },
      { title: 'Inactive Drivers', value: 'Fetch Error' }
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

  // Error rendering
  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-red-500">
          Error loading dashboard stats: {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-2 p-2 rounded transition-colors ${
                  activeTab === item.id ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
                }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-6">
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2">Loading stats...</span>
            </CardContent>
          </Card>
        ) : (
          dashboardStats.map((stat, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
};

export default Sidebar;