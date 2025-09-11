import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useWallet } from '../contexts/WalletContext';
import { useNotification } from '../contexts/NotificationContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import CachedImage from '../components/CachedImage';
import './PackDetail.css';

const PackDetail = () => {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { vpBalance } = useWallet();
  const { showNotification } = useNotification();
  
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showRefundPolicyModal, setShowRefundPolicyModal] = useState(false);
  const [agreeToRefundPolicy, setAgreeToRefundPolicy] = useState(false);

  useEffect(() => {
    loadPack();
  }, [packId]);

  const loadPack = async () => {
    try {
      const packRef = doc(db, 'packs', packId);
      const packSnap = await getDoc(packRef);
      
      if (packSnap.exists()) {
        const packData = packSnap.data();
        
        // Load provider information
        let providerData = {};
        if (packData.providerId) {
          try {
            const providerRef = doc(db, 'users', packData.providerId);
            const providerSnap = await getDoc(providerRef);
            if (providerSnap.exists()) {
              providerData = providerSnap.data();
            }
          } catch (providerError) {
            console.warn('Error loading provider data:', providerError);
          }
        }
        
        setPack({
          id: packSnap.id,
          ...packData,
          // Add provider information
          providerName: providerData.displayName || packData.providerName,
          providerUsername: providerData.username || packData.providerUsername,
          providerAvatar: providerData.profilePictureURL || packData.providerAvatar,
          providerRating: providerData.rating || packData.providerRating,
          providerCompletedOrders: providerData.completedOrders || packData.providerCompletedOrders
        });
      } else {
        showNotification('Pack não encontrado', 'error');
        navigate('/');
      }
    } catch (error) {
      console.error('Error loading pack:', error);
      showNotification('Erro ao carregar pack', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateVpTotal = () => {
    if (!pack) return 0;
    const basePrice = pack.price || 0;
    const discount = pack.discount || 0;
    const discountedPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
    return Math.round(discountedPrice * 1.5); // Convert VC to VP
  };

  const handlePurchase = async () => {
    if (!currentUser) {
      showNotification('Você precisa estar logado para comprar um pack', 'warning');
      navigate('/login');
      return;
    }

    if (userProfile?.accountType !== 'client' && userProfile?.accountType !== 'both') {
      showNotification('Apenas clientes podem comprar packs', 'warning');
      return;
    }

    if (pack.providerId === currentUser.uid) {
      showNotification('Você não pode comprar seu próprio pack', 'warning');
      return;
    }

    const totalCost = calculateVpTotal();
    
    // Check if user has sufficient VP balance
    if (vpBalance < totalCost) {
      showNotification(`Saldo insuficiente! Você tem ${vpBalance} VP, mas precisa de ${totalCost} VP para esta compra.`, 'error');
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

    const totalCost = calculateVpTotal();
    
    // Double-check balance before processing
    if (vpBalance < totalCost) {
      showNotification(`Saldo insuficiente! Você tem ${vpBalance} VP, mas precisa de ${totalCost} VP para esta compra.`, 'error');
      return;
    }

    // TODO: Implement pack purchase logic
    showNotification('Compra de pack será implementada em breve!', 'info');
    setShowRefundPolicyModal(false);
    setAgreeToRefundPolicy(false);
  };

  const formatVP = (amount) => {
    if (isNaN(amount) || amount === null || amount === undefined) {
      return '0 VP';
    }
    return `${amount} VP`;
  };

  if (loading) {
    return (
      <div className="pack-detail-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando pack...</span>
        </div>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="pack-detail-container">
        <div className="error-state">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Pack não encontrado</h2>
          <p>O pack que você está procurando não existe ou foi removido.</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pack-detail-container">
      <div className="pack-detail-content">
        <div className="pack-main">
          <div className="pack-header">
            <div className="pack-title-section">
              <h1>{pack.title}</h1>
              <div className="pack-meta">
                <span className="pack-category">{pack.category}</span>
                <span className="pack-rating">
                  <i className="fas fa-star"></i>
                  {pack.rating || 'N/A'}
                </span>
              </div>
            </div>
            <div className="pack-price">
              {pack.discount && pack.discount > 0 ? (
                <>
                  <span className="price-original">{formatVP(pack.price * 1.5)}</span>
                  <span className="price-amount">{formatVP(calculateVpTotal())}</span>
                  <span className="discount-badge">-{pack.discount}%</span>
                </>
              ) : (
                <span className="price-amount">{formatVP(pack.price * 1.5)}</span>
              )}
            </div>
          </div>

          <div className="pack-images">
            {/* Cover Image */}
            {pack.coverImage?.publicUrl && (
              <div className="image-gallery">
                <CachedImage
                  src={pack.coverImage.publicUrl}
                  alt={`${pack.title} - Imagem principal`}
                  className="pack-image"
                  showLoading={true}
                />
              </div>
            )}
            
            {/* Sample Images */}
            {pack.sampleImages && pack.sampleImages.length > 0 && (
              <div className="image-gallery">
                {pack.sampleImages.map((image, index) => (
                  <CachedImage
                    key={index}
                    src={image.publicUrl}
                    alt={`${pack.title} - Imagem ${index + 1}`}
                    className="pack-image"
                    showLoading={true}
                  />
                ))}
              </div>
            )}
            
            {/* Fallback for old structure */}
            {pack.images && pack.images.length > 0 && !pack.coverImage && !pack.sampleImages && (
              <div className="image-gallery">
                {pack.images.map((image, index) => (
                  <CachedImage
                    key={index}
                    src={image}
                    alt={`${pack.title} - Imagem ${index + 1}`}
                    className="pack-image"
                    showLoading={true}
                  />
                ))}
              </div>
            )}
            
            {/* No images fallback */}
            {!pack.coverImage && !pack.sampleImages && (!pack.images || pack.images.length === 0) && (
              <div className="no-image">
                <i className="fas fa-image"></i>
                <span>Nenhuma imagem disponível</span>
              </div>
            )}
          </div>

          <div className="pack-description">
            <h3>Descrição</h3>
            <p>{pack.description}</p>
          </div>

          <div className="pack-provider">
            <h3>Vendedor(a)</h3>
            <div className="provider-info">
              <CachedImage
                src={pack.providerAvatar || pack.providerPhotoURL}
                alt={pack.providerName || pack.sellerName}
                className="provider-avatar"
                showLoading={false}
              />
              <div className="provider-details">
                <h4>{pack.providerName || pack.sellerName}</h4>
                <p>@{pack.providerUsername || pack.sellerUsername || 'usuário'}</p>
                <div className="provider-stats">
                  <span>
                    <i className="fas fa-star"></i>
                    {pack.providerRating || pack.sellerRating || 'N/A'}
                  </span>
                  <span>
                    <i className="fas fa-check-circle"></i>
                    {pack.providerCompletedOrders || pack.sellerCompletedOrders || 0} packs vendidos
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pack-sidebar">
          <div className="purchase-card">
            <div className="purchase-summary">
              <h3>Resumo do Pedido</h3>
              <div className="price-breakdown">
                <div className="price-item">
                  <span>Preço base</span>
                  <span>{formatVP(pack.price * 1.5)}</span>
                </div>
                {pack.discount && pack.discount > 0 && (
                  <div className="price-item discount-item">
                    <span>Desconto ({pack.discount}%)</span>
                    <span>-{formatVP((pack.price * 1.5) - calculateVpTotal())}</span>
                  </div>
                )}
                <div className="price-total">
                  <span>Total</span>
                  <span>{formatVP(calculateVpTotal())}</span>
                </div>
              </div>
            </div>

            <div className="purchase-actions">
              {currentUser ? (
                (userProfile?.accountType === 'client' || userProfile?.accountType === 'both') ? (
                  pack.providerId !== currentUser.uid ? (
                    <button 
                      className="btn-purchase"
                      onClick={handlePurchase}
                    >
                      <i className="fas fa-shopping-cart"></i>
                      Comprar Pack
                    </button>
                  ) : (
                    <div className="own-pack-notice">
                      <i className="fas fa-info-circle"></i>
                      <span>Este é o seu próprio pack</span>
                    </div>
                  )
                ) : (
                  <div className="provider-notice">
                    <i className="fas fa-info-circle"></i>
                    <span>Apenas clientes podem comprar packs</span>
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
              <div className="pack-summary">
                <h4>{pack.title}</h4>
                <p>por {pack.providerName}</p>
              </div>
              
              <div className="price-breakdown">
                <div className="price-item">
                  <span>Preço base</span>
                  <span>{formatVP(pack.price * 1.5)}</span>
                </div>
                {pack.discount && pack.discount > 0 && (
                  <div className="price-item discount-item">
                    <span>Desconto ({pack.discount}%)</span>
                    <span>-{formatVP((pack.price * 1.5) - calculateVpTotal())}</span>
                  </div>
                )}
                <div className="price-total">
                  <span>Total a pagar</span>
                  <span>{formatVP(calculateVpTotal())}</span>
                </div>
              </div>

              <div className="purchase-terms">
                <p>
                  <i className="fas fa-info-circle"></i>
                  Ao confirmar, o valor será reservado e o vendedor será notificado.
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
                onClick={() => setShowRefundPolicyModal(true)}
              >
                <i className="fas fa-check"></i>
                Confirmar Compra
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
                <div className="pack-info">
                  <h4>{pack?.title}</h4>
                  <p>por {pack?.providerName}</p>
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
                      <span className="remaining-balance">{formatVP(vpBalance - calculateVpTotal())}</span>
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
                    <li>O vendedor será notificado</li>
                    <li>Uma vez confirmado, o pack será adicionado à sua conta</li>
                    <li>Não haverá reembolso após a confirmação da compra</li>
                    <li>Em caso de cancelamento pelo vendedor, o valor será devolvido</li>
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
              >
                <i className="fas fa-check"></i>
                Confirmar Compra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackDetail;
