import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { getNotificationMessage } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import './NotificationCenter.css';

const NotificationCenter = () => {
  const { notifications, loading, unreadCount, readCount, markAsRead, markAllAsRead, deleteNotification, deleteAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const formatTimestamp = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'like':
        return 'fas fa-heart';
      case 'comment':
        return 'fas fa-comment';
      case 'message':
        return 'fas fa-envelope';
      case 'email_verification':
        return 'fas fa-exclamation-triangle';
      case 'service_purchased':
        return 'fas fa-shopping-cart';
      case 'pack_purchased':
        return 'fas fa-box';
      case 'service_accepted':
        return 'fas fa-check-circle';
      case 'pack_accepted':
        return 'fas fa-check-circle';
      default:
        return 'fas fa-bell';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'like':
        return '#ff4757';
      case 'comment':
        return '#3742fa';
      case 'message':
        return '#ff6b35';
      case 'email_verification':
        return '#ffa726';
      case 'service_purchased':
        return '#2ecc71';
      case 'pack_purchased':
        return '#3498db';
      case 'service_accepted':
        return '#27ae60';
      case 'pack_accepted':
        return '#27ae60';
      default:
        return '#a8a8b3';
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Close dropdown
    setIsOpen(false);
    
    // Navigate based on notification type
    if (notification.type === 'post_interaction' && notification.postId) {
      // Navigate to the specific post
      // We'll need to determine which feed the post is in
      if (notification.postId.includes('vixies')) {
        navigate('/vixies');
      } else if (notification.postId.includes('vixink')) {
        navigate('/vixink');
      } else {
        navigate('/lobby');
      }
    } else if (notification.type === 'message' && notification.conversationId) {
      // Navigate to messages
      navigate('/messages');
    } else if (notification.type === 'email_verification') {
      // Navigate to settings for email verification
      navigate('/settings');
    } else if (notification.type === 'service_purchase' || notification.type === 'pack_purchase') {
      // Navigate to seller's products page
      navigate('/my-services');
    } else if (notification.type === 'service_accepted' || notification.type === 'pack_accepted') {
      // Navigate to buyer's purchases page
      navigate('/my-purchases');
    }
  };

  if (loading) {
    return (
      <div className="notification-center">
        <button className="notification-toggle" disabled>
          <i className="fas fa-bell"></i>
          <span className="notification-count">...</span>
        </button>
      </div>
    );
  }

  return (
    <div className="notification-center">
      <button 
        className="notification-toggle" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className="notification-count">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notificações</h3>
            <div className="notification-actions">
              {unreadCount > 0 && (
                <button 
                  className="mark-all-read"
                  onClick={markAllAsRead}
                  title="Marcar todas como lidas"
                >
                  <i className="fas fa-check-double"></i>
                </button>
              )}
              {readCount > 0 && (
                <button 
                  className="delete-read"
                  onClick={deleteAllRead}
                  title="Remover notificações lidas"
                >
                  <i className="fas fa-trash"></i>
                </button>
              )}
            </div>
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <i className="fas fa-bell-slash"></i>
                <p>Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  data-type={notification.type}
                >
                  <div 
                    className="notification-content-wrapper"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-icon">
                      <i 
                        className={getActionIcon(notification.action)}
                        style={{ color: getActionColor(notification.action) }}
                      ></i>
                    </div>
                    <div className="notification-content">
                      <p className="notification-message">
                        {notification.type === 'email_verification' 
                          ? 'Verifique seu e-mail para completar o cadastro'
                          : getNotificationMessage(
                              notification.action, 
                              notification.actorName || notification.senderName || notification.buyerName || notification.sellerName,
                              notification.commentContent
                            )
                        }
                      </p>
                      <div className="notification-meta">
                        <span className="notification-time">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                        {notification.postContent && (
                          <span className="notification-post">
                            "{notification.postContent}"
                          </span>
                        )}
                        {notification.messageContent && (
                          <span className="notification-message-preview">
                            "{notification.messageContent}"
                          </span>
                        )}
                        {notification.serviceName && (
                          <span className="notification-product">
                            "{notification.serviceName}"
                          </span>
                        )}
                        {notification.packName && (
                          <span className="notification-product">
                            "{notification.packName}"
                          </span>
                        )}
                        {notification.amount && (
                          <span className="notification-amount">
                            {notification.amount} VP
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    className="delete-notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    title="Remover notificação"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
