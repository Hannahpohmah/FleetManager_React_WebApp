import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Bell, LogOut, User } from 'lucide-react';
import NotificationComponent from './NotificationContext';
const API_BASE_URL = 'https://fleetmanager-react-webapp.onrender.com';

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

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
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
    <header className="app-header">
      <div className="header-container">
        <div className="app-logo">
          <Truck size={24} />
          <span>Logistics Optimization System</span>
        </div>
        
        <div className="user-actions">
          <div className="welcome-text">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span>Loading...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                Welcome, <span className="user-name">{managerName}</span>
              </div>
            )}
          </div>
          
          <div className="notification-badge">
            <NotificationComponent />
          </div>
          
          <button 
            className="logout-btn flex items-center gap-2" 
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;