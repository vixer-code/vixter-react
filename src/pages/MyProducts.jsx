import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { usePackOrder } from '../contexts/PackOrderContext';
import { useNotification } from '../contexts/NotificationContext';
import { useBuyerData } from '../hooks/useBuyerData';
import { Link } from 'react-router-dom';
import './MyProducts.css';

const MyProducts = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { 
    receivedOrders: serviceOrders, 
    loading: serviceLoading, 
    processing: serviceProcessing,
    acceptServiceOrder,
    declineServiceOrder,
    markServiceDelivered,
    getOrderStatusInfo: getServiceStatusInfo,
    ORDER_STATUS: SERVICE_ORDER_STATUS
  } = useServiceOrder();
  const { 
    receivedOrders: packOrders, 
    loading: packLoading, 
    processing: packProcessing,
    acceptPackOrder,
    declinePackOrder,
    markPackDelivered,
    getOrderStatusInfo: getPackStatusInfo,
    ORDER_STATUS: PACK_ORDER_STATUS
  } = usePackOrder();
  const { showNotification } = useNotification();

  // Fallback constants in case contexts haven't loaded yet
  const SERVICE_STATUS = SERVICE_ORDER_STATUS || {
    PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
    ACCEPTED: 'ACCEPTED',
    DELIVERED: 'DELIVERED',
    CONFIRMED: 'CONFIRMED',
    AUTO_RELEASED: 'AUTO_RELEASED',
    CANCELLED: 'CANCELLED'
  };
  
  const PACK_STATUS = PACK_ORDER_STATUS || {
    PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
    ACCEPTED: 'ACCEPTED',
    DELIVERED: 'DELIVERED',
    CONFIRMED: 'CONFIRMED',
    AUTO_RELEASED: 'AUTO_RELEASED',
    CANCELLED: 'CANCELLED'
  };
  
  const [activeTab, setActiveTab] = useState('pending');
  const [productType, setProductType] = useState('all'); // 'all', 'services', 'packs'
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderType, setSelectedOrderType] = useState(null); // 'service' or 'pack'
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Redirect if not a provider
  useEffect(() => {
    if (userProfile && userProfile.accountType !== 'provider') {
      showNotification('Apenas provedores podem acessar esta página', 'warning');
      // Redirect to home or appropriate page
      window.location.href = '/';
    }
  }, [userProfile, showNotification]);

  const handleAcceptOrder = async (orderId, orderType) => {
    let success = false;
    if (orderType === 'service') {
      success = await acceptServiceOrder(orderId);
    } else if (orderType === 'pack') {
      success = await acceptPackOrder(orderId);
    }
    
    if (success) {
      showNotification('Pedido aceito com sucesso!', 'success');
    }
  };

  const handleDeclineOrder = async () => {
    if (!selectedOrderId || !selectedOrderType) return;
    
    let success = false;
    if (selectedOrderType === 'service') {
      success = await declineServiceOrder(selectedOrderId, declineReason);
    } else if (selectedOrderType === 'pack') {
      success = await declinePackOrder(selectedOrderId, declineReason);
    }
    
    if (success) {
      setShowDeclineModal(false);
      setDeclineReason('');
      setSelectedOrderId(null);
      setSelectedOrderType(null);
    }
  };

  const handleMarkDelivered = async () => {
    if (!selectedOrderId || !selectedOrderType) return;
    
    let success = false;
    if (selectedOrderType === 'service') {
      success = await markServiceDelivered(selectedOrderId, deliveryNotes);
    } else if (selectedOrderType === 'pack') {
      success = await markPackDelivered(selectedOrderId, deliveryNotes);
    }
    
    if (success) {
      setShowDeliveryModal(false);
      setDeliveryNotes('');
      setSelectedOrderId(null);
      setSelectedOrderType(null);
    }
  };

  const openDeclineModal = (orderId, orderType) => {
    setSelectedOrderId(orderId);
    setSelectedOrderType(orderType);
    setShowDeclineModal(true);
  };

  const openDeliveryModal = (orderId, orderType) => {
    setSelectedOrderId(orderId);
    setSelectedOrderType(orderType);
    setShowDeliveryModal(true);
  };

  const getAllOrders = () => {
    // Combine service and pack orders
    return [
      ...(serviceOrders || []).map(order => ({ ...order, type: 'service' })),
      ...(packOrders || []).map(order => ({ ...order, type: 'pack' }))
    ];
  };

  // Use the buyer data hook to enrich orders with buyer information
  const { enrichedOrders: enrichedServiceOrders, loading: serviceBuyerLoading } = useBuyerData(
    serviceOrders || [], 
    true // auto-enrich
  );
  
  const { enrichedOrders: enrichedPackOrders, loading: packBuyerLoading } = useBuyerData(
    packOrders || [], 
    true // auto-enrich
  );

  const getAllOrdersWithBuyerData = () => {
    // Combine enriched service and pack orders
    return [
      ...(enrichedServiceOrders || []).map(order => ({ ...order, type: 'service' })),
      ...(enrichedPackOrders || []).map(order => ({ ...order, type: 'pack' }))
    ];
  };

  const getFilteredOrders = () => {
    // Use enriched orders with buyer data
    const allOrders = getAllOrdersWithBuyerData();

    // Filter by product type first
    let filteredByType = allOrders;
    if (productType === 'services') {
      filteredByType = allOrders.filter(order => order.type === 'service');
    } else if (productType === 'packs') {
      filteredByType = allOrders.filter(order => order.type === 'pack');
    }

    // Then filter by status
    switch (activeTab) {
      case 'pending':
        return filteredByType.filter(order => 
          order.status === SERVICE_STATUS.PENDING_ACCEPTANCE || 
          order.status === PACK_STATUS.PENDING_ACCEPTANCE
        );
      case 'accepted':
        return filteredByType.filter(order => 
          order.status === SERVICE_STATUS.ACCEPTED || 
          order.status === PACK_STATUS.ACCEPTED
        );
      case 'delivered':
        return filteredByType.filter(order => 
          order.status === SERVICE_STATUS.DELIVERED || 
          order.status === PACK_STATUS.DELIVERED
        );
      case 'completed':
        return filteredByType.filter(order => 
          order.status === SERVICE_STATUS.CONFIRMED || 
          order.status === SERVICE_STATUS.AUTO_RELEASED ||
          order.status === PACK_STATUS.CONFIRMED || 
          order.status === PACK_STATUS.AUTO_RELEASED
        );
      case 'cancelled':
        return filteredByType.filter(order => 
          order.status === SERVICE_STATUS.CANCELLED || 
          order.status === PACK_STATUS.CANCELLED
        );
      default:
        return filteredByType;
    }
  };

  // Get counts for each status tab
  const getStatusCounts = () => {
    // Use enriched orders with buyer data
    const allOrders = getAllOrdersWithBuyerData();
    
    // Filter by product type first
    let filteredByType = allOrders;
    if (productType === 'services') {
      filteredByType = allOrders.filter(order => order.type === 'service');
    } else if (productType === 'packs') {
      filteredByType = allOrders.filter(order => order.type === 'pack');
    }

    return {
      pending: filteredByType.filter(order => 
        order.status === SERVICE_STATUS.PENDING_ACCEPTANCE || 
        order.status === PACK_STATUS.PENDING_ACCEPTANCE
      ).length,
      accepted: filteredByType.filter(order => 
        order.status === SERVICE_STATUS.ACCEPTED || 
        order.status === PACK_STATUS.ACCEPTED
      ).length,
      delivered: filteredByType.filter(order => 
        order.status === SERVICE_STATUS.DELIVERED || 
        order.status === PACK_STATUS.DELIVERED
      ).length,
      completed: filteredByType.filter(order => 
        order.status === SERVICE_STATUS.CONFIRMED || 
        order.status === SERVICE_STATUS.AUTO_RELEASED ||
        order.status === PACK_STATUS.CONFIRMED || 
        order.status === PACK_STATUS.AUTO_RELEASED
      ).length,
      cancelled: filteredByType.filter(order => 
        order.status === SERVICE_STATUS.CANCELLED || 
        order.status === PACK_STATUS.CANCELLED
      ).length
    };
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

  const formatCurrency = (amount) => {
    // Convert VP to VC for display (1 VC = 1.5 VP)
    const vcAmount = Math.round(amount / 1.5);
    return `${vcAmount} VC`;
  };

  if (userProfile && userProfile.accountType !== 'provider') {
    return (
      <div className="my-services-container">
        <div className="access-denied">
          <i className="fas fa-lock"></i>
          <h2>Acesso Negado</h2>
          <p>Apenas provedores podem acessar esta página.</p>
          <Link to="/" className="btn-primary">Voltar ao Início</Link>
        </div>
      </div>
    );
  }

  if (serviceLoading || packLoading || serviceBuyerLoading || packBuyerLoading) {
    return (
      <div className="my-services-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando produtos...</span>
        </div>
      </div>
    );
  }

  const filteredOrders = getFilteredOrders();
  const statusCounts = getStatusCounts();

  // Debug: Log order structure to understand available fields
  if (filteredOrders.length > 0) {
    console.log('Sample order structure:', filteredOrders[0]);
  }

  return (
    <div className="my-services-container">
      <div className="my-services-header">
        <h1>Meus Produtos</h1>
        <p>Gerencie seus pedidos de serviços e packs</p>
      </div>

      {/* Product Type Tabs */}
      <div className="product-type-tabs">
        <button 
          className={`tab-btn ${productType === 'all' ? 'active' : ''}`}
          onClick={() => setProductType('all')}
        >
          <i className="fas fa-list"></i>
          Todos ({(serviceOrders || []).length + (packOrders || []).length})
        </button>
        <button 
          className={`tab-btn ${productType === 'services' ? 'active' : ''}`}
          onClick={() => setProductType('services')}
        >
          <i className="fas fa-briefcase"></i>
          Serviços ({(serviceOrders || []).length})
        </button>
        <button 
          className={`tab-btn ${productType === 'packs' ? 'active' : ''}`}
          onClick={() => setProductType('packs')}
        >
          <i className="fas fa-box-open"></i>
          Packs ({(packOrders || []).length})
        </button>
      </div>

      {/* Status Tabs */}
      <div className="services-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <i className="fas fa-clock"></i>
          Pendentes ({statusCounts.pending})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'accepted' ? 'active' : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          <i className="fas fa-check"></i>
          Aceitos ({statusCounts.accepted})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'delivered' ? 'active' : ''}`}
          onClick={() => setActiveTab('delivered')}
        >
          <i className="fas fa-truck"></i>
          Entregues ({statusCounts.delivered})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <i className="fas fa-check-circle"></i>
          Concluídos ({statusCounts.completed})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          <i className="fas fa-times-circle"></i>
          Cancelados ({statusCounts.cancelled})
        </button>
      </div>

      <div className="orders-list">
        {filteredOrders.length === 0 ? (
          <div className="no-orders">
            <i className="fas fa-inbox"></i>
            <h3>Nenhum pedido encontrado</h3>
            <p>
              {activeTab === 'pending' 
                ? 'Não há pedidos pendentes no momento'
                : `Não há pedidos ${activeTab} no momento`
              }
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isService = order.type === 'service';
            const isPack = order.type === 'pack';
            
            const statusInfo = isService ? 
              getServiceStatusInfo(order.status) : 
              getPackStatusInfo(order.status);
              
            const isPending = order.status === SERVICE_STATUS.PENDING_ACCEPTANCE || 
                             order.status === PACK_STATUS.PENDING_ACCEPTANCE;
            const isAccepted = order.status === SERVICE_STATUS.ACCEPTED || 
                              order.status === PACK_STATUS.ACCEPTED;
            const isDelivered = order.status === SERVICE_STATUS.DELIVERED || 
                               order.status === PACK_STATUS.DELIVERED;

            return (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div className="order-info">
                    <h3>
                      {isService 
                        ? (order.metadata?.serviceName || 'Serviço')
                        : (order.packData?.title || order.metadata?.packName || 'Pack')
                      }
                    </h3>
                    <div className="order-meta">
                      <span className="order-type">
                        <i className={`fas fa-${isService ? 'briefcase' : 'box-open'}`}></i>
                        {isService ? 'Serviço' : 'Pack'}
                      </span>
                      <span className="order-id">#{order.id.slice(-8)}</span>
                      <span className="order-date">{formatDate(order.timestamps?.createdAt)}</span>
                    </div>
                  </div>
                  <div className={`order-status status-${statusInfo.color}`}>
                    <i className={`fas fa-${statusInfo.icon}`}></i>
                    {statusInfo.label}
                  </div>
                </div>

                <div className="order-details">
                  <div className="order-client">
                    <strong>Cliente:</strong> 
                    <Link 
                      to={`/profile/${order.buyerUsername || order.buyerName?.toLowerCase().replace(/\s+/g, '') || order.buyerId || 'usuario'}`}
                      className="client-link"
                    >
                      {order.buyerName || order.buyerDisplayName || order.buyerUsername || 'Cliente'}
                    </Link>
                  </div>
                  <div className="order-client-username">
                    <strong>Username:</strong> 
                    <Link 
                      to={`/profile/${order.buyerUsername || order.buyerName?.toLowerCase().replace(/\s+/g, '') || order.buyerId || 'usuario'}`}
                      className="username-link"
                    >
                      @{order.buyerUsername || order.buyerName?.toLowerCase().replace(/\s+/g, '') || order.buyerId || 'usuario'}
                    </Link>
                  </div>
                  <div className="order-amount">
                    <strong>Valor:</strong> {formatCurrency(order.vpAmount)}
                  </div>
                  {order.additionalFeatures && order.additionalFeatures.length > 0 && (
                    <div className="order-features">
                      <strong>Recursos Adicionais:</strong>
                      <ul>
                        {order.additionalFeatures.map((feature, index) => (
                          <li key={index}>
                            {feature.name} - {formatCurrency(feature.price)} VP
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {order.deliveryNotes && (
                    <div className="order-notes">
                      <strong>Notas de Entrega:</strong>
                      <p>{order.deliveryNotes}</p>
                    </div>
                  )}
                  {order.buyerFeedback && (
                    <div className="order-feedback">
                      <strong>Feedback do Cliente:</strong>
                      <p>{order.buyerFeedback}</p>
                    </div>
                  )}
                </div>

                <div className="order-actions">
                  {isPending && (
                    <>
                      <button 
                        className="btn-success"
                        onClick={() => handleAcceptOrder(order.id, order.type)}
                        disabled={serviceProcessing || packProcessing}
                      >
                        <i className="fas fa-check"></i>
                        Aceitar
                      </button>
                      <button 
                        className="btn-danger"
                        onClick={() => openDeclineModal(order.id, order.type)}
                        disabled={serviceProcessing || packProcessing}
                      >
                        <i className="fas fa-times"></i>
                        Recusar
                      </button>
                    </>
                  )}
                  
                  {isAccepted && (
                    <button 
                      className="btn-primary"
                      onClick={() => openDeliveryModal(order.id, order.type)}
                      disabled={serviceProcessing || packProcessing}
                    >
                      <i className="fas fa-truck"></i>
                      Marcar como Entregue
                    </button>
                  )}

                  <Link 
                    to={`/messages?${isService ? 'service' : 'pack'}=${order.id}`}
                    className="btn-secondary"
                  >
                    <i className="fas fa-comments"></i>
                    Conversa
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Recusar Pedido</h3>
            <p>Por favor, informe o motivo da recusa:</p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Motivo da recusa..."
              rows="4"
            />
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowDeclineModal(false);
                  setSelectedOrderId(null);
                  setSelectedOrderType(null);
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-danger"
                onClick={handleDeclineOrder}
                disabled={serviceProcessing || packProcessing}
              >
                Recusar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Marcar como Entregue</h3>
            <p>Adicione notas sobre a entrega (opcional):</p>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Notas sobre a entrega..."
              rows="4"
            />
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowDeliveryModal(false);
                  setSelectedOrderId(null);
                  setSelectedOrderType(null);
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleMarkDelivered}
                disabled={serviceProcessing || packProcessing}
              >
                Marcar como Entregue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProducts;
