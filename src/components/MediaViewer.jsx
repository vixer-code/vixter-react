import React, { useState, useEffect } from 'react';
import './MediaViewer.css';

const MediaViewer = ({ mediaUrl, mediaType, caption, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handleMediaLoad = () => {
    setLoading(false);
  };

  const handleMediaError = () => {
    setLoading(false);
    setError(true);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };


  return (
    <div className="media-viewer-overlay" onClick={handleBackdropClick}>
      <div className="media-viewer-container">
        {/* Header */}
        <div className="media-viewer-header">
          <div className="media-viewer-actions">
            <button
              onClick={onClose}
              className="media-viewer-btn close"
              title="Fechar"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Media content */}
        <div className="media-viewer-content">
          {loading && (
            <div className="media-viewer-loading">
              <div className="loading-spinner"></div>
              <span>Carregando...</span>
            </div>
          )}

          {error && (
            <div className="media-viewer-error">
              <i className="fas fa-exclamation-triangle"></i>
              <span>Erro ao carregar mídia</span>
            </div>
          )}

          {mediaType === 'image' && (
            <img
              src={mediaUrl}
              alt="Imagem expandida"
              className="media-viewer-image"
              onLoad={handleMediaLoad}
              onError={handleMediaError}
              style={{ display: loading || error ? 'none' : 'block' }}
            />
          )}

          {mediaType === 'video' && (
            <video
              src={mediaUrl}
              className="media-viewer-video"
              controls
              autoPlay
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
              style={{ display: loading || error ? 'none' : 'block' }}
            />
          )}
        </div>

        {/* Caption */}
        {caption && !loading && !error && (
          <div className="media-viewer-caption">
            <p>{caption}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaViewer;
