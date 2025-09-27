import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, off, remove, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastNotificationId, setLastNotificationId] = useState(null);
  const { currentUser } = useAuth();
  const { showInfo } = useNotification();

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
        
        // NOTE: Removed duplicate toast notifications here since they're now handled
        // by Centrifugo in EnhancedMessagingContext to prevent duplicates
      }
      setNotifications(notificationsData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading notifications:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser?.uid, showInfo]);

  useEffect(() => {
    const unsubscribe = loadNotifications();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!currentUser?.uid) return;
    
    try {
      // Update in Firebase
      const notificationRef = ref(database, `notifications/${currentUser.uid}/${notificationId}`);
      await update(notificationRef, { read: true });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [currentUser?.uid]);

  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      // Update all notifications in Firebase
      const notificationsRef = ref(database, `notifications/${currentUser.uid}`);
      const updates = {};
      
      notifications.forEach(notification => {
        if (!notification.read) {
          updates[`${notification.id}/read`] = true;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await update(notificationsRef, updates);
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [currentUser?.uid, notifications]);

  const deleteNotification = useCallback(async (notificationId) => {
    if (!currentUser?.uid) return;
    
    try {
      // Delete from Firebase
      const notificationRef = ref(database, `notifications/${currentUser.uid}/${notificationId}`);
      await remove(notificationRef);
      
      // Update local state
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [currentUser?.uid]);

  const deleteAllRead = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      const readNotifications = notifications.filter(n => n.read);
      
      // Delete all read notifications from Firebase
      const updates = {};
      readNotifications.forEach(notification => {
        updates[notification.id] = null; // null removes the key
      });
      
      if (Object.keys(updates).length > 0) {
        const notificationsRef = ref(database, `notifications/${currentUser.uid}`);
        await update(notificationsRef, updates);
      }
      
      // Update local state
      setNotifications(prev => 
        prev.filter(notification => !notification.read)
      );
    } catch (error) {
      console.error('Error deleting read notifications:', error);
    }
  }, [currentUser?.uid, notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.filter(n => n.read).length;

  return {
    notifications,
    loading,
    unreadCount,
    readCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead
  };
};
