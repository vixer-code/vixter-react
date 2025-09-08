import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { useNotification } from '../contexts/NotificationContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import CachedImage from '../components/CachedImage';
import './ServiceDetail.css';

const ServiceDetail = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { createServiceOrder, processing } = useServiceOrder();
  const { showNotification } = useNotification();
  
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    try {
      const serviceRef = doc(db, 'services', serviceId);
      const serviceSnap = await getDoc(serviceRef);
      
      if (serviceSnap.exists()) {
        setService({
          id: serviceSnap.id,
          ...serviceSnap.data()
        });
      } else {
        showNotification('Serviço não encontrado', 'error');
        navigate('/');
      }
    } catch (error) {
      console.error('Error loading service:', error);
      showNotification('Erro ao carregar serviço', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureToggle = (feature) => {
    setSelectedFeatures(prev => {
      const isSelected = prev.find(f => f.id === feature.id);
      if (isSelected) {
        return prev.filter(f => f.id !== feature.id);
      } else {
        return [...prev, feature];
      }
    });
  };

  const calculateTotal = () => {
    if (!service) return 0;
    const featuresTotal = selectedFeatures.reduce((total, feature) => total + feature.price, 0);
    return service.price + featuresTotal;
  };

  const handlePurchase = async () => {
    if (!currentUser) {
      showNotification('Você precisa estar logado para comprar um serviço', 'warning');
      navigate('/login');
      return;
    }

    if (userProfile?.accountType !== 'client') {
      showNotification('Apenas clientes podem comprar serviços', 'warning');
      return;
    }

    if (service.providerId === currentUser.uid) {
      showNotification('Você não pode comprar seu próprio serviço', 'warning');
      return;
    }

    const success = await createServiceOrder(service, selectedFeatures);
    if (success) {
      setShowPurchaseModal(false);
      showNotification('Pedido de serviço enviado com sucesso!', 'success');
      navigate('/wallet');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="service-detail-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando serviço...</span>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="service-detail-container">
        <div className="error-state">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Serviço não encontrado</h2>
          <p>O serviço que você está procurando não existe ou foi removido.</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="service-detail-container">
      <div className="service-detail-content">
        <div className="service-main">
          <div className="service-header">
            <div className="service-title-section">
              <h1>{service.title}</h1>
              <div className="service-meta">
                <span className="service-category">{service.category}</span>
                <span className="service-rating">
                  <i className="fas fa-star"></i>
                  {service.rating || 'N/A'}
                </span>
              </div>
            </div>
            <div className="service-price">
              <span className="price-amount">{formatCurrency(service.price)}</span>
              <span className="price-currency">VP</span>
            </div>
          </div>

          <div className="service-images">
            {service.images && service.images.length > 0 ? (
              <div className="image-gallery">
                {service.images.map((image, index) => (
                  <CachedImage
                    key={index}
                    src={image}
                    alt={`${service.title} - Imagem ${index + 1}`}
                    className="service-image"
                    showLoading={true}
                  />
                ))}
              </div>
            ) : (
              <div className="no-image">
                <i className="fas fa-image"></i>
                <span>Nenhuma imagem disponível</span>
              </div>
            )}
          </div>

          <div className="service-description">
            <h3>Descrição</h3>
            <p>{service.description}</p>
          </div>

          {service.features && service.features.length > 0 && (
            <div className="service-features">
              <h3>Recursos Disponíveis</h3>
              <div className="features-list">
                {service.features.map((feature, index) => (
                  <div 
                    key={index}
                    className={`feature-item ${selectedFeatures.find(f => f.id === feature.id) ? 'selected' : ''}`}
                    onClick={() => handleFeatureToggle(feature)}
                  >
                    <div className="feature-info">
                      <h4>{feature.name}</h4>
                      <p>{feature.description}</p>
                    </div>
                    <div className="feature-price">
                      +{formatCurrency(feature.price)} VP
                    </div>
                    <div className="feature-checkbox">
                      <i className={`fas fa-${selectedFeatures.find(f => f.id === feature.id) ? 'check' : 'plus'}`}></i>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="service-provider">
            <h3>Provedor</h3>
            <div className="provider-info">
              <CachedImage
                src={service.providerAvatar}
                alt={service.providerName}
                className="provider-avatar"
                showLoading={false}
              />
              <div className="provider-details">
                <h4>{service.providerName}</h4>
                <p>@{service.providerUsername}</p>
                <div className="provider-stats">
                  <span>
                    <i className="fas fa-star"></i>
                    {service.providerRating || 'N/A'}
                  </span>
                  <span>
                    <i className="fas fa-check-circle"></i>
                    {service.providerCompletedOrders || 0} serviços concluídos
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="service-sidebar">
          <div className="purchase-card">
            <div className="purchase-summary">
              <h3>Resumo do Pedido</h3>
              <div className="price-breakdown">
                <div className="price-item">
                  <span>Preço base</span>
                  <span>{formatCurrency(service.price)} VP</span>
                </div>
                {selectedFeatures.map((feature, index) => (
                  <div key={index} className="price-item feature-price-item">
                    <span>{feature.name}</span>
                    <span>+{formatCurrency(feature.price)} VP</span>
                  </div>
                ))}
                <div className="price-total">
                  <span>Total</span>
                  <span>{formatCurrency(calculateTotal())} VP</span>
                </div>
              </div>
            </div>

            <div className="purchase-actions">
              {currentUser ? (
                userProfile?.accountType === 'client' ? (
                  service.providerId !== currentUser.uid ? (
                    <button 
                      className="btn-purchase"
                      onClick={() => setShowPurchaseModal(true)}
                      disabled={processing}
                    >
                      <i className="fas fa-shopping-cart"></i>
                      Comprar Serviço
                    </button>
                  ) : (
                    <div className="own-service-notice">
                      <i className="fas fa-info-circle"></i>
                      <span>Este é o seu próprio serviço</span>
                    </div>
                  )
                ) : (
                  <div className="provider-notice">
                    <i className="fas fa-info-circle"></i>
                    <span>Apenas clientes podem comprar serviços</span>
                  </div>
                )
              ) : (
                <button 
                  className="btn-login"
                  onClick={() => navigate('/login')}
                >
                  <i className="fas fa-sign-in-alt"></i>
                  Fazer Login para Comprar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirmar Compra</h3>
            <div className="purchase-confirmation">
              <div className="service-summary">
                <h4>{service.title}</h4>
                <p>por {service.providerName}</p>
              </div>
              
              <div className="price-breakdown">
                <div className="price-item">
                  <span>Preço base</span>
                  <span>{formatCurrency(service.price)} VP</span>
                </div>
                {selectedFeatures.map((feature, index) => (
                  <div key={index} className="price-item">
                    <span>{feature.name}</span>
                    <span>+{formatCurrency(feature.price)} VP</span>
                  </div>
                ))}
                <div className="price-total">
                  <span>Total a pagar</span>
                  <span>{formatCurrency(calculateTotal())} VP</span>
                </div>
              </div>

              <div className="purchase-terms">
                <p>
                  <i className="fas fa-info-circle"></i>
                  Ao confirmar, o valor será reservado e o provedor será notificado para aceitar o pedido.
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowPurchaseModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handlePurchase}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Processando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    Confirmar Compra
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceDetail;
