import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp, get } from 'firebase/database';
import { database, auth } from '../../config/firebase';
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
      setIsConnected(false);
      return;
    }

    const uid = currentUser.uid;
    
    // Listen for connection status
    const connectedRef = ref(database, '.info/connected');
    const unsubscribeConnected = onValue(connectedRef, async (snapshot) => {
      const connected = snapshot.val();
      setIsConnected(connected);
      
      if (connected) {
        // Set up disconnect handler first
        const userStatusRef = ref(database, `status/${uid}`);
        const isOfflineForDatabase = {
          state: 'offline',
          last_changed: serverTimestamp(),
        };
        
        // Set up the disconnect handler
        onDisconnect(userStatusRef).set(isOfflineForDatabase);
        
        // Check if user has manually set their status to offline
        const currentStatusSnapshot = await get(userStatusRef);
        const currentStatus = currentStatusSnapshot.val();
        
        // Only set to online if user hasn't manually set themselves to offline
        if (currentStatus?.manual && currentStatus?.state === 'offline') {
          console.log('🔒 User manually set to offline, keeping offline status');
        } else {
          await set(userStatusRef, {
            state: 'online',
            last_changed: serverTimestamp(),
            manual: false // Reset manual flag when automatically setting online
          });
          console.log('✅ User status set to: online for user:', uid);
        }
      } else {
        // If disconnected, set user as offline immediately
        const userStatusRef = ref(database, `status/${uid}`);
        set(userStatusRef, {
          state: 'offline',
          last_changed: serverTimestamp(),
          manual: false // Reset manual flag when automatically setting offline
        });
        console.log('📴 User disconnected - set to offline:', uid);
      }
    });

    // Handle page visibility changes and beforeunload events
    const handleVisibilityChange = async () => {
      if (!auth?.currentUser) {
        console.log('📱 Visibility change ignored - user not authenticated');
        return;
      }
      
      const userStatusRef = ref(database, `status/${uid}`);
      
      if (document.hidden) {
        // Page is hidden, set user as offline
        set(userStatusRef, {
          state: 'offline',
          last_changed: serverTimestamp(),
          manual: false // Reset manual flag when automatically setting offline
        });
        console.log('📱 Page hidden - User set to offline:', uid);
      } else {
        // Page is visible again, check if user manually set themselves to offline
        const currentStatusSnapshot = await get(userStatusRef);
        const currentStatus = currentStatusSnapshot.val();
        
        // Only set to online if user hasn't manually set themselves to offline
        if (currentStatus?.manual && currentStatus?.state === 'offline') {
          console.log('🔒 User manually set to offline, keeping offline status');
        } else {
          set(userStatusRef, {
            state: 'online',
            last_changed: serverTimestamp(),
            manual: false // Reset manual flag when automatically setting online
          });
          console.log('📱 Page visible - User set to online:', uid);
        }
      }
    };

    const handleBeforeUnload = () => {
      if (!auth?.currentUser) {
        console.log('🚪 Page unload ignored - user not authenticated');
        return;
      }
      
      // Set user as offline when page is about to unload
      const userStatusRef = ref(database, `status/${uid}`);
      set(userStatusRef, {
        state: 'offline',
        last_changed: serverTimestamp()
      });
      console.log('🚪 Page unloading - User set to offline:', uid);
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);


    // Listen for user's own status changes
    const userStatusRef = ref(database, `status/${uid}`);
    const unsubscribeStatus = onValue(userStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('📊 StatusContext - User status changed:', {
          uid: uid.slice(0, 8),
          state: data.state,
          last_changed: data.last_changed,
          timestamp: new Date().toISOString()
        });
        setUserStatus(data.state || 'offline');
      } else {
        console.log('📊 StatusContext - No status data found for user:', uid.slice(0, 8));
        setUserStatus('offline');
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

    // Set up initial status and disconnect handler when user logs in
    const setupInitialStatus = async () => {
      try {
        console.log('🌐 Setting up initial status for user:', uid);
        const userStatusRef = ref(database, `status/${uid}`);
        
        // Check if user has manually set their status
        const currentStatusSnapshot = await get(userStatusRef);
        const currentStatus = currentStatusSnapshot.val();
        
        // If user has manually set themselves to offline, respect that choice
        if (currentStatus?.manual && currentStatus?.state === 'offline') {
          console.log('🔒 User manually set to offline, respecting offline status');
          // Just set up disconnect handler, don't change status
        } else {
          // User is online or no manual status set, set to online
          await set(userStatusRef, {
            state: 'online',
            last_changed: serverTimestamp(),
            manual: false // Reset manual flag when automatically setting online
          });
          console.log('✅ Initial status set to online');
        }
        
        // Always set up disconnect handler
        const isOfflineForDatabase = {
          state: 'offline',
          last_changed: serverTimestamp(),
        };
        onDisconnect(userStatusRef).set(isOfflineForDatabase);
        console.log('🔧 Disconnect handler configured');
      } catch (error) {
        console.error('❌ Error setting up initial status:', error);
      }
    };

    // Set up initial status immediately
    setupInitialStatus();

    return () => {
      // Force offline status before cleanup - only if user is still authenticated
      if (currentUser?.uid && auth?.currentUser) {
        const userStatusRef = ref(database, `status/${currentUser.uid}`);
        set(userStatusRef, {
          state: 'offline',
          last_changed: serverTimestamp()
        }).catch(error => {
          console.error('❌ Error setting offline status during cleanup:', error);
        });
        console.log('🧹 Cleanup - User set to offline:', currentUser.uid);
      } else {
        console.log('🧹 Cleanup - Skipping status update (user not authenticated)');
      }
      
      unsubscribeConnected();
      unsubscribeStatus();
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [currentUser]);

  const updateUserStatus = useCallback(async (status) => {
    if (!currentUser || !auth?.currentUser) {
      console.log('❌ Cannot update status: user not authenticated');
      return false;
    }

    // Only allow online/offline for simplified system
    if (status !== 'online' && status !== 'offline') {
      console.warn('Only online/offline status allowed in simplified system');
      return false;
    }

    try {
      const uid = currentUser.uid;
      
      // Update the current status and save the manual selection
      await Promise.all([
        set(ref(database, `status/${uid}`), {
          state: status,
          last_changed: serverTimestamp(),
          manual: true // Flag to indicate this is a manual status change
        }),
        set(ref(database, `users/${uid}/selectedStatus`), status)
      ]);
      
      setSelectedStatus(status);
      console.log(`✅ Status updated to: ${status} (manual)`);
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

  // Debug function to check current status
  const debugStatus = useCallback(async () => {
    if (!currentUser?.uid) {
      console.log('🔍 Debug: No current user');
      return;
    }
    
    try {
      const userStatusRef = ref(database, `status/${currentUser.uid}`);
      const snapshot = await get(userStatusRef);
      const data = snapshot.val();
      
      console.log('🔍 Debug Status Check:', {
        uid: currentUser.uid.slice(0, 8),
        localStatus: userStatus,
        dbStatus: data?.state || 'not found',
        lastChanged: data?.last_changed || 'not found',
        isConnected,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('🔍 Debug error:', error);
    }
  }, [currentUser, userStatus, isConnected]);

  const value = useMemo(() => ({
    userStatus,
    selectedStatus,
    isConnected,
    lastActivity,
    currentPage,
    updateUserStatus,
    getUserSelectedStatus,
    getCurrentStatus,
    debugStatus,
    // Status options (simplified)
    statusOptions: [
      { value: 'online', label: 'Online', color: '#22c55e', emoji: '🟢' },
      { value: 'offline', label: 'Offline', color: '#ef4444', emoji: '🔴' }
    ]
  }), [userStatus, selectedStatus, isConnected, lastActivity, currentPage, updateUserStatus, getUserSelectedStatus, getCurrentStatus, debugStatus]);

  return (
    <StatusContext.Provider value={value}>
      {children}
    </StatusContext.Provider>
  );
}; 