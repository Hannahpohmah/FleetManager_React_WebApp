import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';

const NotificationComponent = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newNotificationsCount, setNewNotificationsCount] = useState(0);

  const API_BASE_URL = 'http://localhost:5000/api/notifications';

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}`, {
        method: 'GET',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setNewNotificationsCount(data.newNotificationsCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationsAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/mark-read`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Set up a refresh interval for real-time updates
  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Set up interval to fetch notifications every second
    const intervalId = setInterval(fetchNotifications, 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="relative">
      <button 
        onClick={() => {
          setIsDropdownOpen(!isDropdownOpen);
          if (!isDropdownOpen) markNotificationsAsRead();
        }} 
        className="relative"
      >
        <Bell className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full px-2 py-1 text-xs">
            {unreadCount}
          </span>
        )}
      </button>
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b font-bold">
            Notifications 
            {newNotificationsCount > 0 && (
              <span className="ml-2 bg-green-500 text-white rounded-full px-2 py-1 text-xs">
                {newNotificationsCount} new
              </span>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-gray-500">No notifications</div>
          ) : (
            notifications.map(notification => (
              <div 
                key={notification._id} 
                className={`p-4 border-b flex items-center ${!notification.isRead ? 'bg-blue-50' : ''}`}
              >
                <div>
                  <p className="text-sm">{notification.message}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationComponent;