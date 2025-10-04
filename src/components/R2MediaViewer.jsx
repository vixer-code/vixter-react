import React, { useState, useEffect, useCallback } from 'react';
import mediaService from '../services/mediaService';
import './R2MediaViewer.css';

const R2MediaViewer = ({ 
  mediaKey, 
  type = 'service', // 'service' or 'pack'
  watermarked = false, // For pack content
  isOwner = false, // If true, owner sees content without watermark
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
      
      if (type === 'pack' && watermarked && !isOwner) {
        // Get watermarked URL for pack content from private bucket (only for buyers)
        // TODO: Pass actual userId when implementing purchase validation
        const result = await mediaService.generatePackContentUrl(mediaKey, 'buyer-user-id', null, null);
        downloadUrl = result.downloadUrl;
      } else if (type === 'pack' && isOwner) {
        // Owner sees pack content without watermark
        const result = await mediaService.generatePackContentUrl(mediaKey, null, null, null);
        downloadUrl = result.downloadUrl;
      } else {
        // Get regular download URL for service media from public bucket
        const result = await mediaService.getServiceMediaUrl(mediaKey);
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

  // Check if this is a video
  const isVideo = (url) => {
    if (!url) return false;
    return /\.(mp4|mov|webm|ogg|avi|mkv)(\?|$)/i.test(url);
  };

  const isVideoFile = isVideo(imageSrc);

  return (
    <div className={`r2-media-viewer ${className}`} {...props}>
      {isVideoFile ? (
        <video 
          controls 
          onError={handleError}
          className="r2-video"
          controlsList="nodownload"
        >
          <source src={imageSrc} type="video/mp4" />
          Seu navegador não suporta vídeo.
        </video>
      ) : (
        <img
          src={imageSrc}
          alt="Media"
          onError={handleError}
          loading="lazy"
        />
      )}
    </div>
  );
};

export default R2MediaViewer;
