import React, { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { getNotificationMessage } from '../services/notificationService';
import './NotificationCenter.css';

const NotificationCenter = () => {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

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
      case 'repost':
        return 'fas fa-retweet';
      case 'comment':
        return 'fas fa-comment';
      default:
        return 'fas fa-bell';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'like':
        return '#ff4757';
      case 'repost':
        return '#00ffca';
      case 'comment':
        return '#3742fa';
      default:
        return '#a8a8b3';
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
            {unreadCount > 0 && (
              <button 
                className="mark-all-read"
                onClick={markAllAsRead}
              >
                Marcar todas como lidas
              </button>
            )}
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
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="notification-icon">
                    <i 
                      className={getActionIcon(notification.action)}
                      style={{ color: getActionColor(notification.action) }}
                    ></i>
                  </div>
                  <div className="notification-content">
                    <p className="notification-message">
                      {getNotificationMessage(
                        notification.action, 
                        notification.actorName,
                        notification.commentContent
                      )}
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
                    </div>
                  </div>
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
