import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';

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
        const data = snapshot.val();
        setStatus(data.state || 'offline');
      } else {
        setStatus('offline');
      }
    });

    return () => {
      off(statusRef);
    };
  }, [userId]);

  return status;
}; 