import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { ref, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { sendEmailVerificationNotification } from '../services/notificationService';

export const useEmailVerification = () => {
  const { currentUser } = useAuth();
  const { showWarning, showSuccess } = useNotification();
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (currentUser) {
      checkEmailVerification();
    }
  }, [currentUser]);

  const checkEmailVerification = async () => {
    if (!currentUser) return;

    setIsChecking(true);
    try {
      // Reload user to get latest verification status
      await currentUser.reload();
      
      const emailVerified = currentUser.emailVerified;
      setIsVerified(emailVerified);

      // Update database if verified
      if (emailVerified) {
        await update(ref(database, `users/${currentUser.uid}`), {
          emailVerified: true,
          emailVerifiedAt: Date.now()
        });
      } else {
        // Show warning for unverified email
        showWarning(
          'E-mail não verificado',
          'Verifique sua caixa de entrada e clique no link de verificação para acessar todos os recursos.'
        );
        
        // Send notification for unverified email
        await sendEmailVerificationNotification(currentUser.uid);
      }
    } catch (error) {
      console.error('Error checking email verification:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const sendVerificationEmail = async () => {
    if (!currentUser) return;

    try {
      await currentUser.sendEmailVerification({
        url: `${window.location.origin}/profile`,
        handleCodeInApp: false
      });

      // Update database
      await update(ref(database, `users/${currentUser.uid}`), {
        emailVerificationSent: true,
        emailVerificationSentAt: Date.now()
      });

      showSuccess('E-mail de verificação enviado! Verifique sua caixa de entrada.');
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  };

  return {
    isVerified,
    isChecking,
    checkEmailVerification,
    sendVerificationEmail
  };
}; 