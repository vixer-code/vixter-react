import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../../config/firebase';
import { Link, useNavigate } from 'react-router-dom';
import SmartMediaViewer from '../components/SmartMediaViewer';
import PackContentViewer from '../components/PackContentViewer';
import ServiceMediaViewer from '../components/ServiceMediaViewer';
import CachedImage from '../components/CachedImage';
import './MyPurchases.css';

const MyPurchases = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { showError, showSuccess } = useNotification();
  const { createOrGetConversation } = useEnhancedMessaging();
  const navigate = useNavigate();
  
  const [purchasedPacks, setPurchasedPacks] = useState([]);
  const [purchasedServices, setPurchasedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [viewingPack, setViewingPack] = useState(null);
  const [viewingService, setViewingService] = useState(null);

  // Redirect if not a client
  useEffect(() => {
    if (userProfile && userProfile.accountType !== 'client') {
      showError('Apenas clientes podem acessar esta página');
      navigate('/');
    }
  }, [userProfile, showError, navigate]);

  // Load purchased packs
  const loadPurchasedPacks = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const packOrdersRef = ref(database, 'packOrders');
      const queryRef = query(packOrdersRef, orderByChild('buyerId'), equalTo(currentUser.uid));
      const snapshot = await get(queryRef);
      
      if (snapshot.exists()) {
        const orders = [];
        snapshot.forEach((childSnapshot) => {
          const orderData = childSnapshot.val();
          if (orderData && orderData.status !== 'CANCELLED' && orderData.status !== 'BANNED') {
            orders.push({
              id: childSnapshot.key,
              type: 'pack',
              ...orderData
            });
          }
        });
        
        // Sort by purchase date (newest first)
        orders.sort((a, b) => (b.timestamps?.createdAt || 0) - (a.timestamps?.createdAt || 0));
        setPurchasedPacks(orders);
      } else {
        setPurchasedPacks([]);
      }
    } catch (error) {
      console.error('Error loading purchased packs:', error);
      showError('Erro ao carregar packs comprados');
    }
  }, [currentUser, showError]);

  // Load purchased services
  const loadPurchasedServices = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const serviceOrdersRef = ref(database, 'serviceOrders');
      const queryRef = query(serviceOrdersRef, orderByChild('buyerId'), equalTo(currentUser.uid));
      const snapshot = await get(queryRef);
      
      if (snapshot.exists()) {
        const orders = [];
        snapshot.forEach((childSnapshot) => {
          const orderData = childSnapshot.val();
          if (orderData && orderData.status !== 'CANCELLED' && orderData.status !== 'BANNED') {
            orders.push({
              id: childSnapshot.key,
              type: 'service',
              ...orderData
            });
          }
        });
        
        // Sort by purchase date (newest first)
        orders.sort((a, b) => (b.timestamps?.createdAt || 0) - (a.timestamps?.createdAt || 0));
        setPurchasedServices(orders);
      } else {
        setPurchasedServices([]);
      }
    } catch (error) {
      console.error('Error loading purchased services:', error);
      showError('Erro ao carregar serviços comprados');
    }
  }, [currentUser, showError]);

  // Load all purchases
  useEffect(() => {
    const loadPurchases = async () => {
      setLoading(true);
      await Promise.all([
        loadPurchasedPacks(),
        loadPurchasedServices()
      ]);
      setLoading(false);
    };

    if (currentUser) {
      loadPurchases();
    }
  }, [currentUser, loadPurchasedPacks, loadPurchasedServices]);

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

  const handleViewPackContent = (pack) => {
    setViewingPack(pack);
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
      case 'COMPLETED':
        return { label: 'Comprado', color: 'success', icon: 'check-circle' };
      case 'PENDING':
        return { label: 'Pendente', color: 'warning', icon: 'clock' };
      case 'ACCEPTED':
        return { label: 'Em Andamento', color: 'info', icon: 'play-circle' };
      case 'DELIVERED':
        return { label: 'Entregue', color: 'primary', icon: 'truck' };
      case 'CONFIRMED':
        return { label: 'Finalizado', color: 'success', icon: 'check-circle' };
      case 'CANCELLED':
        return { label: 'Cancelado', color: 'danger', icon: 'times-circle' };
      case 'BANNED':
        return { label: 'Banido', color: 'danger', icon: 'ban' };
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

            return (
              <div key={purchase.id} className="purchase-card">
                <div className="purchase-header">
                  <div className="purchase-info">
                    <h3>
                      {isService 
                        ? (purchase.metadata?.serviceName || 'Serviço')
                        : (purchase.packData?.title || 'Pack')
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
                        mediaData={purchase.metadata?.coverImageURL || purchase.metadata?.coverImage}
                        type="service"
                        watermarked={false}
                        fallbackSrc="/images/default-service.jpg"
                        alt={purchase.metadata?.serviceName || 'Serviço'}
                        sizes="(max-width: 768px) 100px, 150px"
                      />
                    ) : (
                      <SmartMediaViewer
                        mediaData={purchase.packData?.coverImage}
                        type="pack"
                        watermarked={false}
                        fallbackSrc="/images/default-pack.jpg"
                        alt={purchase.packData?.title || 'Pack'}
                        sizes="(max-width: 768px) 100px, 150px"
                      />
                    )}
                  </div>

                  <div className="purchase-details">
                    <div className="purchase-seller">
                      <strong>Vendedor:</strong> {purchase.sellerName || 'Provedor'}
                    </div>
                    {isService && (
                      <div className="purchase-seller-username">
                        <strong>Username:</strong> @{purchase.sellerUsername || purchase.sellerName?.toLowerCase().replace(/\s+/g, '') || 'vendedor'}
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
                        className="btn-primary"
                        onClick={() => handleViewService(purchase)}
                      >
                        <i className="fas fa-comments"></i>
                        Ver Serviço
                      </button>
                      <button 
                        className="btn-secondary"
                        onClick={() => handleViewServiceMedia(purchase.service)}
                      >
                        <i className="fas fa-images"></i>
                        Ver Mídias
                      </button>
                      {(purchase.status === 'CONFIRMED' || purchase.status === 'COMPLETED') && (
                        <button 
                          className="btn-rebuy"
                          onClick={() => handleRebuyService(purchase)}
                        >
                          <i className="fas fa-redo"></i>
                          Comprar Novamente
                        </button>
                      )}
                    </>
                  )}
                  
                  {isPack && (
                    <button 
                      className="btn-secondary"
                      onClick={() => handleViewPackContent(purchase.pack)}
                    >
                      <i className="fas fa-eye"></i>
                      Ver Conteúdo
                    </button>
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
          pack={viewingPack}
          orderId={viewingPack.orderId}
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
    </div>
  );
};

export default MyPurchases;
