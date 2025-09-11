import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'info',
      title: '',
      message: '',
      duration: 5000,
      onClick: null, // New: callback for when notification is clicked
      data: null, // New: additional data that can be passed
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove notification after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const showSuccess = useCallback((message, title = 'Success', duration = 5000, options = {}) => {
    return addNotification({
      type: 'success',
      title,
      message,
      duration,
      ...options,
    });
  }, [addNotification]);

  const showError = useCallback((message, title = 'Error', duration = 7000, options = {}) => {
    return addNotification({
      type: 'error',
      title,
      message,
      duration,
      ...options,
    });
  }, [addNotification]);

  const showWarning = useCallback((message, title = 'Warning', duration = 6000, options = {}) => {
    return addNotification({
      type: 'warning',
      title,
      message,
      duration,
      ...options,
    });
  }, [addNotification]);

  const showInfo = useCallback((message, title = 'Info', duration = 5000, options = {}) => {
    return addNotification({
      type: 'info',
      title,
      message,
      duration,
      ...options,
    });
  }, [addNotification]);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo(() => ({
    notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll,
  }), [notifications, addNotification, removeNotification, showSuccess, showError, showWarning, showInfo, clearAll]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 