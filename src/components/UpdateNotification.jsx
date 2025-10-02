import React from 'react';
import { RefreshCw, X, Download } from 'lucide-react';
import './UpdateNotification.css';

const UpdateNotification = ({ isVisible, onUpdate, onDismiss }) => {
  if (!isVisible) return null;

  return (
    <div className="update-notification-overlay">
      <div className="update-notification-modal">
        <div className="update-notification-header">
          <div className="update-notification-icon">
            <Download size={24} />
          </div>
          <button 
            className="update-notification-close"
            onClick={onDismiss}
            aria-label="Fechar notificação"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="update-notification-content">
          <h2 className="update-notification-title">
            Nova versão disponível!
          </h2>
          <p className="update-notification-message">
            Uma nova versão da nossa plataforma está disponível. 
            Recarregue a página para acessar as últimas funcionalidades e melhorias.
          </p>
        </div>
        
        <div className="update-notification-actions">
          <button 
            className="update-notification-button update-notification-button-primary"
            onClick={onUpdate}
          >
            <RefreshCw size={16} />
            Recarregar página
          </button>
          <button 
            className="update-notification-button update-notification-button-secondary"
            onClick={onDismiss}
          >
            Mais tarde
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
