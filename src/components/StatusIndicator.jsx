import React, { useState, useEffect, useRef } from 'react';
import { useStatus } from '../contexts/StatusContext';
import { useUserStatus } from '../hooks/useUserStatus';
import './StatusIndicator.css';

const StatusIndicator = ({ userId, isOwner = false, size = 'medium', showText = false }) => {
  const { userStatus, selectedStatus, updateUserStatus } = useStatus();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  
  // Use the hook to get the user's status
  const otherUserStatus = useUserStatus(isOwner ? null : userId);
  const status = isOwner ? userStatus : otherUserStatus;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleStatusChange = async (newStatus) => {
    if (isOwner) {
      await updateUserStatus(newStatus);
    }
    setShowDropdown(false);
  };

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

  const statusOptions = [
    { value: 'online', label: 'Online', color: '#00d084' },
    { value: 'ausente', label: 'Ausente', color: '#ffb800' },
    { value: 'ocupado', label: 'Não perturbe', color: '#ff3864' },
    { value: 'offline', label: 'Offline', color: '#888' }
  ];

  const sizeClasses = {
    small: 'status-indicator-small',
    medium: 'status-indicator-medium',
    large: 'status-indicator-large'
  };

  return (
    <div className={`status-indicator-container ${sizeClasses[size]}`} ref={dropdownRef}>
      <div
        className={`status-circle ${status} ${isOwner ? 'interactive' : ''}`}
        style={{ backgroundColor: getStatusColor(status) }}
        onClick={() => isOwner && setShowDropdown(!showDropdown)}
        title={getStatusText(status)}
      >
        {showText && (
          <span className="status-text">{getStatusText(status)}</span>
        )}
      </div>
      
      {isOwner && showDropdown && (
        <div className="status-dropdown">
          {statusOptions.map((option) => (
            <div
              key={option.value}
              className={`status-option ${status === option.value ? 'active' : ''}`}
              onClick={() => handleStatusChange(option.value)}
            >
              <div 
                className="status-circle-small"
                style={{ backgroundColor: option.color }}
              />
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatusIndicator; 