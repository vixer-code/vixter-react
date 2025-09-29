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
        console.log('🔍 useUserStatus - Status update:', {
          userId: userId.slice(0, 8),
          state: statusData.state,
          last_changed: statusData.last_changed,
          timestamp: new Date().toISOString()
        });
        // Simply use the state from RTDB without complex threshold logic
        setStatus(statusData.state || 'offline');
      } else {
        console.log('🔍 useUserStatus - No status data for user:', userId.slice(0, 8));
        setStatus('offline');
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return status;
};