import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useServicesR2 as useServices } from '../contexts/ServicesContextR2';
import { useNotification } from '../contexts/NotificationContext';
import useR2Media from '../hooks/useR2Media';
import useKycStatus from '../hooks/useKycStatus';
import SmartMediaViewer from './SmartMediaViewer';
import './CreateServiceModal.css';

const CreateServiceModal = ({ isOpen, onClose, onServiceCreated, editingService = null }) => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { createService, updateService } = useServices();
  const { showSuccess, showError } = useNotification();
  const { uploadServiceMedia, uploading, uploadProgress } = useR2Media();
  const { kycState, isKycVerified, isKycNotConfigured, getKycStatusMessage, loading: kycLoading } = useKycStatus();
  
  // Check account type
  const accountType = userProfile?.accountType || 'client';
  const isProvider = accountType === 'provider';
  const isBoth = accountType === 'both';
  
  // Debug notification context
  console.log('Notification context functions:', { showSuccess: !!showSuccess, showError: !!showError });
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // 'saving', 'saved', 'error'
  const [showPriceSuggestions, setShowPriceSuggestions] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    price: '',
    discount: '',
    complementaryOptions: [],
    coverImage: null,
    tags: []
  });

  // File uploads state
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [showcasePhotoFiles, setShowcasePhotoFiles] = useState([]);
  const [showcaseVideoFiles, setShowcaseVideoFiles] = useState([]);
  const [showcasePhotoPreviews, setShowcasePhotoPreviews] = useState([]);
  const [showcaseVideoPreviews, setShowcaseVideoPreviews] = useState([]);

  // Input refs
  const tagsInputRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);

  const steps = [
    { id: 'basic', title: 'Informações Básicas' },
    { id: 'description', title: 'Descrição' },
    { id: 'pricing', title: 'Precificação' },
    { id: 'media', title: 'Mídia' },
    { id: 'preview', title: 'Pré-visualização' }
  ];

  const categories = [
    { value: 'games', label: 'Jogos' },
    { value: 'webcompanhia', label: 'Web-companhia (Filmes, séries)' },
    { value: 'webnamoro', label: 'Webnamoro (+18)' },
    { value: 'vixink', label: 'Vixink (serviços artísticos)' },
    { value: 'educacao', label: 'Educação' },
    { value: 'esoterico', label: 'Esotérico (Tarot, Quiromancia, Baralho Cigano)' }
  ];

  const categoryLabels = {
    games: 'Jogos',
    webcompanhia: 'Web-companhia (Filmes, séries)',
    webnamoro: 'Webnamoro (+18)',
    vixink: 'Vixink (serviços artísticos)',
    educacao: 'Educação',
    esoterico: 'Esotérico (Tarot, Quiromancia, Baralho Cigano)'
  };

  // Price suggestions based on category
  const getPriceSuggestions = (category) => {
    const suggestions = {
      games: [
        { vc: 15, description: 'Jogo casual (15-30 min)' },
        { vc: 25, description: 'Jogo competitivo (30-60 min)' },
        { vc: 40, description: 'Jogo complexo (1-2 horas)' }
      ],
      webcompanhia: [
        { vc: 20, description: 'Filme casual (1-2 horas)' },
        { vc: 35, description: 'Série completa (2-3 horas)' },
        { vc: 50, description: 'Maratona (4+ horas)' }
      ],
      webnamoro: [
        { vc: 30, description: 'Conversa íntima (30 min)' },
        { vc: 50, description: 'Sessão completa (1 hora)' },
        { vc: 80, description: 'Acompanhamento intensivo (2+ horas)' }
      ],
      vixink: [
        { vc: 25, description: 'Arte simples (30 min)' },
        { vc: 40, description: 'Arte detalhada (1 hora)' },
        { vc: 60, description: 'Obra complexa (2+ horas)' }
      ],
      educacao: [
        { vc: 20, description: 'Aula básica (30 min)' },
        { vc: 35, description: 'Aula completa (1 hora)' },
        { vc: 50, description: 'Curso intensivo (2+ horas)' }
      ],
      esoterico: [
        { vc: 25, description: 'Leitura simples (30 min)' },
        { vc: 40, description: 'Sessão completa (1 hora)' },
        { vc: 60, description: 'Consulta detalhada (2+ horas)' }
      ],
      default: [
        { vc: 15, description: 'Serviço básico (30 min)' },
        { vc: 25, description: 'Serviço padrão (1 hora)' },
        { vc: 40, description: 'Serviço premium (2 horas)' }
      ]
    };
    return suggestions[category] || suggestions.default;
  };

  // Auto-save functionality
  const autoSave = async () => {
    if (!currentUser || !formData.title.trim()) return;
    
    setAutoSaveStatus('saving');
    
    try {
      const draftData = {
        ...formData,
        providerId: currentUser.uid,
        isDraft: true,
        lastSaved: Date.now()
      };
      
      // Save to localStorage as backup
      localStorage.setItem(`service-draft-${currentUser.uid}`, JSON.stringify(draftData));
      
      setAutoSaveStatus('saved');
      
      // Clear saved status after 3 seconds
      setTimeout(() => setAutoSaveStatus('saved'), 3000);
    } catch (error) {
      console.error('Auto-save error:', error);
      setAutoSaveStatus('error');
    }
  };

  // Load draft from localStorage
  const loadDraft = () => {
    if (!currentUser) return;
    
    try {
      const draft = localStorage.getItem(`service-draft-${currentUser.uid}`);
      if (draft) {
        const draftData = JSON.parse(draft);
        setFormData({
          title: draftData.title || '',
          category: draftData.category || '',
          description: draftData.description || '',
          price: draftData.price || '',
          discount: draftData.discount || '',
          complementaryOptions: draftData.complementaryOptions || [],
          coverImage: draftData.coverImage || null,
          showcasePhotos: draftData.showcasePhotos || [],
          showcaseVideos: draftData.showcaseVideos || [],
          tags: draftData.tags || []
        });
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  useEffect(() => {
    if (editingService) {
      populateFormWithServiceData(editingService);
      setCurrentStep(0); // Reset to first step when editing
    } else {
      loadDraft();
      setCurrentStep(0); // Reset to first step when creating new
    }
  }, [editingService]);

  // Auto-save on form data changes
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    if (formData.title.trim()) {
      autoSaveTimeoutRef.current = setTimeout(autoSave, 2000);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData]);

  const populateFormWithServiceData = (service) => {
    setFormData({
      title: service.title || '',
      category: service.category || '',
      description: service.description || '',
      price: service.price || '',
      discount: service.discount || '',
      complementaryOptions: service.complementaryOptions || [],
      coverImage: service.coverImageURL || service.coverImage || null,
      showcasePhotos: service.showcasePhotosURLs || service.showcasePhotos || [],
      showcaseVideos: service.showcaseVideosURLs || service.showcaseVideos || [],
      tags: service.tags || []
    });

    // Clear file upload states
    setCoverImageFile(null);
    setShowcasePhotoFiles([]);
    setShowcaseVideoFiles([]);

    if (service.coverImageURL || service.coverImage) {
      setCoverImagePreview(service.coverImageURL || service.coverImage);
    }
    if (service.showcasePhotosURLs || service.showcasePhotos) {
      setShowcasePhotoPreviews(service.showcasePhotosURLs || service.showcasePhotos);
    }
    if (service.showcaseVideosURLs || service.showcaseVideos) {
      setShowcaseVideoPreviews(service.showcaseVideosURLs || service.showcaseVideos);
    }
  };

  const clearForm = () => {
    setFormData({
      title: '',
      category: '',
      description: '',
      price: '',
      discount: '',
      complementaryOptions: [],
      coverImage: null,
      tags: []
    });
    setCoverImageFile(null);
    setCoverImagePreview('');
    setShowcasePhotoFiles([]);
    setShowcaseVideoFiles([]);
    setShowcasePhotoPreviews([]);
    setShowcaseVideoPreviews([]);
    setCurrentStep(0);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const addTag = () => {
    if (tagsInputRef.current && tagsInputRef.current.value.trim()) {
      const newTag = tagsInputRef.current.value.trim();
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag]
      }));
      tagsInputRef.current.value = '';
    }
  };

  const removeTag = (index) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const addComplementaryOption = () => {
    setFormData(prev => ({
      ...prev,
      complementaryOptions: [...prev.complementaryOptions, {
        title: '',
        description: '',
        price: ''
      }]
    }));
  };

  const updateComplementaryOption = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      complementaryOptions: prev.complementaryOptions.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      )
    }));
  };

  const removeComplementaryOption = (index) => {
    setFormData(prev => ({
      ...prev,
      complementaryOptions: prev.complementaryOptions.filter((_, i) => i !== index)
    }));
  };

  const handleCoverImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 5MB for mobile compatibility)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        showError('A imagem de capa deve ter no máximo 5MB para melhor compatibilidade mobile');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showError('Por favor, selecione apenas arquivos de imagem');
        return;
      }
      
      setCoverImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setCoverImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Discount validation functions (same as packs)
  const getDiscountError = () => {
    if (formData.discount === '') return null;
    const v = parseInt(formData.discount, 10);
    if (isNaN(v)) return 'Desconto deve ser um número';
    if (v < 0 || v > 75) return 'Desconto deve estar entre 0 e 75%';
    return null;
  };

  // Currency helpers (same logic as Service: VC -> VP @ 1.5x)
  const convertVCtoVP = (vcAmount) => vcAmount * 1.5;
  const formatCurrency = (amount, decimals = 2) => {
    const num = parseFloat(amount || 0);
    // If the number is a whole number, don't show decimals
    if (num % 1 === 0) {
      return num.toString().replace('.', ',');
    }
    return num.toFixed(decimals).replace('.', ',');
  };
  const formatVC = (amount) => `${formatCurrency(amount)} VC`;
  const formatVP = (amount) => `${formatCurrency(amount)} VP`;

  const effectivePrice = () => {
    const price = parseFloat(formData.price || 0);
    const discount = parseInt(formData.discount || 0, 10) || 0;
    const final = discount > 0 ? price * (1 - discount / 100) : price;
    return Math.max(final, 0);
  };

  // Validation for minimum seller earnings (10 VC)
  const getSellerEarningsValidationError = () => {
    const effectivePriceValue = effectivePrice();
    if (effectivePriceValue < 10) {
      return `O valor final para a vendedora deve ser pelo menos 10,00 VC. Valor atual: ${formatVC(effectivePriceValue)}`;
    }
    return null;
  };

  // fileToDataURL removed - now using R2 upload

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0: // Basic info
        return formData.title.trim() && formData.category;
      case 1: // Description
        return formData.description.trim().length >= 50;
      case 2: // Pricing
        return formData.price && parseFloat(formData.price) >= 10 && !getDiscountError() && !getSellerEarningsValidationError();
      case 3: // Media (optional)
        return true;
      case 4: // Preview
        return true;
      default:
        return false;
    }
  };

  const getPriceValidationError = () => {
    if (!formData.price) {
      return 'Por favor, insira um preço para o serviço';
    }
    const price = parseFloat(formData.price);
    if (isNaN(price)) {
      return 'Por favor, insira um valor numérico válido';
    }
    if (price < 10) {
      return `O preço mínimo é 10,00 VC (${formatVP(convertVCtoVP(10))} VP)`;
    }
    if (price > 10000) {
      return 'O preço máximo é 10.000,00 VC';
    }
    return null;
  };

  const getOptionPriceValidationError = (price) => {
    if (!price) {
      return 'Por favor, insira um preço para esta opção';
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
      return 'Por favor, insira um valor numérico válido';
    }
    if (numPrice < 1) {
      return `O preço mínimo é 1,00 VC (${formatVP(convertVCtoVP(1))} VP)`;
    }
    if (numPrice > 5000) {
      return 'O preço máximo é 5.000,00 VC';
    }
    return null;
  };

  const nextStep = () => {
    if (!validateCurrentStep() || currentStep >= steps.length - 1) {
      return;
    }

    // KYC validation for +18 content
    if (formData.category === 'webnamoro') {
      if (kycLoading) {
        showError('Aguarde a verificação do status KYC...');
        return;
      }
      if (!isKycVerified) {
        if (isKycNotConfigured) {
          showError('Para criar serviços +18, você precisa configurar sua verificação KYC primeiro.');
          return;
        } else {
          showError('Para criar serviços +18, sua verificação KYC precisa estar aprovada. Status atual: ' + getKycStatusMessage().message);
          return;
        }
      }
    }

    setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    console.log('🚀 Starting service creation/update...');
    console.log('Current user:', currentUser);
    console.log('Editing service:', editingService);
    
    if (!currentUser || isSubmitting) return;

    // Validate all form data before submission
    if (!formData.title.trim()) {
      showError('Por favor, insira um título para o serviço');
      return;
    }

    if (!formData.category) {
      showError('Por favor, selecione uma categoria');
      return;
    }

    // KYC validation for +18 content
    if (formData.category === 'webnamoro') {
      if (kycLoading) {
        return showError('Aguarde a verificação do status KYC...');
      }
      if (!isKycVerified) {
        if (isKycNotConfigured) {
          showError('Para criar serviços +18, você precisa configurar sua verificação KYC primeiro.');
          onClose();
          window.location.href = '/settings';
          return;
        } else {
          return showError('Para criar serviços +18, sua verificação KYC precisa estar aprovada. Status atual: ' + getKycStatusMessage().message);
        }
      }
    }

    if (!formData.description.trim() || formData.description.length < 50) {
      showError('A descrição deve ter pelo menos 50 caracteres');
      return;
    }

    if (!formData.price || parseFloat(formData.price) < 10) {
      showError('O preço mínimo é 10,00 VC');
      return;
    }

    const discountErr = getDiscountError();
    if (discountErr) {
      showError(discountErr);
      return;
    }

    const sellerEarningsErr = getSellerEarningsValidationError();
    if (sellerEarningsErr) {
      showError(sellerEarningsErr);
      return;
    }

    // Check if cover image is provided
    if (!coverImageFile && !formData.coverImage) {
      showError('Você deve carregar uma imagem de capa para o serviço');
      return;
    }

    // Validate complementary options if any
    for (let i = 0; i < formData.complementaryOptions.length; i++) {
      const option = formData.complementaryOptions[i];
      if (!option.title.trim()) {
        showError(`Por favor, insira um título para a opção complementar ${i + 1}`);
        return;
      }
      if (!option.description.trim()) {
        showError(`Por favor, insira uma descrição para a opção complementar ${i + 1}`);
        return;
      }
      if (!option.price || parseFloat(option.price) < 1) {
        showError(`O preço mínimo para a opção complementar ${i + 1} é 1,00 VC`);
        return;
      }
    }

    setIsSubmitting(true);
    setUploadingFiles(true);

    try {
      // Prepare base service data (without media URLs yet)
      const baseServiceData = {
        title: formData.title,
        category: formData.category,
        description: formData.description,
        price: parseFloat(formData.price), // Price in VC
        discount: parseInt(formData.discount || 0, 10) || 0,
        complementaryOptions: formData.complementaryOptions,
        tags: formData.tags,
        providerId: currentUser.uid,
        status: 'active',
        updatedAt: Date.now(),
        currency: 'VC' // Indicates prices are in VC
      };

      // Prepare service data with file references for R2 upload
      const serviceDataWithFiles = {
        ...baseServiceData,
        createdAt: Date.now(),
        // Pass files for R2 upload
        coverImageFile: coverImageFile,
        // Keep existing URLs for editing
        existingCoverImage: formData.coverImage
      };

      // Create or update service via Cloud Functions (Firestore) with R2 upload
      let serviceId = editingService?.id;
      if (editingService) {
        // Update basic fields first
        await updateService(serviceId, baseServiceData);
      } else {
        const result = await createService(serviceDataWithFiles);
        if (!result || !result.success || !result.serviceId) {
          throw new Error('Falha ao criar serviço. Verifique sua conexão e tente novamente.');
        }
        serviceId = result.serviceId;
      }
      console.log(`🔑 ServiceID: ${serviceId}`);
      showSuccess(editingService ? 'Serviço atualizado com sucesso!' : 'Serviço criado com sucesso!');

      // Clear draft after successful creation/update
      localStorage.removeItem(`service-draft-${currentUser.uid}`);

      onServiceCreated && onServiceCreated({ id: serviceId, ...baseServiceData });
      onClose();
    } catch (error) {
      console.error('❌ Error creating/updating service:', error);
      
      // More specific error messages for mobile users
      let errorMessage = error.message;
      if (error.message.includes('permission')) {
        errorMessage = 'Erro de permissão. Verifique se sua conta tem permissão para criar serviços.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout na operação. Tente novamente com uma conexão mais estável.';
      } else {
        errorMessage = `Falha ao ${editingService ? 'atualizar' : 'criar'} serviço: ${error.message}`;
      }
      
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
      setUploadingFiles(false);
    }
  };



  const handlePriceSuggestion = (suggestion) => {
    handleInputChange('price', suggestion.vc.toString());
    setShowPriceSuggestions(false);
  };

  if (!isOpen) return null;

  // Check if user can create services
  if (!isProvider && !isBoth) {
    return (
      <div className="create-service-modal-overlay">
        <div className="create-service-modal">
          <div className="modal-header">
            <h2>Acesso Restrito</h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-content">
            <div className="access-restricted">
              <i className="fas fa-lock"></i>
              <h3>Apenas Provedores Podem Criar Serviços</h3>
              <p>Você precisa ter uma conta de provedor para criar e vender serviços na plataforma.</p>
              <div className="restriction-actions">
                <button className="btn secondary" onClick={onClose}>
                  Fechar
                </button>
                <a href="/register" className="btn primary">
                  Alterar Tipo de Conta
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-service-modal-overlay">
      <div className="create-service-modal">
        <div className="modal-header">
          <h2>{editingService ? 'Editar Serviço' : 'Criar Novo Serviço'}</h2>
          <div className="header-actions">
            {autoSaveStatus === 'saving' && (
              <span className="auto-save-status saving">
                <i className="fas fa-spinner fa-spin"></i> Salvando...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="auto-save-status saved">
                <i className="fas fa-check"></i> Salvo
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="auto-save-status error">
                <i className="fas fa-exclamation-triangle"></i> Erro ao salvar
              </span>
            )}
            <button className="close-btn" onClick={() => {
              clearForm();
              onClose();
            }}>&times;</button>
          </div>
        </div>

        <div className="modal-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
          <div className="progress-steps">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={`progress-step ${index <= currentStep ? 'active' : ''}`}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-content">
          {/* Step 1: Basic Information */}
          {currentStep === 0 && (
            <div className="form-step">
              <h3>Informações Básicas</h3>
              
              <div className="form-group">
                <label htmlFor="service-title">Título do Serviço *</label>
                <input
                  type="text"
                  id="service-title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  maxLength={100}
                  placeholder="Escolha um título claro e atrativo"
                />
                <small>Escolha um título claro e atrativo</small>
              </div>

              <div className="form-group">
                <label htmlFor="service-category">Categoria do Serviço *</label>
                <select
                  id="service-category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                
                {/* KYC Status for +18 content */}
                {formData.category === 'webnamoro' && (
                  <div className="kyc-status-container">
                    {kycLoading ? (
                      <div className="kyc-status loading">
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Verificando status KYC...</span>
                      </div>
                    ) : (
                      <div className={`kyc-status ${getKycStatusMessage().status}`}>
                        <i className={getKycStatusMessage().icon}></i>
                        <span>{getKycStatusMessage().message}</span>
                        {isKycNotConfigured && (
                          <button 
                            type="button" 
                            className="btn-kyc-setup"
                            onClick={() => {
                              onClose();
                              window.location.href = '/settings';
                            }}
                          >
                            Configurar KYC
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Description */}
          {currentStep === 1 && (
            <div className="form-step">
              <h3>Descrição</h3>
              
              <div className="form-group">
                <label htmlFor="service-description">Descrição *</label>
                <textarea
                  id="service-description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={6}
                  minLength={50}
                  placeholder="Descreva o que você oferece e para quem"
                />
                <div className="character-counter">
                  <span>{formData.description.length}</span>/1000
                </div>
                <small>Mínimo de 50 caracteres. Descreva o que você oferece e para quem.</small>
              </div>

            </div>
          )}

          {/* Step 3: Pricing */}
          {currentStep === 2 && (
            <div className="form-step">
              <h3>Precificação</h3>
              
              <div className="form-group">
                <label htmlFor="service-price">Preço Base (VC) *</label>
                <div className="price-input-container">
                  <input
                    type="number"
                    id="service-price"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    min="10"
                    step="0.01"
                    placeholder="10.00"
                    className={getPriceValidationError() ? 'error' : ''}
                  />
                  {formData.category && (
                    <button 
                      type="button" 
                      className="price-suggestions-btn"
                      onClick={() => setShowPriceSuggestions(!showPriceSuggestions)}
                    >
                      <i className="fas fa-lightbulb"></i>
                      Sugestões
                    </button>
                  )}
                </div>
                
                {showPriceSuggestions && formData.category && (
                  <div className="price-suggestions">
                    <h4>Sugestões de Preço para {categoryLabels[formData.category]}</h4>
                    <div className="suggestions-grid">
                      {getPriceSuggestions(formData.category).map((suggestion, index) => (
                        <button
                          key={index}
                          className="price-suggestion"
                          onClick={() => handlePriceSuggestion(suggestion)}
                        >
                          <div className="suggestion-price">
                            {formatVC(suggestion.vc)}
                          </div>
                          <div className="suggestion-vp">
                            {formatVP(convertVCtoVP(suggestion.vc))}
                          </div>
                          <div className="suggestion-desc">{suggestion.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <small>Preço mínimo 10,00 VC</small>
                
                {getPriceValidationError() && (
                  <div className="validation-error">
                    <i className="fas fa-exclamation-triangle"></i>
                    {getPriceValidationError()}
                  </div>
                )}
                
                {formData.price && !getPriceValidationError() && (
                  <div className="currency-display">
                    <div className="currency-row">
                      <span>Você recebe:</span>
                      <span className="currency-value vc">
                        {formatVC(formData.price)}
                      </span>
                    </div>
                    <div className="currency-row">
                      <span>Cliente paga:</span>
                      <span className="currency-value vp">
                        {formatVP(convertVCtoVP(formData.price))}
                      </span>
                    </div>
                    <div className="conversion-note">
                      Taxa de conversão: 1 VC = 1,5 VP
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="service-discount">Desconto (%)</label>
                <input
                  type="number"
                  id="service-discount"
                  value={formData.discount}
                  onChange={(e) => handleInputChange('discount', e.target.value)}
                  min="0"
                  max="75"
                  step="1"
                  placeholder="0"
                  className={getDiscountError() ? 'error' : ''}
                />
                <small>Desconto opcional (0-75%)</small>
                {getDiscountError() && (
                  <div className="validation-error">
                    <i className="fas fa-exclamation-triangle"></i>
                    {getDiscountError()}
                  </div>
                )}
                
                {getSellerEarningsValidationError() && (
                  <div className="validation-error">
                    <i className="fas fa-exclamation-triangle"></i>
                    {getSellerEarningsValidationError()}
                  </div>
                )}
              </div>

              {formData.price && !getPriceValidationError() && (
                <div className="currency-display">
                  <div className="currency-row">
                    <span>Você recebe:</span>
                    <span className="currency-value vc">{formatVC(effectivePrice())}</span>
                  </div>
                  <div className="currency-row">
                    <span>Cliente paga:</span>
                    <span className="currency-value vp">{formatVP(convertVCtoVP(effectivePrice()))}</span>
                  </div>
                  {formData.discount && parseInt(formData.discount, 10) > 0 && (
                    <div className="discount-display">
                      <span>Desconto aplicado: {formData.discount}%</span>
                    </div>
                  )}
                  <div className="conversion-note">Taxa de conversão: 1 VC = 1,5 VP</div>
                </div>
              )}

              <div className="form-group">
                <label>Opções Complementares</label>
                <p>Adicione extras que os clientes podem adquirir para melhorar o serviço base.</p>
                
                {formData.complementaryOptions.map((option, index) => {
                  const optionPriceError = getOptionPriceValidationError(option.price);
                  return (
                    <div key={index} className="complementary-option">
                      <div className="option-header">
                        <h4>Opção Complementar</h4>
                        <button 
                          type="button" 
                          className="close-btn"
                          onClick={() => removeComplementaryOption(index)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="form-group">
                        <input
                          type="text"
                          value={option.title}
                          onChange={(e) => updateComplementaryOption(index, 'title', e.target.value)}
                          placeholder="Título da Opção"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <textarea
                          value={option.description}
                          onChange={(e) => updateComplementaryOption(index, 'description', e.target.value)}
                          placeholder="Descrição da Opção"
                          rows={2}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="number"
                          value={option.price}
                          onChange={(e) => updateComplementaryOption(index, 'price', e.target.value)}
                          placeholder="Preço Adicional (VC)"
                          min="1"
                          step="0.01"
                          required
                          className={optionPriceError ? 'error' : ''}
                        />
                        <small>Preço mínimo 1,00 VC</small>
                        
                        {optionPriceError && (
                          <div className="validation-error">
                            <i className="fas fa-exclamation-triangle"></i>
                            {optionPriceError}
                          </div>
                        )}
                        
                        {option.price && !optionPriceError && (
                          <div className="currency-display option-currency-display">
                            <div className="currency-row">
                              <span>Você recebe:</span>
                              <span className="currency-value vc">
                                {formatVC(option.price)}
                              </span>
                            </div>
                            <div className="currency-row">
                              <span>Cliente paga:</span>
                              <span className="currency-value vp">
                                {formatVP(convertVCtoVP(option.price))}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                <button type="button" onClick={addComplementaryOption} className="btn secondary">
                  Adicionar Opção Complementar
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Media */}
          {currentStep === 3 && (
            <div className="form-step">
              <h3>Mídia</h3>
              
              <div className="form-group">
                <label>Imagem de Capa</label>
                <div className="image-upload-container">
                  <input
                    type="file"
                    id="cover-image"
                    accept="image/*"
                    onChange={handleCoverImageChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="cover-image" className="upload-placeholder">
                    {coverImagePreview ? (
                      <SmartMediaViewer 
                        mediaData={coverImagePreview}
                        type="service"
                        watermarked={false}
                        isOwner={true}
                        fallbackSrc="/images/default-service.jpg"
                        alt="Cover preview"
                        className="image-preview"
                      />
                    ) : (
                      <>
                        <i className="upload-icon">+</i>
                        <span>Adicionar Imagem de Capa</span>
                      </>
                    )}
                  </label>
                </div>
                <small>Esta será a imagem principal mostrada para seu serviço</small>
              </div>


              <div className="form-group">
                <label>Tags do Serviço</label>
                <div className="tag-input-container">
                  <input
                    ref={tagsInputRef}
                    type="text"
                    placeholder="Digite tags e pressione Enter"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <button type="button" onClick={addTag} className="add-tag-btn">
                    Adicionar
                  </button>
                </div>
                <div className="tags-container">
                  {formData.tags.map((tag, index) => (
                    <span key={index} className="tag">
                      {tag}
                      <button onClick={() => removeTag(index)}>&times;</button>
                    </span>
                  ))}
                </div>
                <small>As tags ajudam as pessoas a encontrar seu serviço</small>
              </div>
            </div>
          )}

          {/* Step 5: Preview */}
          {currentStep === 4 && (
            <div className="form-step">
              <h3>Pré-visualização do Serviço</h3>
              
              <div className="service-preview">
                <div className="preview-header">
                  {coverImagePreview && (
                    <div className="preview-cover-image">
                      <SmartMediaViewer 
                        mediaData={coverImagePreview}
                        type="service"
                        watermarked={false}
                        isOwner={true}
                        fallbackSrc="/images/default-service.jpg"
                        alt={formData.title}
                      />
                    </div>
                  )}
                  <div className="preview-service-info">
                    <h2>{formData.title || 'Título do Serviço'}</h2>
                    <div className="preview-meta">
                      <span className="preview-category">
                        {categoryLabels[formData.category] || 'Categoria'}
                      </span>
                    </div>
                  </div>
                  <div className="preview-price-container">
                    {formData.discount && parseInt(formData.discount, 10) > 0 ? (
                      <>
                        <div className="preview-price-secondary">
                          {formatVC(formData.price)}
                        </div>
                        <div className="preview-price-main">
                          A partir de {formatVP(convertVCtoVP(effectivePrice()))}
                        </div>
                      </>
                    ) : (
                      <div className="preview-price-main">
                        A partir de {formData.price ? formatVP(convertVCtoVP(formData.price)) : '0,00 VP'}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="preview-description">
                  <h3>Descrição</h3>
                  <p>{formData.description || 'Descrição do serviço'}</p>
                </div>
                
                
                {formData.complementaryOptions.length > 0 && (
                  <div className="preview-options">
                    <h3>Opções Complementares</h3>
                    {formData.complementaryOptions.map((option, index) => (
                      <div key={index} className="preview-option">
                        <div className="option-info">
                          <div className="option-title">{option.title}</div>
                          <div className="option-description">{option.description}</div>
                        </div>
                        <div className="option-pricing">
                          <div className="option-price-main">+{formatVP(convertVCtoVP(option.price))}</div>
                          <div className="option-price-secondary">Você recebe: +{formatVC(option.price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {(showcasePhotoPreviews.length > 0 || showcaseVideoPreviews.length > 0) && (
                  <div className="preview-media-section">
                    {showcasePhotoPreviews.length > 0 && (
                      <div className="preview-photos">
                        <h4>Fotos ({showcasePhotoPreviews.length})</h4>
                        <div className="showcase-grid">
                          {showcasePhotoPreviews.map((photo, index) => (
                            <div key={index} className="showcase-item">
                              <img src={photo} alt={`Showcase ${index + 1}`} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {showcaseVideoPreviews.length > 0 && (
                      <div className="preview-videos">
                        <h4>Vídeos ({showcaseVideoPreviews.length})</h4>
                        <div className="showcase-grid">
                          {showcaseVideoPreviews.map((video, index) => (
                            <div key={index} className="showcase-item video-showcase">
                              <video controls>
                                <source src={video} type="video/mp4" />
                                Seu navegador não suporta vídeo.
                              </video>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {formData.tags.length > 0 && (
                  <div className="preview-tags">
                    <h3>Tags</h3>
                    <div className="preview-tags-container">
                      {formData.tags.map((tag, index) => (
                        <span key={index} className="preview-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <div className="modal-actions-left">
            {currentStep > 0 && (
              <button type="button" onClick={prevStep} className="btn secondary">
                Voltar
              </button>
            )}
          </div>
          
          <div className="modal-actions-right">
            {currentStep < steps.length - 1 ? (
              <button 
                type="button" 
                onClick={nextStep} 
                className="btn primary"
                disabled={!validateCurrentStep()}
              >
                Continuar
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleSubmit} 
                className="btn primary"
                disabled={isSubmitting || uploading}
              >
                {isSubmitting ? (editingService ? 'Atualizando...' : 'Criando...') : uploading ? `Fazendo upload... ${Math.round(uploadProgress)}%` : (editingService ? 'Atualizar Serviço' : 'Criar Serviço')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateServiceModal; 