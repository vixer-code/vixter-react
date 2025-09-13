import React, { useState, useEffect } from 'react';
import useR2Media from '../hooks/useR2Media';
import './ServiceMediaViewer.css';

const ServiceMediaViewer = ({ service, onClose }) => {
  const { getServiceMediaUrl } = useR2Media();
  const [mediaUrls, setMediaUrls] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  // Generate fixed URLs for service media
  const generateMediaUrls = async () => {
    if (!service) return;

    const urls = {};
    const loadingStates = {};

    try {
      // Cover image
      if (service.coverImage?.key) {
        loadingStates[service.coverImage.key] = true;
        try {
          const result = await getServiceMediaUrl(service.coverImage.key);
          urls[service.coverImage.key] = result.url;
        } catch (err) {
          console.error('Error loading cover image:', err);
        } finally {
          loadingStates[service.coverImage.key] = false;
        }
      }

      // Sample images
      if (service.sampleImages && Array.isArray(service.sampleImages)) {
        for (const image of service.sampleImages) {
          if (image.key) {
            loadingStates[image.key] = true;
            try {
              const result = await getServiceMediaUrl(image.key);
              urls[image.key] = result.url;
            } catch (err) {
              console.error('Error loading sample image:', err);
            } finally {
              loadingStates[image.key] = false;
            }
          }
        }
      }

      // Sample videos
      if (service.sampleVideos && Array.isArray(service.sampleVideos)) {
        for (const video of service.sampleVideos) {
          if (video.key) {
            loadingStates[video.key] = true;
            try {
              const result = await getServiceMediaUrl(video.key);
              urls[video.key] = result.url;
            } catch (err) {
              console.error('Error loading sample video:', err);
            } finally {
              loadingStates[video.key] = false;
            }
          }
        }
      }

      setMediaUrls(urls);
      setLoading(loadingStates);
    } catch (err) {
      console.error('Error generating media URLs:', err);
      setError('Erro ao carregar mídias do serviço');
    }
  };

  useEffect(() => {
    generateMediaUrls();
  }, [service]);

  const handleMediaClick = (mediaItem) => {
    const url = mediaUrls[mediaItem.key];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const getMediaIcon = (type) => {
    if (type.startsWith('image/')) {
      return 'fas fa-image';
    } else if (type.startsWith('video/')) {
      return 'fas fa-video';
    } else {
      return 'fas fa-file';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!service) {
    return (
      <div className="service-media-viewer">
        <div className="error-state">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Serviço não encontrado</h3>
          <p>O serviço solicitado não foi encontrado ou não está mais disponível.</p>
        </div>
      </div>
    );
  }

  const allMedia = [
    ...(service.coverImage ? [{ ...service.coverImage, isCover: true }] : []),
    ...(service.sampleImages || []).map(img => ({ ...img, isSample: true })),
    ...(service.sampleVideos || []).map(vid => ({ ...vid, isSample: true }))
  ];

  return (
    <div className="service-media-viewer">
      <div className="viewer-header">
        <div className="service-info">
          <h2>{service.title}</h2>
          <p className="service-description">{service.description}</p>
          <div className="service-meta">
            <span className="category">{service.category}</span>
            <span className="media-count">
              {allMedia.length} mídias
            </span>
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="viewer-content">
        <div className="content-info">
          <i className="fas fa-info-circle"></i>
          <p>
            <strong>Mídias de Exemplo:</strong> Estas são imagens e vídeos de exemplo 
            do serviço. URLs fixas para visualização.
          </p>
        </div>

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <div className="media-grid">
          {allMedia.map((mediaItem, index) => (
            <React.Fragment key={mediaItem.key || index}>
              <div 
                className="media-preview"
                onClick={() => handleMediaClick(mediaItem)}
              >
                {loading[mediaItem.key] ? (
                  <div className="loading-spinner">
                    <i className="fas fa-spinner fa-spin"></i>
                  </div>
                ) : mediaUrls[mediaItem.key] ? (
                  <div className="preview-loaded">
                    <i className={getMediaIcon(mediaItem.type)}></i>
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    <i className={getMediaIcon(mediaItem.type)}></i>
                  </div>
                )}
                
                {mediaItem.isCover && (
                  <div className="media-badge cover-badge">
                    <i className="fas fa-star"></i>
                    Capa
                  </div>
                )}
                
                {mediaItem.isSample && (
                  <div className="media-badge sample-badge">
                    <i className="fas fa-eye"></i>
                    Amostra
                  </div>
                )}
              </div>
              
              <div className="media-info">
                <h4 className="media-name">
                  {mediaItem.isCover ? 'Imagem de Capa' : 
                   mediaItem.isSample ? 'Amostra' : 
                   mediaItem.name || 'Mídia'}
                </h4>
                <div className="media-meta">
                  <span className="file-type">{mediaItem.type}</span>
                  {mediaItem.size && (
                    <span className="file-size">{formatFileSize(mediaItem.size)}</span>
                  )}
                </div>
              </div>

              <div className="media-actions">
                <button
                  className="view-btn"
                  disabled={loading[mediaItem.key] || !mediaUrls[mediaItem.key]}
                >
                  <i className="fas fa-eye"></i>
                  {loading[mediaItem.key] ? 'Carregando...' : 'Visualizar'}
                </button>
              </div>
            </React.Fragment>
          ))}
        </div>

        {allMedia.length === 0 && (
          <div className="empty-state">
            <i className="fas fa-images"></i>
            <h3>Nenhuma mídia disponível</h3>
            <p>Este serviço não possui mídias de exemplo para visualização.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceMediaViewer;
