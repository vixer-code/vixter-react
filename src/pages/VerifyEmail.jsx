import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { ref, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';
import './VerifyEmail.css';

const VerifyEmail = () => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [checkInterval, setCheckInterval] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // If already verified, redirect to profile
    if (currentUser.emailVerified) {
      handleVerificationSuccess();
      return;
    }

    // Start auto-check for verification
    startAutoCheck();

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [currentUser]);

  const startAutoCheck = () => {
    const interval = setInterval(async () => {
      try {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          handleVerificationSuccess();
        }
      } catch (error) {
        console.error('Error in auto-check:', error);
      }
    }, 5000); // Check every 5 seconds

    setCheckInterval(interval);
  };

  const handleVerificationSuccess = async () => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }

    try {
      // Update database
      await update(ref(database, `users/${currentUser.uid}`), {
        emailVerified: true,
        emailVerifiedAt: Date.now()
      });

      showSuccess('✅ E-mail verificado com sucesso! Redirecionando...');
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/profile');
      }, 3000);
    } catch (error) {
      console.error('Error updating verification status:', error);
    }
  };

  const checkVerificationStatus = async () => {
    setLoading(true);
    try {
      await currentUser.reload();
      
      if (currentUser.emailVerified) {
        handleVerificationSuccess();
      } else {
        showInfo('E-mail ainda não verificado. Verifique sua caixa de entrada e clique no link de verificação.');
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
      showError('Erro ao verificar status. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (resendDisabled) return;

    setLoading(true);
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

      showSuccess('E-mail de verificação reenviado com sucesso! Verifique sua caixa de entrada.');
      startResendTimer();
    } catch (error) {
      console.error('Error resending verification email:', error);
      
      let errorMessage = 'Erro ao reenviar e-mail. Tente novamente.';
      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
      }
      
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startResendTimer = () => {
    setResendDisabled(true);
    setResendCooldown(60); // 60 seconds cooldown

    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (!currentUser) {
    return (
      <div className="verify-email-container">
        <div className="loading-text">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="verify-email-container">
      <div className="verify-email-card">
        <div className="verify-email-header">
          <div className="verify-email-icon">📧</div>
          <h1>Verificar E-mail</h1>
          <p className="verify-email-subtitle">
            Enviamos um link de verificação para:
          </p>
          <div className="user-email">{currentUser.email}</div>
        </div>

        <div className="verify-email-content">
          <div className="verification-steps">
            <h3>Como verificar seu e-mail:</h3>
            <ol>
              <li>Verifique sua caixa de entrada</li>
              <li>Procure por um e-mail do Vixter</li>
              <li>Clique no link "Verificar E-mail"</li>
              <li>Você será redirecionado automaticamente</li>
            </ol>
          </div>

          <div className="verification-actions">
            <button 
              className="btn-check-verification"
              onClick={checkVerificationStatus}
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Verificar Status'}
            </button>

            <button 
              className="btn-resend-email"
              onClick={resendVerificationEmail}
              disabled={resendDisabled || loading}
            >
              {resendDisabled 
                ? `Reenviar em ${resendCooldown}s` 
                : 'Reenviar E-mail'
              }
            </button>
          </div>

          <div className="verification-tips">
            <h4>Dicas:</h4>
            <ul>
              <li>Verifique também a pasta de spam/lixo eletrônico</li>
              <li>Certifique-se de que o e-mail está correto</li>
              <li>O link de verificação expira em 24 horas</li>
            </ul>
          </div>
        </div>

        <div className="verify-email-footer">
          <button 
            className="btn-back-to-profile"
            onClick={() => navigate('/profile')}
          >
            Voltar ao Perfil
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail; 