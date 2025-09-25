import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ref, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { database, db } from '../../config/firebase';

export const useEmailVerification = () => {
  const { currentUser } = useAuth();
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!currentUser) {
        setEmailVerified(false);
        setEmailVerifiedAt(null);
        setLoading(false);
        return;
      }

      try {
        // First check Firebase Auth status
        const authVerified = currentUser.emailVerified;
        
        // Then check our database for additional info
        let dbVerified = false;
        let dbVerifiedAt = null;

        try {
          // Check Firebase Realtime Database
          const userRef = ref(database, `users/${currentUser.uid}`);
          const snapshot = await get(userRef);
          
          if (snapshot.exists()) {
            const userData = snapshot.val();
            dbVerified = userData.emailVerified || false;
            dbVerifiedAt = userData.emailVerifiedAt || null;
          }
        } catch (dbError) {
          console.warn('Error checking database verification status:', dbError);
        }

        // Use the most recent verification status
        // If either Firebase Auth or our database says it's verified, consider it verified
        const finalVerified = authVerified || dbVerified;
        setEmailVerified(finalVerified);
        setEmailVerifiedAt(dbVerifiedAt);
        
        console.log('Email verification status:', {
          authVerified,
          dbVerified,
          finalVerified,
          verifiedAt: dbVerifiedAt
        });

      } catch (error) {
        console.error('Error checking email verification:', error);
        setEmailVerified(false);
        setEmailVerifiedAt(null);
      } finally {
        setLoading(false);
      }
    };

    checkEmailVerification();
  }, [currentUser, currentUser?.emailVerified]);

  return {
    emailVerified,
    emailVerifiedAt,
    loading
  };
};

export default useEmailVerification;