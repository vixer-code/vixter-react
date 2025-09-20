import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import PurpleSpinner from '../components/PurpleSpinner';
import './Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({
    emailOrUsername: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(formData.emailOrUsername, formData.password);
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'Usuário não encontrado';
      case 'auth/wrong-password':
        return 'Senha incorreta';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Tente novamente mais tarde';
      case 'auth/user-disabled':
        return 'Conta desabilitada';
      case 'auth/invalid-email':
        return 'Email inválido';
      default:
        return 'Erro ao fazer login. Tente novamente';
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Entrar</h1>
          <p>Bem-vindo de volta ao Vixter</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="emailOrUsername">Email ou Username</label>
            <div className={`input-group ${formData.emailOrUsername ? 'has-content' : ''}`}>
              <User className="input-icon" size={20} />
              <input
                type="text"
                id="emailOrUsername"
                name="emailOrUsername"
                value={formData.emailOrUsername}
                onChange={handleChange}
                placeholder="     seu@email.com ou username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <div className={`input-group ${formData.password ? 'has-content' : ''}`}>
              <Lock className="input-icon" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="     Sua senha"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="form-options">
            <Link to="/forgot-password" className="forgot-password">
              Esqueceu sua senha?
            </Link>
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? <PurpleSpinner text="Entrando..." size="small" /> : 'Entrar'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Não tem uma conta?{' '}
            <Link to="/register" className="auth-link">
              Registre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;