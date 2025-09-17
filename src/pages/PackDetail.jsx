import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useWallet } from '../contexts/WalletContext';
import { useNotification } from '../contexts/NotificationContext';
import { doc, getDoc } from 'firebase/firestore';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import { db, database } from '../../config/firebase';
import CachedImage from '../components/CachedImage';
import R2MediaViewer from '../components/R2MediaViewer';
import './PackDetail.css';

// Subcategories mapping (same as CreatePackModal)
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

const PackDetail = () => {
  const { packId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { vpBalance, createPackOrder } = useWallet();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();

  // Helper functions for category and subcategory labels
  const getCategoryLabel = (categoryValue) => {
    return packCategories.find(c => c.value === categoryValue)?.label || categoryValue;
  };

  const getSubcategoryLabel = (categoryValue, subcategoryValue) => {
    if (!subcategoryValue || !subcategoriesMap[categoryValue]) return '';
    const match = subcategoriesMap[categoryValue]?.find(s => 
      s.toLowerCase().replace(/\s+/g, '-') === subcategoryValue
    );
    return match || subcategoryValue;
  };
  
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
        console.log('Pack data providerId:', packData.providerId);
        console.log('Pack data authorId:', packData.authorId);
        console.log('Pack data creatorId:', packData.creatorId);
        
        // Try providerId, authorId, or creatorId as fallback
        const providerId = packData.providerId || packData.authorId || packData.creatorId;
        
        if (providerId) {
          try {
            console.log('Loading provider data for ID:', providerId);
            
            // Try Firestore first
            try {
              const providerRef = doc(db, 'users', providerId);
              const providerSnap = await getDoc(providerRef);
              if (providerSnap.exists()) {
                providerData = {
                  id: providerSnap.id,
                  ...providerSnap.data()
                };
                console.log('Provider data loaded from Firestore:', providerData);
              } else {
                console.warn('Provider document not found in Firestore, trying Realtime Database');
                
                // Try Realtime Database as fallback
                const rtdbUserRef = rtdbRef(database, `users/${providerId}`);
                const rtdbSnap = await rtdbGet(rtdbUserRef);
                if (rtdbSnap.exists()) {
                  providerData = {
                    id: providerId,
                    ...rtdbSnap.val()
                  };
                  console.log('Provider data loaded from Realtime Database:', providerData);
                } else {
                  console.warn('Provider not found in either database');
                }
              }
            } catch (firestoreError) {
              console.warn('Firestore error, trying Realtime Database:', firestoreError);
              
              // Try Realtime Database as fallback
              const rtdbUserRef = rtdbRef(database, `users/${providerId}`);
              const rtdbSnap = await rtdbGet(rtdbUserRef);
              if (rtdbSnap.exists()) {
                providerData = {
                  id: providerId,
                  ...rtdbSnap.val()
                };
                console.log('Provider data loaded from Realtime Database (fallback):', providerData);
              } else {
                console.warn('Provider not found in either database');
              }
            }
          } catch (providerError) {
            console.error('Error loading provider data:', providerError);
          }
        } else {
          console.warn('No providerId, authorId, or creatorId found in pack data');
        }
        
        const packWithProvider = {
          id: packSnap.id,
          ...packData,
          // Add provider ID (this is crucial for purchases)
          providerId: providerId,
          // Add provider information with better fallbacks
          providerName: providerData.displayName || providerData.name || packData.providerName || packData.sellerName || 'Vendedor',
          providerUsername: providerData.username || packData.providerUsername || packData.sellerUsername || 'usuario',
          providerAvatar: providerData.profilePictureURL || providerData.avatar || packData.providerAvatar || packData.sellerAvatar || null,
          providerRating: providerData.rating || providerData.averageRating || packData.providerRating || packData.sellerRating || 0,
          providerCompletedOrders: providerData.completedOrders || providerData.totalSales || packData.providerCompletedOrders || packData.sellerCompletedOrders || 0,
          // Also add legacy fields for compatibility
          sellerName: providerData.displayName || providerData.name || packData.sellerName || 'Vendedor',
          sellerUsername: providerData.username || packData.sellerUsername || 'usuario',
          sellerAvatar: providerData.profilePictureURL || providerData.avatar || packData.sellerAvatar || null,
          sellerRating: providerData.rating || providerData.averageRating || packData.sellerRating || 0,
          sellerCompletedOrders: providerData.completedOrders || providerData.totalSales || packData.sellerCompletedOrders || 0
        };
        
        console.log('Pack data loaded:', packWithProvider);
        console.log('Provider data from Firestore:', providerData);
        console.log('Pack content:', packWithProvider.content);
        
        setPack(packWithProvider);
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

    if (pack.authorId === currentUser.uid) {
      showWarning('Você não pode comprar seu próprio pack');
      return;
    }

    if (pack.status && pack.status !== 'active') {
      showWarning('Este pack está pausado e não está disponível para compra');
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

  // Function to get current user's username from Firebase
  const getCurrentUserUsername = async () => {
    try {
      // Try Firestore first
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.username && userData.username.trim() !== '') {
          return userData.username;
        }
      }
      
      // Fallback to Realtime Database
      if (database) {
        const rtdbUserRef = rtdbRef(database, `users/${currentUser.uid}`);
        const rtdbSnap = await rtdbGet(rtdbUserRef);
        if (rtdbSnap.exists()) {
          const rtdbUserData = rtdbSnap.val();
          if (rtdbUserData.username && rtdbUserData.username.trim() !== '') {
            return rtdbUserData.username;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user username:', error);
      return null;
    }
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
      // Get current user's username from Firebase
      const currentUsername = await getCurrentUserUsername();
      console.log('Current user username from Firebase:', currentUsername);
      
      // Prepare buyer info with current data
      const buyerInfo = {
        ...userProfile,
        username: currentUsername || userProfile?.username || '',
        displayName: userProfile?.displayName || currentUser?.displayName || '',
        name: userProfile?.displayName || currentUser?.displayName || ''
      };
      
      console.log('Buyer info for pack order:', buyerInfo);
      
      // Debug: Log pack object to see its structure
      console.log('Pack object before purchase:', pack);
      console.log('pack.providerId:', pack.providerId);
      console.log('pack.authorId:', pack.authorId);
      
      // Create pack order that requires seller approval
      const result = await createPackOrder(
        currentUser.uid, // buyerId
        pack.authorId, // sellerId - use authorId as this is the field used when packs are created
        packId, // packId
        pack.title, // packName
        totalCost, // vpAmount
        buyerInfo // buyerInfo - pass user profile information with current username
      );
      
      if (result) {
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
                <div className="pack-categories">
                  <span className="pack-category">
                    {pack.category === 'conteudo-18' ? 'Vixies (+18)' : getCategoryLabel(pack.category)}
                  </span>
                  {pack.subcategory && (
                    <span className="pack-subcategory">
                      {getSubcategoryLabel(pack.category, pack.subcategory)}
                    </span>
                  )}
                </div>
                <span className="pack-rating">
                  <i className="fas fa-star"></i>
                  {pack.rating || 'N/A'}
                </span>
              </div>
            </div>
            <div className="pack-price">
              <span className="price-amount">{formatVP(calculateVpTotal())}</span>
              {pack.status && pack.status !== 'active' && (
                <div className="pack-status-badge paused">
                  <i className="fas fa-pause"></i>
                  Pausado
                </div>
              )}
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


          {/* Sample Files Showcase (Vitrine) */}
          {((pack.sampleImages && pack.sampleImages.length > 0) || (pack.sampleVideos && pack.sampleVideos.length > 0)) && (
            <div className="pack-showcase">
              <h3>Vitrine - Arquivos de Amostra</h3>
              <p className="showcase-description">
                Visualize uma prévia do conteúdo antes de comprar
              </p>
              
              <div className="showcase-content">
                {/* Sample Images */}
                {pack.sampleImages && pack.sampleImages.length > 0 && (
                  <div className="showcase-section">
                    <h4>Fotos ({pack.sampleImages.length})</h4>
                    <div className="showcase-grid">
                      {pack.sampleImages.map((image, index) => (
                        <div key={`sample-image-${index}`} className="showcase-item">
                          <R2MediaViewer
                            mediaKey={image.key}
                            type="pack"
                            watermarked={false}
                            alt={`${pack.title} - Amostra ${index + 1}`}
                            className="showcase-media"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Videos */}
                {pack.sampleVideos && pack.sampleVideos.length > 0 && (
                  <div className="showcase-section">
                    <h4>Vídeos ({pack.sampleVideos.length})</h4>
                    <div className="showcase-grid">
                      {pack.sampleVideos.map((video, index) => (
                        <div key={`sample-video-${index}`} className="showcase-item video-showcase">
                          <R2MediaViewer
                            mediaKey={video.key}
                            type="pack"
                            watermarked={false}
                            alt={`${pack.title} - Vídeo Amostra ${index + 1}`}
                            className="showcase-media"
                          />
                          <div className="video-overlay">
                            <i className="fas fa-play"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  pack.authorId !== currentUser.uid ? (
            <button 
              className={`btn-purchase ${pack.status && pack.status !== 'active' ? 'disabled' : ''}`}
              onClick={handlePurchase}
              disabled={pack.status && pack.status !== 'active'}
            >
              <i className="fas fa-shopping-cart"></i>
              {pack.status && pack.status !== 'active' ? 'Pack Pausado' : 'Comprar Pack'}
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
