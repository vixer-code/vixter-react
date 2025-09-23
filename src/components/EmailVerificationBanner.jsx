import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { sendEmailVerification } from 'firebase/auth';
import { Mail, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import './EmailVerificationBanner.css';

const EmailVerificationBanner = () => {
  const { currentUser } = useAuth();
  const { emailVerified, loading } = useEmailVerification();
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState('');
  const [showBanner, setShowBanner] = useState(true);

  // Don't show banner if user is not logged in, email is verified, or still loading
  if (!currentUser || emailVerified || loading || !showBanner) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsSending(true);
    setMessage('');

    try {
      await sendEmailVerification(currentUser, {
        url: `https://vixter-react.vercel.app/verify-email`,
        handleCodeInApp: false
      });
      setMessage('Email de verificação enviado! Verifique sua caixa de entrada.');
    } catch (error) {
      console.error('Error sending verification email:', error);
      setMessage(error.message || 'Erro ao enviar email. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  return (
    <div className="email-verification-banner">
      <div className="banner-content">
        <div className="banner-icon">
          <AlertCircle size={20} />
        </div>
        <div className="banner-text">
          <h4>Verifique seu email</h4>
          <p>
            Enviamos um link de verificação para <strong>{currentUser.email}</strong>. 
            Clique no link para ativar sua conta.
          </p>
          {message && (
            <div className={`banner-message ${message.includes('enviado') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </div>
        <div className="banner-actions">
          <button
            onClick={handleResendEmail}
            disabled={isSending}
            className="resend-button"
          >
            {isSending ? (
              <>
                <RefreshCw size={16} className="spinning" />
                Enviando...
              </>
            ) : (
              <>
                <Mail size={16} />
                Reenviar
              </>
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="dismiss-button"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
