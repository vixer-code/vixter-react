import { useEffect, useState } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { database } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

export const usePresence = (userId) => {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState('offline');
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    if (!userId) return;

    // Listen for status changes
    const statusRef = ref(database, `status/${userId}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setStatus(data.state || 'offline');
        setLastSeen(data.last_changed);
      } else {
        setStatus('offline');
        setLastSeen(null);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const updateStatus = async (newStatus) => {
    if (!currentUser || currentUser.uid !== userId) return;

    try {
      const statusRef = ref(database, `status/${userId}`);
      await set(statusRef, {
        state: newStatus,
        last_changed: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return { status, lastSeen, updateStatus };
};

export const usePresenceSystem = () => {
  const { currentUser } = useAuth();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.uid;
    const userStatusRef = ref(database, `status/${uid}`);
    const connectedRef = ref(database, '.info/connected');

    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: serverTimestamp(),
    };

    const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
    };

    // Listen for connection state changes
    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) {
        return;
      }

      // Set up disconnect handler
      onDisconnect(userStatusRef).set(isOfflineForDatabase).then(() => {
        // Set online status
        set(userStatusRef, isOnlineForDatabase);
        setIsOnline(true);
      });
    });

    // Set up inactivity detection
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      inactivityTimer = setTimeout(() => {
        if (isOnline) {
          set(userStatusRef, {
            state: 'ausente',
            last_changed: serverTimestamp(),
          });
        }
      }, INACTIVITY_TIMEOUT);
    };

    const handleActivity = () => {
      resetInactivityTimer();
      if (isOnline) {
        set(userStatusRef, isOnlineForDatabase);
      }
    };

    // Add event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial timer start
    resetInactivityTimer();

    return () => {
      unsubscribeConnected();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
    };
  }, [currentUser, isOnline]);

  return { isOnline };
}; 