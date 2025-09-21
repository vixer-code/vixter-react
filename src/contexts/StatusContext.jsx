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
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [currentPage, setCurrentPage] = useState(window.location.pathname);

  useEffect(() => {
    if (!currentUser || !currentUser.uid) {
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
          // When disconnect trigger is set, set user as online
          set(userStatusRef, {
            state: 'online',
            last_changed: serverTimestamp()
          });
          console.log('✅ User status set to: online for user:', uid);
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

    // Load user's selected status with fallback
    const loadSelectedStatus = async () => {
      if (!uid) {
        setSelectedStatus('online');
        return;
      }
      
      try {
        const status = await getUserSelectedStatus(uid);
        setSelectedStatus(status);
      } catch (error) {
        console.error('Error loading selected status, using default:', error);
        setSelectedStatus('online');
      }
    };

    // Try to load status, but don't fail if it doesn't exist
    loadSelectedStatus();

    // Immediately set user status to online when they login
    const setInitialOnlineStatus = async () => {
      try {
        console.log('🌐 Setting initial online status for user:', uid);
        await set(ref(database, `status/${uid}`), {
          state: 'online',
          last_changed: serverTimestamp()
        });
        console.log('✅ Initial status set successfully');
      } catch (error) {
        console.error('❌ Error setting initial status:', error);
      }
    };

    // Set initial status immediately
    setInitialOnlineStatus();

    return () => {
      unsubscribeConnected();
      unsubscribeStatus();
    };
  }, [currentUser]);

  const updateUserStatus = useCallback(async (status) => {
    if (!currentUser) return false;

    // Only allow online/offline for simplified system
    if (status !== 'online' && status !== 'offline') {
      console.warn('Only online/offline status allowed in simplified system');
      return false;
    }

    try {
      const uid = currentUser.uid;
      
      // Update the current status (simplified)
      await set(ref(database, `status/${uid}`), {
        state: status,
        last_changed: serverTimestamp()
      });
      
      setSelectedStatus(status);
      return true;
    } catch (error) {
      console.error('Error updating user status:', error);
      return false;
    }
  }, [currentUser]);

  const getUserSelectedStatus = useCallback(async (uid) => {
    if (!uid) return 'online';
    
    try {
      const snapshot = await get(ref(database, `users/${uid}/selectedStatus`));
      const status = snapshot.val();
      
      // If no selectedStatus exists, create it with default value
      if (!status) {
        const defaultStatus = 'online';
        try {
          await set(ref(database, `users/${uid}/selectedStatus`), defaultStatus);
          return defaultStatus;
        } catch (writeError) {
          console.error('Error creating default selectedStatus:', writeError);
          return defaultStatus;
        }
      }
      
      return status;
    } catch (error) {
      console.error('Error getting selected status:', error);
      // Return default without trying to write (to avoid permission issues)
      return 'online';
    }
  }, []);

  const getCurrentStatus = useCallback(async (uid) => {
    try {
      const snapshot = await get(ref(database, `status/${uid}`));
      const data = snapshot.val();
      
      // If no status exists, create it with default value
      if (!data || !data.state) {
        const defaultStatus = 'offline';
        try {
          await set(ref(database, `status/${uid}`), {
            state: defaultStatus,
            last_changed: serverTimestamp(),
          });
          return defaultStatus;
        } catch (writeError) {
          console.error('Error creating default status:', writeError);
          return defaultStatus;
        }
      }
      
      return data.state;
    } catch (error) {
      console.error('Error getting current status:', error);
      // Try to create the status with default value
      try {
        const defaultStatus = 'offline';
        await set(ref(database, `status/${uid}`), {
          state: defaultStatus,
          last_changed: serverTimestamp(),
        });
        return defaultStatus;
      } catch (writeError) {
        console.error('Error creating default status after read error:', writeError);
        return 'offline';
      }
    }
  }, []);

  const value = useMemo(() => ({
    userStatus,
    selectedStatus,
    isConnected,
    lastActivity,
    currentPage,
    updateUserStatus,
    getUserSelectedStatus,
    getCurrentStatus,
    // Status options (simplified)
    statusOptions: [
      { value: 'online', label: 'Online', color: '#22c55e', emoji: '🟢' },
      { value: 'offline', label: 'Offline', color: '#ef4444', emoji: '🔴' }
    ]
  }), [userStatus, selectedStatus, isConnected, lastActivity, currentPage, updateUserStatus, getUserSelectedStatus, getCurrentStatus]);

  return (
    <StatusContext.Provider value={value}>
      {children}
    </StatusContext.Provider>
  );
}; 