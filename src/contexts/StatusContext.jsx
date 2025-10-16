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

  // Update user status function
  const updateUserStatus = useCallback(async (status) => {
    if (!currentUser?.uid) {
      console.error('❌ No user authenticated');
      return false;
    }

    try {
      const uid = currentUser.uid;
      
      // Logic: offline/ausente/ocupado = manual, online = automatic
      // This is called only when user manually clicks buttons
      await set(ref(database, `status/${uid}`), {
        state: status,
        last_changed: serverTimestamp(),
        manual: status !== 'online'
      });
      
      setSelectedStatus(status);
      console.log(`✅ Status updated to: ${status} (manual: ${status !== 'online'})`);
      return true;
    } catch (error) {
      console.error('Error updating user status:', error);
      return false;
    }
  }, [currentUser]);

  // Get current status function
  const getCurrentStatus = useCallback(async (uid) => {
    try {
      const snapshot = await get(ref(database, `status/${uid}`));
      const data = snapshot.val();
      
      console.log('🔍 getCurrentStatus - Raw data from DB:', {
        uid: uid.slice(0, 8),
        data,
        hasData: !!data,
        state: data?.state,
        manual: data?.manual,
        manualType: typeof data?.manual
      });
      
      return data || { state: 'offline', manual: false };
    } catch (error) {
      console.error('Error getting current status:', error);
      return { state: 'offline', manual: false };
    }
  }, []);

  // Debug function
  const debugStatus = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      const data = await getCurrentStatus(currentUser.uid);
      console.log('🔍 Status Debug:', {
        uid: currentUser.uid.slice(0, 8),
        localStatus: userStatus,
        dbStatus: data?.state || 'not found',
        manual: data?.manual || 'not found',
        lastChanged: data?.last_changed || 'not found',
        isConnected,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('🔍 Debug error:', error);
    }
  }, [currentUser, userStatus, isConnected, getCurrentStatus]);

  // Main useEffect for status management
  useEffect(() => {
    if (!currentUser || !currentUser.uid) {
      setUserStatus('offline');
      setSelectedStatus('online');
      setIsConnected(false);
      return;
    }

    const uid = currentUser.uid;
    let statusUnsubscribe = null;
    let connectionUnsubscribe = null;

    // Function to setup status listener
    const setupStatusListener = () => {
      const userStatusRef = ref(database, `status/${uid}`);
      
      statusUnsubscribe = onValue(userStatusRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log('📊 Status changed:', {
            uid: uid.slice(0, 8),
            state: data.state,
            manual: data.manual,
            last_changed: data.last_changed,
            timestamp: new Date().toISOString()
          });
          setUserStatus(data.state || 'offline');
          setSelectedStatus(data.state || 'online');
        } else {
          console.log('📊 No status data found for user:', uid.slice(0, 8));
          setUserStatus('offline');
          setSelectedStatus('online');
        }
      });
    };

    // Function to setup connection listener
    const setupConnectionListener = () => {
      const connectedRef = ref(database, '.info/connected');
      
      connectionUnsubscribe = onValue(connectedRef, async (snapshot) => {
        const connected = snapshot.val();
        setIsConnected(connected);
        
        if (connected) {
          console.log('🌐 User connected');
          
          // Get current status to check if manual
          const currentStatus = await getCurrentStatus(uid);
          
          console.log('🔍 CONNECTION CHECK - Current status:', {
            uid: uid.slice(0, 8),
            currentStatus,
            manual: currentStatus?.manual,
            manualType: typeof currentStatus?.manual,
            isManual: currentStatus?.manual === true
          });
          
          // Set up disconnect handler (only for automatic users)
          const userStatusRef = ref(database, `status/${uid}`);
          
          // Only set up disconnect handler if user is not manual
          if (currentStatus.manual !== true) {
            onDisconnect(userStatusRef).set({
              state: 'offline',
              last_changed: serverTimestamp(),
              manual: currentStatus?.manual || false
            });
            console.log('🔧 Disconnect handler configured for automatic user');
          } else {
            console.log('🔧 No disconnect handler - user has manual status');
          }
          
          // If user has manual status (offline/ausente/ocupado), don't change it
          if (currentStatus.manual === true) {
            console.log('🔒 Manual status detected, respecting:', currentStatus.state);
            console.log('🚫 SKIPPING AUTOMATIC ONLINE - User has manual status');
          } else {
            // Set to online automatically but preserve manual flag
            console.log('🔧 SETTING TO ONLINE AUTOMATICALLY:', {
              uid: uid.slice(0, 8),
              manual: currentStatus?.manual || false,
              timestamp: new Date().toISOString()
            });
            await set(userStatusRef, {
              state: 'online',
              last_changed: serverTimestamp(),
              manual: currentStatus?.manual || false
            });
            console.log('✅ Set to online automatically');
            console.log('🔄 PRESENCE DYNAMIC - User is now online and being tracked');
          }
        } else {
          console.log('📴 User disconnected');
          
          // Get current status to check if manual
          const currentStatus = await getCurrentStatus(uid);
          
          // If user has manual status (offline/ausente/ocupado), don't change it
          if (currentStatus.manual === true) {
            console.log('🔒 Manual status detected, respecting:', currentStatus.state);
          } else {
            // Set to offline automatically but preserve manual flag
            const userStatusRef = ref(database, `status/${uid}`);
            await set(userStatusRef, {
              state: 'offline',
              last_changed: serverTimestamp(),
              manual: currentStatus?.manual || false
            });
            console.log('✅ Set to offline automatically');
          }
        }
      });
    };

    // Setup listeners
    console.log('🔧 Setting up listeners for user:', uid.slice(0, 8));
    setupStatusListener();
    setupConnectionListener();

    // Cleanup function
    return () => {
      if (statusUnsubscribe) {
        statusUnsubscribe();
      }
      if (connectionUnsubscribe) {
        connectionUnsubscribe();
      }
    };
  }, [currentUser, getCurrentStatus]);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!currentUser?.uid) return;
      
      const uid = currentUser.uid;
      
      if (document.hidden) {
        console.log('📱 Page hidden');
        
        // Get current status to check if manual
        const currentStatus = await getCurrentStatus(uid);
        
        // If user has manual status, don't change it
        if (currentStatus.manual === true) {
          console.log('🔒 Manual status detected, respecting:', currentStatus.state);
          console.log('🚫 SKIPPING AUTOMATIC OFFLINE - User has manual status');
        } else {
          // Set to offline automatically but preserve manual flag
          await set(ref(database, `status/${uid}`), {
            state: 'offline',
            last_changed: serverTimestamp(),
            manual: currentStatus?.manual || false
          });
          console.log('✅ Set to offline (page hidden)');
          console.log('🔄 PRESENCE DYNAMIC - User is now offline and being tracked');
        }
      } else {
        console.log('📱 Page visible');
        
        // Get current status to check if manual
        const currentStatus = await getCurrentStatus(uid);
        
        // If user has manual status, don't change it
        if (currentStatus.manual === true) {
          console.log('🔒 Manual status detected, respecting:', currentStatus.state);
          console.log('🚫 SKIPPING AUTOMATIC ONLINE - User has manual status');
        } else {
          // Set to online automatically but preserve manual flag
          await set(ref(database, `status/${uid}`), {
            state: 'online',
            last_changed: serverTimestamp(),
            manual: currentStatus?.manual || false
          });
          console.log('✅ Set to online (page visible)');
          console.log('🔄 PRESENCE DYNAMIC - User is now online and being tracked');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, getCurrentStatus]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (!currentUser?.uid) return;
      
      const uid = currentUser.uid;
      
      // Get current status to check if manual
      const currentStatus = await getCurrentStatus(uid);
      
      // If user has manual status, don't change it
      if (currentStatus.manual === true) {
        console.log('🔒 Manual status detected, respecting:', currentStatus.state);
        console.log('🚫 SKIPPING AUTOMATIC OFFLINE - User has manual status');
      } else {
        // Set to offline automatically but preserve manual flag
        await set(ref(database, `status/${uid}`), {
          state: 'offline',
          last_changed: serverTimestamp(),
          manual: currentStatus?.manual || false
        });
        console.log('✅ Set to offline (page unload)');
        console.log('🔄 PRESENCE DYNAMIC - User is now offline and being tracked');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [currentUser, getCurrentStatus]);

  const value = useMemo(() => ({
    userStatus,
    selectedStatus,
    isConnected,
    lastActivity,
    currentPage,
    updateUserStatus,
    getCurrentStatus,
    debugStatus,
    // Status options (simplified)
    statusOptions: [
      { value: 'online', label: 'Online', color: '#22c55e', emoji: '🟢' },
      { value: 'offline', label: 'Offline', color: '#ef4444', emoji: '🔴' }
    ]
  }), [userStatus, selectedStatus, isConnected, lastActivity, currentPage, updateUserStatus, getCurrentStatus, debugStatus]);

  return (
    <StatusContext.Provider value={value}>
      {children}
    </StatusContext.Provider>
  );
}; 