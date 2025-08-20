import React from 'react';
import './MediaProcessingStatus.css';

const MediaProcessingStatus = ({ mediaProcessing, compact = false }) => {
  if (!mediaProcessing) return null;

  const { status, error, lastUpdate } = mediaProcessing;

  if (status === 'completed') return null; // Don't show when completed

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <i className="fas fa-spinner fa-spin"></i>;
      case 'error':
        return <i className="fas fa-exclamation-triangle"></i>;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'processing':
        return compact ? 'Processando...' : 'Mídias sendo processadas com marca d\'água...';
      case 'error':
        return compact ? 'Erro no processamento' : 'Erro ao processar marca d\'água';
      default:
        return 'Status desconhecido';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'processing':
        return 'processing';
      case 'error':
        return 'error';
      default:
        return '';
    }
  };

  return (
    <div className={`media-processing-status ${getStatusClass()} ${compact ? 'compact' : ''}`}>
      <span className="status-icon">{getStatusIcon()}</span>
      <span className="status-text">{getStatusText()}</span>
      {error && !compact && (
        <span className="error-details" title={error}>
          <i className="fas fa-info-circle"></i>
        </span>
      )}
    </div>
  );
};

export default MediaProcessingStatus;
