import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import './NotificationIcon.css';

const NotificationIcon = () => {
  const { currentUser } = useAuth();
  const { notifications, clearAll } = useNotification();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [persistentNotifications, setPersistentNotifications] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      checkPersistentNotifications();
      
      // Check for email verification status every 30 seconds
      const interval = setInterval(() => {
        checkPersistentNotifications();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  const checkPersistentNotifications = async () => {
    if (!currentUser) return;
    
    try {
      // Reload user to get latest verification status
      await currentUser.reload();
      
      const persistent = [];
      
      // Check email verification status
      if (!currentUser.emailVerified) {
        persistent.push({
          id: 'email-verification',
          type: 'warning',
          title: 'E-mail não verificado',
          message: 'Verifique sua caixa de entrada para confirmar seu e-mail',
          persistent: true,
          action: 'verify-email'
        });
      }

      setPersistentNotifications(persistent);
    } catch (error) {
      console.error('Error checking persistent notifications:', error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleNotificationClick = (notification) => {
    if (notification.action === 'verify-email') {
      // Navigate to verification page or resend email
      window.location.href = '/verify-email';
    }
    if (!notification.persistent) {
      // Remove non-persistent notifications when clicked
      // This would be handled by the notification context
    }
  };

  const allNotifications = [...persistentNotifications, ...notifications];
  const notificationCount = allNotifications.length;

  if (!currentUser) return null;

  return (
    <div className="notification-icon-container" ref={dropdownRef}>
      <button 
        className="notification-icon-btn"
        onClick={toggleDropdown}
        aria-label={`Notifications (${notificationCount})`}
      >
        <svg 
          className="notification-bell" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M13.73 21a2 2 0 0 1-3.46 0" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
        
        {notificationCount > 0 && (
          <span className="notification-badge">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <div className="notification-dropdown">
            <div className="notification-dropdown-header">
              <h3>Notificações</h3>
              {notificationCount > 0 && (
                <span className="notification-count">{notificationCount}</span>
              )}
            </div>
            
            <div className="notification-dropdown-content">
              {allNotifications.length === 0 ? (
                <div className="notification-empty">
                  <svg className="notification-empty-icon" viewBox="0 0 24 24" fill="none">
                    <path 
                      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                    <path 
                      d="M13.73 21a2 2 0 0 1-3.46 0" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p>Nenhuma notificação</p>
                </div>
              ) : (
                <ul className="notification-list">
                  {allNotifications.map((notification) => (
                    <li 
                      key={notification.id} 
                      className={`notification-item notification-${notification.type}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-item-icon">
                        {notification.type === 'success' && '✓'}
                        {notification.type === 'error' && '✕'}
                        {notification.type === 'warning' && '⚠'}
                        {notification.type === 'info' && 'ℹ'}
                      </div>
                      <div className="notification-item-content">
                        <div className="notification-item-title">
                          {notification.title}
                        </div>
                        <div className="notification-item-message">
                          {notification.message}
                        </div>
                        {notification.persistent && (
                          <div className="notification-item-action">
                            Clique para resolver
                          </div>
                        )}
                      </div>
                      {notification.persistent && (
                        <div className="notification-item-persistent">
                          <span className="persistent-indicator">●</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {allNotifications.length > 0 && (
              <div className="notification-dropdown-footer">
                <button 
                  className="notification-clear-btn"
                  onClick={() => {
                    clearAll(); // Clear non-persistent notifications
                    closeDropdown();
                  }}
                >
                  Limpar todas
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default NotificationIcon;