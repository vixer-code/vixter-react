import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp, get } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from './AuthContext';

const StatusContext = createContext();

export const useStatus = () => {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error('useStatus must be used within a StatusProvider');
  }
  return context;
};

export const StatusProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [userStatus, setUserStatus] = useState('offline');
  const [selectedStatus, setSelectedStatus] = useState('online');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setUserStatus('offline');
      setSelectedStatus('online');
      return;
    }

    const uid = currentUser.uid;
    
    // Listen for connection status
    const connectedRef = ref(database, '.info/connected');
    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val();
      setIsConnected(connected);
      
      if (connected) {
        // Set up disconnect handler
        const userStatusRef = ref(database, `status/${uid}`);
        const isOfflineForDatabase = {
          state: 'offline',
          last_changed: serverTimestamp(),
        };
        
        onDisconnect(userStatusRef).set(isOfflineForDatabase).then(() => {
          // When disconnect trigger is set, update status based on user's selected status
          getUserSelectedStatus(uid).then(status => {
            set(userStatusRef, {
              state: status,
              last_changed: serverTimestamp(),
            });
          });
        });
      }
    });

    // Listen for user's own status changes
    const userStatusRef = ref(database, `status/${uid}`);
    const unsubscribeStatus = onValue(userStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setUserStatus(data.state || 'offline');
      }
    });

    // Load user's selected status
    getUserSelectedStatus(uid).then(status => {
      setSelectedStatus(status);
    });

    // Set up inactivity detection
    const inactivityTimeout = 5 * 60 * 1000; // 5 minutes
    let inactivityTimer;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      
      inactivityTimer = setTimeout(async () => {
        const currentSelectedStatus = await getUserSelectedStatus(uid);
        
        // Only change to away if user is currently online
        if (currentSelectedStatus === 'online') {
          set(userStatusRef, {
            state: 'ausente',
            last_changed: serverTimestamp(),
          });
        }
      }, inactivityTimeout);
    };

    // Activity events to reset timer
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 
      'scroll', 'touchstart', 'click', 'keydown'
    ];

    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    // Initial timer start
    resetInactivityTimer();

    // Handle tab visibility changes
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        resetInactivityTimer();
        
        const currentSelectedStatus = await getUserSelectedStatus(uid);
        const currentStatus = await getCurrentStatus(uid);
        
        // Only change if current status is away and selected is online
        if (currentStatus === 'ausente' && currentSelectedStatus === 'online') {
          set(userStatusRef, {
            state: 'online',
            last_changed: serverTimestamp(),
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeConnected();
      unsubscribeStatus();
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(inactivityTimer);
    };
  }, [currentUser]);

  const updateUserStatus = useCallback(async (status) => {
    if (!currentUser) return false;

    try {
      const uid = currentUser.uid;
      
      // Update the user's selected status
      await set(ref(database, `users/${uid}/selectedStatus`), status);
      
      // Update the current status
      await set(ref(database, `status/${uid}`), {
        state: status,
        last_changed: serverTimestamp(),
      });
      
      setSelectedStatus(status);
      return true;
    } catch (error) {
      console.error('Error updating user status:', error);
      return false;
    }
  }, [currentUser]);

  const getUserSelectedStatus = useCallback(async (uid) => {
    try {
      const snapshot = await get(ref(database, `users/${uid}/selectedStatus`));
      return snapshot.val() || 'online';
    } catch (error) {
      console.error('Error getting selected status:', error);
      return 'online';
    }
  }, []);

  const getCurrentStatus = useCallback(async (uid) => {
    try {
      const snapshot = await get(ref(database, `status/${uid}`));
      const data = snapshot.val();
      return data && data.state ? data.state : 'offline';
    } catch (error) {
      console.error('Error getting current status:', error);
      return 'offline';
    }
  }, []);

  const value = useMemo(() => ({
    userStatus,
    selectedStatus,
    isConnected,
    updateUserStatus,
    getUserSelectedStatus,
    getCurrentStatus
  }), [userStatus, selectedStatus, isConnected, updateUserStatus, getUserSelectedStatus, getCurrentStatus]);

  return (
    <StatusContext.Provider value={value}>
      {children}
    </StatusContext.Provider>
  );
}; 