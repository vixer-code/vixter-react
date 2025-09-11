import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import './ServiceOrders.css';

const ServiceOrders = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { 
    serviceOrders, 
    receivedOrders, 
    sentOrders, 
    loading, 
    processing,
    acceptServiceOrder,
    declineServiceOrder,
    markServiceDelivered,
    confirmServiceDelivery,
    ORDER_STATUS,
    getOrderStatusInfo
  } = useServiceOrder();
  const { showError, showSuccess } = useNotification();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('received');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      showError('Você precisa estar logado para acessar esta página');
      navigate('/login');
    }
  }, [currentUser, showError, navigate]);

  const handleAcceptOrder = async (orderId) => {
    const success = await acceptServiceOrder(orderId);
    if (success) {
      setSelectedOrder(null);
    }
  };

  const handleDeclineOrder = async () => {
    if (!selectedOrder) return;
    
    const success = await declineServiceOrder(selectedOrder.id, declineReason);
    if (success) {
      setShowDeclineModal(false);
      setSelectedOrder(null);
      setDeclineReason('');
    }
  };

  const handleMarkDelivered = async (orderId) => {
    const success = await markServiceDelivered(orderId);
    if (success) {
      setSelectedOrder(null);
    }
  };

  const handleConfirmDelivery = async (orderId) => {
    const success = await confirmServiceDelivery(orderId);
    if (success) {
      setSelectedOrder(null);
    }
  };

  const formatVP = (amount) => {
    if (isNaN(amount) || amount === null || amount === undefined) {
      return '0 VP';
    }
    return `${amount} VP`;
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING_ACCEPTANCE': return '#f39c12';
      case 'ACCEPTED': return '#3498db';
      case 'DELIVERED': return '#9b59b6';
      case 'CONFIRMED': return '#27ae60';
      case 'CANCELLED': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'PENDING_ACCEPTANCE': return 'Aguardando Aceitação';
      case 'ACCEPTED': return 'Aceito';
      case 'DELIVERED': return 'Entregue';
      case 'CONFIRMED': return 'Confirmado';
      case 'CANCELLED': return 'Cancelado';
      default: return 'Desconhecido';
    }
  };

  const canAccept = (order) => {
    return order.status === 'PENDING_ACCEPTANCE' && order.sellerId === currentUser?.uid;
  };

  const canDecline = (order) => {
    return order.status === 'PENDING_ACCEPTANCE' && order.sellerId === currentUser?.uid;
  };

  const canMarkDelivered = (order) => {
    return order.status === 'ACCEPTED' && order.sellerId === currentUser?.uid;
  };

  const canConfirmDelivery = (order) => {
    return order.status === 'DELIVERED' && order.buyerId === currentUser?.uid;
  };

  if (loading) {
    return (
      <div className="service-orders-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando pedidos...</span>
        </div>
      </div>
    );
  }

  const currentOrders = activeTab === 'received' ? receivedOrders : sentOrders;

  return (
    <div className="service-orders-container">
      <div className="service-orders-header">
        <h1>Pedidos de Serviço</h1>
        <p>Gerencie seus pedidos de serviço como vendedor ou comprador</p>
      </div>

      <div className="orders-tabs">
        <button 
          className={`tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          <i className="fas fa-inbox"></i>
          Recebidos ({receivedOrders.length})
        </button>
        <button 
          className={`tab ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          <i className="fas fa-paper-plane"></i>
          Enviados ({sentOrders.length})
        </button>
      </div>

      <div className="orders-list">
        {currentOrders.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-inbox"></i>
            <h3>Nenhum pedido encontrado</h3>
            <p>
              {activeTab === 'received' 
                ? 'Você ainda não recebeu nenhum pedido de serviço.'
                : 'Você ainda não fez nenhum pedido de serviço.'
              }
            </p>
          </div>
        ) : (
          currentOrders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div className="order-info">
                  <h3>{order.metadata.serviceName}</h3>
                  <p className="order-id">Pedido #{order.id.slice(-8)}</p>
                </div>
                <div className="order-status">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {getStatusText(order.status)}
                  </span>
                </div>
              </div>

              <div className="order-details">
                <div className="order-meta">
                  <div className="meta-item">
                    <i className="fas fa-user"></i>
                    <span>
                      {activeTab === 'received' ? 'Cliente' : 'Vendedor'}: 
                      {order.buyerId === currentUser?.uid ? 'Você' : 'Outro usuário'}
                    </span>
                  </div>
                  <div className="meta-item">
                    <i className="fas fa-dollar-sign"></i>
                    <span>Valor: {formatVP(order.vpAmount)}</span>
                  </div>
                  <div className="meta-item">
                    <i className="fas fa-clock"></i>
                    <span>Criado: {formatDate(order.timestamps?.createdAt)}</span>
                  </div>
                </div>

                {order.metadata.serviceDescription && (
                  <div className="order-description">
                    <p>{order.metadata.serviceDescription}</p>
                  </div>
                )}

                {order.additionalFeatures && order.additionalFeatures.length > 0 && (
                  <div className="order-features">
                    <h4>Recursos Adicionais:</h4>
                    <ul>
                      {order.additionalFeatures.map((feature, index) => (
                        <li key={index}>
                          {feature.name || feature.title} 
                          {feature.price && ` (+${formatVP(feature.price * 1.5)})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="order-actions">
                {canAccept(order) && (
                  <button 
                    className="btn-accept"
                    onClick={() => handleAcceptOrder(order.id)}
                    disabled={processing}
                  >
                    <i className="fas fa-check"></i>
                    Aceitar Pedido
                  </button>
                )}

                {canDecline(order) && (
                  <button 
                    className="btn-decline"
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowDeclineModal(true);
                    }}
                    disabled={processing}
                  >
                    <i className="fas fa-times"></i>
                    Recusar Pedido
                  </button>
                )}

                {canMarkDelivered(order) && (
                  <button 
                    className="btn-deliver"
                    onClick={() => handleMarkDelivered(order.id)}
                    disabled={processing}
                  >
                    <i className="fas fa-check-circle"></i>
                    Marcar como Entregue
                  </button>
                )}

                {canConfirmDelivery(order) && (
                  <button 
                    className="btn-confirm"
                    onClick={() => handleConfirmDelivery(order.id)}
                    disabled={processing}
                  >
                    <i className="fas fa-thumbs-up"></i>
                    Confirmar Entrega
                  </button>
                )}

                {order.chatId && (
                  <button 
                    className="btn-chat"
                    onClick={() => navigate(`/messages?chat=${order.chatId}`)}
                  >
                    <i className="fas fa-comments"></i>
                    Abrir Chat
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Decline Modal */}
      {showDeclineModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Recusar Pedido</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowDeclineModal(false);
                  setSelectedOrder(null);
                  setDeclineReason('');
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Você está prestes a recusar o pedido de <strong>{selectedOrder.metadata.serviceName}</strong>.</p>
              <p>O valor será devolvido ao cliente automaticamente.</p>
              
              <div className="form-group">
                <label htmlFor="decline-reason">Motivo da recusa (opcional):</label>
                <textarea
                  id="decline-reason"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Explique o motivo da recusa..."
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowDeclineModal(false);
                  setSelectedOrder(null);
                  setDeclineReason('');
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-decline"
                onClick={handleDeclineOrder}
                disabled={processing}
              >
                Recusar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrders;
