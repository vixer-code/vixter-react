import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Mail, ArrowLeft } from 'lucide-react';
import './Auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      showError('Por favor, digite seu email');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setEmailSent(true);
      showSuccess('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (error) {
      console.error('Reset password error:', error);
      showError(error.message || 'Erro ao enviar email de recuperação');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-icon">📧</div>
            <h1>Email Enviado!</h1>
            <p>Verifique sua caixa de entrada</p>
          </div>

          <div className="success-message">
            <div className="success-content">
              <h3>Email de recuperação enviado</h3>
              <p>
                Enviamos um link para <strong>{email}</strong> com instruções para redefinir sua senha.
              </p>
              <div className="instructions">
                <h4>Próximos passos:</h4>
                <ol>
                  <li>Verifique sua caixa de entrada</li>
                  <li>Procure por um email da Vixter</li>
                  <li>Clique no link "Redefinir Senha"</li>
                  <li>Siga as instruções para criar uma nova senha</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="auth-actions">
            <button 
              className="btn-secondary"
              onClick={() => setEmailSent(false)}
            >
              Enviar novamente
            </button>
            <Link to="/login" className="btn-primary">
              Voltar ao Login
            </Link>
          </div>

          <div className="auth-footer">
            <p>
              Não recebeu o email?{' '}
              <button 
                className="auth-link"
                onClick={() => setEmailSent(false)}
              >
                Tentar novamente
              </button>
            </p>
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
          <h1>Esqueceu sua senha?</h1>
          <p>Digite seu email para receber instruções de recuperação</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-group">
              <Mail className="input-icon" size={20} />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu email"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Enviar Email de Recuperação'}
          </button>
        </form>

        <div className="auth-actions">
          <Link to="/login" className="btn-secondary">
            <ArrowLeft size={16} />
            Voltar ao Login
          </Link>
        </div>

        <div className="auth-footer">
          <p>
            Lembrou sua senha?{' '}
            <Link to="/login" className="auth-link">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
