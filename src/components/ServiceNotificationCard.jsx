import React from 'react';
import { Link } from 'react-router-dom';
import { useServiceOrder } from '../contexts/ServiceOrderContext';
import './ServiceNotificationCard.css';

const ServiceNotificationCard = ({ notification, onMarkAsRead }) => {
  const { getOrderStatusInfo } = useServiceOrder();

  const handleClick = () => {
    if (onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    
    // Navigate to the appropriate conversation
    if (notification.orderId) {
      window.location.href = `/messages?service=${notification.orderId}`;
    }
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'service_requested':
        return 'fas fa-shopping-cart';
      case 'service_accepted':
        return 'fas fa-check-circle';
      case 'service_delivered':
        return 'fas fa-truck';
      case 'service_completed':
        return 'fas fa-check-double';
      case 'service_declined':
        return 'fas fa-times-circle';
      default:
        return 'fas fa-bell';
    }
  };

  const getNotificationColor = () => {
    switch (notification.type) {
      case 'service_requested':
        return 'warning';
      case 'service_accepted':
        return 'success';
      case 'service_delivered':
        return 'info';
      case 'service_completed':
        return 'success';
      case 'service_declined':
        return 'danger';
      default:
        return 'primary';
    }
  };

  const getNotificationMessage = () => {
    switch (notification.type) {
      case 'service_requested':
        return `Novo pedido de serviço: ${notification.serviceName}`;
      case 'service_accepted':
        return `Seu pedido foi aceito: ${notification.serviceName}`;
      case 'service_delivered':
        return `Serviço entregue: ${notification.serviceName}`;
      case 'service_completed':
        return `Serviço concluído: ${notification.serviceName}`;
      case 'service_declined':
        return `Pedido recusado: ${notification.serviceName}`;
      default:
        return notification.message || 'Nova notificação';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Agora';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString('pt-BR');
  };

  const colorClass = getNotificationColor();
  const isUnread = !notification.read;

  return (
    <div 
      className={`service-notification-card ${colorClass} ${isUnread ? 'unread' : ''}`}
      onClick={handleClick}
    >
      <div className="notification-icon">
        <i className={getNotificationIcon()}></i>
      </div>

      <div className="notification-content">
        <div className="notification-header">
          <h4>{getNotificationMessage()}</h4>
          <span className="notification-time">
            {formatTime(notification.timestamp)}
            </span>
        </div>

        <div className="notification-details">
          <p className="notification-description">
            {notification.description || 'Clique para ver detalhes'}
          </p>
          
          {notification.vpAmount && (
            <div className="notification-amount">
              <span className="amount-label">Valor:</span>
              <span className="amount-value">{notification.vpAmount} VP</span>
            </div>
          )}

          {notification.status && (
            <div className="notification-status">
              <span className="status-label">Status:</span>
              <span className={`status-value status-${colorClass}`}>
                {getOrderStatusInfo(notification.status).label}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {isUnread && <div className="unread-indicator"></div>}
    </div>
  );
};

export default ServiceNotificationCard;