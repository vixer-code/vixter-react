import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { Lock, Eye, EyeOff } from 'lucide-react';
import PurpleSpinner from '../components/PurpleSpinner';
import './Auth.css';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oobCode, setOobCode] = useState(null);
  const [email, setEmail] = useState('');
  const [codeValid, setCodeValid] = useState(false);
  const [processing, setProcessing] = useState(true);
  
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Extract parameters from URL
    const urlParams = new URLSearchParams(location.search);
    const mode = urlParams.get('mode');
    const code = urlParams.get('oobCode');
    const apiKey = urlParams.get('apiKey');

    if (mode === 'resetPassword' && code) {
      setOobCode(code);
      verifyResetCode(code);
    } else {
      showError('Link de recuperação inválido ou expirado');
      navigate('/forgot-password');
    }
  }, [location.search, navigate]);

  const verifyResetCode = async (code) => {
    try {
      console.log('[verifyResetCode] Verifying reset code:', code);
      const email = await verifyPasswordResetCode(auth, code);
      setEmail(email);
      setCodeValid(true);
      console.log('[verifyResetCode] Reset code verified for email:', email);
    } catch (error) {
      console.error('[verifyResetCode] Error verifying reset code:', error);
      let errorMessage = 'Link de recuperação inválido ou expirado.';
      
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Link de recuperação expirado. Solicite um novo email.';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Link de recuperação inválido. Solicite um novo email.';
      }
      
      showError(errorMessage);
      navigate('/forgot-password');
    } finally {
      setProcessing(false);
    }
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return { isValid: false, message: 'A senha deve ter pelo menos 8 caracteres' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'A senha deve conter pelo menos uma letra maiúscula' };
    }
    if (!/\d/.test(password)) {
      return { isValid: false, message: 'A senha deve conter pelo menos um número' };
    }
    return { isValid: true, message: 'Senha válida' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      showError('Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      showError('As senhas não coincidem');
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      showError(validation.message);
      return;
    }

    setLoading(true);
    try {
      console.log('[handleSubmit] Resetting password for email:', email);
      await confirmPasswordReset(auth, oobCode, password);
      
      showSuccess('Senha redefinida com sucesso! Redirecionando para o login...');
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, '/reset-password');
      
      // Redirect to login after a delay
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (error) {
      console.error('[handleSubmit] Error resetting password:', error);
      
      let errorMessage = 'Erro ao redefinir senha. Tente novamente.';
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Link de recuperação expirado. Solicite um novo email.';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Link de recuperação inválido. Solicite um novo email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'A senha é muito fraca. Use pelo menos 8 caracteres com maiúscula e número.';
      }
      
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (processing) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-icon">⏳</div>
            <h1>Verificando Link</h1>
            <p>Validando link de recuperação...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!codeValid) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-icon">❌</div>
            <h1>Link Inválido</h1>
            <p>Este link de recuperação é inválido ou expirado</p>
          </div>
          <div className="auth-actions">
            <button 
              className="btn-primary"
              onClick={() => navigate('/forgot-password')}
            >
              Solicitar Novo Email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-icon">🔒</div>
          <h1>Redefinir Senha</h1>
          <p>Crie uma nova senha para <strong>{email}</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">Nova Senha</label>
            <div className="input-group">
              <Lock className="input-icon" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength="8"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <small>Use pelo menos 8 caracteres, incluindo maiúscula e número</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Nova Senha</label>
            <div className="input-group">
              <Lock className="input-icon" size={20} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme sua nova senha"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? <PurpleSpinner text="Redefinindo..." size="small" /> : 'Redefinir Senha'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Lembrou sua senha?{' '}
            <button 
              className="auth-link"
              onClick={() => navigate('/login')}
            >
              Fazer login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
