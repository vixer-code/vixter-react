import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useUser } from '../contexts/UserContext';
import { database } from '../../config/firebase';
import { ref, set, get } from 'firebase/database';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import './Settings.css';

const Settings = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [userSettings, setUserSettings] = useState({
    displayName: '',
    username: '',
    bio: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    notifications: {
      email: true,
      push: true,
      messages: true,
      services: true,
      marketing: false
    },
    privacy: {
      profileVisibility: 'public',
      showEmail: false,
      showPhone: false,
      allowMessages: true,
      allowServiceRequests: true
    },
    theme: 'auto',
    language: 'pt-BR'
  });

  // Stripe Connect states
  const [stripeStatus, setStripeStatus] = useState({
    hasAccount: false,
    isComplete: false,
    loading: false
  });

  // Password change states
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Get account type
  const accountType = userProfile?.accountType || 'client';
  const isProvider = accountType === 'provider' || accountType === 'both';

  useEffect(() => {
    if (currentUser) {
      loadUserSettings();
      if (isProvider) {
        checkStripeStatus();
      }
    }
  }, [currentUser, isProvider]);

  const loadUserSettings = async () => {
    try {
      const userRef = ref(database, `users/${currentUser.uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        setUserSettings(prev => ({
          ...prev,
          displayName: userData.displayName || currentUser.displayName || '',
          username: userData.username || '',
          bio: userData.bio || '',
          email: currentUser.email || '',
          phone: userData.phone || '',
          location: userData.location || '',
          website: userData.website || '',
          notifications: {
            ...prev.notifications,
            ...userData.notifications
          },
          privacy: {
            ...prev.privacy,
            ...userData.privacy
          },
          theme: userData.theme || 'auto',
          language: userData.language || 'pt-BR'
        }));
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      showNotification('Erro ao carregar configurações', 'error');
    }
  };

  const handleInputChange = (section, field, value) => {
    if (section) {
      setUserSettings(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setUserSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const saveSettings = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const userRef = ref(database, `users/${currentUser.uid}`);
      
      // Update Firebase Auth profile
      if (userSettings.displayName !== currentUser.displayName) {
        await updateProfile(currentUser, {
          displayName: userSettings.displayName
        });
      }

      // Update database
      await set(userRef, {
        displayName: userSettings.displayName,
        username: userSettings.username,
        bio: userSettings.bio,
        phone: userSettings.phone,
        location: userSettings.location,
        website: userSettings.website,
        notifications: userSettings.notifications,
        privacy: userSettings.privacy,
        theme: userSettings.theme,
        language: userSettings.language,
        updatedAt: Date.now()
      });

      showNotification('Configurações salvas com sucesso!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('Erro ao salvar configurações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    if (window.confirm('Tem certeza que deseja redefinir todas as configurações?')) {
      loadUserSettings();
      showNotification('Configurações redefinidas', 'info');
    }
  };

  // Stripe Connect functions
  const checkStripeStatus = async () => {
    if (!isProvider) return;
    
    setStripeStatus(prev => ({ ...prev, loading: true }));
    try {
      const getStripeStatus = httpsCallable(functions, 'getStripeConnectStatus');
      const result = await getStripeStatus();
      
      setStripeStatus({
        hasAccount: result.data.hasAccount,
        isComplete: result.data.isComplete,
        loading: false
      });
    } catch (error) {
      console.error('Error checking Stripe status:', error);
      setStripeStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const connectStripeAccount = async () => {
    if (!isProvider) return;
    
    setStripeStatus(prev => ({ ...prev, loading: true }));
    try {
      const createStripeAccount = httpsCallable(functions, 'createStripeConnectAccount');
      const returnUrl = `${window.location.origin}/settings?stripe=success`;
      const refreshUrl = `${window.location.origin}/settings?stripe=refresh`;
      
      const result = await createStripeAccount({ returnUrl, refreshUrl });
      
      if (result.data.isComplete) {
        showNotification('Conta Stripe já configurada!', 'success');
        setStripeStatus({
          hasAccount: true,
          isComplete: true,
          loading: false
        });
      } else {
        // Redirecionar para onboarding do Stripe
        window.location.href = result.data.onboardingUrl;
      }
    } catch (error) {
      console.error('Error creating Stripe account:', error);
      showNotification('Erro ao conectar conta Stripe', 'error');
      setStripeStatus(prev => ({ ...prev, loading: false }));
    }
  };

  // Password change functions
  const handlePasswordChange = (field, value) => {
    setPasswordForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const changePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showNotification('Preencha todos os campos', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showNotification('As senhas não coincidem', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showNotification('A nova senha deve ter pelo menos 6 caracteres', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      // Reautenticar usuário
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Atualizar senha
      await updatePassword(currentUser, passwordForm.newPassword);

      showNotification('Senha alterada com sucesso!', 'success');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        showNotification('Senha atual incorreta', 'error');
      } else if (error.code === 'auth/weak-password') {
        showNotification('A nova senha é muito fraca', 'error');
      } else {
        showNotification('Erro ao alterar senha', 'error');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const deleteAccount = () => {
    if (window.confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.')) {
      showNotification('Funcionalidade de exclusão de conta em desenvolvimento', 'warning');
    }
  };

  if (!currentUser) {
    return (
      <div className="settings-container">
        <div className="not-authenticated">
          <h2>Faça login para acessar as configurações</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Configurações</h1>
        <p>Gerencie suas configurações de conta e segurança</p>
      </div>

      <div className="settings-content">

        {/* Stripe Connect Section - Only for providers */}
        {isProvider && (
          <div className="settings-section">
            <h2>Pagamentos (Stripe)</h2>
            <div className="settings-grid">
              <div className="setting-group full-width">
                <label>Conta Stripe Connect</label>
                <div className="stripe-status">
                  {stripeStatus.loading ? (
                    <div className="loading-state">
                      <i className="fas fa-spinner fa-spin"></i> Verificando status...
                    </div>
                  ) : stripeStatus.hasAccount ? (
                    <div className={`stripe-status-badge ${stripeStatus.isComplete ? 'complete' : 'pending'}`}>
                      <i className={`fas ${stripeStatus.isComplete ? 'fa-check-circle' : 'fa-clock'}`}></i>
                      {stripeStatus.isComplete ? 'Conta configurada e ativa' : 'Conta pendente de configuração'}
                    </div>
                  ) : (
                    <div className="stripe-status-badge not-connected">
                      <i className="fas fa-exclamation-circle"></i>
                      Nenhuma conta Stripe configurada
                    </div>
                  )}
                </div>
                <small>
                  {stripeStatus.isComplete 
                    ? 'Sua conta Stripe está configurada! Configure PIX, conta bancária e outros métodos de pagamento no seu dashboard Stripe.'
                    : 'Configure sua conta Stripe para receber pagamentos. No Stripe você pode configurar PIX, conta bancária e outros métodos de pagamento.'
                  }
                </small>
                <div className="stripe-actions">
                  <button 
                    className={`btn-stripe ${stripeStatus.isComplete ? 'btn-success' : 'btn-primary'}`}
                    onClick={connectStripeAccount}
                    disabled={stripeStatus.loading}
                  >
                    {stripeStatus.loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i> Processando...
                      </>
                    ) : stripeStatus.isComplete ? (
                      <>
                        <i className="fab fa-stripe"></i> Gerenciar Conta Stripe
                      </>
                    ) : (
                      <>
                        <i className="fab fa-stripe"></i> Conectar Conta Stripe
                      </>
                    )}
                  </button>
                  
                  {stripeStatus.isComplete && (
                    <a 
                      href="https://dashboard.stripe.com/connect/accounts/overview" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-stripe btn-outline"
                    >
                      <i className="fas fa-external-link-alt"></i> Configurar PIX/Banco
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password Change Section */}
        <div className="settings-section">
          <h2>Segurança</h2>
          <div className="settings-grid">
            <div className="setting-group">
              <label htmlFor="currentPassword">Senha Atual</label>
              <input
                type="password"
                id="currentPassword"
                value={passwordForm.currentPassword}
                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                placeholder="Digite sua senha atual"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="newPassword">Nova Senha</label>
              <input
                type="password"
                id="newPassword"
                value={passwordForm.newPassword}
                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                placeholder="Digite sua nova senha"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="confirmPassword">Confirmar Nova Senha</label>
              <input
                type="password"
                id="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                placeholder="Confirme sua nova senha"
              />
            </div>

            <div className="setting-group full-width">
              <button 
                className="btn-primary"
                onClick={changePassword}
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              >
                {passwordLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Alterando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-key"></i> Alterar Senha
                  </>
                )}
              </button>
              <small>Mínimo de 6 caracteres. Use uma senha forte e única.</small>
            </div>
          </div>
        </div>


        <div className="settings-section danger-zone">
          <h2>Zona de Perigo</h2>
          <div className="danger-actions">
            <button
              onClick={deleteAccount}
              className="delete-account-btn"
            >
              <i className="fas fa-trash"></i>
              Excluir Conta
            </button>
            <p className="danger-warning">
              Esta ação é irreversível e excluirá permanentemente sua conta e todos os dados associados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 