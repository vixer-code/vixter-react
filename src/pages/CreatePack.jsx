import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './CreatePack.css';

const CreatePack = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [packFiles, setPackFiles] = useState([]);
  const [features, setFeatures] = useState([]);
  const [tags, setTags] = useState([]);
  const [newFeature, setNewFeature] = useState('');
  const [newTag, setNewTag] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    subcategory: '',
    packType: 'digital',
    price: '',
    discount: '0',
    licenseOptions: {
      personal: false,
      commercial: false,
      editorial: false,
      resale: false
    }
  });

  const categories = {
    photography: 'Fotografia',
    videography: 'Videografia',
    design: 'Design',
    music: 'Música',
    writing: 'Escrita',
    other: 'Outro'
  };

  const subcategories = {
    photography: ['Retrato', 'Paisagem', 'Eventos', 'Produto', 'Arquitetura'],
    videography: ['Eventos', 'Comercial', 'Documentário', 'Música', 'Educacional'],
    design: ['Logo', 'UI/UX', 'Ilustração', 'Branding', 'Web Design'],
    music: ['Instrumental', 'Vocal', 'Eletrônica', 'Jazz', 'Rock'],
    writing: ['Artigos', 'Poesia', 'Ficção', 'Técnico', 'Marketing'],
    other: ['Outro']
  };

  const packTypes = {
    digital: 'Digital',
    physical: 'Físico',
    mixed: 'Misto'
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLicenseChange = (license) => {
    setFormData(prev => ({
      ...prev,
      licenseOptions: {
        ...prev.licenseOptions,
        [license]: !prev.licenseOptions[license]
      }
    }));
  };

  const handleCoverImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setCoverPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handlePackFilesChange = (e) => {
    const files = Array.from(e.target.files);
    setPackFiles(files);
  };

  const addFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      setFeatures(prev => [...prev, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (feature) => {
    setFeatures(prev => prev.filter(f => f !== feature));
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const uploadFilesToFirebase = async (files, userId, packId) => {
    const uploadPromises = files.map(async (file, index) => {
      const fileRef = storageRef(storage, `packs/${userId}/${packId}/${file.name}`);
      await uploadBytes(fileRef, file);
      return await getDownloadURL(fileRef);
    });
    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);

      const userId = currentUser.uid;
      const packData = {
        ...formData,
        price: parseFloat(formData.price),
        discount: parseInt(formData.discount),
        features,
        tags,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active'
      };

      // Create pack reference
      const packsRef = ref(database, `packs/${userId}`);
      const newPackRef = push(packsRef);
      const packId = newPackRef.key;
      packData.id = packId;

      // Upload cover image
      if (coverImage) {
        const coverRef = storageRef(storage, `packs/${userId}/${packId}/cover.jpg`);
        await uploadBytes(coverRef, coverImage);
        const coverURL = await getDownloadURL(coverRef);
        packData.coverImage = coverURL;
      }

      // Upload pack files
      if (packFiles.length > 0) {
        const packContentURLs = await uploadFilesToFirebase(packFiles, userId, packId);
        packData.packContent = packContentURLs;
      }

      // Save to database
      await set(newPackRef, packData);

      navigate('/profile');
    } catch (error) {
      console.error('Error creating pack:', error);
      alert('Erro ao criar pack. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="form-section">
            <h3>Informações Básicas</h3>
            <div className="form-group">
              <label htmlFor="title">Título do Pack *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Ex: Pack de Fotos de Casamento"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">Categoria *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
              >
                <option value="">Selecione uma categoria</option>
                {Object.entries(categories).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>
            {formData.category && (
              <div className="form-group">
                <label htmlFor="subcategory">Subcategoria</label>
                <select
                  id="subcategory"
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                >
                  <option value="">Selecione uma subcategoria</option>
                  {subcategories[formData.category]?.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="packType">Tipo de Pack *</label>
              <select
                id="packType"
                name="packType"
                value={formData.packType}
                onChange={handleInputChange}
                required
              >
                {Object.entries(packTypes).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="form-section">
            <h3>Descrição</h3>
            <div className="form-group">
              <label htmlFor="description">Descrição Detalhada *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Descreva seu pack em detalhes..."
                rows={6}
                required
              />
            </div>
            <div className="form-group">
              <label>Recursos do Pack</label>
              <div className="tags-input">
                <input
                  type="text"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Adicionar recurso..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                />
                <button type="button" onClick={addFeature}>+</button>
              </div>
              <div className="tags-container">
                {features.map((feature, index) => (
                  <span key={index} className="tag">
                    {feature}
                    <button type="button" onClick={() => removeFeature(feature)}>×</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Tags</label>
              <div className="tags-input">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Adicionar tag..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <button type="button" onClick={addTag}>+</button>
              </div>
              <div className="tags-container">
                {tags.map((tag, index) => (
                  <span key={index} className="tag">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="form-section">
            <h3>Preço</h3>
            <div className="form-group">
              <label htmlFor="price">Preço (R$) *</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="discount">Desconto (%)</label>
              <input
                type="number"
                id="discount"
                name="discount"
                value={formData.discount}
                onChange={handleInputChange}
                placeholder="0"
                min="0"
                max="100"
              />
            </div>
            <div className="license-section">
              <h4>Opções de Licença</h4>
              <div className="license-options">
                {Object.entries(formData.licenseOptions).map(([key, value]) => (
                  <label key={key} className="license-option">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => handleLicenseChange(key)}
                    />
                    <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="form-section">
            <h3>Conteúdo</h3>
            <div className="form-group">
              <label>Imagem de Capa</label>
              <div className="image-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  id="cover-upload"
                />
                <label htmlFor="cover-upload" className="upload-label">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Preview" className="image-preview" />
                  ) : (
                    <div className="upload-placeholder">
                      <i className="fas fa-image"></i>
                      <span>Clique para selecionar imagem de capa</span>
                    </div>
                  )}
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Arquivos do Pack</label>
              <div className="file-upload">
                <input
                  type="file"
                  multiple
                  onChange={handlePackFilesChange}
                  id="pack-files"
                />
                <label htmlFor="pack-files" className="upload-label">
                  <div className="upload-placeholder">
                    <i className="fas fa-folder-open"></i>
                    <span>Selecione os arquivos do pack</span>
                  </div>
                </label>
              </div>
              {packFiles.length > 0 && (
                <div className="files-list">
                  <h4>Arquivos selecionados:</h4>
                  <ul>
                    {packFiles.map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="form-section">
            <h3>Pré-visualização</h3>
            <div className="pack-preview">
              <div className="preview-header">
                {coverPreview && (
                  <img src={coverPreview} alt="Cover" className="preview-cover" />
                )}
                <div className="preview-info">
                  <h2>{formData.title || 'Título do Pack'}</h2>
                  <p className="preview-category">
                    {categories[formData.category] || 'Categoria'}
                    {formData.subcategory && ` • ${formData.subcategory}`}
                  </p>
                  <p className="preview-price">
                    R$ {formData.price || '0.00'}
                    {formData.discount > 0 && (
                      <span className="discount">(-{formData.discount}%)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="preview-description">
                <h3>Descrição</h3>
                <p>{formData.description || 'Descrição do pack...'}</p>
              </div>
              {features.length > 0 && (
                <div className="preview-features">
                  <h3>Recursos</h3>
                  <ul>
                    {features.map((feature, index) => (
                      <li key={index}>✓ {feature}</li>
                    ))}
                  </ul>
                </div>
              )}
              {tags.length > 0 && (
                <div className="preview-tags">
                  <h3>Tags</h3>
                  <div className="tags-display">
                    {tags.map((tag, index) => (
                      <span key={index} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!currentUser) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="create-pack-container">
      <div className="create-pack-header">
        <h1>Criar Novo Pack</h1>
        <p>Compartilhe seu conteúdo criativo com a comunidade</p>
      </div>

      <div className="form-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(currentStep / 5) * 100}%` }}
          ></div>
        </div>
        <div className="progress-steps">
          {[1, 2, 3, 4, 5].map(step => (
            <div 
              key={step} 
              className={`step ${step <= currentStep ? 'active' : ''}`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="create-pack-form">
        {renderStepContent()}

        <div className="form-navigation">
          {currentStep > 1 && (
            <button type="button" onClick={prevStep} className="btn-secondary">
              Anterior
            </button>
          )}
          {currentStep < 5 ? (
            <button type="button" onClick={nextStep} className="btn-primary">
              Próximo
            </button>
          ) : (
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Criando...' : 'Criar Pack'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default CreatePack; 