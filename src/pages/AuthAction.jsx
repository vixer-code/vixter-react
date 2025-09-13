import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';

const AuthAction = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useNotification();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    const apiKey = urlParams.get('apiKey');

    console.log('[AuthAction] Processing action:', { mode, oobCode: !!oobCode });

    if (!mode || !oobCode) {
      console.error('[AuthAction] Missing required parameters');
      showError('Link inválido ou expirado');
      navigate('/login');
      return;
    }

    // Since Firebase uses mode=action for all templates, we need to determine the action type
    if (mode === 'action') {
      console.log('[AuthAction] Generic action mode detected, using smart detection');
      
      // Redirect to smart handler that detects the action type
      navigate(`/handle-auth-action?mode=${mode}&oobCode=${oobCode}${apiKey ? `&apiKey=${apiKey}` : ''}`);
    } else {
      // Fallback for other modes (if they exist)
      switch (mode) {
        case 'verifyEmail':
          console.log('[AuthAction] Redirecting to email verification');
          navigate(`/verify-email?mode=${mode}&oobCode=${oobCode}${apiKey ? `&apiKey=${apiKey}` : ''}`);
          break;
        
        case 'resetPassword':
          console.log('[AuthAction] Redirecting to password reset');
          navigate(`/reset-password?mode=${mode}&oobCode=${oobCode}${apiKey ? `&apiKey=${apiKey}` : ''}`);
          break;
        
        default:
          console.error('[AuthAction] Unknown action mode:', mode);
          showError('Tipo de ação não reconhecido');
          navigate('/login');
          break;
      }
    }
  }, [location.search, navigate, showError]);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-icon">⏳</div>
          <h1>Processando...</h1>
          <p>Redirecionando para a página correta...</p>
        </div>
      </div>
    </div>
  );
};

export default AuthAction;
