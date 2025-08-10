import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { ref, update } from 'firebase/database';
import { database } from '../../config/firebase';
import './EmailVerificationStatus.css';

const EmailVerificationStatus = ({ 
  showActions = true, 
  compact = false, 
  theme = 'default',
  autoRefresh = true,
  refreshInterval = 30000 
}) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const [verificationStatus, setVerificationStatus] = useState({
    isVerified: false,
    email: '',
    lastSent: null,
    canResend: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentUser) {
      updateStatus();
      
      if (autoRefresh) {
        const interval = setInterval(updateStatus, refreshInterval);
        return () => clearInterval(interval);
      }
    }
  }, [currentUser, autoRefresh, refreshInterval]);

  const updateStatus = async () => {
    if (!currentUser) return;

    try {
      // Reload user to get latest verification status
      await currentUser.reload();
      
      const isVerified = currentUser.emailVerified;
      const email = currentUser.email;
      
      // Check if we can resend (cooldown of 1 minute)
      const lastSent = currentUser.metadata?.lastSignInTime ? 
        new Date(currentUser.metadata.lastSignInTime).getTime() : null;
      const canResend = !lastSent || (Date.now() - lastSent) > 60000;

      const wasVerified = verificationStatus.isVerified;
      setVerificationStatus({
        isVerified,
        email,
        lastSent,
        canResend
      });
      
      // Show success notification if email was just verified
      if (isVerified && !wasVerified) {
        showSuccess('E-mail verificado com sucesso!');
      }
      
      setError(null);
    } catch (error) {
      console.error('Error updating verification status:', error);
      setError('Erro ao verificar status do e-mail');
      showError('Erro ao verificar status do e-mail');
    }
  };

  const handleResendEmail = async () => {
    if (!currentUser || !verificationStatus.canResend) return;

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

      // Update status
      setVerificationStatus(prev => ({
        ...prev,
        lastSent: Date.now(),
        canResend: false
      }));

      // Re-enable resend after 1 minute
      setTimeout(() => {
        setVerificationStatus(prev => ({
          ...prev,
          canResend: true
        }));
      }, 60000);

      showSuccess('E-mail de verificação reenviado com sucesso!');

    } catch (error) {
      console.error('Error resending verification email:', error);
      setError('Erro ao reenviar e-mail de verificação');
      showError('Erro ao reenviar e-mail de verificação');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      await updateStatus();
      showInfo('Status do e-mail verificado');
    } catch (error) {
      console.error('Error checking status:', error);
      setError('Erro ao verificar status');
      showError('Erro ao verificar status');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) {
      return 'agora mesmo';
    } else if (minutes < 60) {
      return `há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else if (hours < 24) {
      return `há ${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
      return `há ${days} dia${days > 1 ? 's' : ''}`;
    }
  };

  if (!currentUser) return null;

  const className = `email-verification-status ${compact ? 'compact' : ''} theme-${theme} ${verificationStatus.isVerified ? 'verified' : 'unverified'}`;

  if (error) {
    return (
      <div className={`${className} error`}>
        <div className="status-content error">
          <span className="status-icon">❌</span>
          <div className="error-message">
            <h4>Erro ao verificar status</h4>
            <p>{error}</p>
            <button className="action-btn retry-btn" onClick={handleCheckStatus}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus.isVerified) {
    return (
      <div className={className}>
        {compact ? (
          <div className="status-indicator verified">
            <span className="status-icon">✅</span>
            <span className="status-text">E-mail verificado</span>
          </div>
        ) : (
          <div className="status-content">
            <div className="status-header">
              <span className="status-icon">✅</span>
              <h4>E-mail Verificado</h4>
            </div>
            <p className="status-description">
              Seu endereço <strong>{verificationStatus.email}</strong> foi verificado com sucesso.
            </p>
          </div>
        )}
      </div>
    );
  }

  const lastSentText = verificationStatus.lastSent ? 
    `Último e-mail enviado ${formatTimeAgo(verificationStatus.lastSent)}` : 
    'Nenhum e-mail de verificação enviado ainda';

  return (
    <div className={className}>
      {compact ? (
        <div className="status-indicator unverified">
          <span className="status-icon">⚠️</span>
          <span className="status-text">E-mail não verificado</span>
          {showActions && (
            <button 
              className="action-btn resend-btn" 
              disabled={!verificationStatus.canResend || loading}
              onClick={handleResendEmail}
            >
              {loading ? 'Enviando...' : 'Reenviar'}
            </button>
          )}
        </div>
      ) : (
        <div className="status-content">
          <div className="status-header">
            <span className="status-icon">⚠️</span>
            <h4>E-mail Não Verificado</h4>
          </div>
          <div className="status-description">
            <p>Verifique sua caixa de entrada em <strong>{verificationStatus.email}</strong> e clique no link de verificação.</p>
            <p className="last-sent">{lastSentText}</p>
          </div>
          {showActions && (
            <div className="status-actions">
              <button className="action-btn primary verify-btn" onClick={handleCheckStatus}>
                Verificar agora
              </button>
              <button 
                className="action-btn secondary resend-btn" 
                disabled={!verificationStatus.canResend || loading}
                onClick={handleResendEmail}
              >
                {loading ? 'Enviando...' : 
                  verificationStatus.canResend ? 'Reenviar e-mail' : 'Aguarde para reenviar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailVerificationStatus; 