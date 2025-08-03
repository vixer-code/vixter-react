import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import './CreateSubscription.css';

const CreateSubscription = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [benefits, setBenefits] = useState([]);
  const [newBenefit, setNewBenefit] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    mensalPrice: '',
    anualPrice: '',
    benefits: [],
    maxSubscribers: '',
    isActive: true
  });

  const categories = {
    content: 'Conteúdo Exclusivo',
    coaching: 'Coaching/Mentoria',
    community: 'Comunidade',
    tools: 'Ferramentas',
    education: 'Educação',
    entertainment: 'Entretenimento',
    health: 'Saúde & Bem-estar',
    business: 'Negócios',
    other: 'Outro'
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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

  const addBenefit = () => {
    if (newBenefit.trim() && !benefits.includes(newBenefit.trim())) {
      setBenefits(prev => [...prev, newBenefit.trim()]);
      setNewBenefit('');
    }
  };

  const removeBenefit = (benefit) => {
    setBenefits(prev => prev.filter(b => b !== benefit));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);

      const userId = currentUser.uid;
      const subscriptionData = {
        ...formData,
        mensalPrice: parseFloat(formData.mensalPrice),
        anualPrice: parseFloat(formData.anualPrice),
        maxSubscribers: parseInt(formData.maxSubscribers),
        benefits,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active'
      };

      // Create subscription reference
      const subscriptionsRef = ref(database, `subscriptions/${userId}`);
      const newSubscriptionRef = push(subscriptionsRef);
      const subscriptionId = newSubscriptionRef.key;
      subscriptionData.id = subscriptionId;

      // Upload cover image
      if (coverImage) {
        const coverRef = storageRef(storage, `subscriptions/${userId}/${subscriptionId}/cover.jpg`);
        await uploadBytes(coverRef, coverImage);
        const coverURL = await getDownloadURL(coverRef);
        subscriptionData.coverImageUrl = coverURL;
      }

      // Save to database
      await set(newSubscriptionRef, subscriptionData);

      navigate('/profile');
    } catch (error) {
      console.error('Error creating subscription:', error);
      alert('Erro ao criar assinatura. Tente novamente.');
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
              <label htmlFor="title">Título da Assinatura *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Ex: Assinatura Premium de Conteúdo"
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
            <div className="form-group">
              <label htmlFor="description">Descrição Detalhada *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Descreva o que os assinantes receberão..."
                rows={6}
                required
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="form-section">
            <h3>Preços</h3>
            <div className="pricing-section">
              <div className="form-group">
                <label htmlFor="mensalPrice">Preço Mensal (R$) *</label>
                <input
                  type="number"
                  id="mensalPrice"
                  name="mensalPrice"
                  value={formData.mensalPrice}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="anualPrice">Preço Anual (R$) *</label>
                <input
                  type="number"
                  id="anualPrice"
                  name="anualPrice"
                  value={formData.anualPrice}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
                {formData.mensalPrice && formData.anualPrice && (
                  <div className="price-comparison">
                    <span className="savings">
                      Economia: R$ {((parseFloat(formData.mensalPrice) * 12) - parseFloat(formData.anualPrice)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="maxSubscribers">Limite de Assinantes</label>
                <input
                  type="number"
                  id="maxSubscribers"
                  name="maxSubscribers"
                  value={formData.maxSubscribers}
                  onChange={handleInputChange}
                  placeholder="Ilimitado (deixe vazio)"
                  min="1"
                />
                <small>Deixe vazio para assinatura ilimitada</small>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="form-section">
            <h3>Benefícios e Conteúdo</h3>
            <div className="form-group">
              <label>Benefícios da Assinatura</label>
              <div className="benefits-input">
                <input
                  type="text"
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  placeholder="Adicionar benefício..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                />
                <button type="button" onClick={addBenefit}>+</button>
              </div>
              <div className="benefits-container">
                {benefits.map((benefit, index) => (
                  <span key={index} className="benefit-tag">
                    {benefit}
                    <button type="button" onClick={() => removeBenefit(benefit)}>×</button>
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
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                <span>Assinatura ativa (aceitando novos assinantes)</span>
              </label>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="form-section">
            <h3>Pré-visualização</h3>
            <div className="subscription-preview">
              <div className="preview-header">
                {coverPreview && (
                  <img src={coverPreview} alt="Cover" className="preview-cover" />
                )}
                <div className="preview-info">
                  <h2>{formData.title || 'Título da Assinatura'}</h2>
                  <p className="preview-category">
                    {categories[formData.category] || 'Categoria'}
                  </p>
                  <div className="preview-pricing">
                    <div className="price-option">
                      <span className="price-label">Mensal</span>
                      <span className="price-value">R$ {formData.mensalPrice || '0.00'}</span>
                    </div>
                    <div className="price-option">
                      <span className="price-label">Anual</span>
                      <span className="price-value">R$ {formData.anualPrice || '0.00'}</span>
                      {formData.mensalPrice && formData.anualPrice && (
                        <span className="savings-badge">
                          Economia R$ {((parseFloat(formData.mensalPrice) * 12) - parseFloat(formData.anualPrice)).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  {formData.maxSubscribers && (
                    <p className="preview-limit">
                      <i className="fas fa-users"></i>
                      Limite: {formData.maxSubscribers} assinantes
                    </p>
                  )}
                </div>
              </div>
              <div className="preview-description">
                <h3>Descrição</h3>
                <p>{formData.description || 'Descrição da assinatura...'}</p>
              </div>
              {benefits.length > 0 && (
                <div className="preview-benefits">
                  <h3>Benefícios</h3>
                  <ul>
                    {benefits.map((benefit, index) => (
                      <li key={index}>✓ {benefit}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="preview-status">
                <span className={`status-badge ${formData.isActive ? 'active' : 'inactive'}`}>
                  {formData.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </div>
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
    <div className="create-subscription-container">
      <div className="create-subscription-header">
        <h1>Criar Nova Assinatura</h1>
        <p>Crie uma assinatura recorrente e construa uma comunidade fiel</p>
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

      <form onSubmit={handleSubmit} className="create-subscription-form">
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
              {loading ? 'Criando...' : 'Criar Assinatura'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default CreateSubscription; 