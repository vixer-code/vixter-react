import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { usePacksR2 } from '../contexts/PacksContextR2';
import { useReview } from '../contexts/ReviewContext';
import ServicePackReviewModal from '../components/ServicePackReviewModal';
import { collection, query as fsQuery, where, orderBy, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Link, useNavigate } from 'react-router-dom';
import SmartMediaViewer from '../components/SmartMediaViewer';
import PackContentViewer from '../components/PackContentViewer';
import ServiceMediaViewer from '../components/ServiceMediaViewer';
import './MyPurchases.css';

const MyPurchases = () => {
  const { currentUser } = useAuth();
  const { userProfile, getUserById } = useUser();
  const { showError, showSuccess } = useNotification();
  const { createOrGetConversation } = useEnhancedMessaging();
  const { confirmServiceDelivery, processing } = useServiceOrder();
  const { getPackById } = usePacksR2();
  const { canReviewOrder, canReviewBuyerBehavior } = useReview();
  const navigate = useNavigate();
  
  
  const [purchasedPacks, setPurchasedPacks] = useState([]);
  const [purchasedServices, setPurchasedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [sellerData, setSellerData] = useState({});
  const [packData, setPackData] = useState({});
  const [viewingPack, setViewingPack] = useState(null);
  const [viewingService, setViewingService] = useState(null);
  const [confirmingOrder, setConfirmingOrder] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [showServicePackReviewModal, setShowServicePackReviewModal] = useState(false);
  const [reviewingOrder, setReviewingOrder] = useState(null);
  const [canReviewMap, setCanReviewMap] = useState({});
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [openingModal, setOpeningModal] = useState(false);

  // Redirect if not a client
  useEffect(() => {
    if (userProfile && userProfile.accountType !== 'client') {
      showError('Apenas clientes podem acessar esta página');
      navigate('/');
    }
  }, [userProfile, showError, navigate]);

  // Load purchased packs with real-time updates
  const loadPurchasedPacks = useCallback(() => {
    if (!currentUser) {
      setPurchasedPacks([]);
      return;
    }
    
    const packOrdersRef = collection(db, 'packOrders');
    
    console.log('🔍 Setting up pack orders query for user:', currentUser.uid);
    
    // Test: Try to read all pack orders to see if our document exists
    getDocs(collection(db, 'packOrders')).then(allPacksSnapshot => {
      console.log('🧪 All pack orders in database:', allPacksSnapshot.size);
      allPacksSnapshot.forEach(doc => {
        const data = doc.data();
        console.log('🧪 Found pack order:', doc.id, {
          buyerId: data.buyerId,
          status: data.status,
          isCurrentUser: data.buyerId === currentUser.uid
        });
      });
    }).catch(error => {
      console.error('🧪 Error reading all pack orders:', error);
    });
    
    // Try without orderBy first to see if that's the issue
    const queryRef = fsQuery(
      packOrdersRef,
      where('buyerId', '==', currentUser.uid)
      // Temporarily removed orderBy to debug
      // orderBy('timestamps.createdAt', 'desc')
    );
    
    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(queryRef,
      (snapshot) => {
        console.log('📦 Pack orders snapshot received:', snapshot.size, 'documents');
        console.log('📦 Snapshot metadata:', {
          empty: snapshot.empty,
          size: snapshot.size,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
          isFromCache: snapshot.metadata.fromCache
        });
        
        const orders = [];
        snapshot.forEach((doc) => {
          const orderData = doc.data();
          console.log('🔍 Processing pack order:', doc.id, {
            buyerId: orderData.buyerId,
            status: orderData.status,
            packId: orderData.packId,
            currentUserMatch: orderData.buyerId === currentUser.uid,
            timestamps: orderData.timestamps,
            fullData: orderData
          });
          
          // Include all pack orders except cancelled and banned
          if (orderData && orderData.status !== 'CANCELLED' && orderData.status !== 'BANNED') {
            orders.push({
              id: doc.id,
              type: 'pack',
              ...orderData
            });
            console.log('✅ Added pack order:', doc.id);
          } else {
            console.log('❌ Filtered out pack order:', doc.id, 'Status:', orderData?.status);
          }
        });
        
        console.log('📦 Final pack orders:', orders.length);
        console.log('📦 Orders array:', orders);
        setPurchasedPacks(orders);
        
        // Load pack data for purchased packs
        if (orders.length > 0) {
          loadPackData(orders);
        }
      },
      (error) => {
        console.error('Error loading purchased packs:', error);
        showError('Erro ao carregar packs comprados');
      }
    );
    
    return unsubscribe;
  }, [currentUser, showError]);

  // Load pack data for purchased packs
  const loadPackData = useCallback(async (packs) => {
    const packIds = [...new Set(packs.map(pack => pack.packId).filter(Boolean))];
    const packDataMap = {};
    
    for (const packId of packIds) {
      try {
        const pack = await getPackById(packId);
        if (pack) {
          packDataMap[packId] = {
            title: pack.title || 'Pack',
            coverImage: pack.coverImage,
            description: pack.description,
            price: pack.price,
            packContent: pack.packContent || [],
            content: pack.content || []
          };
        }
      } catch (error) {
        console.error('Error loading pack data:', error);
        // Set fallback data
        packDataMap[packId] = {
          title: 'Pack',
          coverImage: null,
          description: '',
          price: 0
        };
      }
    }
    
    setPackData(packDataMap);
  }, [getPackById]);

  // Load seller data for services and packs
  const loadSellerData = useCallback(async (services, packs = []) => {
    const sellerIds = [...new Set([
      ...services.map(service => service.sellerId).filter(Boolean),
      ...packs.map(pack => pack.sellerId).filter(Boolean)
    ])];
    const sellerDataMap = {};
    
    for (const sellerId of sellerIds) {
      try {
        const seller = await getUserById(sellerId);
        if (seller) {
          sellerDataMap[sellerId] = {
            name: seller.displayName || seller.username || seller.name || 'Vendedor',
            username: seller.username || seller.displayName?.toLowerCase().replace(/\s+/g, '') || 'vendedor',
            profilePicture: seller.profilePictureURL || null
          };
        }
      } catch (error) {
        console.error('Error loading seller data:', error);
      }
    }
    
    setSellerData(sellerDataMap);
  }, [getUserById]);

  // Load purchased services with real-time updates (supports both buyerId locations)
  const loadPurchasedServices = useCallback(() => {
    if (!currentUser) {
      setPurchasedServices([]);
      return;
    }
    
    const serviceOrdersRef = collection(db, 'serviceOrders');
    let allOrders = [];
    let hasAdditionalQuery = false;
    
    const updateOrders = async () => {
      // Remove duplicates by ID and sort by creation time
      const uniqueOrders = allOrders.filter((order, index, self) => 
        index === self.findIndex((o) => o.id === order.id)
      );
      uniqueOrders.sort((a, b) => {
        const aTime = a.timestamps?.createdAt?.toMillis?.() || 0;
        const bTime = b.timestamps?.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      
      setPurchasedServices(uniqueOrders);
      
      // Load seller data for services
      if (uniqueOrders.length > 0) {
        await loadSellerData(uniqueOrders);
      }
    };
    
    // Query 1: buyerId at root level (primary query - always works)
    const rootQuery = fsQuery(
      serviceOrdersRef,
      where('buyerId', '==', currentUser.uid),
      orderBy('timestamps.createdAt', 'desc')
    );
    
    const unsubscribeRoot = onSnapshot(rootQuery, 
      (snapshot) => {
        const orders = [];
        snapshot.forEach((doc) => {
          const orderData = doc.data();
          // Include service orders that should be visible to buyers
          const validStatuses = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'DELIVERED', 'CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'];
          if (orderData && validStatuses.includes(orderData.status)) {
            orders.push({
              id: doc.id,
              type: 'service',
              ...orderData
            });
          }
        });
        
        // Replace all orders from root source
        allOrders = allOrders.filter(order => order._source !== 'root');
        allOrders.push(...orders.map(order => ({ ...order, _source: 'root' })));
        
        // If no additional query is running, update immediately
        if (!hasAdditionalQuery) {
          updateOrders();
        }
      },
      (error) => {
        console.error('Error loading services (root buyerId):', error);
        showError('Erro ao carregar serviços comprados');
      }
    );
    
    // Query 2: Try buyerId in additionalFeatures (optional - for new structure)
    let unsubscribeFeatures = null;
    
    try {
      const featuresQuery = fsQuery(
        serviceOrdersRef,
        where('additionalFeatures.buyerId', '==', currentUser.uid),
        orderBy('timestamps.createdAt', 'desc')
      );
      
      hasAdditionalQuery = true;
      
      unsubscribeFeatures = onSnapshot(featuresQuery, 
        (snapshot) => {
          const orders = [];
          snapshot.forEach((doc) => {
            const orderData = doc.data();
            if (orderData && orderData.status !== 'CANCELLED' && orderData.status !== 'BANNED') {
              orders.push({
                id: doc.id,
                type: 'service',
                ...orderData,
                // Normalize buyerId to root for consistency
                buyerId: orderData.buyerId || orderData.additionalFeatures?.buyerId || currentUser.uid
              });
            }
          });
          
          // Replace all orders from features source
          allOrders = allOrders.filter(order => order._source !== 'features');
          allOrders.push(...orders.map(order => ({ ...order, _source: 'features' })));
          
          updateOrders();
        },
        (error) => {
          // If this query fails (missing index, permissions, etc), that's OK
          // We'll continue with just the root query
          console.warn('Additional query for additionalFeatures.buyerId failed (this is OK):', error.message);
          hasAdditionalQuery = false;
          updateOrders();
        }
      );
    } catch (error) {
      // If we can't even create the second query, that's fine
      console.warn('Could not create additionalFeatures query (this is OK):', error.message);
      hasAdditionalQuery = false;
    }
    
    return () => {
      unsubscribeRoot();
      if (unsubscribeFeatures) {
        unsubscribeFeatures();
      }
    };
  }, [currentUser, showError, loadSellerData]);

  // Setup real-time listeners for purchases
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Setup listeners
    const unsubscribePacks = loadPurchasedPacks();
    const unsubscribeServices = loadPurchasedServices();
    
    // Set loading to false after initial setup
    setTimeout(() => setLoading(false), 1000);

    // Cleanup function
    return () => {
      if (unsubscribePacks) unsubscribePacks();
      if (unsubscribeServices) unsubscribeServices();
    };
  }, [currentUser, loadPurchasedPacks, loadPurchasedServices]);

  // Check which orders can be reviewed
  useEffect(() => {
    const checkReviewPermissions = async () => {
      if (!currentUser) return;

      setCheckingPermissions(true);
      console.log('Checking review permissions for purchases...');
      const allPurchases = [...purchasedPacks, ...purchasedServices];
      console.log('Total purchases to check:', allPurchases.length);
      
      const canReviewPromises = allPurchases.map(async (purchase) => {
        if (purchase.status === 'CONFIRMED' || purchase.status === 'COMPLETED' || purchase.status === 'AUTO_RELEASED') {
          // Check if the service/pack still exists
          const itemExists = await checkItemExists(purchase);
          if (!itemExists) {
            console.log(`Item ${purchase.id} no longer exists, cannot review`);
            return { orderId: purchase.id, canReview: false };
          }
          
          const canReview = await canReviewOrder(purchase.id, purchase.type);
          console.log(`Purchase ${purchase.id} can review:`, canReview);
          return { orderId: purchase.id, canReview };
        }
        return { orderId: purchase.id, canReview: false };
      });

      const results = await Promise.all(canReviewPromises);
      const canReviewMap = {};
      results.forEach(({ orderId, canReview }) => {
        canReviewMap[orderId] = canReview;
      });
      
      console.log('Final canReviewMap:', canReviewMap);
      setCanReviewMap(canReviewMap);
      setCheckingPermissions(false);
    };

    if (purchasedPacks.length > 0 || purchasedServices.length > 0) {
      checkReviewPermissions();
    }
  }, [currentUser, purchasedPacks, purchasedServices]);

  // Check if service/pack still exists
  const checkItemExists = async (purchase) => {
    try {
      if (purchase.type === 'service') {
        const serviceRef = doc(db, 'services', purchase.serviceId);
        const serviceSnap = await getDoc(serviceRef);
        return serviceSnap.exists();
      } else if (purchase.type === 'pack') {
        const packRef = doc(db, 'packs', purchase.packId);
        const packSnap = await getDoc(packRef);
        return packSnap.exists();
      }
      return false;
    } catch (error) {
      console.error('Error checking if item exists:', error);
      return false;
    }
  };

  // Load pack data and seller data when purchases change
  useEffect(() => {
    if (purchasedPacks.length > 0 || purchasedServices.length > 0) {
      Promise.all([
        loadPackData(purchasedPacks),
        loadSellerData(purchasedServices, purchasedPacks)
      ]);
    }
  }, [purchasedPacks, purchasedServices, loadPackData, loadSellerData]);

  const handleViewService = async (serviceOrder) => {
    if (!currentUser || !serviceOrder.sellerId) return;
    
    try {
      // Create or get conversation with the service provider, passing the service order ID
      const conversation = await createOrGetConversation(serviceOrder.sellerId, serviceOrder.id);
      if (conversation) {
        // Navigate to messages with service context
        navigate(`/messages?service=${serviceOrder.id}`);
      } else {
        showError('Erro ao acessar conversa');
      }
    } catch (error) {
      console.error('Error accessing conversation:', error);
      showError('Erro ao acessar conversa');
    }
  };

  // Load secure pack data only when user has confirmed access
  const loadSecurePackData = useCallback(async (packId, orderId) => {
    try {
      // Call secure API endpoint that validates access before returning pack data
      const response = await fetch('https://vixter-react-llyd.vercel.app/api/pack-content/secure-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          packId,
          orderId,
          userId: currentUser.uid
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load secure pack data');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error loading secure pack data:', error);
      throw error;
    }
  }, [currentUser]);

  const handleViewPackContent = async (pack) => {
    // Check if pack is still pending acceptance
    if (pack.status === 'PENDING_ACCEPTANCE') {
      showError('Você só poderá visualizar as mídias após a vendedora aceitar o pedido. Aguarde a aprovação!', 'Aguardando Aprovação');
      return;
    }
    
    try {
      // Load secure pack data with access validation
      const securePackData = await loadSecurePackData(pack.packId, pack.id);
      
      setPackData(prev => ({
        ...prev,
        [pack.packId]: securePackData
      }));
      
      setViewingPack(pack);
    } catch (error) {
      console.error('Error loading secure pack data:', error);
      showError('Erro ao carregar dados do pack. Verifique se você tem acesso.', 'Erro');
    }
  };

  const handleViewServiceMedia = (service) => {
    setViewingService(service);
  };

  const handleClosePackViewer = () => {
    setViewingPack(null);
  };

  const handleCloseServiceViewer = () => {
    setViewingService(null);
  };

  // Handle service delivery confirmation
  const handleConfirmDelivery = async () => {
    if (!confirmingOrder) return;
    
    try {
      const success = await confirmServiceDelivery(confirmingOrder.id, feedback);
      if (success) {
        setConfirmingOrder(null);
        setFeedback('');
        // Reload purchases to update status
        await loadPurchasedServices();
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
    }
  };

  const handleOpenConfirmation = (order) => {
    setConfirmingOrder(order);
    setFeedback('');
  };

  const handleCloseConfirmation = () => {
    setConfirmingOrder(null);
    setFeedback('');
  };


  const handleReviewSubmitted = () => {
    // Reload purchases to update review status
    loadPurchasedPacks();
    loadPurchasedServices();
  };

  const handleOpenServicePackReview = async (order) => {
    console.log('Opening review modal for order:', order);
    console.log('Current canReviewMap:', canReviewMap);
    console.log('Can review this order:', canReviewMap[order.id]);
    
    setOpeningModal(true);
    
    try {
      // Pre-load necessary data for the modal
      const orderData = {
        ...order,
        itemName: order.type === 'service' 
          ? (order.metadata?.serviceName || 'Serviço')
          : (packData[order.packId]?.title || order.metadata?.packName || 'Pack'),
        sellerName: sellerData[order.sellerId]?.name || 'Vendedor',
        sellerPhotoURL: sellerData[order.sellerId]?.profilePicture
      };
      
      console.log('Pre-loaded order data:', orderData);
      
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setReviewingOrder(orderData);
      setShowServicePackReviewModal(true);
    } catch (error) {
      console.error('Error opening review modal:', error);
      showError('Erro ao abrir modal de avaliação');
    } finally {
      setOpeningModal(false);
    }
  };

  const handleCloseServicePackReview = () => {
    setShowServicePackReviewModal(false);
    setReviewingOrder(null);
  };

  const getFilteredPurchases = () => {
    const allPurchases = [...purchasedPacks, ...purchasedServices];
    
    switch (activeTab) {
      case 'packs':
        return purchasedPacks;
      case 'services':
        return purchasedServices;
      default:
        return allPurchases;
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Data não disponível';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatServiceStartDate = (serviceOrder) => {
    // Try to get service start date from various possible fields
    const startDate = serviceOrder.serviceStartDate || 
                     serviceOrder.timestamps?.serviceStartDate || 
                     serviceOrder.timestamps?.acceptedAt || 
                     serviceOrder.timestamps?.createdAt;
    
    if (!startDate) return 'Data não disponível';
    const date = startDate.toDate ? startDate.toDate() : new Date(startDate);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleRebuyService = (serviceOrder) => {
    // Navigate to the service detail page for customization and repurchase
    if (serviceOrder.serviceId) {
      navigate(`/service/${serviceOrder.serviceId}`);
    } else {
      showError('ID do serviço não encontrado');
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      // Status para Serviços
      case 'PENDING_ACCEPTANCE':
        return { label: 'Aguardando Aceitação', color: 'warning', icon: 'clock' };
      case 'ACCEPTED':
        return { label: 'Aceito - Em Andamento', color: 'info', icon: 'play-circle' };
      case 'DELIVERED':
        return { label: 'Entregue', color: 'primary', icon: 'truck' };
      case 'CONFIRMED':
        return { label: 'Finalizado', color: 'success', icon: 'check-circle' };
      case 'AUTO_RELEASED':
        return { label: 'Concluído', color: 'success', icon: 'check-circle' };
      case 'CANCELLED':
        return { label: 'Cancelado', color: 'danger', icon: 'times-circle' };
      case 'DISPUTED':
        return { label: 'Em Disputa', color: 'warning', icon: 'exclamation-triangle' };
      
      // Status para Packs (compra direta)
      case 'COMPLETED':
        return { label: 'Comprado', color: 'success', icon: 'check-circle' };
      case 'PENDING':
        return { label: 'Pendente', color: 'warning', icon: 'clock' };
      
      // Status de banimento
      case 'BANNED':
        return { label: 'Banido', color: 'danger', icon: 'ban' };
      
      // Status desconhecido
      default:
        return { label: status || 'Desconhecido', color: 'secondary', icon: 'question' };
    }
  };

  if (userProfile && userProfile.accountType !== 'client') {
    return (
      <div className="my-purchases-container">
        <div className="access-denied">
          <i className="fas fa-lock"></i>
          <h2>Acesso Negado</h2>
          <p>Apenas clientes podem acessar esta página.</p>
          <Link to="/" className="btn-primary">Voltar ao Início</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="my-purchases-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando suas compras...</span>
        </div>
      </div>
    );
  }

  const filteredPurchases = getFilteredPurchases();

  return (
    <div className="my-purchases-container">
      <div className="my-purchases-header">
        <h1>Minhas Compras</h1>
        <p>Gerencie seus packs e serviços comprados</p>
      </div>

      <div className="purchases-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <i className="fas fa-list"></i>
          Todos ({purchasedPacks.length + purchasedServices.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'packs' ? 'active' : ''}`}
          onClick={() => setActiveTab('packs')}
        >
          <i className="fas fa-box-open"></i>
          Packs ({purchasedPacks.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <i className="fas fa-briefcase"></i>
          Serviços ({purchasedServices.length})
        </button>
      </div>

      <div className="purchases-list">
        {filteredPurchases.length === 0 ? (
          <div className="no-purchases">
            <i className="fas fa-shopping-bag"></i>
            <h3>Nenhuma compra encontrada</h3>
            <p>
              {activeTab === 'all' 
                ? 'Você ainda não comprou nenhum pack ou serviço'
                : `Não há ${activeTab} comprados no momento`
              }
            </p>
            {activeTab === 'all' && (
              <div className="no-purchases-actions">
                <Link to="/vixies" className="btn-primary">
                  <i className="fas fa-search"></i>
                  Procurar Serviços
                </Link>
                <Link to="/vixink" className="btn-secondary">
                  <i className="fas fa-box-open"></i>
                  Ver Packs
                </Link>
              </div>
            )}
          </div>
        ) : (
          filteredPurchases.map((purchase) => {
            const statusInfo = getStatusInfo(purchase.status);
            const isService = purchase.type === 'service';
            const isPack = purchase.type === 'pack';

            const isCompleted = purchase.status === 'CONFIRMED' || purchase.status === 'COMPLETED' || purchase.status === 'AUTO_RELEASED';
            
            // Debug logs
            console.log('Purchase debug:', {
              id: purchase.id,
              status: purchase.status,
              type: purchase.type,
              isService,
              isDelivered: purchase.status === 'DELIVERED',
              coverImage: purchase.metadata?.coverImageURL || purchase.metadata?.coverImage || purchase.coverImage,
              metadata: purchase.metadata,
              fullPurchase: purchase
            });
            
            return (
              <div key={purchase.id} className={`purchase-card ${isCompleted ? 'completed' : ''}`}>
                <div className="purchase-header">
                  <div className="purchase-info">
                    <h3>
                      {isService 
                        ? (purchase.metadata?.serviceName || 'Serviço')
                        : (packData[purchase.packId]?.title || purchase.metadata?.packName || 'Pack')
                      }
                    </h3>
                    <div className="purchase-meta">
                      <span className="purchase-type">
                        <i className={`fas fa-${isService ? 'briefcase' : 'box-open'}`}></i>
                        {isService ? 'Serviço' : 'Pack'}
                      </span>
                      <span className="purchase-id">#{purchase.id.slice(-8)}</span>
                      <span className="purchase-date">{formatDate(purchase.timestamps?.createdAt)}</span>
                    </div>
                  </div>
                  <div className={`purchase-status status-${statusInfo.color}`}>
                    <i className={`fas fa-${statusInfo.icon}`}></i>
                    {statusInfo.label}
                  </div>
                </div>

                <div className="purchase-content">
                  <div className="purchase-cover">
                    {isService ? (
                      <SmartMediaViewer
                        mediaData={purchase.metadata?.coverImageURL || purchase.metadata?.coverImage || purchase.coverImage}
                        type="service"
                        watermarked={false}
                        fallbackSrc="/images/default-service.jpg"
                        alt={purchase.metadata?.serviceName || purchase.serviceName || 'Serviço'}
                        sizes="(max-width: 768px) 100px, 150px"
                      />
                    ) : (
                      <SmartMediaViewer
                        mediaData={packData[purchase.packId]?.coverImage}
                        type="pack"
                        watermarked={false}
                        fallbackSrc="/images/default-pack.jpg"
                        alt={packData[purchase.packId]?.title || 'Pack'}
                        sizes="(max-width: 768px) 100px, 150px"
                      />
                    )}
                  </div>

                  <div className="purchase-details">
                    <div className="purchase-seller">
                      <strong>Vendedor:</strong> {sellerData[purchase.sellerId]?.name || purchase.sellerName || 'Provedor'}
                      {sellerData[purchase.sellerId]?.username && (
                        <span className="seller-username">(@{sellerData[purchase.sellerId].username})</span>
                      )}
                    </div>
                    {isService && (
                      <div className="purchase-seller-username">
                        <strong>Username:</strong> @{sellerData[purchase.sellerId]?.username || purchase.sellerUsername || purchase.sellerName?.toLowerCase().replace(/\s+/g, '') || 'vendedor'}
                      </div>
                    )}
                    <div className="purchase-amount">
                      <strong>Valor:</strong> {purchase.vpAmount} VP
                    </div>
                    {isService && (
                      <div className="purchase-service-start">
                        <strong>Início do Serviço:</strong> {formatServiceStartDate(purchase)}
                      </div>
                    )}
                    {isService && purchase.deliveryNotes && (
                      <div className="purchase-notes">
                        <strong>Notas de Entrega:</strong>
                        <p>{purchase.deliveryNotes}</p>
                      </div>
                    )}
                    {isService && purchase.buyerFeedback && (
                      <div className="purchase-feedback">
                        <strong>Seu Feedback:</strong>
                        <p>{purchase.buyerFeedback}</p>
                      </div>
                    )}
                    {purchase.cancellationReason && (
                      <div className="purchase-cancellation">
                        <strong>Motivo do Cancelamento:</strong>
                        <p>{purchase.cancellationReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="purchase-actions">
                  {isService && (
                    <>
                      <button 
                        className={`btn-primary ${isCompleted ? 'disabled' : ''}`}
                        onClick={() => !isCompleted && handleViewService(purchase)}
                        disabled={isCompleted}
                        title={isCompleted ? 'Serviço concluído - Conversa finalizada' : 'Ver conversa do serviço'}
                      >
                        <i className="fas fa-comments"></i>
                        {isCompleted ? 'Serviço Concluído' : 'Ver Serviço'}
                      </button>
                      {purchase.status === 'DELIVERED' && (
                        <button 
                          className="btn-confirm"
                          onClick={() => handleOpenConfirmation(purchase)}
                        >
                          <i className="fas fa-check-circle"></i>
                          Confirmar Recebimento
                        </button>
                      )}
                      {isCompleted && (
                        <>
                          <button 
                            className="btn-rebuy"
                            onClick={() => handleRebuyService(purchase)}
                          >
                            <i className="fas fa-redo"></i>
                            Comprar Novamente
                          </button>
                          {canReviewMap[purchase.id] && (
                            <>
                              <button 
                                className="btn-review-service"
                                onClick={() => handleOpenServicePackReview(purchase)}
                                disabled={checkingPermissions || openingModal}
                              >
                                <i className={`fas ${openingModal ? 'fa-spinner fa-spin' : 'fa-star'}`}></i>
                                {checkingPermissions ? 'Verificando...' : openingModal ? 'Abrindo...' : 'Avaliar Serviço'}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                  
                  {isPack && (
                    <>
                      {purchase.status === 'PENDING_ACCEPTANCE' && (
                        <div className="pack-warning">
                          <i className="fas fa-exclamation-triangle"></i>
                          <div className="warning-content">
                            <strong>Pack pendente de aprovação</strong>
                            <p>A vendedora tem até 24h para aceitar seu pedido. Você só poderá visualizar as mídias após a aprovação.</p>
                            <p><strong>Política de Reembolso:</strong> Caso a vendedora recuse o pedido, você receberá reembolso automático.</p>
                          </div>
                        </div>
                      )}
                      <button 
                        className="btn-primary"
                        onClick={() => handleViewPackContent(purchase)}
                      >
                        <i className="fas fa-images"></i>
                        Ver Mídias
                      </button>
                      {isCompleted && canReviewMap[purchase.id] && (
                        <>
                          <button 
                            className="btn-review-service"
                            onClick={() => handleOpenServicePackReview(purchase)}
                            disabled={checkingPermissions || openingModal}
                          >
                            <i className={`fas ${openingModal ? 'fa-spinner fa-spin' : 'fa-star'}`}></i>
                            {checkingPermissions ? 'Verificando...' : openingModal ? 'Abrindo...' : 'Avaliar Pack'}
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {purchase.status === 'COMPLETED' && (
                    <div className="purchase-completed-info">
                      <i className="fas fa-check-circle"></i>
                      <span>Compra concluída com sucesso!</span>
                    </div>
                  )}

                  {purchase.status === 'CANCELLED' && (
                    <div className="purchase-cancelled-info">
                      <i className="fas fa-times-circle"></i>
                      <span>Compra cancelada - Valor devolvido</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pack Content Viewer */}
      {viewingPack && (
        <PackContentViewer
          pack={{
            ...packData[viewingPack.packId],
            id: viewingPack.packId
          }}
          orderId={viewingPack.id}
          vendorInfo={{
            name: sellerData[viewingPack.sellerId]?.name || 'Provedor',
            username: sellerData[viewingPack.sellerId]?.username || 'provedor'
          }}
          onClose={handleClosePackViewer}
        />
      )}

      {/* Service Media Viewer */}
      {viewingService && (
        <ServiceMediaViewer
          service={viewingService}
          onClose={handleCloseServiceViewer}
        />
      )}

      {/* Delivery Confirmation Modal */}
      {confirmingOrder && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Confirmar Recebimento do Serviço</h3>
              <button 
                className="modal-close"
                onClick={handleCloseConfirmation}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                O vendedor marcou o serviço <strong>"{confirmingOrder.metadata?.serviceName || 'Serviço'}"</strong> como entregue.
              </p>
              <p>
                Confirme que você recebeu o serviço conforme combinado para liberar o pagamento ao vendedor.
              </p>
              <div className="form-group">
                <label htmlFor="feedback">Feedback (opcional):</label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Deixe um comentário sobre o serviço recebido..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={handleCloseConfirmation}
                disabled={processing}
              >
                Cancelar
              </button>
              <button 
                className="btn-confirm"
                onClick={handleConfirmDelivery}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Confirmando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle"></i>
                    Confirmar Recebimento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Loading overlay for modal opening */}
      {openingModal && (
        <div className="modal-loading-overlay">
          <div className="modal-loading-content">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Preparando avaliação...</p>
          </div>
        </div>
      )}

      {/* Service/Pack Review Modal */}
      {showServicePackReviewModal && reviewingOrder && (
        <ServicePackReviewModal
          isOpen={showServicePackReviewModal}
          onClose={handleCloseServicePackReview}
          orderId={reviewingOrder.id}
          orderType={reviewingOrder.type}
          itemName={reviewingOrder.itemName || 'Item'}
          sellerName={reviewingOrder.sellerName || 'Vendedor'}
          sellerPhotoURL={reviewingOrder.sellerPhotoURL}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  );
};

export default MyPurchases;
