import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { database } from '../../config/firebase';
import { ref, set, get } from 'firebase/database';
import { updateProfile } from 'firebase/auth';
import './Settings.css';

const Settings = () => {
  const { currentUser } = useAuth();
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

  useEffect(() => {
    if (currentUser) {
      loadUserSettings();
    }
  }, [currentUser]);

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
        <p>Gerencie suas preferências e informações da conta</p>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h2>Informações Pessoais</h2>
          <div className="settings-grid">
            <div className="setting-group">
              <label htmlFor="displayName">Nome de Exibição</label>
              <input
                type="text"
                id="displayName"
                value={userSettings.displayName}
                onChange={(e) => handleInputChange(null, 'displayName', e.target.value)}
                placeholder="Seu nome de exibição"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="username">Nome de Usuário</label>
              <input
                type="text"
                id="username"
                value={userSettings.username}
                onChange={(e) => handleInputChange(null, 'username', e.target.value)}
                placeholder="seu_usuario"
              />
            </div>

            <div className="setting-group full-width">
              <label htmlFor="bio">Biografia</label>
              <textarea
                id="bio"
                value={userSettings.bio}
                onChange={(e) => handleInputChange(null, 'bio', e.target.value)}
                placeholder="Conte um pouco sobre você..."
                rows="3"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                value={userSettings.email}
                disabled
                className="disabled"
              />
              <small>O e-mail não pode ser alterado</small>
            </div>

            <div className="setting-group">
              <label htmlFor="phone">Telefone</label>
              <input
                type="tel"
                id="phone"
                value={userSettings.phone}
                onChange={(e) => handleInputChange(null, 'phone', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="location">Localização</label>
              <input
                type="text"
                id="location"
                value={userSettings.location}
                onChange={(e) => handleInputChange(null, 'location', e.target.value)}
                placeholder="Sua cidade, estado"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="website">Website</label>
              <input
                type="url"
                id="website"
                value={userSettings.website}
                onChange={(e) => handleInputChange(null, 'website', e.target.value)}
                placeholder="https://seusite.com"
              />
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Notificações</h2>
          <div className="settings-grid">
            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.notifications.email}
                  onChange={(e) => handleInputChange('notifications', 'email', e.target.checked)}
                />
                <span className="checkmark"></span>
                Notificações por E-mail
              </label>
              <small>Receba notificações importantes por e-mail</small>
            </div>

            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.notifications.push}
                  onChange={(e) => handleInputChange('notifications', 'push', e.target.checked)}
                />
                <span className="checkmark"></span>
                Notificações Push
              </label>
              <small>Receba notificações em tempo real</small>
            </div>

            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.notifications.messages}
                  onChange={(e) => handleInputChange('notifications', 'messages', e.target.checked)}
                />
                <span className="checkmark"></span>
                Novas Mensagens
              </label>
              <small>Seja notificado sobre novas mensagens</small>
            </div>

            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.notifications.services}
                  onChange={(e) => handleInputChange('notifications', 'services', e.target.checked)}
                />
                <span className="checkmark"></span>
                Atualizações de Serviços
              </label>
              <small>Receba notificações sobre seus serviços</small>
            </div>

            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.notifications.marketing}
                  onChange={(e) => handleInputChange('notifications', 'marketing', e.target.checked)}
                />
                <span className="checkmark"></span>
                Marketing e Promoções
              </label>
              <small>Receba ofertas e novidades (opcional)</small>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Privacidade</h2>
          <div className="settings-grid">
            <div className="setting-group">
              <label htmlFor="profileVisibility">Visibilidade do Perfil</label>
              <select
                id="profileVisibility"
                value={userSettings.privacy.profileVisibility}
                onChange={(e) => handleInputChange('privacy', 'profileVisibility', e.target.value)}
              >
                <option value="public">Público</option>
                <option value="friends">Apenas Amigos</option>
                <option value="private">Privado</option>
              </select>
            </div>

            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.privacy.showEmail}
                  onChange={(e) => handleInputChange('privacy', 'showEmail', e.target.checked)}
                />
                <span className="checkmark"></span>
                Mostrar E-mail no Perfil
              </label>
            </div>

            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.privacy.showPhone}
                  onChange={(e) => handleInputChange('privacy', 'showPhone', e.target.checked)}
                />
                <span className="checkmark"></span>
                Mostrar Telefone no Perfil
              </label>
            </div>

            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.privacy.allowMessages}
                  onChange={(e) => handleInputChange('privacy', 'allowMessages', e.target.checked)}
                />
                <span className="checkmark"></span>
                Permitir Mensagens
              </label>
            </div>

            <div className="setting-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={userSettings.privacy.allowServiceRequests}
                  onChange={(e) => handleInputChange('privacy', 'allowServiceRequests', e.target.checked)}
                />
                <span className="checkmark"></span>
                Permitir Solicitações de Serviço
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Preferências</h2>
          <div className="settings-grid">
            <div className="setting-group">
              <label htmlFor="theme">Tema</label>
              <select
                id="theme"
                value={userSettings.theme}
                onChange={(e) => handleInputChange(null, 'theme', e.target.value)}
              >
                <option value="auto">Automático</option>
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="language">Idioma</label>
              <select
                id="language"
                value={userSettings.language}
                onChange={(e) => handleInputChange(null, 'language', e.target.value)}
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Español</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button
            onClick={saveSettings}
            disabled={loading}
            className="save-btn"
          >
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          
          <button
            onClick={resetSettings}
            className="reset-btn"
          >
            Redefinir
          </button>
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