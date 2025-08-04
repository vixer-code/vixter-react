import React, { useState, useEffect, useRef } from 'react';
import { ref, push } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { useServices } from '../hooks/useServices';
import { useNotification } from '../contexts/NotificationContext';
import { database } from '../config/firebase';
import './CreateServiceModal.css';

const CreateServiceModal = ({ isOpen, onClose, onServiceCreated, editingService = null }) => {
  const { currentUser } = useAuth();
  const { createService, uploadFile, createServiceWithId, updateService } = useServices();
  const { showSuccess, showError } = useNotification();
  
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
    features: [],
    complementaryOptions: [],
    coverImage: null,
    showcasePhotos: [],
    showcaseVideos: [],
    tags: []
  });

  // File uploads state
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [showcasePhotoFiles, setShowcasePhotoFiles] = useState([]);
  const [showcasePhotoPreviews, setShowcasePhotoPreviews] = useState([]);
  const [showcaseVideoFiles, setShowcaseVideoFiles] = useState([]);
  const [showcaseVideoPreviews, setShowcaseVideoPreviews] = useState([]);
  const [activeMediaTab, setActiveMediaTab] = useState('photos');

  // Input refs
  const featuresInputRef = useRef(null);
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
    { value: 'chilling', label: 'Relaxar' },
    { value: 'custom', label: 'Personalizado' },
    { value: 'makeFriends', label: 'Fazer Amigos' },
    { value: 'chat', label: 'Conversar' },
    { value: 'movie', label: 'Filme' },
    { value: 'likeService', label: 'Curtir Serviço' },
    { value: 'emotionalSupport', label: 'Apoio Emocional' },
    { value: 'addingSocials', label: 'Adicionar Redes Sociais' },
    { value: 'languageExchange', label: 'Intercâmbio de Idiomas' },
    { value: 'drawing', label: 'Desenho' },
    { value: 'fortuneTelling', label: 'Leitura de Sorte' }
  ];

  const categoryLabels = {
    games: 'Jogos',
    chilling: 'Relaxar',
    custom: 'Personalizado',
    makeFriends: 'Fazer Amigos',
    chat: 'Conversar',
    movie: 'Filme',
    likeService: 'Curtir Serviço',
    emotionalSupport: 'Apoio Emocional',
    addingSocials: 'Adicionar Redes Sociais',
    languageExchange: 'Intercâmbio de Idiomas',
    drawing: 'Desenho',
    fortuneTelling: 'Leitura de Sorte'
  };

  // Price suggestions based on category
  const getPriceSuggestions = (category) => {
    const suggestions = {
      games: [
        { vc: 15, description: 'Jogo casual (15-30 min)' },
        { vc: 25, description: 'Jogo competitivo (30-60 min)' },
        { vc: 40, description: 'Jogo complexo (1-2 horas)' }
      ],
      chat: [
        { vc: 10, description: 'Conversa casual (15 min)' },
        { vc: 20, description: 'Conversa profunda (30 min)' },
        { vc: 35, description: 'Sessão de terapia (1 hora)' }
      ],
      emotionalSupport: [
        { vc: 20, description: 'Apoio básico (30 min)' },
        { vc: 35, description: 'Sessão completa (1 hora)' },
        { vc: 50, description: 'Acompanhamento intensivo (2 horas)' }
      ],
      drawing: [
        { vc: 25, description: 'Desenho simples (30 min)' },
        { vc: 40, description: 'Desenho detalhado (1 hora)' },
        { vc: 60, description: 'Ilustração complexa (2+ horas)' }
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
          features: draftData.features || [],
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
      features: service.features || [],
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
      features: [],
      complementaryOptions: [],
      coverImage: null,
      showcasePhotos: [],
      showcaseVideos: [],
      tags: []
    });
    setCoverImageFile(null);
    setCoverImagePreview('');
    setShowcasePhotoFiles([]);
    setShowcasePhotoPreviews([]);
    setShowcaseVideoFiles([]);
    setShowcaseVideoPreviews([]);
    setCurrentStep(0);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addFeature = () => {
    if (featuresInputRef.current && featuresInputRef.current.value.trim()) {
      const newFeature = featuresInputRef.current.value.trim();
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature]
      }));
      featuresInputRef.current.value = '';
    }
  };

  const removeFeature = (index) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
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
      setCoverImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setCoverImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleShowcasePhotosChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length + showcasePhotoFiles.length <= 10) {
      setShowcasePhotoFiles(prev => [...prev, ...files]);
      
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setShowcasePhotoPreviews(prev => [...prev, e.target.result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleShowcaseVideosChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length + showcaseVideoFiles.length <= 5) {
      setShowcaseVideoFiles(prev => [...prev, ...files]);
      
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setShowcaseVideoPreviews(prev => [...prev, e.target.result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeShowcasePhoto = (index) => {
    setShowcasePhotoFiles(prev => prev.filter((_, i) => i !== index));
    setShowcasePhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeShowcaseVideo = (index) => {
    setShowcaseVideoFiles(prev => prev.filter((_, i) => i !== index));
    setShowcaseVideoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFileToStorage = async (file, path) => {
    try {
      console.log(`📤 Uploading file: ${file.name} to path: ${path}`);
      const url = await uploadFile(file, path);
      console.log(`✅ File uploaded successfully: ${url}`);
      return url;
    } catch (error) {
      console.error(`❌ Error uploading file ${file.name}:`, error);
      throw error;
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0: // Basic info
        return formData.title.trim() && formData.category;
      case 1: // Description
        return formData.description.trim().length >= 50;
      case 2: // Pricing
        return formData.price && parseFloat(formData.price) >= 10;
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
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    console.log('🚀 Starting service creation/update...');
    console.log('Current user:', currentUser);
    console.log('Database instance:', database);
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

    if (!formData.description.trim() || formData.description.length < 50) {
      showError('A descrição deve ter pelo menos 50 caracteres');
      return;
    }

    if (!formData.price || parseFloat(formData.price) < 10) {
      showError('O preço mínimo é 10,00 VC');
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
      // Prepare base service data
      const serviceData = {
        title: formData.title,
        category: formData.category,
        description: formData.description,
        price: parseFloat(formData.price), // Price in VC
        features: formData.features,
        complementaryOptions: formData.complementaryOptions,
        tags: formData.tags,
        providerId: currentUser.uid,
        status: 'active',
        updatedAt: Date.now(),
        currency: 'VC' // Indicates prices are in VC
      };

      // If creating a new service, add creation timestamp
      if (!editingService) {
        serviceData.createdAt = Date.now();
      }

      // Generate a unique service ID for file uploads (only for new services)
      let serviceId = editingService?.id;
      if (!serviceId) {
        if (!database) {
          throw new Error('Firebase database not initialized');
        }
        
        const tempRef = ref(database, 'services');
        const newServiceRef = push(tempRef);
        serviceId = newServiceRef.key;

        if (!serviceId) {
          throw new Error('Failed to generate service ID');
        }
      }

      console.log(`🔑 Using ServiceID: ${serviceId}`);

      // Upload cover image
      if (coverImageFile) {
        const coverImagePath = `servicesMedia/${currentUser.uid}/${serviceId}/cover-${Date.now()}-${coverImageFile.name}`;
        console.log('📷 Uploading cover image...');
        serviceData.coverImageURL = await uploadFileToStorage(coverImageFile, coverImagePath);
        console.log('✅ Cover image uploaded:', serviceData.coverImageURL);
      } else if (formData.coverImage) {
        serviceData.coverImageURL = formData.coverImage;
        console.log('📷 Reusing existing cover image:', serviceData.coverImageURL);
      }

      // Upload showcase photos
      const photoUrls = [...formData.showcasePhotos];
      for (let i = 0; i < showcasePhotoFiles.length; i++) {
        const photoPath = `servicesMedia/${currentUser.uid}/${serviceId}/photo-${Date.now()}-${i}-${showcasePhotoFiles[i].name}`;
        console.log(`📸 Uploading showcase photo ${i + 1}...`);
        const photoUrl = await uploadFileToStorage(showcasePhotoFiles[i], photoPath);
        photoUrls.push(photoUrl);
        console.log(`✅ Showcase photo ${i + 1} uploaded:`, photoUrl);
      }
      serviceData.showcasePhotosURLs = photoUrls;

      // Upload showcase videos
      const videoUrls = [...formData.showcaseVideos];
      for (let i = 0; i < showcaseVideoFiles.length; i++) {
        const videoPath = `servicesMedia/${currentUser.uid}/${serviceId}/video-${Date.now()}-${i}-${showcaseVideoFiles[i].name}`;
        console.log(`🎥 Uploading showcase video ${i + 1}...`);
        const videoUrl = await uploadFileToStorage(showcaseVideoFiles[i], videoPath);
        videoUrls.push(videoUrl);
        console.log(`✅ Showcase video ${i + 1} uploaded:`, videoUrl);
      }
      serviceData.showcaseVideosURLs = videoUrls;

      let resultService;
      
      if (editingService) {
        // Update existing service
        console.log('📝 Updating existing service...');
        resultService = await updateService(serviceId, serviceData);
        console.log('✅ Service updated successfully:', resultService);
        showSuccess('Serviço atualizado com sucesso!');
      } else {
        // Create new service
        console.log('📝 Creating new service...');
        resultService = await createServiceWithId(currentUser.uid, serviceId, serviceData);
        console.log('✅ Service created successfully:', resultService);
        showSuccess('Serviço criado com sucesso!');
      }

      // Clear draft after successful creation/update
      localStorage.removeItem(`service-draft-${currentUser.uid}`);

      onServiceCreated(resultService);
      onClose();
    } catch (error) {
      console.error('❌ Error creating/updating service:', error);
      const errorMessage = `Falha ao ${editingService ? 'atualizar' : 'criar'} serviço: ${error.message}`;
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
      setUploadingFiles(false);
    }
  };

  const convertVCtoVP = (vcAmount) => {
    return vcAmount * 1.5;
  };

  const formatCurrency = (amount, decimals = 2) => {
    return parseFloat(amount || 0).toFixed(decimals).replace('.', ',');
  };

  const formatVC = (amount) => {
    return `${formatCurrency(amount)} VC`;
  };

  const formatVP = (amount) => {
    return `${formatCurrency(amount)} VP`;
  };

  const handlePriceSuggestion = (suggestion) => {
    handleInputChange('price', suggestion.vc.toString());
    setShowPriceSuggestions(false);
  };

  if (!isOpen) return null;

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

              <div className="form-group">
                <label>Recursos do Serviço</label>
                <div className="tag-input-container">
                  <input
                    ref={featuresInputRef}
                    type="text"
                    placeholder="Adicione recursos e pressione Enter"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  />
                  <button type="button" onClick={addFeature} className="add-tag-btn">
                    Adicionar
                  </button>
                </div>
                <div className="tags-container">
                  {formData.features.map((feature, index) => (
                    <span key={index} className="tag">
                      {feature}
                      <button onClick={() => removeFeature(index)}>&times;</button>
                    </span>
                  ))}
                </div>
                <small>Liste os principais recursos do seu serviço para torná-lo mais atraente</small>
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
                            <div className="currency-icon vc-icon"></div>
                            {formatVC(suggestion.vc)}
                          </div>
                          <div className="suggestion-vp">
                            <div className="currency-icon vp-icon"></div>
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
                        <div className="currency-icon vc-icon"></div>
                        {formatVC(formData.price)}
                      </span>
                    </div>
                    <div className="currency-row">
                      <span>Cliente paga:</span>
                      <span className="currency-value vp">
                        <div className="currency-icon vp-icon"></div>
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
                          className="remove-option"
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
                                <div className="currency-icon vc-icon"></div>
                                {formatVC(option.price)}
                              </span>
                            </div>
                            <div className="currency-row">
                              <span>Cliente paga:</span>
                              <span className="currency-value vp">
                                <div className="currency-icon vp-icon"></div>
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
                      <img src={coverImagePreview} alt="Cover preview" className="image-preview" />
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
                <label>Conteúdo de Demonstração</label>
                <p>Faça upload de fotos e vídeos para demonstrar seu serviço aos clientes.</p>
                
                <div className="media-tabs">
                  <button
                    type="button"
                    className={`media-tab ${activeMediaTab === 'photos' ? 'active' : ''}`}
                    onClick={() => setActiveMediaTab('photos')}
                  >
                    Fotos
                  </button>
                  <button
                    type="button"
                    className={`media-tab ${activeMediaTab === 'videos' ? 'active' : ''}`}
                    onClick={() => setActiveMediaTab('videos')}
                  >
                    Vídeos
                  </button>
                </div>

                {activeMediaTab === 'photos' && (
                  <div className="media-content">
                    <div className="image-upload-container">
                      <input
                        type="file"
                        id="showcase-photos"
                        accept="image/*"
                        multiple
                        onChange={handleShowcasePhotosChange}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="showcase-photos" className="upload-placeholder">
                        <i className="upload-icon">+</i>
                        <span>Adicionar Fotos</span>
                      </label>
                    </div>
                    <div className="showcase-grid">
                      {showcasePhotoPreviews.map((preview, index) => (
                        <div key={index} className="showcase-item">
                          <img src={preview} alt={`Showcase ${index + 1}`} />
                          <button 
                            type="button" 
                            className="remove-media"
                            onClick={() => removeShowcasePhoto(index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <small>Até 10 fotos (JPG/PNG)</small>
                  </div>
                )}

                {activeMediaTab === 'videos' && (
                  <div className="media-content">
                    <div className="image-upload-container">
                      <input
                        type="file"
                        id="showcase-videos"
                        accept="video/*"
                        multiple
                        onChange={handleShowcaseVideosChange}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="showcase-videos" className="upload-placeholder">
                        <i className="upload-icon">+</i>
                        <span>Adicionar Vídeos</span>
                      </label>
                    </div>
                    <div className="showcase-grid">
                      {showcaseVideoPreviews.map((preview, index) => (
                        <div key={index} className="showcase-item">
                          <video controls>
                            <source src={preview} type="video/mp4" />
                            Seu navegador não suporta vídeo.
                          </video>
                          <button 
                            type="button" 
                            className="remove-media"
                            onClick={() => removeShowcaseVideo(index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <small>Até 5 vídeos (MP4/MOV, máx. 100 MB cada)</small>
                  </div>
                )}
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
                      <img src={coverImagePreview} alt={formData.title} />
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
                    <div className="preview-price-main">
                      A partir de {formData.price ? formatVP(convertVCtoVP(formData.price)) : '0,00 VP'}
                    </div>
                  </div>
                </div>
                
                <div className="preview-description">
                  <h3>Descrição</h3>
                  <p>{formData.description || 'Descrição do serviço'}</p>
                </div>
                
                {formData.features.length > 0 && (
                  <div className="preview-features">
                    <h3>Recursos do Serviço</h3>
                    <ul className="features-list">
                      {formData.features.map((feature, index) => (
                        <li key={index}>
                          <span className="feature-check">✓</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
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
          {currentStep > 0 && (
            <button type="button" onClick={prevStep} className="btn secondary">
              Voltar
            </button>
          )}
          
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
              disabled={isSubmitting || uploadingFiles}
            >
              {isSubmitting ? (editingService ? 'Atualizando...' : 'Criando...') : uploadingFiles ? 'Fazendo upload...' : (editingService ? 'Atualizar Serviço' : 'Criar Serviço')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateServiceModal; 