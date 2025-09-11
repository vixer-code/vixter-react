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
  const [showRefundPolicyModal, setShowRefundPolicyModal] = useState(false);
  const [agreeToRefundPolicy, setAgreeToRefundPolicy] = useState(false);

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
      const featureId = feature.id || feature.title || feature.name;
      const isSelected = prev.find(f => (f.id || f.title || f.name) === featureId);
      if (isSelected) {
        return prev.filter(f => (f.id || f.title || f.name) !== featureId);
      } else {
        return [...prev, feature];
      }
    });
  };

  const calculateTotal = () => {
    if (!service) return 0;
    const featuresTotal = selectedFeatures.reduce((total, feature) => {
      const price = feature.price || feature.vpAmount || 0;
      return total + (isNaN(price) ? 0 : price);
    }, 0);
    const basePrice = isNaN(service.price) ? 0 : service.price;
    const discount = service.discount || 0;
    const discountedPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
    return discountedPrice + featuresTotal;
  };

  const calculateVpTotal = () => {
    const vcTotal = calculateTotal();
    return Math.round(vcTotal * 1.5); // Convert VC to VP
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

    // Show refund policy modal first
    setShowRefundPolicyModal(true);
  };

  const handleConfirmPurchase = async () => {
    if (!agreeToRefundPolicy) {
      showNotification('Você deve concordar com a política de reembolso para continuar', 'warning');
      return;
    }

    const success = await createServiceOrder(service, selectedFeatures);
    if (success) {
      setShowRefundPolicyModal(false);
      setAgreeToRefundPolicy(false);
      showNotification('Pedido de serviço enviado com sucesso! O provedor foi notificado e receberá o pedido em breve.', 'success');
      navigate('/wallet');
    }
  };

  const formatVP = (amount) => {
    if (isNaN(amount) || amount === null || amount === undefined) {
      return '0 VP';
    }
    return `${amount} VP`;
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
              {service.discount && service.discount > 0 ? (
                <>
                  <span className="price-original">{formatVP(service.price * 1.5)}</span>
                  <span className="price-amount">{formatVP(calculateVpTotal())}</span>
                  <span className="discount-badge">-{service.discount}%</span>
                </>
              ) : (
                <span className="price-amount">{formatVP(service.price * 1.5)}</span>
              )}
            </div>
          </div>

          <div className="service-images">
            {/* Cover Image */}
            {service.coverImage?.publicUrl && (
              <div className="image-gallery">
                <CachedImage
                  src={service.coverImage.publicUrl}
                  alt={`${service.title} - Imagem principal`}
                  className="service-image"
                  showLoading={true}
                />
              </div>
            )}
            
            {/* Sample Images */}
            {service.sampleImages && service.sampleImages.length > 0 && (
              <div className="image-gallery">
                {service.sampleImages.map((image, index) => (
                  <CachedImage
                    key={index}
                    src={image.publicUrl}
                    alt={`${service.title} - Imagem ${index + 1}`}
                    className="service-image"
                    showLoading={true}
                  />
                ))}
              </div>
            )}
            
            {/* Fallback for old structure */}
            {service.images && service.images.length > 0 && !service.coverImage && !service.sampleImages && (
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
            )}
            
            {/* No images fallback */}
            {!service.coverImage && !service.sampleImages && (!service.images || service.images.length === 0) && (
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

          {service.additionalFeatures && service.additionalFeatures.length > 0 && (
            <div className="service-features">
              <h3>Recursos Complementares</h3>
              <div className="features-list">
                {service.additionalFeatures.map((feature, index) => {
                  const featureId = feature.id || feature.title || feature.name;
                  const isSelected = selectedFeatures.find(f => (f.id || f.title || f.name) === featureId);
                  return (
                    <div 
                      key={featureId || index}
                      className={`feature-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleFeatureToggle(feature)}
                    >
                      <div className="feature-info">
                        <h4>{feature.name || feature.title}</h4>
                        <p>{feature.description || feature.desc}</p>
                      </div>
                      <div className="feature-price">
                        +{formatVP(feature.price || feature.vpAmount || 0)}
                      </div>
                      <div className="feature-checkbox">
                        <i className={`fas fa-${isSelected ? 'check' : 'plus'}`}></i>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="service-provider">
            <h3>Vendedor(a)</h3>
            <div className="provider-info">
              <CachedImage
                src={service.providerAvatar || service.providerPhotoURL}
                alt={service.providerName || service.sellerName}
                className="provider-avatar"
                showLoading={false}
              />
              <div className="provider-details">
                <h4>{service.providerName || service.sellerName}</h4>
                <p>@{service.providerUsername || service.sellerUsername || 'usuário'}</p>
                <div className="provider-stats">
                  <span>
                    <i className="fas fa-star"></i>
                    {service.providerRating || service.sellerRating || 'N/A'}
                  </span>
                  <span>
                    <i className="fas fa-check-circle"></i>
                    {service.providerCompletedOrders || service.sellerCompletedOrders || 0} serviços concluídos
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
                  <span>{formatVP(service.price * 1.5)}</span>
                </div>
                {service.discount && service.discount > 0 && (
                  <div className="price-item discount-item">
                    <span>Desconto ({service.discount}%)</span>
                    <span>-{formatVP((service.price * 1.5) - calculateVpTotal())}</span>
                  </div>
                )}
                {selectedFeatures.map((feature, index) => (
                  <div key={index} className="price-item feature-price-item">
                    <span>{feature.name || feature.title}</span>
                    <span>+{formatVP(feature.price || feature.vpAmount || 0)}</span>
                  </div>
                ))}
                <div className="price-total">
                  <span>Total</span>
                  <span>{formatVP(calculateVpTotal())}</span>
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
                  <span>{formatVP(service.price * 1.5)}</span>
                </div>
                {service.discount && service.discount > 0 && (
                  <div className="price-item discount-item">
                    <span>Desconto ({service.discount}%)</span>
                    <span>-{formatVP((service.price * 1.5) - calculateVpTotal())}</span>
                  </div>
                )}
                {selectedFeatures.map((feature, index) => (
                  <div key={index} className="price-item">
                    <span>{feature.name || feature.title}</span>
                    <span>+{formatVP(feature.price || feature.vpAmount || 0)}</span>
                  </div>
                ))}
                <div className="price-total">
                  <span>Total a pagar</span>
                  <span>{formatVP(calculateVpTotal())}</span>
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

      {/* Refund Policy Modal */}
      {showRefundPolicyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Política de Reembolso</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowRefundPolicyModal(false);
                  setAgreeToRefundPolicy(false);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="refund-policy-content">
                <div className="service-info">
                  <h4>{service?.title}</h4>
                  <p>por {service?.providerName}</p>
                  <div className="total-amount">
                    <strong>Total: {formatCurrency(calculateTotal())} VP</strong>
                  </div>
                </div>
                
                <div className="refund-policy-text">
                  <h5>⚠️ Política de Reembolso</h5>
                  <p>
                    <strong>Esta compra é NÃO REEMBOLSÁVEL.</strong> Ao continuar, você reconhece e concorda que:
                  </p>
                  <ul>
                    <li>O valor será reservado em sua conta</li>
                    <li>O provedor será notificado para aceitar o pedido</li>
                    <li>Uma vez aceito, o serviço será executado conforme acordado</li>
                    <li>Não haverá reembolso após a confirmação da compra</li>
                    <li>Em caso de cancelamento pelo provedor, o valor será devolvido</li>
                  </ul>
                </div>
                
                <div className="agreement-checkbox">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={agreeToRefundPolicy}
                      onChange={(e) => setAgreeToRefundPolicy(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    <span className="checkbox-text">
                      Eu li e concordo com a política de reembolso (não reembolsável)
                    </span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowRefundPolicyModal(false);
                  setAgreeToRefundPolicy(false);
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleConfirmPurchase}
                disabled={!agreeToRefundPolicy || processing}
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
