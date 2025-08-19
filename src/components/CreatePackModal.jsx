import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePacks } from '../contexts/PacksContext';
import { storage } from '../../config/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import './CreatePackModal.css';

const subcategoriesMap = {
  fotografia: ['Retratos', 'Paisagens', 'Eventos', 'Moda', 'Esportes', 'Outro Fotografia'],
  videografia: ['Casamentos', 'Eventos', 'Promoções', 'Documentários', 'Animações', 'Outro Videografia'],
  mista: ['Fotografia + Vídeo', 'Multimídia', 'Design', 'Arte Digital', 'Outro Mídia Mista'],
  stock: ['Imagens', 'Vídeos', 'Vetores', 'Ícones', 'Outro Stock'],
  modelos: ['Templates de Fotos', 'Templates de Vídeos', 'Layouts', 'Mockups', 'Outro Modelos'],
  predefinicoes: ['LUTs', 'Filtros', 'Presets', 'Perfis', 'Outro Predefinições'],
  outro: ['Outro']
};

const packCategories = [
  { value: 'fotografia', label: 'Fotografia' },
  { value: 'videografia', label: 'Videografia' },
  { value: 'mista', label: 'Mídia Mista' },
  { value: 'stock', label: 'Recursos de Stock' },
  { value: 'modelos', label: 'Modelos' },
  { value: 'predefinicoes', label: 'Predefinições/LUTs' },
  { value: 'outro', label: 'Outro' }
];

const packTypeOptions = [
  { value: 'download', label: 'Download Digital' },
  { value: 'nao-download', label: 'Uso Licenciado' }
];

