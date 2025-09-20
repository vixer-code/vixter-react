import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useUser } from '../contexts/UserContext';
import { database, db } from '../../config/firebase';
import { ref, set, get, update } from 'firebase/database';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import PurpleSpinner from '../components/PurpleSpinner';
import './Settings.css';

const Settings = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
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
  const [submittedKycDocuments, setSubmittedKycDocuments] = useState(null);
  const [cpfVerificationState, setCpfVerificationState] = useState({
    isVerified: false,
    isVerifying: false,
    isValid: false,
    message: ''
  });
  const [kycState, setKycState] = useState('PENDING_UPLOAD');
  const [documentUploadStates, setDocumentUploadStates] = useState({
    front: { uploaded: false, uploading: false, error: null },
    back: { uploaded: false, uploading: false, error: null },
    selfie: { uploaded: false, uploading: false, error: null }
  });

  // Get account type
  const accountType = userProfile?.accountType || 'client';
  const isProvider = accountType === 'provider' || accountType === 'both';

  useEffect(() => {
    if (currentUser) {
      loadUserSettings();
      loadKycState();
      loadSubmittedKycDocuments();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && isProvider) {
      checkStripeStatus();
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
      showError('Erro ao carregar configurações');
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

      showSuccess('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('Erro ao salvar configurações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    if (window.confirm('Tem certeza que deseja redefinir todas as configurações?')) {
      loadUserSettings();
      showInfo('Configurações redefinidas');
    }
  };

  // Stripe Connect functions
  const checkStripeStatus = async () => {
    if (!isProvider) return;
    
    // Evitar chamadas múltiplas
    if (stripeStatus.loading) return;
    
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
      showError('Erro ao verificar status Stripe');
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
        showSuccess('Conta Stripe já configurada!');
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
      showError('Erro ao conectar conta Stripe', 'error');
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
      showError('Preencha todos os campos', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showError('As senhas não coincidem', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showError('A nova senha deve ter pelo menos 6 caracteres', 'error');
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

      showSuccess('Senha alterada com sucesso!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        showError('Senha atual incorreta', 'error');
      } else if (error.code === 'auth/weak-password') {
        showError('A nova senha é muito fraca', 'error');
      } else {
        showError('Erro ao alterar senha', 'error');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const deleteAccount = () => {
    if (window.confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.')) {
      showWarning('Funcionalidade de exclusão de conta em desenvolvimento');
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

      // Auto-validate CPF when typing
      if (field === 'cpf' && value) {
        const validation = validateCPF(value);
        if (validation.isValid) {
          setCpfVerificationState({
            isVerified: true,
            isVerifying: false,
            isValid: true,
            message: 'CPF válido'
          });
        } else {
          setCpfVerificationState({
            isVerified: false,
            isVerifying: false,
            isValid: false,
            message: validation.message
          });
        }
      }
    }
  };

  const handleKycDocumentChange = async (documentType, file) => {
    if (!file) return;

    // Update form state
    setKycForm(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [documentType]: file
      }
    }));

    // Set uploading state
    setDocumentUploadStates(prev => ({
      ...prev,
      [documentType]: { uploaded: false, uploading: true, error: null }
    }));

    try {
      // Upload document immediately for visual feedback
      const documentKey = `KYC/${currentUser.uid}/${documentType}-${Date.now()}.${file.name.split('.').pop()}`;
      
      // Get Firebase ID token for authentication
      const token = await currentUser.getIdToken();
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://vixter-react-llyd.vercel.app';
      const response = await fetch(`${backendUrl}/api/media/upload`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'kyc',
          contentType: file.type,
          originalName: file.name,
          key: documentKey
        })
      });

      if (response.ok) {
        const { data } = await response.json();
        const uploadResponse = await fetch(data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });
        
        if (uploadResponse.ok) {
          // Update form with the key
          setKycForm(prev => ({
            ...prev,
            documents: {
              ...prev.documents,
              [documentType]: { file, key: data.key }
            }
          }));

          // Set uploaded state
          setDocumentUploadStates(prev => ({
            ...prev,
            [documentType]: { uploaded: true, uploading: false, error: null }
          }));

          showSuccess(`${documentType === 'front' ? 'Frente' : documentType === 'back' ? 'Verso' : 'Selfie'} do documento enviado com sucesso!`);
        } else {
          throw new Error('Falha no upload do arquivo');
        }
      } else {
        throw new Error('Falha ao gerar URL de upload');
      }
    } catch (error) {
      console.error(`Error uploading ${documentType} document:`, error);
      setDocumentUploadStates(prev => ({
        ...prev,
        [documentType]: { uploaded: false, uploading: false, error: error.message }
      }));
      showError(`Erro ao enviar ${documentType === 'front' ? 'frente' : documentType === 'back' ? 'verso' : 'selfie'} do documento`);
    }
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

  // CPF verification (local validation only)
  const verifyCPF = () => {
    const cpfRaw = kycForm.cpf.replace(/\D/g, '');
    const name = kycForm.fullName.trim();

    if (!cpfRaw || !name) {
      setCpfVerificationState({
        isVerified: false,
        isVerifying: false,
        isValid: false,
        message: 'Preencha o nome completo e CPF antes de verificar.'
      });
      return;
    }

    const validation = validateCPF(kycForm.cpf);
    if (validation.isValid) {
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
        message: validation.message
      });
    }
  };

  // Submit KYC documents for verification
  const submitKycDocuments = async () => {
    if (!cpfVerificationState.isVerified) {
      showError('Verifique o CPF antes de enviar os documentos', 'error');
      return;
    }

    if (!kycForm.fullName.trim()) {
      showError('Preencha o nome completo', 'error');
      return;
    }

    // Check if all documents are uploaded
    const allDocumentsUploaded = Object.values(documentUploadStates).every(state => state.uploaded);

    if (!allDocumentsUploaded) {
      showError('Todos os documentos devem ser enviados antes de finalizar', 'error');
      return;
    }

    setKycLoading(true);
    try {
      // Prepare document keys
      const documentKeys = {
        front: kycForm.documents.front?.key || kycForm.documents.front,
        back: kycForm.documents.back?.key || kycForm.documents.back,
        selfie: kycForm.documents.selfie?.key || kycForm.documents.selfie
      };

      // Create KYC document in Firestore (main data storage)
      await createKycDocument(currentUser.uid, {
        fullName: kycForm.fullName,
        cpf: kycForm.cpf.replace(/\D/g, ''),
        documents: documentKeys,
        submittedAt: Date.now(),
        status: 'PENDING_VERIFICATION'
      });

      // Update only basic KYC state in Realtime Database
      const userRef = ref(database, `users/${currentUser.uid}`);
      await update(userRef, {
        kycState: 'PENDING_VERIFICATION',
        kyc: false, // Will be set to true by admin when verified
        updatedAt: Date.now()
      });

      // Update local state
      setKycState('PENDING_VERIFICATION');

      showSuccess('Documentos enviados com sucesso! A verificação será realizada assim que possível.');
      
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
      setDocumentUploadStates({
        front: { uploaded: false, uploading: false, error: null },
        back: { uploaded: false, uploading: false, error: null },
        selfie: { uploaded: false, uploading: false, error: null }
      });

    } catch (error) {
      console.error('Error submitting KYC documents:', error);
      showError('Erro ao enviar documentos. Tente novamente.', 'error');
    } finally {
      setKycLoading(false);
    }
  };

  // View KYC document (for user's own documents)
  const viewKycDocument = async (documentKey) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://vixter-react-llyd.vercel.app';
      const response = await fetch(`${backendUrl}/api/kyc/download`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        },
        body: JSON.stringify({ key: documentKey })
      });

      if (response.ok) {
        const { data } = await response.json();
        window.open(data.downloadUrl, '_blank');
      } else {
        const error = await response.json();
        showError(error.error || 'Erro ao visualizar documento', 'error');
      }
    } catch (error) {
      console.error('Error viewing KYC document:', error);
      showError('Erro ao visualizar documento', 'error');
    }
  };

  // Get KYC document from Firestore
  const getKycDocument = async (userId) => {
    try {
      const kycRef = doc(db, 'kyc', userId);
      const kycSnap = await getDoc(kycRef);
      
      if (kycSnap.exists()) {
        return kycSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting KYC document:', error);
      return null;
    }
  };

  // Load submitted KYC documents
  const loadKycState = async () => {
    try {
      // First check Firestore for KYC data
      const kycData = await getKycDocument(currentUser.uid);
      
      if (kycData) {
        // KYC document exists, check status
        if (kycData.status === 'VERIFIED') {
          setKycState('VERIFIED');
        } else {
          setKycState('PENDING_VERIFICATION');
        }
      } else {
        // No KYC document, check Realtime Database for basic state
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setKycState(userData.kycState || 'PENDING_UPLOAD');
        } else {
          setKycState('PENDING_UPLOAD');
        }
      }
    } catch (error) {
      console.error('Error loading KYC state:', error);
      setKycState('PENDING_UPLOAD');
    }
  };

  const loadSubmittedKycDocuments = () => {
    if (userProfile?.verification?.documents) {
      setSubmittedKycDocuments(userProfile.verification.documents);
    }
  };

  // Create or update KYC document in Firestore
  const createKycDocument = async (userId, kycData) => {
    try {
      const kycRef = doc(db, 'kyc', userId);
      await setDoc(kycRef, {
        ...kycData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Error creating KYC document:', error);
      throw error;
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
                      <PurpleSpinner text="Verificando status..." size="small" />
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
                        <PurpleSpinner text="Processando..." size="small" />
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
                      href="https://dashboard.stripe.com/connect/accounts" 
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
        {kycState !== 'VERIFIED' && (
          <div className="settings-section">
            <h2>Verificação de Identidade (KYC)</h2>
            <div className="settings-grid">
              <div className="setting-group full-width">
                <div className="kyc-info">
                  <div className={`kyc-status ${kycState === 'PENDING_VERIFICATION' ? 'pending' : 'warning'}`}>
                    <i className={`fas ${kycState === 'PENDING_VERIFICATION' ? 'fa-clock' : 'fa-exclamation-triangle'}`}></i>
                    <span>
                      {kycState === 'PENDING_VERIFICATION' 
                        ? 'Verificação em Andamento' 
                        : 'Verificação Pendente'
                      }
                    </span>
                  </div>
                  <p className="kyc-description">
                    {kycState === 'PENDING_VERIFICATION' 
                      ? 'Seus documentos foram enviados e estão sendo analisados. Você receberá uma notificação assim que a verificação for concluída.'
                      : 'Complete a verificação de identidade para acessar todas as funcionalidades da plataforma, incluindo o Vixies. Uma vez validada a identidade que comprove sua maioridade, o Vixies será liberado para acesso.'
                    }
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
                  </div>
                  <button 
                    type="button" 
                    className={`btn-verify-cpf ${cpfVerificationState.isVerified ? 'verified' : ''}`}
                    onClick={verifyCPF}
                    disabled={cpfVerificationState.isVerified || !kycForm.fullName || !kycForm.cpf}
                  >
                    <i className={`fas ${cpfVerificationState.isVerified ? 'fa-check' : 'fa-search'}`}></i>
                    {cpfVerificationState.isVerified ? 'CPF Verificado' : 'Verificar CPF'}
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

              {kycState === 'PENDING_UPLOAD' && (
                <div className="setting-group full-width">
                  <label>Documentos de Verificação</label>
                  <p className="verification-description">
                    Envie 3 fotos conforme especificado abaixo. Certifique-se de que todas as informações estejam legíveis e que as fotos estejam bem iluminadas.
                  </p>
                  
                  <div className="kyc-documents">
                    <div className={`document-upload-item ${documentUploadStates.front.uploaded ? 'uploaded' : documentUploadStates.front.uploading ? 'uploading' : documentUploadStates.front.error ? 'error' : ''}`}>
                      <input 
                        type="file" 
                        id="kyc-doc-front" 
                        accept="image/*"
                        onChange={(e) => handleKycDocumentChange('front', e.target.files[0])}
                        disabled={documentUploadStates.front.uploading}
                      />
                      <div className="document-upload-icon">
                        {documentUploadStates.front.uploaded ? '✅' : documentUploadStates.front.uploading ? '⏳' : '📄'}
                      </div>
                      <div className="document-upload-title">Frente do Documento</div>
                      <div className="document-upload-description">
                        Foto da frente do RG, CNH ou outro documento com foto que contenha seu CPF
                      </div>
                      {documentUploadStates.front.uploading && (
                        <div className="upload-progress">
                          <div className="progress-bar"></div>
                          <span>Enviando...</span>
                        </div>
                      )}
                      {documentUploadStates.front.error && (
                        <div className="upload-error">
                          <i className="fas fa-exclamation-circle"></i>
                          <span>{documentUploadStates.front.error}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className={`document-upload-item ${documentUploadStates.back.uploaded ? 'uploaded' : documentUploadStates.back.uploading ? 'uploading' : documentUploadStates.back.error ? 'error' : ''}`}>
                      <input 
                        type="file" 
                        id="kyc-doc-back" 
                        accept="image/*"
                        onChange={(e) => handleKycDocumentChange('back', e.target.files[0])}
                        disabled={documentUploadStates.back.uploading}
                      />
                      <div className="document-upload-icon">
                        {documentUploadStates.back.uploaded ? '✅' : documentUploadStates.back.uploading ? '⏳' : '📄'}
                      </div>
                      <div className="document-upload-title">Verso do Documento</div>
                      <div className="document-upload-description">
                        Foto do verso do mesmo documento usado na frente
                      </div>
                      {documentUploadStates.back.uploading && (
                        <div className="upload-progress">
                          <div className="progress-bar"></div>
                          <span>Enviando...</span>
                        </div>
                      )}
                      {documentUploadStates.back.error && (
                        <div className="upload-error">
                          <i className="fas fa-exclamation-circle"></i>
                          <span>{documentUploadStates.back.error}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className={`document-upload-item ${documentUploadStates.selfie.uploaded ? 'uploaded' : documentUploadStates.selfie.uploading ? 'uploading' : documentUploadStates.selfie.error ? 'error' : ''}`}>
                      <input 
                        type="file" 
                        id="kyc-selfie-doc" 
                        accept="image/*"
                        onChange={(e) => handleKycDocumentChange('selfie', e.target.files[0])}
                        disabled={documentUploadStates.selfie.uploading}
                      />
                      <div className="document-upload-icon">
                        {documentUploadStates.selfie.uploaded ? '✅' : documentUploadStates.selfie.uploading ? '⏳' : '🤳'}
                      </div>
                      <div className="document-upload-title">Selfie com Documento</div>
                      <div className="document-upload-description">
                        Foto sua segurando o documento ao lado do rosto, ambos devem estar visíveis
                      </div>
                      {documentUploadStates.selfie.uploading && (
                        <div className="upload-progress">
                          <div className="progress-bar"></div>
                          <span>Enviando...</span>
                        </div>
                      )}
                      {documentUploadStates.selfie.error && (
                        <div className="upload-error">
                          <i className="fas fa-exclamation-circle"></i>
                          <span>{documentUploadStates.selfie.error}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    className="btn-primary kyc-submit-btn"
                    onClick={submitKycDocuments}
                    disabled={kycLoading || !cpfVerificationState.isVerified || !kycForm.fullName || !Object.values(documentUploadStates).every(state => state.uploaded)}
                  >
                    {kycLoading ? (
                      <>
                        <PurpleSpinner text="Enviando..." size="small" />
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload"></i> Finalizar Envio
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* KYC Status Display for PENDING_VERIFICATION */}
              {kycState === 'PENDING_VERIFICATION' && (
                <div className="setting-group full-width">
                  <div className="kyc-status-display">
                    <div className="status-icon">
                      <i className="fas fa-clock"></i>
                    </div>
                    <div className="status-content">
                      <h3>Documentos Enviados</h3>
                      <p>Seus documentos de verificação foram enviados e estão sendo analisados pela nossa equipe.</p>
                      <div className="status-details">
                        <div className="detail-item">
                          <i className="fas fa-check-circle"></i>
                          <span>CPF verificado</span>
                        </div>
                        <div className="detail-item">
                          <i className="fas fa-check-circle"></i>
                          <span>Documentos enviados</span>
                        </div>
                        <div className="detail-item">
                          <i className="fas fa-clock"></i>
                          <span>Aguardando análise</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* KYC Status Display for VERIFIED */}
              {kycState === 'VERIFIED' && (
                <div className="setting-group full-width">
                  <div className="kyc-status-display verified">
                    <div className="status-icon">
                      <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="status-content">
                      <h3>Verificação Concluída</h3>
                      <p>Sua identidade foi verificada com sucesso! Agora você tem acesso completo a todas as funcionalidades da plataforma.</p>
                      <div className="status-details">
                        <div className="detail-item">
                          <i className="fas fa-check-circle"></i>
                          <span>Identidade verificada</span>
                        </div>
                        <div className="detail-item">
                          <i className="fas fa-unlock"></i>
                          <span>Acesso completo liberado</span>
                        </div>
                        <div className="detail-item">
                          <i className="fas fa-shield-alt"></i>
                          <span>Conta segura</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                    <PurpleSpinner text="Alterando..." size="small" />
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