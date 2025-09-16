import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useWallet } from '../contexts/WalletContext';
import { useNotification } from '../contexts/NotificationContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import CachedImage from '../components/CachedImage';
import R2MediaViewer from '../components/R2MediaViewer';
import './PackDetail.css';

const PackDetail = () => {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { vpBalance, createPackOrder } = useWallet();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  // Packs não têm política de reembolso - compra direta

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
        showError('Pack não encontrado');
        navigate('/');
      }
    } catch (error) {
      console.error('Error loading pack:', error);
      showError('Erro ao carregar pack');
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
      showWarning('Você precisa estar logado para comprar um pack');
      navigate('/login');
      return;
    }

    if (userProfile?.accountType !== 'client' && userProfile?.accountType !== 'both') {
      showWarning('Apenas clientes podem comprar packs');
      return;
    }

    if (pack.providerId === currentUser.uid) {
      showWarning('Você não pode comprar seu próprio pack');
      return;
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

    // Packs são comprados diretamente - sem política de reembolso
    setShowPurchaseModal(true);
  };

  const handleConfirmPurchase = async () => {
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
            setShowPurchaseModal(false);
            navigate('/wallet?tab=packs');
          },
          data: { action: 'recharge' }
        }
      );
      return;
    }

    try {
      // Create pack order that requires seller approval
      const result = await createPackOrder(
        currentUser.uid, // buyerId
        pack.providerId, // sellerId
        packId, // packId
        pack.title, // packName
        totalCost // vpAmount
      );
      
      if (result) {
        showSuccess(`Pedido de pack enviado! A vendedora tem 24h para aprovar.`);
        setShowPurchaseModal(false);
        
        // Redirect to my-purchases to see the pending order
        setTimeout(() => {
          navigate('/my-purchases');
        }, 1500);
      } else {
        showError('Erro ao processar pedido do pack. Tente novamente.');
      }
      
    } catch (error) {
      console.error('Error purchasing pack:', error);
      showError('Erro ao comprar pack. Tente novamente.');
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
                <span className="pack-category">
                  {pack.category === 'conteudo-18' ? 'Vixies (+18)' : pack.category}
                </span>
                <span className="pack-rating">
                  <i className="fas fa-star"></i>
                  {pack.rating || 'N/A'}
                </span>
              </div>
            </div>
            <div className="pack-price">
              <span className="price-amount">{formatVP(calculateVpTotal())}</span>
            </div>
          </div>

          {/* Cover Image */}
          <div className="pack-images">
            {pack.coverImage?.key && (
              <div className="image-gallery">
                <R2MediaViewer
                  mediaKey={pack.coverImage.key}
                  type="pack"
                  watermarked={false}
                  alt={`${pack.title} - Imagem principal`}
                  className="pack-image"
                />
              </div>
            )}
            
            {/* Fallback for old structure */}
            {pack.images && pack.images.length > 0 && !pack.coverImage && (
              <div className="image-gallery">
                <CachedImage
                  src={pack.images[0]}
                  alt={`${pack.title} - Imagem principal`}
                  className="pack-image"
                  showLoading={true}
                />
              </div>
            )}
            
            {/* No images fallback */}
            {!pack.coverImage && (!pack.images || pack.images.length === 0) && (
              <div className="no-image">
                <i className="fas fa-image"></i>
                <span>Nenhuma imagem disponível</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="pack-description">
            <h3>Descrição</h3>
            <p>{pack.description}</p>
          </div>

          {/* Pack Content Showcase */}
          {pack.content && pack.content.length > 0 && (
            <div className="pack-content-showcase">
              <h3>Conteúdo do Pack</h3>
              <div className="content-preview-grid">
                {pack.content.map((item, index) => (
                  <div key={index} className="content-preview-item">
                    <div className="content-preview-icon">
                      <i className="fas fa-file"></i>
                    </div>
                    <div className="content-preview-name">{item.name}</div>
                    <div className="content-preview-type">{item.type}</div>
                    {item.description && (
                      <div className="content-preview-description">{item.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Images */}
          {pack.sampleImages && pack.sampleImages.length > 0 && (
            <div className="pack-sample-images">
              <h3>Imagens de Amostra</h3>
              <div className="image-gallery">
                {pack.sampleImages.map((image, index) => (
                  <R2MediaViewer
                    key={index}
                    mediaKey={image.key}
                    type="pack"
                    watermarked={false}
                    alt={`${pack.title} - Amostra ${index + 1}`}
                    className="pack-image"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="pack-provider">
            <h3>Vendedor(a)</h3>
            <div className="provider-info">
              <CachedImage
                src={pack.providerAvatar || pack.providerPhotoURL || pack.sellerAvatar || pack.sellerPhotoURL}
                defaultType="PROFILE_1"
                alt={pack.providerName || pack.sellerName || 'Vendedor'}
                className="provider-avatar"
                showLoading={false}
              />
              <div className="provider-details">
                <h4>{pack.providerName || pack.sellerName || 'Vendedor'}</h4>
                <p>@{pack.providerUsername || pack.sellerUsername || 'usuario'}</p>
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
                className="btn-cancel"
                onClick={() => setShowPurchaseModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-confirm"
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
