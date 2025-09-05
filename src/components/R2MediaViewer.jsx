import React, { useState, useEffect, useCallback } from 'react';
import { getServiceMediaUrl, getPackContentUrl } from '../services/mediaService';
import './R2MediaViewer.css';

const R2MediaViewer = ({ 
  mediaKey, 
  type = 'service', // 'service' or 'pack'
  watermarked = false, // For pack content
  fallbackUrl = null,
  className = '',
  ...props 
}) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMedia = useCallback(async () => {
    if (!mediaKey) {
      setImageSrc(fallbackUrl);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let downloadUrl;
      
      if (type === 'pack' && watermarked) {
        // Get watermarked URL for pack content
        const result = await getPackContentUrl(mediaKey);
        downloadUrl = result.downloadUrl;
      } else {
        // Get regular download URL for service media
        const result = await getServiceMediaUrl(mediaKey);
        downloadUrl = result.downloadUrl;
      }

      setImageSrc(downloadUrl);
    } catch (err) {
      console.warn('Failed to load R2 media:', err);
      setImageSrc(fallbackUrl);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [mediaKey, type, watermarked, fallbackUrl]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleError = () => {
    setImageSrc(fallbackUrl);
    setError(true);
  };

  const handleRetry = () => {
    loadMedia();
  };

  if (loading) {
    return (
      <div className={`r2-media-viewer loading ${className}`} {...props}>
        <div className="loading-spinner"></div>
        <span>Carregando...</span>
      </div>
    );
  }

  if (error && !imageSrc) {
    return (
      <div className={`r2-media-viewer error ${className}`} {...props}>
        <div className="error-content">
          <i className="fas fa-exclamation-triangle"></i>
          <span>Erro ao carregar mídia</span>
          <button onClick={handleRetry} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`r2-media-viewer ${className}`} {...props}>
      <img
        src={imageSrc}
        alt="Media"
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
};

export default R2MediaViewer;
