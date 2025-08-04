import React, { useState, useEffect, useRef } from 'react';
import { ref, push, update } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { database } from '../config/firebase';
import './CreatePackModal.css';

const CreatePackModal = ({ isOpen, onClose, onPackCreated, editingPack = null }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved');
  
  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    subcategory: '',
    packType: '',
    description: '',
    price: '',
    discount: '',
    features: [],
    tags: [],
    licenseOptions: [],
    coverImage: null,
    sampleContent: [],
    packContent: []
  });

  // File uploads state
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [sampleContentFiles, setSampleContentFiles] = useState([]);
  const [sampleContentPreviews, setSampleContentPreviews] = useState([]);
  const [packContentFiles, setPackContentFiles] = useState([]);
  const [packContentPreviews, setPackContentPreviews] = useState([]);

  // Input refs
  const featuresInputRef = useRef(null);
  const tagsInputRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);

  const steps = [
    { id: 'basic', title: 'Informações Básicas' },
    { id: 'description', title: 'Descrição' },
    { id: 'pricing', title: 'Precificação' },
    { id: 'content', title: 'Conteúdo' },
    { id: 'preview', title: 'Pré-visualização' }
  ];

  const categories = [
    { value: 'fotografia', label: 'Fotografia' },
    { value: 'videografia', label: 'Videografia' },
    { value: 'mista', label: 'Mídia Mista' },
    { value: 'stock', label: 'Recursos de Stock' },
    { value: 'modelos', label: 'Modelos' },
    { value: 'predefinicoes', label: 'Predefinições/LUTs' },
    { value: 'outro', label: 'Outro' }
  ];

  const subcategories = {
    fotografia: [
      { value: 'natureza', label: 'Natureza' },
      { value: 'retrato', label: 'Retrato' },
      { value: 'paisagem', label: 'Paisagem' },
      { value: 'arquitetura', label: 'Arquitetura' },
      { value: 'eventos', label: 'Eventos' },
      { value: 'produto', label: 'Produto' }
    ],
    videografia: [
      { value: 'documentario', label: 'Documentário' },
      { value: 'comercial', label: 'Comercial' },
      { value: 'eventos', label: 'Eventos' },
      { value: 'musica', label: 'Música' },
      { value: 'cinema', label: 'Cinema' }
    ],
    mista: [
      { value: 'multimidia', label: 'Multimídia' },
      { value: 'apresentacao', label: 'Apresentação' },
      { value: 'portfolio', label: 'Portfólio' }
    ],
    stock: [
      { value: 'imagens', label: 'Imagens' },
      { value: 'videos', label: 'Vídeos' },
      { value: 'audio', label: 'Áudio' },
      { value: 'templates', label: 'Templates' }
    ],
    modelos: [
      { value: '3d', label: '3D' },
      { value: '2d', label: '2D' },
      { value: 'personagens', label: 'Personagens' },
      { value: 'cenarios', label: 'Cenários' }
    ],
    predefinicoes: [
      { value: 'lut', label: 'LUTs' },
      { value: 'preset', label: 'Presets' },
      { value: 'filtro', label: 'Filtros' }
    ]
  };

  const packTypes = [
    { value: 'download', label: 'Download Digital' },
    { value: 'nao-download', label: 'Uso Licenciado' }
  ];

  const licenseOptions = [
    { value: 'personal', label: 'Uso Pessoal' },
    { value: 'commercial', label: 'Uso Comercial' },
    { value: 'editorial', label: 'Uso Editorial' },
    { value: 'resale', label: 'Direitos de Revenda' }
  ];

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
      
      localStorage.setItem(`pack-draft-${currentUser.uid}`, JSON.stringify(draftData));
      
      setAutoSaveStatus('saved');
      
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
      const draft = localStorage.getItem(`pack-draft-${currentUser.uid}`);
      if (draft) {
        const draftData = JSON.parse(draft);
        setFormData({
          title: draftData.title || '',
          category: draftData.category || '',
          subcategory: draftData.subcategory || '',
          packType: draftData.packType || '',
          description: draftData.description || '',
          price: draftData.price || '',
          discount: draftData.discount || '',
          features: draftData.features || [],
          tags: draftData.tags || [],
          licenseOptions: draftData.licenseOptions || [],
          coverImage: draftData.coverImage || null,
          sampleContent: draftData.sampleContent || [],
          packContent: draftData.packContent || []
        });
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  };

  useEffect(() => {
    if (editingPack) {
      populateFormWithPackData(editingPack);
      setCurrentStep(0);
    } else {
      loadDraft();
      setCurrentStep(0);
    }
  }, [editingPack]);

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

  const populateFormWithPackData = (pack) => {
    setFormData({
      title: pack.title || '',
      category: pack.category || '',
      subcategory: pack.subcategory || '',
      packType: pack.packType || '',
      description: pack.description || '',
      price: pack.price || '',
      discount: pack.discount || '',
      features: pack.features || [],
      tags: pack.tags || [],
      licenseOptions: pack.licenseOptions || [],
      coverImage: pack.coverImage || null,
      sampleContent: pack.sampleContent || [],
      packContent: pack.packContent || []
    });

    setCoverImageFile(null);
    setSampleContentFiles([]);
    setPackContentFiles([]);

    if (pack.coverImage) {
      setCoverImagePreview(pack.coverImage);
    }
    if (pack.sampleContent) {
      setSampleContentPreviews(pack.sampleContent);
    }
    if (pack.packContent) {
      setPackContentPreviews(pack.packContent);
    }
  };

  const clearForm = () => {
    setFormData({
      title: '',
      category: '',
      subcategory: '',
      packType: '',
      description: '',
      price: '',
      discount: '',
      features: [],
      tags: [],
      licenseOptions: [],
      coverImage: null,
      sampleContent: [],
      packContent: []
    });
    setCoverImageFile(null);
    setCoverImagePreview('');
    setSampleContentFiles([]);
    setSampleContentPreviews([]);
    setPackContentFiles([]);
    setPackContentPreviews([]);
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

  const handleLicenseOptionChange = (option, checked) => {
    setFormData(prev => ({
      ...prev,
      licenseOptions: checked 
        ? [...prev.licenseOptions, option]
        : prev.licenseOptions.filter(opt => opt !== option)
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

  const handleSampleContentChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length + sampleContentFiles.length <= 5) {
      setSampleContentFiles(prev => [...prev, ...files]);
      
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSampleContentPreviews(prev => [...prev, e.target.result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handlePackContentChange = (event) => {
    const files = Array.from(event.target.files);
    setPackContentFiles(prev => [...prev, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPackContentPreviews(prev => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeSampleContent = (index) => {
    setSampleContentFiles(prev => prev.filter((_, i) => i !== index));
    setSampleContentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removePackContent = (index) => {
    setPackContentFiles(prev => prev.filter((_, i) => i !== index));
    setPackContentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFileToStorage = async (file, path) => {
    try {
      const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../config/firebase');
      
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      return await getDownloadURL(fileRef);
    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      throw error;
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0: // Basic info
        return formData.title.trim() && formData.category && formData.packType;
      case 1: // Description
        return formData.description.trim().length >= 50;
      case 2: // Pricing
        return formData.price && parseFloat(formData.price) >= 5;
      case 3: // Content (optional)
        return true;
      case 4: // Preview
        return true;
      default:
        return false;
    }
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
    if (!currentUser || isSubmitting) return;

    // Validate form data
    if (!formData.title.trim()) {
      showError('Por favor, insira um título para o pack');
      return;
    }

    if (!formData.category) {
      showError('Por favor, selecione uma categoria');
      return;
    }

    if (!formData.packType) {
      showError('Por favor, selecione um tipo de pack');
      return;
    }

    if (!formData.description.trim() || formData.description.length < 50) {
      showError('A descrição deve ter pelo menos 50 caracteres');
      return;
    }

    if (!formData.price || parseFloat(formData.price) < 5) {
      showError('O preço mínimo é 5,00 VP');
      return;
    }

    setIsSubmitting(true);
    setUploadingFiles(true);

    try {
      // Prepare base pack data
      const packData = {
        title: formData.title,
        category: formData.category,
        subcategory: formData.subcategory,
        packType: formData.packType,
        description: formData.description,
        price: parseFloat(formData.price),
        discount: formData.discount ? parseInt(formData.discount) : 0,
        features: formData.features,
        tags: formData.tags,
        licenseOptions: formData.licenseOptions,
        providerId: currentUser.uid,
        status: 'active',
        updatedAt: Date.now()
      };

      if (!editingPack) {
        packData.createdAt = Date.now();
      }

      // Generate pack ID
      let packId = editingPack?.id;
      if (!packId) {
        const tempRef = ref(database, 'packs');
        const newPackRef = push(tempRef);
        packId = newPackRef.key;
      }

      // Upload cover image
      if (coverImageFile) {
        const coverImagePath = `packs/${currentUser.uid}/${packId}/cover.jpg`;
        packData.coverImage = await uploadFileToStorage(coverImageFile, coverImagePath);
      } else if (formData.coverImage) {
        packData.coverImage = formData.coverImage;
      }

      // Upload sample content
      const sampleUrls = [...formData.sampleContent];
      for (let i = 0; i < sampleContentFiles.length; i++) {
        const samplePath = `packs/${currentUser.uid}/${packId}/sample-${Date.now()}-${i}-${sampleContentFiles[i].name}`;
        const sampleUrl = await uploadFileToStorage(sampleContentFiles[i], samplePath);
        sampleUrls.push(sampleUrl);
      }
      packData.sampleContent = sampleUrls;

      // Upload pack content
      const contentUrls = [...formData.packContent];
      for (let i = 0; i < packContentFiles.length; i++) {
        const contentPath = `packs/${currentUser.uid}/${packId}/content-${Date.now()}-${i}-${packContentFiles[i].name}`;
        const contentUrl = await uploadFileToStorage(packContentFiles[i], contentPath);
        contentUrls.push(contentUrl);
      }
      packData.packContent = contentUrls;

      let resultPack;
      
      if (editingPack) {
        // Update existing pack
        const packRef = ref(database, `packs/${currentUser.uid}/${packId}`);
        await update(packRef, packData);
        resultPack = { id: packId, ...packData };
        showSuccess('Pack atualizado com sucesso!');
      } else {
        // Create new pack
        const packRef = ref(database, `packs/${currentUser.uid}/${packId}`);
        await push(packRef, packData);
        resultPack = { id: packId, ...packData };
        showSuccess('Pack criado com sucesso!');
      }

      // Clear draft after successful creation/update
      localStorage.removeItem(`pack-draft-${currentUser.uid}`);

      onPackCreated(resultPack);
      onClose();
    } catch (error) {
      console.error('Error creating/updating pack:', error);
      const errorMessage = `Falha ao ${editingPack ? 'atualizar' : 'criar'} pack: ${error.message}`;
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
      setUploadingFiles(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="create-pack-modal-overlay">
      <div className="create-pack-modal">
        <div className="modal-header">
          <h2>{editingPack ? 'Editar Pack' : 'Criar Novo Pack'}</h2>
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
                <label htmlFor="pack-title">Título do Pack *</label>
                <input
                  type="text"
                  id="pack-title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  maxLength={100}
                  placeholder="Escolha um título claro e atrativo"
                />
                <small>Escolha um título claro e atrativo para seu pack</small>
              </div>

              <div className="form-group">
                <label htmlFor="pack-category">Categoria *</label>
                <select
                  id="pack-category"
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

              {formData.category && subcategories[formData.category] && (
                <div className="form-group">
                  <label htmlFor="pack-subcategory">Subcategoria</label>
                  <select
                    id="pack-subcategory"
                    value={formData.subcategory}
                    onChange={(e) => handleInputChange('subcategory', e.target.value)}
                  >
                    <option value="">Selecione uma subcategoria (opcional)</option>
                    {subcategories[formData.category].map(sub => (
                      <option key={sub.value} value={sub.value}>
                        {sub.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="pack-type">Tipo de Pack *</label>
                <select
                  id="pack-type"
                  value={formData.packType}
                  onChange={(e) => handleInputChange('packType', e.target.value)}
                >
                  <option value="">Selecione um tipo</option>
                  {packTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
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
                <label htmlFor="pack-description">Descrição *</label>
                <textarea
                  id="pack-description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={6}
                  minLength={50}
                  placeholder="Descreva o que está incluído no pack e para quem é"
                />
                <div className="character-counter">
                  <span>{formData.description.length}</span>/1000
                </div>
                <small>Mínimo de 50 caracteres. Descreva o que está incluído e para quem é.</small>
              </div>

              <div className="form-group">
                <label>Recursos do Pack</label>
                <div className="tag-input-container">
                  <input
                    ref={featuresInputRef}
                    type="text"
                    placeholder="Adicione recursos (ex.: '20 Imagens em Alta Resolução') e pressione Enter"
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
                <small>Liste todos os recursos-chave do seu pack para torná-lo mais atraente</small>
              </div>
            </div>
          )}

          {/* Step 3: Pricing */}
          {currentStep === 2 && (
            <div className="form-step">
              <h3>Precificação</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pack-price">Preço (VP) *</label>
                  <input
                    type="number"
                    id="pack-price"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    min="5"
                    step="0.01"
                    placeholder="5.00"
                  />
                  <small>Preço mínimo de VP 5,00</small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="pack-discount">Desconto (%)</label>
                  <input
                    type="number"
                    id="pack-discount"
                    value={formData.discount}
                    onChange={(e) => handleInputChange('discount', e.target.value)}
                    min="0"
                    max="99"
                    step="1"
                    placeholder="0"
                  />
                  <small>Opcional: Adicione uma porcentagem de desconto</small>
                </div>
              </div>

              {formData.packType === 'nao-download' && (
                <div className="form-group">
                  <label>Opções de Licença</label>
                  <div className="checkbox-options">
                    {licenseOptions.map(option => (
                      <div key={option.value} className="checkbox-option">
                        <input
                          type="checkbox"
                          id={`license-${option.value}`}
                          checked={formData.licenseOptions.includes(option.value)}
                          onChange={(e) => handleLicenseOptionChange(option.value, e.target.checked)}
                        />
                        <label htmlFor={`license-${option.value}`}>{option.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Content */}
          {currentStep === 3 && (
            <div className="form-step">
              <h3>Conteúdo</h3>
              
              <div className="form-group">
                <label>Imagem de Capa do Pack</label>
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
                <small>Esta será a imagem principal exibida para o seu pack</small>
              </div>

              <div className="form-group">
                <label>Conteúdo de Exemplo</label>
                <div className="image-upload-container">
                  <input
                    type="file"
                    id="sample-content"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleSampleContentChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="sample-content" className="upload-placeholder">
                    <i className="upload-icon">+</i>
                    <span>Adicionar Exemplo</span>
                  </label>
                </div>
                <div className="showcase-grid">
                  {sampleContentPreviews.map((preview, index) => (
                    <div key={index} className="showcase-item">
                      {preview.includes('data:video') ? (
                        <video controls>
                          <source src={preview} type="video/mp4" />
                          Seu navegador não suporta vídeo.
                        </video>
                      ) : (
                        <img src={preview} alt={`Sample ${index + 1}`} />
                      )}
                      <button 
                        type="button" 
                        className="remove-media"
                        onClick={() => removeSampleContent(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <small>Envie exemplos do conteúdo do seu pack (até 5 arquivos)</small>
              </div>

              <div className="form-group">
                <label>Enviar Conteúdo Completo do Pack</label>
                <div className="image-upload-container">
                  <input
                    type="file"
                    id="pack-content"
                    accept="image/*,video/*"
                    multiple
                    onChange={handlePackContentChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="pack-content" className="upload-placeholder">
                    <i className="upload-icon">+</i>
                    <span>Enviar Imagens ou Vídeos</span>
                  </label>
                </div>
                <div className="showcase-grid">
                  {packContentPreviews.map((preview, index) => (
                    <div key={index} className="showcase-item">
                      {preview.includes('data:video') ? (
                        <video controls>
                          <source src={preview} type="video/mp4" />
                          Seu navegador não suporta vídeo.
                        </video>
                      ) : (
                        <img src={preview} alt={`Content ${index + 1}`} />
                      )}
                      <button 
                        type="button" 
                        className="remove-media"
                        onClick={() => removePackContent(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <small>Formatos suportados: JPG, PNG, GIF, MP4, etc. Tamanho máximo: 500 MB.</small>
              </div>

              <div className="form-group">
                <label>Tags</label>
                <div className="tag-input-container">
                  <input
                    ref={tagsInputRef}
                    type="text"
                    placeholder="Insira tags e pressione Enter"
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
                <small>As tags ajudam as pessoas a encontrar seu pack (ex.: 'Natureza', 'Retrato', '4K')</small>
              </div>
            </div>
          )}

          {/* Step 5: Preview */}
          {currentStep === 4 && (
            <div className="form-step">
              <h3>Pré-visualização do Pack</h3>
              
              <div className="pack-preview">
                <div className="preview-header">
                  {coverImagePreview && (
                    <div className="preview-cover-image">
                      <img src={coverImagePreview} alt={formData.title} />
                    </div>
                  )}
                  <div className="preview-pack-info">
                    <h2>{formData.title || 'Título do Pack'}</h2>
                    <div className="preview-meta">
                      <span className="preview-category">
                        {categories.find(c => c.value === formData.category)?.label || 'Categoria'}
                      </span>
                      {formData.subcategory && (
                        <span className="preview-subcategory">
                          {subcategories[formData.category]?.find(s => s.value === formData.subcategory)?.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="preview-price-container">
                    <div className="preview-price-main">
                      {formData.price ? `VP ${parseFloat(formData.price).toFixed(2)}` : 'VP 0,00'}
                    </div>
                    {formData.discount && (
                      <div className="preview-discount">
                        {formData.discount}% de desconto
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="preview-description">
                  <h3>Descrição</h3>
                  <p>{formData.description || 'Descrição do pack'}</p>
                </div>
                
                {formData.features.length > 0 && (
                  <div className="preview-features">
                    <h3>Recursos do Pack</h3>
                    <ul className="features-list">
                      {formData.features.map((feature, index) => (
                        <li key={index}>
                          <span className="feature-check">✓</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {formData.licenseOptions.length > 0 && (
                  <div className="preview-license">
                    <h3>Opções de Licença</h3>
                    <div className="license-options-list">
                      {formData.licenseOptions.map((option, index) => (
                        <span key={index} className="license-option">
                          {licenseOptions.find(l => l.value === option)?.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {(sampleContentPreviews.length > 0 || packContentPreviews.length > 0) && (
                  <div className="preview-media-section">
                    {sampleContentPreviews.length > 0 && (
                      <div className="preview-samples">
                        <h4>Exemplos ({sampleContentPreviews.length})</h4>
                        <div className="showcase-grid">
                          {sampleContentPreviews.map((preview, index) => (
                            <div key={index} className="showcase-item">
                              {preview.includes('data:video') ? (
                                <video controls>
                                  <source src={preview} type="video/mp4" />
                                  Seu navegador não suporta vídeo.
                                </video>
                              ) : (
                                <img src={preview} alt={`Sample ${index + 1}`} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {packContentPreviews.length > 0 && (
                      <div className="preview-content">
                        <h4>Conteúdo ({packContentPreviews.length})</h4>
                        <div className="showcase-grid">
                          {packContentPreviews.map((preview, index) => (
                            <div key={index} className="showcase-item">
                              {preview.includes('data:video') ? (
                                <video controls>
                                  <source src={preview} type="video/mp4" />
                                  Seu navegador não suporta vídeo.
                                </video>
                              ) : (
                                <img src={preview} alt={`Content ${index + 1}`} />
                              )}
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
              {isSubmitting ? (editingPack ? 'Atualizando...' : 'Criando...') : uploadingFiles ? 'Fazendo upload...' : (editingPack ? 'Atualizar Pack' : 'Criar Pack')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePackModal; 