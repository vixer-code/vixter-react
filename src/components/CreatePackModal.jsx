import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePacksR2 as usePacks } from '../contexts/PacksContextR2';
import useR2Media from '../hooks/useR2Media';
import './CreatePackModal.css';

const subcategoriesMap = {
  'conteudo-artistico': ['Ilustração', 'Desenho', 'Modelagem 3D', 'Templates', 'Outros'],
  'conteudo-educativo': ['Tutoriais', 'Cursos', 'Questionários', 'Outros'],
  'conteudo-18': ['Fetiche', 'Conteúdo Acompanhada', 'Cosplay', 'BBW (Big Beautiful Woman)', 'Outros'],
  'outros': []
};

const packCategories = [
  { value: 'conteudo-artistico', label: 'Conteúdo artístico' },
  { value: 'conteudo-educativo', label: 'Conteúdo educativo' },
  { value: 'conteudo-18', label: 'Conteúdo +18 (Vixies)' },
  { value: 'outros', label: 'Outros' }
];

const packTypeOptions = [
  { value: 'download', label: 'Download Digital' },
  { value: 'nao-download', label: 'Uso Licenciado' }
];

const CreatePackModal = ({ isOpen, onClose, onPackCreated, editingPack = null }) => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { createPack, updatePack } = usePacks();
  const { showSuccess, showError } = useNotification();
  const { uploadPackMedia, uploading } = useR2Media();
  
  // Check account type
  const accountType = userProfile?.accountType || 'client';
  const isProvider = accountType === 'provider';
  const isBoth = accountType === 'both';

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const tagsInputRef = useRef(null);

  const steps = [
    { id: 'basic', title: 'Informações Básicas' },
    { id: 'description', title: 'Descrição' },
    { id: 'pricing', title: 'Precificação' },
    { id: 'media', title: 'Mídia' },
    { id: 'preview', title: 'Pré-visualização' }
  ];

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    subcategory: '',
    packType: '',
    description: '',
    price: '',
    discount: '',
    tags: [],
    licenseOptions: [], // ['personal','commercial','editorial','resale'] when packType == 'nao-download'
    disableWatermark: false, // Option to disable watermark for download content
    coverImage: null, // URL when editing
    sampleImages: [], // existing URLs when editing
    sampleVideos: [], // existing URLs when editing
    packContent: [] // existing URLs when editing
  });

  // Local file states
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [sampleImageFiles, setSampleImageFiles] = useState([]);
  const [sampleImagePreviews, setSampleImagePreviews] = useState([]);
  const [sampleVideoFiles, setSampleVideoFiles] = useState([]);
  const [sampleVideoPreviews, setSampleVideoPreviews] = useState([]);
  const [packFiles, setPackFiles] = useState([]); // images or videos (final downloadable content)
  const [packFilePreviews, setPackFilePreviews] = useState([]); // data URLs for previews aligned with packFiles

  useEffect(() => {
    if (editingPack) {
      setFormData({
        title: editingPack.title || '',
        category: editingPack.category || '',
        subcategory: editingPack.subcategory || '',
        packType: editingPack.packType || '',
        description: editingPack.description || '',
        price: editingPack.price != null ? String(editingPack.price) : '',
        discount: editingPack.discount != null ? String(editingPack.discount) : '',
        tags: editingPack.tags || [],
        licenseOptions: editingPack.licenseOptions || [],
        disableWatermark: editingPack.disableWatermark || false,
        coverImage: editingPack.coverImage || null,
        sampleImages: editingPack.sampleImages || [],
        sampleVideos: editingPack.sampleVideos || [],
        packContent: editingPack.packContent || []
      });

      setCoverImageFile(null);
      setPackFiles([]);
      setPackFilePreviews([]);
      setSampleImageFiles([]);
      setSampleVideoFiles([]);
      setSampleImagePreviews([]);
      setSampleVideoPreviews([]);
      setCoverImagePreview(editingPack.coverImage?.publicUrl || editingPack.coverImage || '');

      setCurrentStep(0);
    } else {
      clearForm(false);
      setCurrentStep(0);
    }
  }, [editingPack]);

  const clearForm = (resetStep = true) => {
    setFormData({
      title: '',
      category: '',
      subcategory: '',
      packType: '',
      description: '',
      price: '',
      discount: '',
      tags: [],
      licenseOptions: [],
      disableWatermark: false,
      coverImage: null,
      sampleImages: [],
      sampleVideos: [],
      packContent: []
    });
    setCoverImageFile(null);
    setCoverImagePreview('');
    setSampleImageFiles([]);
    setSampleImagePreviews([]);
    setSampleVideoFiles([]);
    setSampleVideoPreviews([]);
    setPackFiles([]);
    setPackFilePreviews([]);
    if (resetStep) setCurrentStep(0);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  const addTag = () => {
    const el = tagsInputRef.current;
    if (el && el.value.trim()) {
      const newTag = el.value.trim();
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
      el.value = '';
    }
  };
  const removeTag = (index) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== index) }));
  };

  // Cover image
  const handleCoverImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Sample content (limit 5 total as per create-pack.js)
  const MAX_SAMPLES = 5;

  const handleSampleImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    const total = sampleImageFiles.length + sampleVideoFiles.length + files.length;
    if (total > MAX_SAMPLES) {
      showError(`Máximo de ${MAX_SAMPLES} amostras (imagens ou vídeos)`);
      return;
    }
    setSampleImageFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setSampleImagePreviews(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
  };

  const handleSampleVideosChange = (e) => {
    const files = Array.from(e.target.files || []);
    const total = sampleImageFiles.length + sampleVideoFiles.length + files.length;
    if (total > MAX_SAMPLES) {
      showError(`Máximo de ${MAX_SAMPLES} amostras (imagens ou vídeos)`);
      return;
    }
    setSampleVideoFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setSampleVideoPreviews(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
  };

  const removeSampleImage = (index) => {
    setSampleImageFiles(prev => prev.filter((_, i) => i !== index));
    setSampleImagePreviews(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({ ...prev, sampleImages: prev.sampleImages.filter((_, i) => i !== index) }));
  };

  const removeSampleVideo = (index) => {
    setSampleVideoFiles(prev => prev.filter((_, i) => i !== index));
    setSampleVideoPreviews(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({ ...prev, sampleVideos: prev.sampleVideos.filter((_, i) => i !== index) }));
  };

  // Pack files (downloadable content)
  const handlePackFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPackFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setPackFilePreviews(prev => [...prev, { src: ev.target.result, isVideo: file.type.startsWith('video/') }]);
      };
      reader.readAsDataURL(file);
    });
  };
  const removePackFile = (index) => {
    setPackFiles(prev => prev.filter((_, i) => i !== index));
    setPackFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingPackContent = (index) => {
    setFormData(prev => ({
      ...prev,
      packContent: (prev.packContent || []).filter((_, i) => i !== index)
    }));
  };

  // Validation
  const getPriceError = () => {
    if (!formData.price) return 'Por favor, insira um preço';
    const value = parseFloat(formData.price);
    if (isNaN(value)) return 'Por favor, insira um valor numérico válido';
    if (value < 10) return 'O preço mínimo é 10,00 VC';
    if (value > 10000) return 'O preço máximo é 10.000,00 VC';
    return null;
  };

  const getDiscountError = () => {
    if (formData.discount === '') return null;
    const v = parseInt(formData.discount, 10);
    if (isNaN(v)) return 'Desconto deve ser um número';
    if (v < 0 || v > 100) return 'Desconto deve estar entre 0 e 100';
    return null;
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0: // basic
        if (!formData.title.trim()) return false;
        if (!formData.category) return false;
        if (subcategoriesMap[formData.category]?.length && !formData.subcategory) return false;
        if (!formData.packType) return false;
        return true;
      case 1: // description
        return formData.description.trim().length >= 50;
      case 2: // pricing
        return !getPriceError() && !getDiscountError();
      case 3: // media
        // cover is required as per create-pack.js
        return Boolean(coverImageFile || formData.coverImage);
      case 4: // preview
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateCurrentStep() && currentStep < steps.length - 1) setCurrentStep(s => s + 1);
  };
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  // fileToDataURL removed - now using R2 upload

  // Currency helpers (same logic as Service: VC -> VP @ 1.5x)
  const convertVCtoVP = (vcAmount) => vcAmount * 1.5;
  const formatCurrency = (amount, decimals = 2) => {
    return parseFloat(amount || 0).toFixed(decimals).replace('.', ',');
  };
  const formatVC = (amount) => `${formatCurrency(amount)} VC`;
  const formatVP = (amount) => `${formatCurrency(amount)} VP`;

  const effectivePrice = () => {
    const price = parseFloat(formData.price || 0);
    const discount = parseInt(formData.discount || 0, 10) || 0;
    const final = discount > 0 ? price * (1 - discount / 100) : price;
    return Math.max(final, 0);
  };

  const handleSubmit = async () => {
    if (!currentUser || isSubmitting) return;

    if (!formData.title.trim()) return showError('Por favor, insira um título');
    if (!formData.category) return showError('Por favor, selecione uma categoria');
    if (subcategoriesMap[formData.category]?.length && !formData.subcategory) {
      return showError('Por favor, selecione uma subcategoria');
    }
    if (!formData.packType) return showError('Por favor, selecione um tipo de pack');
    if (!formData.description.trim() || formData.description.trim().length < 50) {
      return showError('A descrição deve ter pelo menos 50 caracteres');
    }
    const priceErr = getPriceError();
    if (priceErr) return showError(priceErr);
    const discountErr = getDiscountError();
    if (discountErr) return showError(discountErr);
    if (!coverImageFile && !formData.coverImage) {
      return showError('Você deve carregar uma imagem de capa');
    }

    setIsSubmitting(true);
    setUploadingFiles(true);
    setUploadProgress(0);
    setUploadStatus('Preparando...');

    try {
      // Prepare pack data with file references for R2 upload
      const packDataWithFiles = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        subcategory: formData.subcategory || '',
        packType: formData.packType,
        price: parseFloat(formData.price),
        discount: parseInt(formData.discount || 0, 10) || 0,
        tags: formData.tags,
        disableWatermark: formData.disableWatermark,
        createdAt: Date.now(),
        isActive: true,
        // Pass files for R2 upload
        coverImageFile: coverImageFile,
        sampleImageFiles: sampleImageFiles,
        sampleVideoFiles: sampleVideoFiles,
        packFiles: packFiles,
        // Keep existing URLs for editing
        existingCoverImage: formData.coverImage,
        existingSampleImages: formData.sampleImages,
        existingSampleVideos: formData.sampleVideos,
        existingPackContent: formData.packContent
      };

      // Create or update pack via Cloud Functions (Firestore) with R2 upload
      let packId = editingPack?.id;
      if (editingPack) {
        await updatePack(packId, {}); // ensure pack exists; fields will be updated below
      } else {
        const result = await createPack(packDataWithFiles, (progress, status) => {
          setUploadProgress(progress);
          setUploadStatus(status);
        });
        if (!result || !result.success || !result.packId) throw new Error('Falha ao criar pack');
        packId = result.packId;
      }

      // Single success message after everything is complete
      showSuccess(editingPack ? 'Pack atualizado com sucesso!' : 'Pack criado com sucesso!');

      onPackCreated && onPackCreated({ id: packId, ...packDataWithFiles });
      clearForm();
      onClose && onClose();
    } catch (err) {
      console.error('Erro ao criar/atualizar pack:', err);
      showError(`Falha ao ${editingPack ? 'atualizar' : 'criar'} pack: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setUploadingFiles(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  if (!isOpen) return null;

  // Check if user can create packs
  if (!isProvider && !isBoth) {
    return (
      <div className="create-pack-modal-overlay">
        <div className="create-pack-modal">
          <div className="modal-header">
            <h2>Acesso Restrito</h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-content">
            <div className="access-restricted">
              <i className="fas fa-lock"></i>
              <h3>Apenas Provedores Podem Criar Packs</h3>
              <p>Você precisa ter uma conta de provedor para criar e vender packs na plataforma.</p>
              <div className="restriction-actions">
                <button className="btn-primary" onClick={onClose}>
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const categoryLabel = (val) => packCategories.find(c => c.value === val)?.label || val;
  const subcategoryLabel = (cat, subVal) => {
    const match = subcategoriesMap[cat]?.find(s => s.toLowerCase().replace(/\s+/g, '-') === subVal);
    return match || subVal || '';
  };

  return (
    // Reuse the same layout and classes from CreateServiceModal to inherit identical styling
    <div className="create-service-modal-overlay">
      <div className="create-service-modal">
        <div className="modal-header">
          <h2>{editingPack ? 'Editar Pack de Foto/Vídeo' : 'Criar Novo Pack de Foto/Vídeo'}</h2>
          <div className="header-actions">
            <button
              className="close-btn"
              onClick={() => {
                clearForm();
                onClose && onClose();
              }}
            >
              &times;
            </button>
          </div>
        </div>

        <div className="modal-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          <div className="progress-steps">
            {steps.map((s, idx) => (
              <div key={s.id} className={`progress-step ${idx <= currentStep ? 'active' : ''}`}>
                {s.title}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-content">
          {currentStep === 0 && (
            <div className="form-step">
              <h3>Informações Básicas</h3>

              <div className="form-group">
                <label htmlFor="pack-title">Título *</label>
                <input
                  id="pack-title"
                  type="text"
                  value={formData.title}
                  onChange={e => handleInputChange('title', e.target.value)}
                  maxLength={100}
                  placeholder="Dê um nome atraente ao seu pack"
                />
              </div>

              <div className="form-group">
                <label htmlFor="pack-category">Categoria *</label>
                <select
                  id="pack-category"
                  value={formData.category}
                  onChange={e => {
                    handleInputChange('category', e.target.value);
                    handleInputChange('subcategory', '');
                  }}
                >
                  <option value="">Selecione uma categoria</option>
                  {packCategories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {formData.category && subcategoriesMap[formData.category] && (
                <div id="subcategory-container" className="form-group">
                  <label htmlFor="pack-subcategory">Subcategoria</label>
                  <select
                    id="pack-subcategory"
                    value={formData.subcategory}
                    onChange={e => handleInputChange('subcategory', e.target.value)}
                  >
                    <option value="" />
                    {subcategoriesMap[formData.category].map(sub => {
                      const val = sub.toLowerCase().replace(/\s+/g, '-');
                      return <option key={val} value={val}>{sub}</option>;
                    })}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="pack-type">Tipo de Pack *</label>
                <select
                  id="pack-type"
                  value={formData.packType}
                  onChange={e => handleInputChange('packType', e.target.value)}
                >
                  <option value="">Selecione o tipo</option>
                  {packTypeOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {formData.packType === 'nao-download' && (
                <div id="license-options" className="form-group">
                  <label>Opções de Licença</label>
                  <div className="license-options">
                    {[
                      { key: 'personal', label: 'Uso Pessoal' },
                      { key: 'commercial', label: 'Uso Comercial' },
                      { key: 'editorial', label: 'Uso Editorial' },
                      { key: 'resale', label: 'Direitos de Revenda' }
                    ].map(opt => (
                      <label key={opt.key} className="license-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.licenseOptions.includes(opt.key)}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              licenseOptions: checked
                                ? [...prev.licenseOptions, opt.key]
                                : prev.licenseOptions.filter(x => x !== opt.key)
                            }));
                          }}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.packType === 'download' && (
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.disableWatermark}
                      onChange={e => handleInputChange('disableWatermark', e.target.checked)}
                    />
                    <span className="checkbox-text">
                      Desabilitar watermark no conteúdo de download
                    </span>
                  </label>
                  <small className="field-description">
                    Por padrão, todo conteúdo de download terá watermark único por usuário. 
                    Marque esta opção apenas se desejar disponibilizar o conteúdo sem watermark.
                  </small>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="form-step">
              <h3>Descrição</h3>

              <div className="form-group">
                <label htmlFor="pack-description">Descrição *</label>
                <textarea
                  id="pack-description"
                  rows={6}
                  value={formData.description}
                  onChange={e => handleInputChange('description', e.target.value)}
                  placeholder="Descreva o conteúdo do pack e para quem ele é indicado"
                  minLength={50}
                />
                <div className="character-counter">
                  <span>{formData.description.length}</span>/1000
                </div>
                <small>Mínimo de 50 caracteres.</small>
              </div>

            </div>
          )}

          {currentStep === 2 && (
            <div className="form-step">
              <h3>Precificação</h3>

              <div className="form-group">
                <label htmlFor="pack-price">Preço Base (VC) *</label>
                <input
                  id="pack-price"
                  type="number"
                  min="10"
                  step="0.01"
                  value={formData.price}
                  onChange={e => handleInputChange('price', e.target.value)}
                  className={getPriceError() ? 'error' : ''}
                  placeholder="10.00"
                />
                 <small>Preço mínimo 10,00 VC</small>
                {getPriceError() && (
                  <div className="validation-error">
                    <i className="fas fa-exclamation-triangle"></i>
                    {getPriceError()}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="pack-discount">Desconto (%)</label>
                <input
                  id="pack-discount"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={formData.discount}
                  onChange={e => handleInputChange('discount', e.target.value)}
                  className={getDiscountError() ? 'error' : ''}
                  placeholder="0"
                />
                {getDiscountError() && (
                  <div className="validation-error">
                    <i className="fas fa-exclamation-triangle"></i>
                    {getDiscountError()}
                  </div>
                )}
              </div>

              {formData.price && !getPriceError() && (
                <div className="currency-display">
                  <div className="currency-row">
                    <span>Você recebe:</span>
                    <span className="currency-value vc">{formatVC(effectivePrice())}</span>
                  </div>
                  <div className="currency-row">
                    <span>Cliente paga:</span>
                    <span className="currency-value vp">{formatVP(convertVCtoVP(effectivePrice()))}</span>
                  </div>
                  <div className="conversion-note">Taxa de conversão: 1 VC = 1,5 VP</div>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="form-step">
              <h3>Mídia</h3>

              <div className="form-group">
                <label>Imagem de Capa *</label>
                <div className="image-upload-container">
                  <input
                    id="cover-image"
                    type="file"
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
                <small>Obrigatório</small>
              </div>

              <div className="form-group">
                <label>Conteúdos de Amostra (máx. 5)</label>
                <div className="media-tabs">
                  <label className="media-tab active" style={{ cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleSampleImagesChange}
                      style={{ display: 'none' }}
                    />
                    <span>Adicionar Fotos</span>
                  </label>
                  <label className="media-tab" style={{ cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleSampleVideosChange}
                      style={{ display: 'none' }}
                    />
                    <span>Adicionar Vídeos</span>
                  </label>
                </div>

                {(sampleImagePreviews.length > 0 || formData.sampleImages.length > 0) && (
                  <div className="showcase-grid">
                    {formData.sampleImages.map((imageData, idx) => {
                      const imageUrl = typeof imageData === 'string' ? imageData : imageData?.publicUrl || imageData;
                      return (
                        <div key={`si-url-${idx}`} className="showcase-item">
                          <img src={imageUrl} alt={`Amostra ${idx + 1}`} />
                          <button className="remove-media" onClick={() => removeSampleImage(idx)}>×</button>
                        </div>
                      );
                    })}
                    {sampleImagePreviews.map((src, idx) => (
                      <div key={`si-${idx}`} className="showcase-item">
                        <img src={src} alt={`Amostra ${idx + 1}`} />
                        <button className="remove-media" onClick={() => removeSampleImage(idx)}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                {(sampleVideoPreviews.length > 0 || formData.sampleVideos.length > 0) && (
                  <div className="showcase-grid">
                    {formData.sampleVideos.map((videoData, idx) => {
                      const videoUrl = typeof videoData === 'string' ? videoData : videoData?.publicUrl || videoData;
                      return (
                        <div key={`sv-url-${idx}`} className="showcase-item video-showcase">
                          <video controls>
                            <source src={videoUrl} type="video/mp4" />
                            Seu navegador não suporta vídeo.
                          </video>
                          <button className="remove-media" onClick={() => removeSampleVideo(idx)}>×</button>
                        </div>
                      );
                    })}
                    {sampleVideoPreviews.map((src, idx) => (
                      <div key={`sv-${idx}`} className="showcase-item video-showcase">
                        <video controls>
                          <source src={src} type="video/mp4" />
                          Seu navegador não suporta vídeo.
                        </video>
                        <button className="remove-media" onClick={() => removeSampleVideo(idx)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Conteúdo do Pack (imagens/vídeos)</label>
                <small className="field-description">
                  {formData.packType === 'download' 
                    ? `Este conteúdo será disponibilizado para download após a compra ${formData.disableWatermark ? '(sem watermark)' : '(com URL assinada e watermark único)'}.`
                    : 'Este conteúdo será disponibilizado para visualização após a compra (com watermark único por usuário, não para download).'
                  }
                </small>
                <div className="image-upload-container">
                  <input
                    type="file"
                    id="pack-files-input"
                    multiple
                    accept="image/*,video/*"
                    onChange={handlePackFilesChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="pack-files-input" className="upload-placeholder">
                    <i className="upload-icon">+</i>
                    <span>Adicionar Conteúdo do Pack</span>
                  </label>
                </div>

                {/* Existing pack content (URLs) when editing */}
                {formData.packContent && formData.packContent.length > 0 && (
                  <div className="showcase-grid">
                    {formData.packContent.map((contentData, idx) => {
                      const contentUrl = typeof contentData === 'string' ? contentData : contentData?.publicUrl || contentData;
                      return (
                        <div key={`pc-url-${idx}`} className="showcase-item">
                          {/\.(mp4|mov|webm|ogg)(\?|$)/i.test(contentUrl) ? (
                            <video controls>
                              <source src={contentUrl} type="video/mp4" />
                              Seu navegador não suporta vídeo.
                            </video>
                          ) : (
                            <img src={contentUrl} alt={`Arquivo ${idx + 1}`} />
                          )}
                          <button className="remove-media" onClick={() => removeExistingPackContent(idx)}>×</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Newly selected pack files previews */}
                {packFilePreviews.length > 0 && (
                  <div className="showcase-grid">
                    {packFilePreviews.map((prev, idx) => (
                      <div key={`pc-prev-${idx}`} className="showcase-item">
                        {prev.isVideo ? (
                          <video controls>
                            <source src={prev.src} type="video/mp4" />
                            Seu navegador não suporta vídeo.
                          </video>
                        ) : (
                          <img src={prev.src} alt={`Arquivo ${idx + 1}`} />
                        )}
                        <button className="remove-media" onClick={() => removePackFile(idx)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Tags</label>
                <div className="tag-input-container">
                  <input
                    ref={tagsInputRef}
                    type="text"
                    placeholder="Digite tags e pressione Enter"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <button className="add-tag-btn" onClick={addTag} type="button">Adicionar</button>
                </div>
                <div className="tags-container">
                  {formData.tags.map((t, idx) => (
                    <span key={idx} className="tag">
                      {t}
                      <button onClick={() => removeTag(idx)}>&times;</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="form-step">
              <h3>Pré-visualização do Pack</h3>

              <div className="service-preview">
                <div className="preview-header">
                  {coverImagePreview && (
                    <div className="preview-cover-image">
                      <img src={coverImagePreview} alt={formData.title} />
                    </div>
                  )}
                  <div className="preview-service-info">
                    <h2>{formData.title || 'Título do Pack'}</h2>
                    <div className="preview-meta">
                      <span className="preview-category">{categoryLabel(formData.category) || 'Categoria'}</span>
                      {formData.subcategory && (
                        <span className="preview-category">
                          {subcategoryLabel(formData.category, formData.subcategory)}
                        </span>
                      )}
                      {formData.packType && (
                        <span className="preview-category">
                          {formData.packType === 'download' ? 'Download Digital' : 'Uso Licenciado'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="preview-price-container">
                    {formData.discount && parseInt(formData.discount, 10) > 0 ? (
                      <>
                        <div className="preview-price-secondary">
                          {formatVC(formData.price)}
                        </div>
                        <div className="preview-price-main">
                          {formatVP(convertVCtoVP(effectivePrice()))}
                        </div>
                      </>
                    ) : (
                      <div className="preview-price-main">
                        {formData.price ? formatVP(convertVCtoVP(formData.price)) : '0,00 VP'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="preview-description">
                  <h3>Descrição</h3>
                  <p>{formData.description || 'Descrição do pack'}</p>
                </div>


                {/* Conteúdo de Amostra (Vitrine) */}
                {(sampleImagePreviews.length > 0 || sampleVideoPreviews.length > 0 || formData.sampleImages.length > 0 || formData.sampleVideos.length > 0) && (
                  <div className="preview-media-section">
                    <h3>Conteúdo de Amostra (Vitrine)</h3>
                    <p className="preview-section-description">Este conteúdo será exibido na vitrine para os clientes visualizarem antes da compra.</p>
                    
                    {sampleImagePreviews.length > 0 && (
                      <div className="preview-photos">
                        <h4>Fotos de Amostra ({sampleImagePreviews.length})</h4>
                        <div className="showcase-grid">
                          {sampleImagePreviews.map((src, idx) => (
                            <div key={idx} className="showcase-item">
                              <img src={src} alt={`Amostra ${idx + 1}`} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {formData.sampleImages.length > 0 && (
                      <div className="preview-photos">
                        <h4>Fotos de Amostra Existentes ({formData.sampleImages.length})</h4>
                        <div className="showcase-grid">
                          {formData.sampleImages.map((imageData, idx) => {
                            const imageUrl = typeof imageData === 'string' ? imageData : imageData?.publicUrl || imageData;
                            return (
                              <div key={`existing-si-${idx}`} className="showcase-item">
                                <img src={imageUrl} alt={`Amostra ${idx + 1}`} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {sampleVideoPreviews.length > 0 && (
                      <div className="preview-videos">
                        <h4>Vídeos de Amostra ({sampleVideoPreviews.length})</h4>
                        <div className="showcase-grid">
                          {sampleVideoPreviews.map((src, idx) => (
                            <div key={idx} className="showcase-item video-showcase">
                              <video controls>
                                <source src={src} type="video/mp4" />
                                Seu navegador não suporta vídeo.
                              </video>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {formData.sampleVideos.length > 0 && (
                      <div className="preview-videos">
                        <h4>Vídeos de Amostra Existentes ({formData.sampleVideos.length})</h4>
                        <div className="showcase-grid">
                          {formData.sampleVideos.map((videoData, idx) => {
                            const videoUrl = typeof videoData === 'string' ? videoData : videoData?.publicUrl || videoData;
                            return (
                              <div key={`existing-sv-${idx}`} className="showcase-item video-showcase">
                                <video controls>
                                  <source src={videoUrl} type="video/mp4" />
                                  Seu navegador não suporta vídeo.
                                </video>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Conteúdo do Pack (Visualização) */}
                {(packFilePreviews.length > 0 || formData.packContent.length > 0) && (
                  <div className="preview-pack-content-section">
                    <h3>Conteúdo do Pack (Visualização)</h3>
                    <p className="preview-section-description">
                      {formData.packType === 'download' 
                        ? `Este é o conteúdo que será disponibilizado para download após a compra ${formData.disableWatermark ? '(sem watermark)' : '(com URL assinada e watermark único)'}.`
                        : 'Este é o conteúdo que será disponibilizado para visualização após a compra (com watermark único por usuário, não para download).'
                      }
                    </p>
                    
                    {packFilePreviews.length > 0 && (
                      <div className="preview-pack-files">
                        <h4>Conteúdo do Pack ({packFilePreviews.length})</h4>
                        <div className="showcase-grid">
                          {packFilePreviews.map((prev, idx) => (
                            <div key={idx} className="showcase-item">
                              {prev.isVideo ? (
                                <video controls>
                                  <source src={prev.src} type="video/mp4" />
                                  Seu navegador não suporta vídeo.
                                </video>
                              ) : (
                                <img src={prev.src} alt={`Arquivo ${idx + 1}`} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {formData.packContent.length > 0 && (
                      <div className="preview-pack-files">
                        <h4>Conteúdo do Pack Existentes ({formData.packContent.length})</h4>
                        <div className="showcase-grid">
                          {formData.packContent.map((contentData, idx) => {
                            const contentUrl = typeof contentData === 'string' ? contentData : contentData?.publicUrl || contentData;
                            return (
                              <div key={`existing-pc-${idx}`} className="showcase-item">
                                {/\.(mp4|mov|webm|ogg)(\?|$)/i.test(contentUrl) ? (
                                  <video controls>
                                    <source src={contentUrl} type="video/mp4" />
                                    Seu navegador não suporta vídeo.
                                  </video>
                                ) : (
                                  <img src={contentUrl} alt={`Arquivo ${idx + 1}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {formData.packType === 'nao-download' && formData.licenseOptions.length > 0 && (
                  <div className="preview-licenses">
                    <h3>Informações da Licença</h3>
                    <div className="license-tags">
                      {formData.licenseOptions.map(opt => {
                        const label = {
                          personal: 'Uso Pessoal',
                          commercial: 'Uso Comercial',
                          editorial: 'Uso Editorial',
                          resale: 'Direitos de Revenda'
                        }[opt] || opt;
                        return <span key={opt} className="license-tag">{label}</span>;
                      })}
                    </div>
                  </div>
                )}

                {/* Watermark Information */}
                <div className="preview-watermark-info">
                  <h3>Proteção de Conteúdo</h3>
                  <div className="watermark-status">
                    <i className={`fas fa-${formData.packType === 'download' && formData.disableWatermark ? 'unlock' : 'shield-alt'}`}></i>
                    <span>
                      {formData.packType === 'download' 
                        ? (formData.disableWatermark 
                            ? 'Conteúdo sem watermark (download direto)'
                            : 'Conteúdo com watermark único por usuário (download seguro)'
                          )
                        : 'Conteúdo com watermark único por usuário (visualização segura)'
                      }
                    </span>
                  </div>
                  <p className="watermark-description">
                    {formData.packType === 'download' 
                      ? (formData.disableWatermark 
                          ? 'O conteúdo será disponibilizado para download sem proteção adicional.'
                          : 'Cada usuário receberá uma URL assinada única com watermark personalizado para download.'
                        )
                      : 'O conteúdo será visualizado dentro do site com watermark único por usuário para proteção.'
                    }
                  </p>
                </div>

                {formData.tags.length > 0 && (
                  <div className="preview-tags">
                    <h3>Tags</h3>
                    <div className="preview-tags-container">
                      {formData.tags.map((t, idx) => (
                        <span key={idx} className="preview-tag">{t}</span>
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
              <button type="button" className="btn secondary" onClick={prevStep}>Voltar</button>
            )}
          </div>
          <div className="modal-actions-right">
            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                className="btn primary"
                disabled={!validateCurrentStep()}
                onClick={nextStep}
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                className="btn primary"
                disabled={isSubmitting || uploading}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  uploadingFiles ? (
                    <div className="upload-progress-container">
                      <div className="upload-progress-bar">
                        <div 
                          className="upload-progress-fill" 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <span className="upload-status">
                        {uploadStatus || `Fazendo upload... ${uploadProgress}%`}
                      </span>
                    </div>
                  ) : (
                    editingPack ? 'Atualizando...' : 'Criando...'
                  )
                ) : (
                  editingPack ? 'Atualizar Pack' : 'Criar Pack'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePackModal;