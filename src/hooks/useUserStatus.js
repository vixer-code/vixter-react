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
        // Simply use the state from RTDB without complex threshold logic
        setStatus(statusData.state || 'offline');
      } else {
        setStatus('offline');
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return status;
};