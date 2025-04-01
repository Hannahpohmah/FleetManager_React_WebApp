import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationComponent from './NotificationContext';

const Header = () => {
  const [managerName, setManagerName] = useState('Manager');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');

    if (isAuthenticated) {
      fetchManagerData();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchManagerData = async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/auth/me', {
        method: 'GET',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Prioritize username, fallback to email
        setManagerName(userData.username || userData.email || 'Manager');
      } else {
        // Handle error response
        console.error('Failed to fetch user data', await response.text());
        setManagerName('Manager');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setManagerName('Manager');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    navigate('/');
  };

  return (
    <div className="bg-white shadow-sm flex-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <h1 className="text-xl font-bold">Logistics Optimization System</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm">
              {loading ? 'Loading...' : `Welcome, ${managerName}`}
            </span>
            <NotificationComponent />
            <button
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;