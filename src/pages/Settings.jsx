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

  // KYC verification states
  const [kycForm, setKycForm] = useState({
    fullName: '',
    cpf: '',
    documents: {
      front: null,
      back: null,
      selfie: null
    }
  });
  const [kycLoading, setKycLoading] = useState(false);
  const [cpfVerificationState, setCpfVerificationState] = useState({
    isVerified: false,
    isVerifying: false,
    isValid: false,
    message: ''
  });

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

  // KYC Functions
  const handleKycChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setKycForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setKycForm(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleKycDocumentChange = (documentType, file) => {
    setKycForm(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [documentType]: file
      }
    }));
  };

  // CPF validation function
  const validateCPF = (cpf) => {
    const cleanCpf = cpf.replace(/\D/g, '');
    
    if (cleanCpf.length !== 11) {
      return { isValid: false, message: 'CPF deve ter 11 dígitos' };
    }
    
    if (/^(\d)\1{10}$/.test(cleanCpf)) {
      return { isValid: false, message: 'CPF inválido (todos os dígitos são iguais)' };
    }
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    if (digit1 !== parseInt(cleanCpf.charAt(9))) {
      return { isValid: false, message: 'CPF inválido (primeiro dígito verificador)' };
    }
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    if (digit2 !== parseInt(cleanCpf.charAt(10))) {
      return { isValid: false, message: 'CPF inválido (segundo dígito verificador)' };
    }
    
    return { isValid: true, message: 'CPF válido' };
  };

  // CPF verification with API
  const verifyCPF = async () => {
    const cpfRaw = kycForm.cpf.replace(/\D/g, '');
    const name = kycForm.fullName.trim();
    const birthDate = userProfile?.birthDate;

    if (!cpfRaw || !name || !birthDate) {
      setCpfVerificationState({
        isVerified: false,
        isVerifying: false,
        isValid: false,
        message: 'Preencha todos os campos obrigatórios antes de verificar.'
      });
      return;
    }

    const validation = validateCPF(kycForm.cpf);
    if (!validation.isValid) {
      setCpfVerificationState({
        isVerified: false,
        isVerifying: false,
        isValid: false,
        message: validation.message
      });
      return;
    }

    setCpfVerificationState(prev => ({ ...prev, isVerifying: true }));

    try {
      // Convert birthDate format if needed
      let formattedBirthDate = birthDate;
      if (birthDate.includes('/')) {
        const [day, month, year] = birthDate.split('/');
        formattedBirthDate = `${year}-${month}-${day}`;
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://vixter-react-llyd.vercel.app'}/api/verify-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: cpfRaw,
          name: name,
          birthDate: formattedBirthDate
        })
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        setCpfVerificationState({
          isVerified: true,
          isVerifying: false,
          isValid: true,
          message: 'CPF verificado com sucesso!'
        });
      } else {
        setCpfVerificationState({
          isVerified: false,
          isVerifying: false,
          isValid: false,
          message: data.message || 'Falha na verificação do CPF'
        });
      }
    } catch (error) {
      console.error('CPF verification error:', error);
      setCpfVerificationState({
        isVerified: false,
        isVerifying: false,
        isValid: false,
        message: 'Erro na verificação. Tente novamente.'
      });
    }
  };

  // Upload KYC documents to R2
  const uploadKycDocuments = async () => {
    if (!cpfVerificationState.isVerified) {
      showNotification('Verifique o CPF antes de enviar os documentos', 'error');
      return;
    }

    setKycLoading(true);
    try {
      const documentURLs = {};
      const uploadPromises = [];

      // Upload front document
      if (kycForm.documents.front) {
        const frontKey = `KYC/${currentUser.uid}/doc-front-${Date.now()}.${kycForm.documents.front.name.split('.').pop()}`;
        uploadPromises.push(
          fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'kyc',
              contentType: kycForm.documents.front.type,
              originalName: kycForm.documents.front.name,
              key: frontKey
            })
          }).then(async (response) => {
            if (response.ok) {
              const { data } = await response.json();
              const uploadResponse = await fetch(data.uploadUrl, {
                method: 'PUT',
                body: kycForm.documents.front,
                headers: { 'Content-Type': kycForm.documents.front.type }
              });
              
              if (uploadResponse.ok) {
                // For KYC documents, store only the key - no public URL
                documentURLs.front = data.key;
              }
            }
          })
        );
      }

      // Upload back document
      if (kycForm.documents.back) {
        const backKey = `KYC/${currentUser.uid}/doc-back-${Date.now()}.${kycForm.documents.back.name.split('.').pop()}`;
        uploadPromises.push(
          fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'kyc',
              contentType: kycForm.documents.back.type,
              originalName: kycForm.documents.back.name,
              key: backKey
            })
          }).then(async (response) => {
            if (response.ok) {
              const { data } = await response.json();
              const uploadResponse = await fetch(data.uploadUrl, {
                method: 'PUT',
                body: kycForm.documents.back,
                headers: { 'Content-Type': kycForm.documents.back.type }
              });
              
              if (uploadResponse.ok) {
                // For KYC documents, store only the key - no public URL
                documentURLs.back = data.key;
              }
            }
          })
        );
      }

      // Upload selfie document
      if (kycForm.documents.selfie) {
        const selfieKey = `KYC/${currentUser.uid}/selfie-${Date.now()}.${kycForm.documents.selfie.name.split('.').pop()}`;
        uploadPromises.push(
          fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'kyc',
              contentType: kycForm.documents.selfie.type,
              originalName: kycForm.documents.selfie.name,
              key: selfieKey
            })
          }).then(async (response) => {
            if (response.ok) {
              const { data } = await response.json();
              const uploadResponse = await fetch(data.uploadUrl, {
                method: 'PUT',
                body: kycForm.documents.selfie,
                headers: { 'Content-Type': kycForm.documents.selfie.type }
              });
              
              if (uploadResponse.ok) {
                // For KYC documents, store only the key - no public URL
                documentURLs.selfie = data.key;
              }
            }
          })
        );
      }

      await Promise.all(uploadPromises);

      // Update user profile with KYC data
      const userRef = ref(database, `users/${currentUser.uid}`);
      await update(userRef, {
        verification: {
          fullName: kycForm.fullName,
          cpf: kycForm.cpf.replace(/\D/g, ''),
          documents: documentURLs,
          submittedAt: Date.now(),
          verificationStatus: 'pending'
        }
      });

      showNotification('Documentos enviados com sucesso! A verificação será realizada assim que possível.', 'success');
      
      // Reset form
      setKycForm({
        fullName: '',
        cpf: '',
        documents: {
          front: null,
          back: null,
          selfie: null
        }
      });
      setCpfVerificationState({
        isVerified: false,
        isVerifying: false,
        isValid: false,
        message: ''
      });

    } catch (error) {
      console.error('Error uploading KYC documents:', error);
      showNotification('Erro ao enviar documentos. Tente novamente.', 'error');
    } finally {
      setKycLoading(false);
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

        {/* KYC Verification Section */}
        {!userProfile?.kyc && (
          <div className="settings-section">
            <h2>Verificação de Identidade (KYC)</h2>
            <div className="settings-grid">
              <div className="setting-group full-width">
                <div className="kyc-info">
                  <div className="kyc-status">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>Verificação Pendente</span>
                  </div>
                  <p className="kyc-description">
                    Complete a verificação de identidade para acessar todas as funcionalidades da plataforma, incluindo o Vixies.
                    Uma vez validada a identidade que comprove sua maioridade, o Vixies será liberado para acesso.
                  </p>
                </div>
              </div>

              <div className="setting-group">
                <label htmlFor="kyc-fullName">Nome Completo</label>
                <input
                  type="text"
                  id="kyc-fullName"
                  value={kycForm.fullName}
                  onChange={(e) => handleKycChange('fullName', e.target.value)}
                  placeholder="Digite seu nome completo conforme documento"
                />
                <small>Deve corresponder exatamente ao nome no documento de identificação</small>
              </div>

              <div className="setting-group">
                <label htmlFor="kyc-cpf">CPF</label>
                <div className="cpf-verification-container">
                  <div className="cpf-wrapper">
                    <input
                      type="text"
                      id="kyc-cpf"
                      className="cpf-input"
                      value={kycForm.cpf}
                      onChange={(e) => handleKycChange('cpf', e.target.value)}
                      placeholder="000.000.000-00"
                      maxLength="14"
                    />
                    <span className={`status-icon ${cpfVerificationState.isVerified ? 'verified' : ''}`}></span>
                  </div>
                  <button 
                    type="button" 
                    className={`btn-verify-cpf ${cpfVerificationState.isVerified ? 'verified' : ''} ${cpfVerificationState.isVerifying ? 'verifying' : ''}`}
                    onClick={verifyCPF}
                    disabled={cpfVerificationState.isVerifying || cpfVerificationState.isVerified || !kycForm.fullName || !kycForm.cpf || !userProfile?.birthDate}
                  >
                    {cpfVerificationState.isVerifying ? (
                      <>
                        <span className="verify-loading">
                          <svg className="loading-spinner" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="31.416" strokeDashoffset="31.416">
                              <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                              <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                            </circle>
                          </svg>
                          Verificando...
                        </span>
                      </>
                    ) : (
                      <span className="verify-text">
                        {cpfVerificationState.isVerified ? 'CPF Verificado' : 'Verificar CPF'}
                      </span>
                    )}
                  </button>
                </div>
                <small>Informe apenas números, a formatação será aplicada automaticamente</small>
                {cpfVerificationState.message && (
                  <div className={`cpf-feedback ${cpfVerificationState.isValid ? 'success' : 'error'}`}>
                    <div className="feedback-content">
                      <span className="feedback-icon">
                        {cpfVerificationState.isValid ? '✅' : '❌'}
                      </span>
                      <span className="feedback-message">{cpfVerificationState.message}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="setting-group full-width">
                <label>Documentos de Verificação</label>
                <p className="verification-description">
                  Envie 3 fotos conforme especificado abaixo. Certifique-se de que todas as informações estejam legíveis e que as fotos estejam bem iluminadas.
                </p>
                
                <div className="kyc-documents">
                  <div className="document-upload-item">
                    <input 
                      type="file" 
                      id="kyc-doc-front" 
                      accept="image/*"
                      onChange={(e) => handleKycDocumentChange('front', e.target.files[0])}
                    />
                    <div className="document-upload-icon">📄</div>
                    <div className="document-upload-title">Frente do Documento</div>
                    <div className="document-upload-description">
                      Foto da frente do RG, CNH ou outro documento com foto que contenha seu CPF
                    </div>
                  </div>
                  
                  <div className="document-upload-item">
                    <input 
                      type="file" 
                      id="kyc-doc-back" 
                      accept="image/*"
                      onChange={(e) => handleKycDocumentChange('back', e.target.files[0])}
                    />
                    <div className="document-upload-icon">📄</div>
                    <div className="document-upload-title">Verso do Documento</div>
                    <div className="document-upload-description">
                      Foto do verso do mesmo documento usado na frente
                    </div>
                  </div>
                  
                  <div className="document-upload-item">
                    <input 
                      type="file" 
                      id="kyc-selfie-doc" 
                      accept="image/*"
                      onChange={(e) => handleKycDocumentChange('selfie', e.target.files[0])}
                    />
                    <div className="document-upload-icon">🤳</div>
                    <div className="document-upload-title">Selfie com Documento</div>
                    <div className="document-upload-description">
                      Foto sua segurando o documento ao lado do rosto, ambos devem estar visíveis
                    </div>
                  </div>
                </div>

                <button 
                  className="btn-primary kyc-submit-btn"
                  onClick={uploadKycDocuments}
                  disabled={kycLoading || !cpfVerificationState.isVerified || !kycForm.documents.front || !kycForm.documents.back || !kycForm.documents.selfie}
                >
                  {kycLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Enviando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload"></i> Enviar Documentos
                    </>
                  )}
                </button>
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