import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { verifyPasswordResetCode, checkActionCode } from 'firebase/auth';
import { auth } from '../../config/firebase';

const HandleAuthAction = () => {
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useNotification();

  useEffect(() => {
    const detectActionType = async () => {
      const urlParams = new URLSearchParams(location.search);
      const mode = urlParams.get('mode');
      const oobCode = urlParams.get('oobCode');
      const apiKey = urlParams.get('apiKey');

      console.log('[HandleAuthAction] Detecting action type:', { mode, oobCode: !!oobCode });

      if (!mode || !oobCode) {
        console.error('[HandleAuthAction] Missing required parameters');
        showError('Link inválido ou expirado');
        navigate('/login');
        return;
      }

      try {
        // Try to verify as password reset first
        try {
          await verifyPasswordResetCode(auth, oobCode);
          console.log('[HandleAuthAction] Detected as password reset');
          setActionType('resetPassword');
          navigate(`/reset-password?mode=${mode}&oobCode=${oobCode}${apiKey ? `&apiKey=${apiKey}` : ''}`);
          return;
        } catch (passwordResetError) {
          console.log('[HandleAuthAction] Not a password reset, trying email verification');
          
          // If not password reset, try email verification
          try {
            await checkActionCode(auth, oobCode);
            console.log('[HandleAuthAction] Detected as email verification');
            setActionType('verifyEmail');
            navigate(`/verify-email?mode=${mode}&oobCode=${oobCode}${apiKey ? `&apiKey=${apiKey}` : ''}`);
            return;
          } catch (emailVerificationError) {
            console.error('[HandleAuthAction] Neither password reset nor email verification');
            showError('Link inválido ou expirado');
            navigate('/login');
            return;
          }
        }
      } catch (error) {
        console.error('[HandleAuthAction] Error detecting action type:', error);
        showError('Erro ao processar link');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    detectActionType();
  }, [location.search, navigate, showError]);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-icon">⏳</div>
          <h1>Detectando Tipo de Ação</h1>
          <p>Analisando link para determinar a ação correta...</p>
        </div>
      </div>
    </div>
  );
};

export default HandleAuthAction;
