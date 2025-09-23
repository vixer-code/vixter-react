import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, RefreshCw, Mail } from 'lucide-react';
import PurpleSpinner from '../components/PurpleSpinner';
import './VerifyEmail.css';

const VerifyEmail = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, error, not-verified
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        // Check if user is logged in
        if (!currentUser) {
          setStatus('error');
          setMessage('Você precisa estar logado para verificar seu email.');
          return;
        }

        // Check if email is already verified
        if (currentUser.emailVerified) {
          setStatus('success');
          setMessage('Seu email já foi verificado com sucesso!');
          return;
        }

        // Check if this is a verification link
        const mode = searchParams.get('mode');
        const actionCode = searchParams.get('oobCode');

        console.log('Verification params:', { mode, actionCode });

        if (mode === 'verifyEmail' && actionCode) {
          // For now, we'll just show that verification is needed
          // In a real implementation, you would handle the verification here
          setStatus('not-verified');
          setMessage('Clique no link de verificação que enviamos para seu email.');
        } else {
          setStatus('not-verified');
          setMessage('Clique no link de verificação que enviamos para seu email.');
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