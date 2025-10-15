import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useWallet } from '../contexts/WalletContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { useBlock } from '../contexts/BlockContext';
import { useNotification } from '../contexts/NotificationContext';
import useKycStatus from '../hooks/useKycStatus';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import CachedImage from '../components/CachedImage';
import R2MediaViewer from '../components/R2MediaViewer';
import './ServiceDetail.css';

const ServiceDetail = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { vpBalance } = useWallet();
  const { createServiceOrder, processing } = useServiceOrder();
  const { hasBlockBetween } = useBlock();
  const { showSuccess, showError, showWarning } = useNotification();
  const { kycState, isKycVerified, kycLoading } = useKycStatus();

  // Function to calculate provider statistics dynamically
  const calculateProviderStats = async (providerData) => {
    try {
      // Calculate completed service orders
      const serviceOrdersQuery = query(
        collection(db, 'serviceOrders'),
        where('sellerId', '==', providerData.id),
        where('status', 'in', ['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'])
      );
      const serviceOrdersSnap = await getDocs(serviceOrdersQuery);
      const completedServiceOrders = serviceOrdersSnap.size;

      // Calculate completed pack orders
      const packOrdersQuery = query(
        collection(db, 'packOrders'),
        where('sellerId', '==', providerData.id),
        where('status', 'in', ['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'])
      );
      const packOrdersSnap = await getDocs(packOrdersQuery);
      const completedPackOrders = packOrdersSnap.size;

      // Total completed orders
      const totalCompletedOrders = completedServiceOrders + completedPackOrders;

      // Calculate average rating from reviews
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('targetUserId', '==', providerData.id)
      );
      const reviewsSnap = await getDocs(reviewsQuery);
      
      let totalRating = 0;
      let reviewCount = 0;
      
      reviewsSnap.forEach((doc) => {
        const reviewData = doc.data();
        if (reviewData.rating && reviewData.rating >= 1 && reviewData.rating <= 5) {
          totalRating += reviewData.rating;
          reviewCount++;
        }
      });

      const averageRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 0;

      // Update provider data with calculated stats
      providerData.completedOrders = totalCompletedOrders;
      providerData.servicesSold = completedServiceOrders;
      providerData.packsSold = completedPackOrders;
      providerData.rating = averageRating;
      providerData.reviewCount = reviewCount;

      console.log('Provider stats calculated:', {
        completedOrders: totalCompletedOrders,
        servicesSold: completedServiceOrders,
        packsSold: completedPackOrders,
        rating: averageRating,
        reviewCount: reviewCount
      });

    } catch (error) {
      console.error('Error calculating provider stats:', error);
    }
  };

  // Function to calculate service specific statistics
  const calculateServiceStats = async (serviceData, serviceId) => {
    try {
      console.log('Calculating service stats for serviceId:', serviceId);
      
      // Calculate service rating from reviews
      const serviceReviewsQuery = query(
        collection(db, 'reviews'),
        where('itemId', '==', serviceId),
        where('type', '==', 'service')
      );
      const serviceReviewsSnap = await getDocs(serviceReviewsQuery);
      
      console.log('Found service reviews:', serviceReviewsSnap.size);
      
      // Also try without type filter to debug
      const allServiceReviewsQuery = query(
        collection(db, 'reviews'),
        where('itemId', '==', serviceId)
      );
      const allServiceReviewsSnap = await getDocs(allServiceReviewsQuery);
      console.log('All reviews for this serviceId (any type):', allServiceReviewsSnap.size);
      
      allServiceReviewsSnap.forEach((doc) => {
        const reviewData = doc.data();
        console.log('All review data:', {
          id: doc.id,
          itemId: reviewData.itemId,
          type: reviewData.type,
          rating: reviewData.rating
        });
      });
      
      let totalRating = 0;
      let reviewCount = 0;
      
      serviceReviewsSnap.forEach((doc) => {
        const reviewData = doc.data();
        console.log('Review data:', reviewData);
        if (reviewData.rating && reviewData.rating >= 1 && reviewData.rating <= 5) {
          totalRating += reviewData.rating;
          reviewCount++;
        }
      });

      const averageRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 'N/A';

      // Calculate service sales count
      const serviceSalesQuery = query(
        collection(db, 'serviceOrders'),
        where('serviceId', '==', serviceId),
        where('status', 'in', ['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'])
      );
      const serviceSalesSnap = await getDocs(serviceSalesQuery);
      const salesCount = serviceSalesSnap.size;

      console.log('Service sales count:', salesCount);

      // Update service data with calculated stats
      serviceData.rating = averageRating;
      serviceData.reviewCount = reviewCount;
      serviceData.salesCount = salesCount;

      console.log('Service stats calculated:', {
        serviceId: serviceId,
        rating: averageRating,
        reviewCount: reviewCount,
        salesCount: salesCount,
        totalRating: totalRating
      });

    } catch (error) {
      console.error('Error calculating service stats:', error);
    }
  };
  
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
        const serviceData = serviceSnap.data();
        
        // Load provider information
        let providerData = {};
        if (serviceData.providerId) {
          try {
            const providerRef = doc(db, 'users', serviceData.providerId);
            const providerSnap = await getDoc(providerRef);
            if (providerSnap.exists()) {
              providerData = {
                id: providerSnap.id,
                ...providerSnap.data()
              };
              
              // Calculate provider statistics dynamically
              await calculateProviderStats(providerData);
            }
          } catch (providerError) {
            console.warn('Error loading provider data:', providerError);
          }
        }
        
        const serviceWithProvider = {
          id: serviceSnap.id,
          ...serviceData,
          // Add provider information
          providerName: providerData.displayName || serviceData.providerName,
          providerUsername: providerData.username || serviceData.providerUsername,
          providerAvatar: providerData.profilePictureURL || serviceData.providerAvatar,
          providerRating: providerData.rating || serviceData.providerRating,
          providerCompletedOrders: providerData.completedOrders || serviceData.providerCompletedOrders
        };

        // Calculate service-specific statistics
        await calculateServiceStats(serviceWithProvider, serviceSnap.id);
        
        setService(serviceWithProvider);
      } else {
        showError('Serviço não encontrado');
        navigate('/');
      }
    } catch (error) {
      console.error('Error loading service:', error);
      showError('Erro ao carregar serviço');
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
    return Math.round(vcTotal * 1.5); // Convert VC to VP (1 VC = 1.5 VP)
  };

  const handlePurchase = async () => {
    if (!currentUser) {
      showWarning('Você precisa estar logado para comprar um serviço');
      navigate('/login');
      return;
    }

    if (userProfile?.accountType !== 'client' && userProfile?.accountType !== 'both') {
      showWarning('Apenas clientes podem comprar serviços');
      return;
    }

    if (service.status && service.status !== 'active') {
      showWarning('Este serviço está pausado e não está disponível para compra');
      return;
    }

    if (service.providerId === currentUser.uid) {
      showWarning('Você não pode comprar seu próprio serviço');
      return;
    }

    // Check if there's a block between users
    if (hasBlockBetween(service.providerId)) {
      showError('Não é possível comprar de um usuário bloqueado ou que bloqueou você');
      return;
    }

    // KYC validation for +18 content (Webnamoro)
    if (service.category === 'webnamoro') {
      if (kycLoading) {
        return showError('Aguarde a verificação do status KYC...');
      }
      if (!isKycVerified) {
        if (kycState === 'PENDING_UPLOAD') {
          showError('Para acessar serviços +18 (Webnamoro), você precisa completar sua verificação KYC primeiro.');
          setTimeout(() => {
            window.location.href = '/settings';
          }, 2000);
          return;
        } else {
          return showError('Para acessar serviços +18 (Webnamoro), sua verificação KYC precisa estar aprovada. Status atual: ' + (kycState === 'PENDING_VERIFICATION' ? 'Em análise' : 'Pendente'));
        }
      }
    }

    const totalCost = calculateVpTotal();
    
    // Check if user has sufficient VP balance
    if (vpBalance < totalCost) {
      showError(
        `Saldo insuficiente! Você tem ${vpBalance} VP, mas precisa de ${totalCost} VP para esta compra. Clique para adicionar saldo.`,
        'Saldo Insuficiente',
        8000,
        {
          onClick: (data) => {
            console.log('Notification clicked! Data:', data);
            console.log('Navigating to wallet...');
            navigate('/wallet?tab=packs');
          },
          data: { action: 'recharge' }
        }
      );
      return;
    }

    // Show refund policy modal first
    setShowRefundPolicyModal(true);
  };

  const handleConfirmPurchase = async () => {
    // Prevent multiple simultaneous calls
    if (processing) {
      console.log('Purchase already in progress, ignoring duplicate call');
      return;
    }

    if (!agreeToRefundPolicy) {
      showWarning('Você deve concordar com a política de reembolso para continuar');
      return;
    }

    const totalCost = calculateVpTotal();
    
    // Double-check balance before processing
    if (vpBalance < totalCost) {
      showError(
        `Saldo insuficiente! Você tem ${vpBalance} VP, mas precisa de ${totalCost} VP para esta compra. Clique para adicionar saldo.`,
        'Saldo Insuficiente',
        8000,
        {
          onClick: (data) => {
            console.log('Notification clicked! Data:', data);
            console.log('Closing modal and navigating to wallet...');
            setShowRefundPolicyModal(false);
            setAgreeToRefundPolicy(false);
            navigate('/wallet?tab=packs');
          },
          data: { action: 'recharge' }
        }
      );
      return;
    }

    console.log('Creating service order with:', { service, selectedFeatures, createServiceOrder });
    
    if (typeof createServiceOrder !== 'function') {
      showError('Erro: Função de criação de pedido não disponível');
      return;
    }
    
    try {
      const success = await createServiceOrder(service, selectedFeatures);
      if (success) {
        setShowRefundPolicyModal(false);
        setAgreeToRefundPolicy(false);
        showSuccess('Pedido de serviço enviado com sucesso! O provedor foi notificado e receberá o pedido em breve.');
        navigate('/wallet');
      }
    } catch (error) {
      console.error('Error creating service order:', error);
      showError('Erro ao criar pedido de serviço. Tente novamente.');
    }
  };

  const formatVP = (amount) => {
    if (isNaN(amount) || amount === null || amount === undefined) {
      return '0 VP';
    }
    return `${parseInt(amount, 10)} VP`;
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
                  <span className="price-original">{formatVP(Math.round(service.price * 1.5))}</span>
                  <span className="price-amount">{formatVP(calculateVpTotal())}</span>
                  <span className="discount-badge">-{service.discount}%</span>
                </>
              ) : (
                <span className="price-amount">{formatVP(Math.round(service.price * 1.5))}</span>
              )}
              {service.status && service.status !== 'active' && (
                <div className="service-status-badge paused">
                  <i className="fas fa-pause"></i>
                  Pausado
                </div>
              )}
            </div>
          </div>

          <div className="service-images">
            {/* Cover Image */}
            {service.coverImage?.key && (
              <div className="image-gallery">
                <R2MediaViewer
                  mediaKey={service.coverImage.key}
                  type="service"
                  watermarked={false}
                  alt={`${service.title} - Imagem principal`}
                  className="service-image"
                />
              </div>
            )}
            
            {/* Sample Images */}
            {service.sampleImages && service.sampleImages.length > 0 && (
              <div className="image-gallery">
                {service.sampleImages.map((image, index) => (
                  <R2MediaViewer
                    key={index}
                    mediaKey={image.key}
                    type="service"
                    watermarked={false}
                    alt={`${service.title} - Imagem ${index + 1}`}
                    className="service-image"
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
                  <span>{formatVP(Math.round(service.price * 1.5))}</span>
                </div>
                {service.discount && service.discount > 0 && (
                  <div className="price-item discount-item">
                    <span>Desconto ({service.discount}%)</span>
                    <span>-{formatVP(Math.round(service.price * 1.5) - calculateVpTotal())}</span>
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
                (userProfile?.accountType === 'client' || userProfile?.accountType === 'both') ? (
                  service.providerId !== currentUser.uid ? (
                    <>
                      {/* KYC Warning for +18 content */}
                      {service.category === 'webnamoro' && !isKycVerified && (
                        <div className="kyc-warning">
                          <i className="fas fa-exclamation-triangle"></i>
                          <div className="warning-content">
                            <strong>Verificação KYC Necessária</strong>
                            <p>Para acessar serviços +18 (Webnamoro), você precisa ter sua identidade verificada.</p>
                            <button 
                              className="btn-kyc"
                              onClick={() => navigate('/settings')}
                            >
                              <i className="fas fa-id-card"></i>
                              Verificar Identidade
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <button 
                        className={`btn-purchase ${service.status && service.status !== 'active' ? 'disabled' : ''} ${service.category === 'webnamoro' && !isKycVerified ? 'disabled' : ''}`}
                        onClick={() => setShowPurchaseModal(true)}
                        disabled={processing || (service.status && service.status !== 'active') || (service.category === 'webnamoro' && !isKycVerified)}
                      >
                        <i className="fas fa-shopping-cart"></i>
                        {service.status && service.status !== 'active' ? 'Serviço Pausado' : 
                         service.category === 'webnamoro' && !isKycVerified ? 'KYC Necessário' : 
                         'Comprar Serviço'}
                      </button>
                    </>
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
                  <span>{formatVP(Math.round(service.price * 1.5))}</span>
                </div>
                {service.discount && service.discount > 0 && (
                  <div className="price-item discount-item">
                    <span>Desconto ({service.discount}%)</span>
                    <span>-{formatVP(Math.round(service.price * 1.5) - calculateVpTotal())}</span>
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
                    <strong>Total: {formatVP(calculateVpTotal())}</strong>
                  </div>
                </div>
                
                <div className="balance-confirmation">
                  <h5>💰 Confirmação de Saldo</h5>
                  <div className="balance-details">
                    <div className="balance-item">
                      <span>Saldo atual:</span>
                      <span className="current-balance">{formatVP(vpBalance)}</span>
                    </div>
                    <div className="balance-item">
                      <span>Valor da compra:</span>
                      <span className="purchase-amount">{formatVP(calculateVpTotal())}</span>
                    </div>
                    <div className="balance-item total">
                      <span>Saldo após compra:</span>
                      <span className={`remaining-balance ${(vpBalance - calculateVpTotal()) < 0 ? 'insufficient' : ''}`}>
                        {formatVP(Math.max(0, vpBalance - calculateVpTotal()))}
                      </span>
                    </div>
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
