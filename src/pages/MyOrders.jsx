import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import { useNotification } from '../contexts/NotificationContext';
import { Link } from 'react-router-dom';
import './MyOrders.css';

const MyOrders = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUser();
  const { 
    sentOrders, 
    loading, 
    processing,
    confirmServiceDelivery,
    getOrderStatusInfo,
    ORDER_STATUS
  } = useServiceOrder();
  const { showNotification } = useNotification();
  
  const [activeTab, setActiveTab] = useState('all');
  const [feedback, setFeedback] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // Redirect if not a client
  React.useEffect(() => {
    if (userProfile && userProfile.accountType !== 'client') {
      showNotification('Apenas clientes podem acessar esta página', 'warning');
      window.location.href = '/';
    }
  }, [userProfile, showNotification]);

  const handleConfirmDelivery = async () => {
    if (!selectedOrderId) return;
    
    const success = await confirmServiceDelivery(selectedOrderId, feedback);
    if (success) {
      setShowFeedbackModal(false);
      setFeedback('');
      setSelectedOrderId(null);
    }
  };

  const openFeedbackModal = (orderId) => {
    setSelectedOrderId(orderId);
    setShowFeedbackModal(true);
  };

  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'pending':
        return sentOrders.filter(order => order.status === ORDER_STATUS.PENDING_ACCEPTANCE);
      case 'accepted':
        return sentOrders.filter(order => order.status === ORDER_STATUS.ACCEPTED);
      case 'delivered':
        return sentOrders.filter(order => order.status === ORDER_STATUS.DELIVERED);
      case 'completed':
        return sentOrders.filter(order => 
          order.status === ORDER_STATUS.CONFIRMED || 
          order.status === ORDER_STATUS.AUTO_RELEASED
        );
      case 'cancelled':
        return sentOrders.filter(order => order.status === ORDER_STATUS.CANCELLED);
      default:
        return sentOrders;
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

  if (userProfile && userProfile.accountType !== 'client') {
    return (
      <div className="my-orders-container">
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
      <div className="my-orders-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Carregando pedidos...</span>
        </div>
      </div>
    );
  }

  const filteredOrders = getFilteredOrders();

  return (
    <div className="my-orders-container">
      <div className="my-orders-header">
        <h1>Meus Pedidos</h1>
        <p>Acompanhe o status dos seus pedidos de serviços</p>
      </div>

      <div className="orders-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <i className="fas fa-list"></i>
          Todos ({sentOrders.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <i className="fas fa-clock"></i>
          Pendentes ({sentOrders.filter(o => o.status === ORDER_STATUS.PENDING_ACCEPTANCE).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'accepted' ? 'active' : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          <i className="fas fa-check"></i>
          Aceitos ({sentOrders.filter(o => o.status === ORDER_STATUS.ACCEPTED).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'delivered' ? 'active' : ''}`}
          onClick={() => setActiveTab('delivered')}
        >
          <i className="fas fa-truck"></i>
          Entregues ({sentOrders.filter(o => o.status === ORDER_STATUS.DELIVERED).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <i className="fas fa-check-circle"></i>
          Concluídos ({sentOrders.filter(o => 
            o.status === ORDER_STATUS.CONFIRMED || o.status === ORDER_STATUS.AUTO_RELEASED
          ).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          <i className="fas fa-times-circle"></i>
          Cancelados ({sentOrders.filter(o => o.status === ORDER_STATUS.CANCELLED).length})
        </button>
      </div>

      <div className="orders-list">
        {filteredOrders.length === 0 ? (
          <div className="no-orders">
            <i className="fas fa-shopping-cart"></i>
            <h3>Nenhum pedido encontrado</h3>
            <p>
              {activeTab === 'all' 
                ? 'Você ainda não fez nenhum pedido de serviço'
                : `Não há pedidos ${activeTab} no momento`
              }
            </p>
            {activeTab === 'all' && (
              <Link to="/" className="btn-primary">
                <i className="fas fa-search"></i>
                Procurar Serviços
              </Link>
            )}
          </div>
        ) : (
          filteredOrders.map((order) => {
            const statusInfo = getOrderStatusInfo(order.status);
            const isDelivered = order.status === ORDER_STATUS.DELIVERED;
            const isCompleted = order.status === ORDER_STATUS.CONFIRMED || order.status === ORDER_STATUS.AUTO_RELEASED;
            const isCancelled = order.status === ORDER_STATUS.CANCELLED;

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
                  <div className="order-provider">
                    <strong>Provedor:</strong> {order.sellerName || 'Provedor'}
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
                      <strong>Seu Feedback:</strong>
                      <p>{order.buyerFeedback}</p>
                    </div>
                  )}
                  {order.cancellationReason && (
                    <div className="order-cancellation">
                      <strong>Motivo do Cancelamento:</strong>
                      <p>{order.cancellationReason}</p>
                    </div>
                  )}
                </div>

                <div className="order-actions">
                  {isDelivered && (
                    <button 
                      className="btn-success"
                      onClick={() => openFeedbackModal(order.id)}
                      disabled={processing}
                    >
                      <i className="fas fa-check"></i>
                      Confirmar Entrega
                    </button>
                  )}
                  
                  {!isCompleted && !isCancelled && (
                    <Link 
                      to={`/messages?service=${order.id}`}
                      className="btn-secondary"
                    >
                      <i className="fas fa-comments"></i>
                      Conversa
                    </Link>
                  )}

                  {isCompleted && (
                    <div className="order-completed-info">
                      <i className="fas fa-check-circle"></i>
                      <span>Serviço concluído com sucesso!</span>
                    </div>
                  )}

                  {isCancelled && (
                    <div className="order-cancelled-info">
                      <i className="fas fa-times-circle"></i>
                      <span>Pedido cancelado - Valor devolvido</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirmar Entrega</h3>
            <p>Por favor, deixe seu feedback sobre o serviço recebido (opcional):</p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Como foi o serviço? Deixe seu feedback..."
              rows="4"
            />
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowFeedbackModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-success"
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
                    <i className="fas fa-check"></i>
                    Confirmar Entrega
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

export default MyOrders;
