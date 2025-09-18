import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  const loadNotifications = useCallback(() => {
    if (!currentUser?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const notificationsRef = ref(database, `notifications/${currentUser.uid}`);
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const notificationsData = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const notification = {
            id: childSnapshot.key,
            ...childSnapshot.val()
          };
          notificationsData.push(notification);
        });
        
        // Sort by timestamp (newest first)
        notificationsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
      setNotifications(notificationsData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading notifications:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsubscribe = loadNotifications();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadNotifications]);

  const markAsRead = useCallback((notificationId) => {
    // This would be implemented to mark a notification as read
    // For now, we'll just filter it out locally
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead
  };
};
