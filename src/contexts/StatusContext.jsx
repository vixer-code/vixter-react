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
          // When disconnect trigger is set, update status based on user's selected status
          getUserSelectedStatus(uid).then(status => {
            // Set the status to online immediately when connected
            const statusToSet = status || 'online';
            set(userStatusRef, {
              state: statusToSet,
              last_changed: serverTimestamp(),
            });
            console.log('✅ User status set to:', statusToSet, 'for user:', uid);
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
          last_changed: serverTimestamp(),
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          session_start: serverTimestamp()
        });
        
        // Also ensure selectedStatus is set to online if not set
        const currentSelectedStatus = await getUserSelectedStatus(uid);
        if (!currentSelectedStatus) {
          await set(ref(database, `users/${uid}/selectedStatus`), 'online');
        }
        console.log('✅ Initial status set successfully');
      } catch (error) {
        console.error('❌ Error setting initial status:', error);
      }
    };

    // Set initial status immediately
    setInitialOnlineStatus();

    // Set up inactivity detection
    const inactivityTimeout = 5 * 60 * 1000; // 5 minutes
    let inactivityTimer;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      setLastActivity(Date.now());
      
      // Update last activity in real-time
      if (userStatus === 'online') {
        set(ref(database, `status/${uid}/last_activity`), serverTimestamp());
      }
      
      inactivityTimer = setTimeout(async () => {
        const currentSelectedStatus = await getUserSelectedStatus(uid);
        
        // Only change to away if user is currently online
        if (currentSelectedStatus === 'online') {
          set(userStatusRef, {
            state: 'ausente',
            last_changed: serverTimestamp(),
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            last_activity: serverTimestamp(),
            current_page: window.location.pathname
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

    // Track page changes for rich presence
    const updateCurrentPage = () => {
      const newPage = window.location.pathname;
      if (newPage !== currentPage) {
        setCurrentPage(newPage);
        if (userStatus === 'online') {
          set(ref(database, `status/${uid}/current_page`), newPage);
        }
      }
    };

    // Listen for route changes
    window.addEventListener('popstate', updateCurrentPage);
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(updateCurrentPage, 0);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(updateCurrentPage, 0);
    };

    return () => {
      unsubscribeConnected();
      unsubscribeStatus();
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', updateCurrentPage);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      clearTimeout(inactivityTimer);
    };
  }, [currentUser]);

  const updateUserStatus = useCallback(async (status) => {
    if (!currentUser) return false;

    try {
      const uid = currentUser.uid;
      
      // Update the user's selected status
      await set(ref(database, `users/${uid}/selectedStatus`), status);
      
      // Update the current status with rich presence info
      await set(ref(database, `status/${uid}`), {
        state: status,
        last_changed: serverTimestamp(),
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        last_activity: serverTimestamp()
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
    // Status options
    statusOptions: [
      { value: 'online', label: 'Online', color: '#22c55e', emoji: '🟢' },
      { value: 'ausente', label: 'Ausente', color: '#f59e0b', emoji: '🟡' },
      { value: 'invisivel', label: 'Invisível', color: '#6b7280', emoji: '⚫' },
      { value: 'offline', label: 'Offline', color: '#ef4444', emoji: '🔴' }
    ]
  }), [userStatus, selectedStatus, isConnected, lastActivity, currentPage, updateUserStatus, getUserSelectedStatus, getCurrentStatus]);

  return (
    <StatusContext.Provider value={value}>
      {children}
    </StatusContext.Provider>
  );
}; 