const CreatePackModal = ({ isOpen, onClose, onPackCreated, editingPack = null }) => {
  const { currentUser } = useAuth();
  const { createPack, updatePack } = usePacks();
  const { showSuccess, showError } = useNotification();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const featuresInputRef = useRef(null);
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
    features: [],
    tags: [],
    licenseOptions: [], // ['personal','commercial','editorial','resale'] when packType == 'nao-download'
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
        features: editingPack.features || [],
        tags: editingPack.tags || [],
        licenseOptions: editingPack.licenseOptions || [],
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
      setCoverImagePreview(editingPack.coverImage || '');

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
      features: [],
      tags: [],
      licenseOptions: [],
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

  const addFeature = () => {
    const el = featuresInputRef.current;
    if (el && el.value.trim()) {
      setFormData(prev => ({ ...prev, features: [...prev.features, el.value.trim()] }));
      el.value = '';
    }
  };
  const removeFeature = (index) => {
    setFormData(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  };

  const addTag = () => {
    const el = tagsInputRef.current;
    if (el && el.value.trim()) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, el.value.trim()] }));
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
    if (value < 5) return 'O preço mínimo é 5,00 VC';
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

  const uploadFileToStorage = async (file, path) => {
    try {
      const fileRef = storageRef(storage, path);
      const snap = await uploadBytes(fileRef, file);
      return await getDownloadURL(snap.ref);
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    }
  };

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

    try {
      // Create or update pack via Cloud Functions (Firestore)
      let packId = editingPack?.id;
      if (editingPack) {
        await updatePack(packId, {}); // ensure pack exists; fields will be updated below
      } else {
        const result = await createPack({
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category,
          subcategory: formData.subcategory || '',
          packType: formData.packType,
          price: parseFloat(formData.price),
          discount: parseInt(formData.discount || 0, 10) || 0,
          features: formData.features,
          tags: formData.tags,
          createdAt: Date.now(),
          isActive: true
        });
        if (!result || !result.success || !result.packId) throw new Error('Falha ao criar pack');
        packId = result.packId;
      }

      // Upload cover
      const packBasePath = `packs/${currentUser.uid}/${packId}`;
      let coverImageURL = formData.coverImage || '';
      if (coverImageFile) {
        const namePart = coverImageFile.name?.split('.').pop() || 'jpg';
        coverImageURL = await uploadFileToStorage(
          coverImageFile,
          `${packBasePath}/cover-${Date.now()}.${namePart}`
        );
      }

      // Upload samples
      const sampleImages = [...formData.sampleImages];
      for (let i = 0; i < sampleImageFiles.length; i++) {
        const f = sampleImageFiles[i];
        const ext = f.name?.split('.').pop() || 'jpg';
        const url = await uploadFileToStorage(f, `${packBasePath}/samples/image_${i}.${ext}`);
        sampleImages.push(url);
      }

      const sampleVideos = [...formData.sampleVideos];
      for (let i = 0; i < sampleVideoFiles.length; i++) {
        const f = sampleVideoFiles[i];
        const ext = f.name?.split('.').pop() || 'mp4';
        const url = await uploadFileToStorage(f, `${packBasePath}/samples/video_${i}.${ext}`);
        sampleVideos.push(url);
      }

      // Upload pack files (downloadable content)
      let packContentURLs = [...(formData.packContent || [])];
      for (let i = 0; i < packFiles.length; i++) {
        const f = packFiles[i];
        const ext = f.name?.split('.').pop() || 'bin';
        const url = await uploadFileToStorage(f, `${packBasePath}/${packId}_${i}.${ext}`);
        packContentURLs.push(url);
      }

      // Prepare data to save (mirror create-pack.js fields)
      const packData = {
        id: packId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        subcategory: formData.subcategory || '',
        packType: formData.packType,
        price: parseFloat(formData.price),
        discount: parseInt(formData.discount || 0, 10) || 0,
        features: formData.features,
        tags: formData.tags,
        licenseOptions:
          formData.packType === 'nao-download' ? formData.licenseOptions : [],
        coverImage: coverImageURL,
        sampleImages,
        sampleVideos,
        packContent: packContentURLs,
        createdAt: editingPack ? (editingPack.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
        status: 'active'
      };

      // Persist fields via Cloud Function update
      await updatePack(packId, packData);
      showSuccess(editingPack ? 'Pack atualizado com sucesso!' : 'Pack criado com sucesso!');

      onPackCreated && onPackCreated(packData);
      clearForm();
      onClose && onClose();
    } catch (err) {
      console.error('Erro ao criar/atualizar pack:', err);
      showError(`Falha ao ${editingPack ? 'atualizar' : 'criar'} pack: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setUploadingFiles(false);
    }
  };

  if (!isOpen) return null;

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

              <div className="form-group">
                <label>Recursos Incluídos</label>
                <div className="tag-input-container">
                  <input
                    ref={featuresInputRef}
                    type="text"
                    placeholder="Adicione recursos e pressione Enter"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  />
                  <button type="button" className="add-tag-btn" onClick={addFeature}>Adicionar</button>
                </div>
                <div className="tags-container">
                  {formData.features.map((f, idx) => (
                    <span key={idx} className="tag">
                      {f}
                      <button onClick={() => removeFeature(idx)}>&times;</button>
                    </span>
                  ))}
                </div>
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
                  min="5"
                  step="0.01"
                  value={formData.price}
                  onChange={e => handleInputChange('price', e.target.value)}
                  className={getPriceError() ? 'error' : ''}
                  placeholder="5.00"
                />
                 <small>Preço mínimo 5,00 VC</small>
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
                    {formData.sampleImages.map((url, idx) => (
                      <div key={`si-url-${idx}`} className="showcase-item">
                        <img src={url} alt={`Amostra ${idx + 1}`} />
                        <button className="remove-media" onClick={() => removeSampleImage(idx)}>×</button>
                      </div>
                    ))}
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
                    {formData.sampleVideos.map((url, idx) => (
                      <div key={`sv-url-${idx}`} className="showcase-item video-showcase">
                        <video controls>
                          <source src={url} type="video/mp4" />
                          Seu navegador não suporta vídeo.
                        </video>
                        <button className="remove-media" onClick={() => removeSampleVideo(idx)}>×</button>
                      </div>
                    ))}
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
                <label>Arquivos do Pack (imagens/vídeos)</label>
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
                    <span>Adicionar Arquivos do Pack</span>
                  </label>
                </div>

                {/* Existing pack content (URLs) when editing */}
                {formData.packContent && formData.packContent.length > 0 && (
                  <div className="showcase-grid">
                    {formData.packContent.map((url, idx) => (
                      <div key={`pc-url-${idx}`} className="showcase-item">
                        {/\.(mp4|mov|webm|ogg)(\?|$)/i.test(url) ? (
                          <video controls>
                            <source src={url} type="video/mp4" />
                            Seu navegador não suporta vídeo.
                          </video>
                        ) : (
                          <img src={url} alt={`Arquivo ${idx + 1}`} />
                        )}
                        <button className="remove-media" onClick={() => removeExistingPackContent(idx)}>×</button>
                      </div>
                    ))}
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

                {formData.features.length > 0 && (
                  <div className="preview-features">
                    <h3>Recursos Incluídos</h3>
                    <ul className="features-list">
                      {formData.features.map((f, idx) => (
                        <li key={idx}><span className="feature-check">✓</span> {f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(sampleImagePreviews.length > 0 || sampleVideoPreviews.length > 0) && (
                  <div className="preview-media-section">
                    {sampleImagePreviews.length > 0 && (
                      <div className="preview-photos">
                        <h4>Fotos ({sampleImagePreviews.length})</h4>
                        <div className="showcase-grid">
                          {sampleImagePreviews.map((src, idx) => (
                            <div key={idx} className="showcase-item">
                              <img src={src} alt={`Amostra ${idx + 1}`} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {sampleVideoPreviews.length > 0 && (
                      <div className="preview-videos">
                        <h4>Vídeos ({sampleVideoPreviews.length})</h4>
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
                disabled={isSubmitting || uploadingFiles}
                onClick={handleSubmit}
              >
                {isSubmitting ? (editingPack ? 'Atualizando...' : 'Criando...') : uploadingFiles ? 'Fazendo upload...' : (editingPack ? 'Atualizar Pack' : 'Criar Pack')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePackModal;