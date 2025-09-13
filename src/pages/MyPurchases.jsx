import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { collection, query as fsQuery, where, orderBy, getDocs } from 'firebase/firestore';
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
  const navigate = useNavigate();
  
  const [purchasedPacks, setPurchasedPacks] = useState([]);
  const [purchasedServices, setPurchasedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [sellerData, setSellerData] = useState({});
  const [viewingPack, setViewingPack] = useState(null);
  const [viewingService, setViewingService] = useState(null);
  const [confirmingOrder, setConfirmingOrder] = useState(null);
  const [feedback, setFeedback] = useState('');

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
      const packOrdersRef = collection(db, 'packOrders');
      const queryRef = fsQuery(
        packOrdersRef,
        where('buyerId', '==', currentUser.uid),
        orderBy('timestamps.createdAt', 'desc')
      );
      const snapshot = await getDocs(queryRef);
      
      const orders = [];
      snapshot.forEach((doc) => {
        const orderData = doc.data();
        if (orderData && orderData.status !== 'CANCELLED' && orderData.status !== 'BANNED') {
          orders.push({
            id: doc.id,
            type: 'pack',
            ...orderData
          });
        }
      });
      
      setPurchasedPacks(orders);
    } catch (error) {
      console.error('Error loading purchased packs:', error);
      showError('Erro ao carregar packs comprados');
    }
  }, [currentUser, showError]);

  // Load seller data for services
  const loadSellerData = useCallback(async (services) => {
    const sellerIds = [...new Set(services.map(service => service.sellerId).filter(Boolean))];
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

  // Load purchased services
  const loadPurchasedServices = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const serviceOrdersRef = collection(db, 'serviceOrders');
      const queryRef = fsQuery(
        serviceOrdersRef,
        where('buyerId', '==', currentUser.uid),
        orderBy('timestamps.createdAt', 'desc')
      );
      const snapshot = await getDocs(queryRef);
      
      const orders = [];
      snapshot.forEach((doc) => {
        const orderData = doc.data();
        if (orderData && orderData.status !== 'CANCELLED' && orderData.status !== 'BANNED') {
          orders.push({
            id: doc.id,
            type: 'service',
            ...orderData
          });
        }
      });
      
      setPurchasedServices(orders);
      
      // Load seller data for services
      if (orders.length > 0) {
        await loadSellerData(orders);
      }
    } catch (error) {
      console.error('Error loading purchased services:', error);
      showError('Erro ao carregar serviços comprados');
    }
  }, [currentUser, showError, loadSellerData]);

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
            
            return (
              <div key={purchase.id} className={`purchase-card ${isCompleted ? 'completed' : ''}`}>
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
                        mediaData={purchase.metadata?.coverImageURL || purchase.metadata?.coverImage || purchase.coverImage}
                        type="service"
                        watermarked={false}
                        fallbackSrc="/images/default-service.jpg"
                        alt={purchase.metadata?.serviceName || purchase.serviceName || 'Serviço'}
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
                      <strong>Vendedor:</strong> {sellerData[purchase.sellerId]?.name || purchase.sellerName || 'Provedor'}
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
                      className="btn-primary"
                      onClick={() => handleViewPackContent(purchase.pack)}
                    >
                      <i className="fas fa-images"></i>
                      Ver Mídias
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
    </div>
  );
};

export default MyPurchases;
