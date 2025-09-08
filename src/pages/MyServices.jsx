import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { useNotification } from '../contexts/NotificationContext';
import { Link } from 'react-router-dom';
import './MyServices.css';

const MyServices = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { 
    receivedOrders, 
    loading, 
    processing,
    acceptServiceOrder,
    declineServiceOrder,
    markServiceDelivered,
    getOrderStatusInfo,
    ORDER_STATUS
  } = useServiceOrder();
  const { showNotification } = useNotification();
  
  const [activeTab, setActiveTab] = useState('pending');
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
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

  const handleAcceptOrder = async (orderId) => {
    const success = await acceptServiceOrder(orderId);
    if (success) {
      showNotification('Pedido aceito com sucesso!', 'success');
    }
  };

  const handleDeclineOrder = async () => {
    if (!selectedOrderId) return;
    
    const success = await declineServiceOrder(selectedOrderId, declineReason);
    if (success) {
      setShowDeclineModal(false);
      setDeclineReason('');
      setSelectedOrderId(null);
    }
  };

  const handleMarkDelivered = async () => {
    if (!selectedOrderId) return;
    
    const success = await markServiceDelivered(selectedOrderId, deliveryNotes);
    if (success) {
      setShowDeliveryModal(false);
      setDeliveryNotes('');
      setSelectedOrderId(null);
    }
  };

  const openDeclineModal = (orderId) => {
    setSelectedOrderId(orderId);
    setShowDeclineModal(true);
  };

  const openDeliveryModal = (orderId) => {
    setSelectedOrderId(orderId);
    setShowDeliveryModal(true);
  };

  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'pending':
        return receivedOrders.filter(order => order.status === ORDER_STATUS.PENDING_ACCEPTANCE);
      case 'accepted':
        return receivedOrders.filter(order => order.status === ORDER_STATUS.ACCEPTED);
      case 'delivered':
        return receivedOrders.filter(order => order.status === ORDER_STATUS.DELIVERED);
      case 'completed':
        return receivedOrders.filter(order => 
          order.status === ORDER_STATUS.CONFIRMED || 
          order.status === ORDER_STATUS.AUTO_RELEASED
        );
      case 'cancelled':
        return receivedOrders.filter(order => order.status === ORDER_STATUS.CANCELLED);
      default:
        return receivedOrders;
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(amount);
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

  if (loading) {
    return (
      <div className="my-services-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando serviços...</span>
        </div>
      </div>
    );
  }

  const filteredOrders = getFilteredOrders();

  return (
    <div className="my-services-container">
      <div className="my-services-header">
        <h1>Meus Serviços</h1>
        <p>Gerencie seus pedidos de serviços</p>
      </div>

      <div className="services-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <i className="fas fa-clock"></i>
          Pendentes ({receivedOrders.filter(o => o.status === ORDER_STATUS.PENDING_ACCEPTANCE).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'accepted' ? 'active' : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          <i className="fas fa-check"></i>
          Aceitos ({receivedOrders.filter(o => o.status === ORDER_STATUS.ACCEPTED).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'delivered' ? 'active' : ''}`}
          onClick={() => setActiveTab('delivered')}
        >
          <i className="fas fa-truck"></i>
          Entregues ({receivedOrders.filter(o => o.status === ORDER_STATUS.DELIVERED).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <i className="fas fa-check-circle"></i>
          Concluídos ({receivedOrders.filter(o => 
            o.status === ORDER_STATUS.CONFIRMED || o.status === ORDER_STATUS.AUTO_RELEASED
          ).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          <i className="fas fa-times-circle"></i>
          Cancelados ({receivedOrders.filter(o => o.status === ORDER_STATUS.CANCELLED).length})
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
            const statusInfo = getOrderStatusInfo(order.status);
            const isPending = order.status === ORDER_STATUS.PENDING_ACCEPTANCE;
            const isAccepted = order.status === ORDER_STATUS.ACCEPTED;
            const isDelivered = order.status === ORDER_STATUS.DELIVERED;

            return (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div className="order-info">
                    <h3>{order.metadata?.serviceName || 'Serviço'}</h3>
                    <div className="order-meta">
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
                    <strong>Cliente:</strong> {order.buyerName || 'Cliente'}
                  </div>
                  <div className="order-amount">
                    <strong>Valor:</strong> {formatCurrency(order.vpAmount)} VP
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
                        onClick={() => handleAcceptOrder(order.id)}
                        disabled={processing}
                      >
                        <i className="fas fa-check"></i>
                        Aceitar
                      </button>
                      <button 
                        className="btn-danger"
                        onClick={() => openDeclineModal(order.id)}
                        disabled={processing}
                      >
                        <i className="fas fa-times"></i>
                        Recusar
                      </button>
                    </>
                  )}
                  
                  {isAccepted && (
                    <button 
                      className="btn-primary"
                      onClick={() => openDeliveryModal(order.id)}
                      disabled={processing}
                    >
                      <i className="fas fa-truck"></i>
                      Marcar como Entregue
                    </button>
                  )}

                  <Link 
                    to={`/messages?service=${order.id}`}
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
                onClick={() => setShowDeclineModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-danger"
                onClick={handleDeclineOrder}
                disabled={processing}
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
                onClick={() => setShowDeliveryModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleMarkDelivered}
                disabled={processing}
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

export default MyServices;
