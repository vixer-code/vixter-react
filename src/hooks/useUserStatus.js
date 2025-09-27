import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../config/firebase';

export const useUserStatus = (userId) => {
  const [status, setStatus] = useState('offline');

  useEffect(() => {
    if (!userId) {
      setStatus('offline');
      return;
    }

    const statusRef = ref(database, `status/${userId}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const statusData = snapshot.val();
        const now = Date.now();
        const OFFLINE_THRESHOLD = 3 * 60 * 1000; // 3 minutes
        const lastChanged = statusData.last_changed;
        const isRecentActivity = lastChanged && (now - lastChanged) < OFFLINE_THRESHOLD;
        
        // Only consider user online if they have recent activity AND status is online
        const actualStatus = (statusData.state === 'online' && isRecentActivity) ? 'online' : 'offline';
        setStatus(actualStatus);
      } else {
        setStatus('offline');
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return status;
};