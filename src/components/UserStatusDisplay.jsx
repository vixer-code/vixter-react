import React from 'react';
import { useUserStatus } from '../hooks/useUserStatus';
import './UserStatusDisplay.css';

const UserStatusDisplay = ({ userId, showIcon = true, showText = true, size = 'medium' }) => {
  const status = useUserStatus(userId);

  const getStatusColor = (status) => {
    const colors = {
      online: '#00d084',
      ausente: '#ffb800',
      ocupado: '#ff3864',
      offline: '#888'
    };
    return colors[status] || colors.offline;
  };

  const getStatusText = (status) => {
    const texts = {
      online: 'Online',
      ausente: 'Ausente',
      ocupado: 'Não perturbe',
      offline: 'Offline'
    };
    return texts[status] || texts.offline;
  };

  const getStatusIcon = (status) => {
    const icons = {
      online: '●',
      ausente: '○',
      ocupado: '●',
      offline: '○'
    };
    return icons[status] || icons.offline;
  };

  const sizeClasses = {
    small: 'status-display-small',
    medium: 'status-display-medium',
    large: 'status-display-large'
  };

  return (
    <div className={`user-status-display ${sizeClasses[size]}`}>
      {showIcon && (
        <span 
          className="status-icon"
          style={{ color: getStatusColor(status) }}
        >
          {getStatusIcon(status)}
        </span>
      )}
      {showText && (
        <span className="status-label">
          {getStatusText(status)}
        </span>
      )}
    </div>
  );
};

export default UserStatusDisplay; 