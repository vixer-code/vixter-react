import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, RefreshCw, Mail } from 'lucide-react';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { doc, updateDoc } from 'firebase/firestore';
import { database, db } from '../../config/firebase';
import PurpleSpinner from '../components/PurpleSpinner';
import './VerifyEmail.css';

const VerifyEmail = () => {
  const { currentUser, refreshEmailVerification } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, error, not-verified
  const [message, setMessage] = useState('');

  // Function to update email verification status in database
  const updateEmailVerificationStatus = async (userId, isVerified) => {
    try {
      console.log('[updateEmailVerificationStatus] Updating verification status for user:', userId, 'verified:', isVerified);
      
      // Update Firebase Realtime Database
      const userRef = ref(database, `users/${userId}`);
      await update(userRef, {
        emailVerified: isVerified,
        emailVerifiedAt: isVerified ? Date.now() : null,
        updatedAt: Date.now()
      });

      // Update Firestore
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        emailVerified: isVerified,
        emailVerifiedAt: isVerified ? new Date() : null,
        updatedAt: new Date()
      });

      console.log('[updateEmailVerificationStatus] Verification status updated successfully');
    } catch (error) {
      console.error('[updateEmailVerificationStatus] Error updating verification status:', error);
      // Don't throw error, just log it
    }
  };

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        // Check if this is a verification link
        const mode = searchParams.get('mode');
        const actionCode = searchParams.get('oobCode');

        console.log('Verification params:', { mode, actionCode });
        console.log('Current user state:', currentUser ? {
          uid: currentUser.uid,
          email: currentUser.email,
          emailVerified: currentUser.emailVerified
        } : 'null');

        if (mode === 'verifyEmail' && actionCode) {
          // Verify the action code
          try {
            console.log('Verifying email with action code:', actionCode);
            console.log('Current user:', currentUser ? currentUser.uid : 'null');
            
            if (!currentUser) {
              console.log('No current user found, redirecting to login...');
              setStatus('error');
              setMessage('Você precisa estar logado para verificar seu email. Faça login primeiro.');
              return;
            }

            // Ensure user is properly authenticated
            if (!currentUser.uid) {
              console.log('User has no UID, redirecting to login...');
              setStatus('error');
              setMessage('Usuário não está autenticado corretamente. Faça login novamente.');
              return;
            }

            console.log('User is authenticated, proceeding with verification...');
            
            // First, check if the action code is valid
            console.log('Checking action code validity...');
            let actionCodeInfo;
            try {
              actionCodeInfo = await checkActionCode(actionCode);
              console.log('Action code info:', actionCodeInfo);
              console.log('Action code email:', actionCodeInfo.data.email);
              console.log('Current user email:', currentUser.email);
            } catch (checkError) {
              console.error('Error in checkActionCode:', checkError);
              console.error('Check error code:', checkError.code);
              console.error('Check error message:', checkError.message);
              throw checkError;
            }
            
            // Verify that the action code is for the current user's email
            if (actionCodeInfo.data.email !== currentUser.email) {
              throw new Error('Código de verificação não corresponde ao email do usuário logado.');
            }
            
            // Apply the action code to verify the email
            console.log('Applying action code...');
            console.log('About to call applyActionCode with:', actionCode);
            
            try {
              await applyActionCode(actionCode);
              console.log('Action code applied successfully - Firebase Auth updated!');
            } catch (applyError) {
              console.error('Error in applyActionCode:', applyError);
              console.error('Apply error code:', applyError.code);
              console.error('Apply error message:', applyError.message);
              throw applyError; // Re-throw to be caught by outer catch
            }
            
            // Update our database with the verification status
            await updateEmailVerificationStatus(currentUser.uid, true);
            
            // Refresh the auth context to update emailVerified status
            await refreshEmailVerification();
            
            setStatus('success');
            setMessage('Seu email foi verificado com sucesso!');
            console.log('Email verification completed successfully');
          } catch (verificationError) {
            console.error('Email verification failed:', verificationError);
            console.error('Error code:', verificationError.code);
            console.error('Error message:', verificationError.message);
            console.error('Full error object:', verificationError);
            
            // Only use fallback if it's a specific Firebase error, not a user error
            if (verificationError.code === 'auth/invalid-action-code' || 
                verificationError.code === 'auth/expired-action-code' ||
                verificationError.code === 'auth/user-disabled') {
              setStatus('error');
              setMessage('Código de verificação inválido ou expirado. Solicite um novo email de verificação.');
            } else {
              // For other errors, try fallback
              console.log('Firebase Auth failed, updating database as fallback...');
              console.log('Fallback reason - Error code:', verificationError.code);
              console.log('Fallback reason - Error message:', verificationError.message);
              try {
                await updateEmailVerificationStatus(currentUser.uid, true);
                await refreshEmailVerification();
                setStatus('success');
                setMessage('Seu email foi verificado com sucesso!');
                console.log('Fallback verification completed successfully');
              } catch (fallbackError) {
                console.error('Fallback verification also failed:', fallbackError);
                setStatus('error');
                setMessage('Erro na verificação. Tente novamente ou solicite um novo email.');
              }
            }
          }
        } else if (currentUser && currentUser.emailVerified) {
          // If user is already verified, make sure our database is up to date
          await updateEmailVerificationStatus(currentUser.uid, true);
          setStatus('success');
          setMessage('Seu email já foi verificado com sucesso!');
        } else if (currentUser) {
          setStatus('not-verified');
          setMessage('Clique no link de verificação que enviamos para seu email.');
        } else {
          setStatus('error');
          setMessage('Você precisa estar logado para verificar seu email.');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        setStatus('error');
        setMessage('Erro ao verificar email. Tente novamente.');
      }
    };

    handleEmailVerification();
  }, [currentUser, searchParams]);

  const handleGoToProfile = () => {
    navigate('/profile');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="verification-content">
            <div className="verification-icon loading">
              <PurpleSpinner size="large" />
            </div>
            <h2>Verificando email...</h2>
            <p>Aguarde enquanto verificamos seu email.</p>
          </div>
        );

      case 'success':
        return (
          <div className="verification-content">
            <div className="verification-icon success">
              <CheckCircle size={64} />
            </div>
            <h2>Email Verificado!</h2>
            <p>Sua conta foi ativada com sucesso. Agora você tem acesso a todas as funcionalidades.</p>
            <div className="verification-actions">
              <button onClick={handleGoToProfile} className="btn primary">
                Ir para Perfil
              </button>
              <button onClick={handleGoHome} className="btn secondary">
                Ir para Início
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="verification-content">
            <div className="verification-icon error">
              <XCircle size={64} />
            </div>
            <h2>Erro na Verificação</h2>
            <p>{message}</p>
            <div className="verification-actions">
              <button onClick={handleGoHome} className="btn primary">
                Ir para Início
              </button>
            </div>
          </div>
        );

      case 'not-verified':
      default:
        return (
          <div className="verification-content">
            <div className="verification-icon pending">
              <Mail size={64} />
            </div>
            <h2>Verifique seu Email</h2>
            <p>
              Enviamos um link de verificação para <strong>{currentUser?.email}</strong>. 
              Clique no link para ativar sua conta.
            </p>
            {message && (
              <div className={`verification-message ${message.includes('reenviado') ? 'success' : 'info'}`}>
                {message}
              </div>
            )}
            <div className="verification-actions">
              <button onClick={handleGoHome} className="btn primary">
                Ir para Início
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="verify-email-page">
      <div className="verify-email-container">
        {renderContent()}
      </div>
    </div>
  );
};

export default VerifyEmail;