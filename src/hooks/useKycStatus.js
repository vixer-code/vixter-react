import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { ref, get } from 'firebase/database';
import { db, database } from '../../config/firebase';

const useKycStatus = () => {
  const { currentUser } = useAuth();
  const [kycState, setKycState] = useState('PENDING_UPLOAD');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getKycDocument = async (userId) => {
    try {
      const kycRef = doc(db, 'kyc', userId);
      const kycSnap = await getDoc(kycRef);
      
      if (kycSnap.exists()) {
        return kycSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting KYC document:', error);
      return null;
    }
  };

  const loadKycState = async () => {
    if (!currentUser) {
      setKycState('PENDING_UPLOAD');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First check Firestore for KYC data
      const kycData = await getKycDocument(currentUser.uid);
      
      if (kycData) {
        // KYC document exists, check status
        if (kycData.status === 'VERIFIED') {
          setKycState('VERIFIED');
        } else {
          setKycState('PENDING_VERIFICATION');
        }
      } else {
        // No KYC document, check Realtime Database for basic state
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setKycState(userData.kycState || 'PENDING_UPLOAD');
        } else {
          setKycState('PENDING_UPLOAD');
        }
      }
    } catch (error) {
      console.error('Error loading KYC state:', error);
      setError(error);
      setKycState('PENDING_UPLOAD');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKycState();
  }, [currentUser]);

  const isKycVerified = kycState === 'VERIFIED';
  const isKycPending = kycState === 'PENDING_VERIFICATION';
  const isKycNotConfigured = kycState === 'PENDING_UPLOAD';

  const getKycStatusMessage = () => {
    switch (kycState) {
      case 'VERIFIED':
        return {
          status: 'success',
          message: 'KYC verificado',
          icon: 'fas fa-check-circle'
        };
      case 'PENDING_VERIFICATION':
        return {
          status: 'warning',
          message: 'KYC em análise',
          icon: 'fas fa-clock'
        };
      case 'PENDING_UPLOAD':
      default:
        return {
          status: 'error',
          message: 'KYC não configurado',
          icon: 'fas fa-exclamation-triangle'
        };
    }
  };

  return {
    kycState,
    loading,
    error,
    isKycVerified,
    isKycPending,
    isKycNotConfigured,
    getKycStatusMessage,
    refreshKycState: loadKycState
  };
};

export default useKycStatus;
