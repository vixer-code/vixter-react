import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './CreateService.css';

const CreateService = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [features, setFeatures] = useState([]);
  const [tags, setTags] = useState([]);
  const [newFeature, setNewFeature] = useState('');
  const [newTag, setNewTag] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    subcategory: '',
    priceVP: '',
    priceReal: '',
    deliveryTime: '',
    features: [],
    tags: []
  });

  const categories = {
    photography: 'Fotografia',
    videography: 'Videografia',
    design: 'Design',
    writing: 'Escrita',
    translation: 'Tradução',
    tutoring: 'Aulas',
    consulting: 'Consultoria',
    languageExchange: 'Intercâmbio de Idiomas',
    drawing: 'Desenho',
    fortuneTelling: 'Leitura de Sorte',
    other: 'Outro'
  };

  const subcategories = {
    photography: ['Retrato', 'Paisagem', 'Eventos', 'Produto', 'Arquitetura', 'Moda'],
    videography: ['Eventos', 'Comercial', 'Documentário', 'Música', 'Educacional', 'Casamento'],
    design: ['Logo', 'UI/UX', 'Ilustração', 'Branding', 'Web Design', 'Social Media'],
    writing: ['Artigos', 'Poesia', 'Ficção', 'Técnico', 'Marketing', 'Blog'],
    translation: ['Inglês', 'Espanhol', 'Francês', 'Alemão', 'Italiano', 'Português'],
    tutoring: ['Matemática', 'Ciências', 'História', 'Inglês', 'Programação', 'Música'],
    consulting: ['Negócios', 'Marketing', 'Tecnologia', 'Saúde', 'Educação', 'Finanças'],
    languageExchange: ['Inglês', 'Espanhol', 'Francês', 'Alemão', 'Italiano', 'Português'],
    drawing: ['Retrato', 'Paisagem', 'Caricatura', 'Digital', 'Tradicional', 'Manga'],
    fortuneTelling: ['Tarot', 'Astrologia', 'Numerologia', 'Runas', 'Búzios', 'Cristal'],
    other: ['Outro']
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

  const handleCoverImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setCoverPreview(e.target.result);
      reader.readAsDataURL(file);
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);

      const userId = currentUser.uid;
      const serviceData = {
        ...formData,
        priceVP: parseFloat(formData.priceVP),
        priceReal: parseFloat(formData.priceReal),
        deliveryTime: parseInt(formData.deliveryTime),
        features,
        tags,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active'
      };

      // Create service reference
      const servicesRef = ref(database, `services/${userId}`);
      const newServiceRef = push(servicesRef);
      const serviceId = newServiceRef.key;
      serviceData.id = serviceId;

      // Upload cover image
      if (coverImage) {
        const coverRef = storageRef(storage, `services/${userId}/${serviceId}/cover.jpg`);
        await uploadBytes(coverRef, coverImage);
        const coverURL = await getDownloadURL(coverRef);
        serviceData.coverImageURL = coverURL;
      }

      // Save to database
      await set(newServiceRef, serviceData);

      navigate('/profile');
    } catch (error) {
      console.error('Error creating service:', error);
      alert('Erro ao criar serviço. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
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
              <label htmlFor="title">Título do Serviço *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Ex: Fotografia de Casamento"
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
          </div>
        );

      case 2:
        return (
          <div className="form-section">
            <h3>Descrição e Preços</h3>
            <div className="form-group">
              <label htmlFor="description">Descrição Detalhada *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Descreva seu serviço em detalhes..."
                rows={6}
                required
              />
            </div>
            <div className="pricing-section">
              <div className="form-group">
                <label htmlFor="priceVP">Preço em VP *</label>
                <input
                  type="number"
                  id="priceVP"
                  name="priceVP"
                  value={formData.priceVP}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="priceReal">Preço em R$</label>
                <input
                  type="number"
                  id="priceReal"
                  name="priceReal"
                  value={formData.priceReal}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="deliveryTime">Prazo de Entrega (dias) *</label>
                <input
                  type="number"
                  id="deliveryTime"
                  name="deliveryTime"
                  value={formData.deliveryTime}
                  onChange={handleInputChange}
                  placeholder="1"
                  min="1"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="form-section">
            <h3>Recursos e Tags</h3>
            <div className="form-group">
              <label>Recursos do Serviço</label>
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
          </div>
        );

      case 4:
        return (
          <div className="form-section">
            <h3>Pré-visualização</h3>
            <div className="service-preview">
              <div className="preview-header">
                {coverPreview && (
                  <img src={coverPreview} alt="Cover" className="preview-cover" />
                )}
                <div className="preview-info">
                  <h2>{formData.title || 'Título do Serviço'}</h2>
                  <p className="preview-category">
                    {categories[formData.category] || 'Categoria'}
                    {formData.subcategory && ` • ${formData.subcategory}`}
                  </p>
                  <div className="preview-pricing">
                    <span className="preview-price-vp">{formData.priceVP || 0} VP</span>
                    {formData.priceReal > 0 && (
                      <span className="preview-price-real">R$ {formData.priceReal}</span>
                    )}
                  </div>
                  <p className="preview-delivery">
                    <i className="fas fa-clock"></i>
                    Entrega em {formData.deliveryTime || 1} dia(s)
                  </p>
                </div>
              </div>
              <div className="preview-description">
                <h3>Descrição</h3>
                <p>{formData.description || 'Descrição do serviço...'}</p>
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
    <div className="create-service-container">
      <div className="create-service-header">
        <h1>Criar Novo Serviço</h1>
        <p>Ofereça seus talentos e habilidades para a comunidade</p>
      </div>

      <div className="form-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(currentStep / 4) * 100}%` }}
          ></div>
        </div>
        <div className="progress-steps">
          {[1, 2, 3, 4].map(step => (
            <div 
              key={step} 
              className={`step ${step <= currentStep ? 'active' : ''}`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="create-service-form">
        {renderStepContent()}

        <div className="form-navigation">
          {currentStep > 1 && (
            <button type="button" onClick={prevStep} className="btn-secondary">
              Anterior
            </button>
          )}
          {currentStep < 4 ? (
            <button type="button" onClick={nextStep} className="btn-primary">
              Próximo
            </button>
          ) : (
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Criando...' : 'Criar Serviço'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default CreateService; 