import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSecurePackContent } from '../hooks/useSecurePackContent';
import './PackContentViewer.css';

const PackContentViewer = ({ pack, orderId, vendorInfo, onClose }) => {
  const { currentUser } = useAuth();
  const { generateSecurePackContentUrl, openSecureContent } = useSecurePackContent();
  
  const [contentUrls, setContentUrls] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaBlobUrls, setMediaBlobUrls] = useState({});

  // Load authenticated media using fetch with JWT token
  const loadAuthenticatedMedia = useCallback(async (contentItem) => {
    if (!contentItem.requiresAuth || !contentItem.jwtToken) {
      return contentItem.secureUrl;
    }

    const cacheKey = contentItem.key;
    if (mediaBlobUrls[cacheKey]) {
      return mediaBlobUrls[cacheKey];
    }

    try {
      setLoading(prev => ({ ...prev, [cacheKey]: true }));
      
      const response = await fetch(contentItem.secureUrl, {
        headers: {
          'Authorization': `Bearer ${contentItem.jwtToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      setMediaBlobUrls(prev => ({ ...prev, [cacheKey]: blobUrl }));
      return blobUrl;
    } catch (error) {
      console.error('Error loading authenticated media:', error);
      setError(`Erro ao carregar ${contentItem.name}: ${error.message}`);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  }, [mediaBlobUrls]);

  // Use pre-generated URLs from backend
  useEffect(() => {
    if (pack?.contentWithUrls && Array.isArray(pack.contentWithUrls)) {
      const urls = {};
      const media = [];
      
      pack.contentWithUrls.forEach((contentItem, index) => {
        if (contentItem.key && contentItem.secureUrl) {
          urls[contentItem.key] = contentItem.secureUrl;
          
          // Check if it's a media item (image or video)
          if (contentItem.type.startsWith('image/') || contentItem.type.startsWith('video/') || 
              (contentItem.type === 'image/webp' && contentItem.name.toLowerCase().includes('video'))) {
            media.push({
              ...contentItem,
              index,
              isVideo: contentItem.type.startsWith('video/') || 
                      (contentItem.type === 'image/webp' && contentItem.name.toLowerCase().includes('video'))
            });
          }
        }
      });
      
      setContentUrls(urls);
      setMediaItems(media);
    }
  }, [pack?.contentWithUrls]);

  const handleContentClick = async (contentItem) => {
    if (!contentItem.key) return;

    // Check if it's a media item (image or video)
    const isMedia = contentItem.type.startsWith('image/') || contentItem.type.startsWith('video/') || 
                   (contentItem.type === 'image/webp' && contentItem.name.toLowerCase().includes('video'));

    if (isMedia && mediaItems.length > 0) {
      // Open gallery for media items
      const mediaIndex = mediaItems.findIndex(item => item.key === contentItem.key);
      if (mediaIndex >= 0) {
        setSelectedMediaIndex(mediaIndex);
        setGalleryOpen(true);
      }
    } else {
      // For non-media files, open in new tab with JWT authentication
      if (contentItem.requiresAuth && contentItem.jwtToken) {
        // Create a blob URL with JWT authentication
        try {
          const response = await fetch(contentItem.secureUrl, {
            headers: {
              'Authorization': `Bearer ${contentItem.jwtToken}`
            }
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank', 'noopener,noreferrer,resizable=yes,scrollbars=yes');
          } else {
            setError(`Erro ao carregar ${contentItem.name}: ${response.status}`);
          }
        } catch (error) {
          setError(`Erro ao carregar ${contentItem.name}: ${error.message}`);
        }
      } else if (contentItem.secureUrl) {
        // For sample content or public URLs, open directly
        window.open(contentItem.secureUrl, '_blank', 'noopener,noreferrer,resizable=yes,scrollbars=yes');
      } else {
        setError(`URL não disponível para ${contentItem.name}`);
      }
    }
  };

  const getFileIcon = (type, name = '') => {
    if (type.startsWith('video/') || (type === 'image/webp' && name.toLowerCase().includes('video'))) {
      return 'fas fa-video';
    } else if (type.startsWith('image/')) {
      return 'fas fa-image';
    } else if (type.includes('pdf')) {
      return 'fas fa-file-pdf';
    } else if (type.includes('zip') || type.includes('rar')) {
      return 'fas fa-file-archive';
    } else {
      return 'fas fa-file';
    }
  };

  const getFileTypeLabel = (type, name = '') => {
    if (type.startsWith('video/') || (type === 'image/webp' && name.toLowerCase().includes('video'))) {
      return 'Vídeo';
    } else if (type.startsWith('image/')) {
      return 'Imagem';
    } else if (type.includes('pdf')) {
      return 'PDF';
    } else if (type.includes('zip') || type.includes('rar')) {
      return 'Arquivo';
    } else {
      return 'Arquivo';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Gallery navigation functions
  const nextMedia = () => {
    setSelectedMediaIndex((prev) => (prev + 1) % mediaItems.length);
  };

  const prevMedia = () => {
    setSelectedMediaIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
  };

  // Load authenticated media when gallery opens
  useEffect(() => {
    if (galleryOpen && mediaItems[selectedMediaIndex]) {
      loadAuthenticatedMedia(mediaItems[selectedMediaIndex]);
    }
  }, [galleryOpen, selectedMediaIndex, mediaItems, loadAuthenticatedMedia]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!galleryOpen) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          prevMedia();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextMedia();
          break;
        case 'Escape':
          e.preventDefault();
          closeGallery();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [galleryOpen]);

  if (!pack) {
    return (
      <div className="pack-content-viewer">
        <div className="error-state">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Pack não encontrado</h3>
          <p>O pack solicitado não foi encontrado ou não está mais disponível.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pack-content-viewer">
      <div className="viewer-header">
        <div className="pack-info">
          <h2>{pack.title}</h2>
          <p className="pack-description">{pack.description}</p>
          <div className="pack-meta">
            <span className="category">{pack.category}</span>
            <span className="item-count">
              {pack.packContent?.length || 0} itens
            </span>
            {vendorInfo && (
              <span className="vendor-info">
                <i className="fas fa-user"></i>
                Vendido por: 
                <a 
                  href={`https://vixter.com.br/profile/${vendorInfo.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vendor-link"
                >
                  {vendorInfo.name} (@{vendorInfo.username})
                </a>
              </span>
            )}
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="viewer-content">
            <div className="content-warning">
              <i className="fas fa-shield-alt"></i>
              <div className="warning-content">
                <p>
                  <strong>Visualização Segura:</strong> Este conteúdo é protegido por watermark 
                  personalizado com seu username. Compartilhar URLs resultará em acesso negado.
                </p>
                <p className="watermark-info">
                  <i className="fas fa-info-circle"></i>
                  <strong>Watermark:</strong> Todas as mídias (imagens e vídeos) exibem seu username ({currentUser?.email?.split('@')[0] || 'usuário'}) 
                  para proteção contra compartilhamento não autorizado.
                </p>
                <p className="video-info">
                  <i className="fas fa-video"></i>
                  <strong>Vídeos:</strong> O processamento de vídeos pode levar alguns segundos para aplicar o watermark. 
                  Por favor, aguarde o carregamento.
                </p>
              </div>
            </div>

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <div className="content-grid">
          {(pack.contentWithUrls || pack.packContent || pack.content || [])?.map((contentItem, index) => (
            <div
              key={contentItem.key || index}
              className="content-item"
              onClick={() => handleContentClick(contentItem)}
            >
              <div className="content-preview">
                {loading[contentItem.key] ? (
                  <div className="loading-spinner">
                    <i className="fas fa-spinner fa-spin"></i>
                  </div>
                ) : contentUrls[contentItem.key] ? (
                  <div className="preview-loaded">
                    <i className={getFileIcon(contentItem.type, contentItem.name)}></i>
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    <i className={getFileIcon(contentItem.type, contentItem.name)}></i>
                  </div>
                )}
              </div>
              
              <div className="content-info">
                <h4 className="content-name">
                  {contentItem.name}
                  {contentItem.isSample && (
                    <span className="sample-badge">AMOSTRA</span>
                  )}
                </h4>
                <div className="content-meta">
                  <span className="file-type">{getFileTypeLabel(contentItem.type, contentItem.name)}</span>
                  {contentItem.size && (
                    <span className="file-size">{formatFileSize(contentItem.size)}</span>
                  )}
                </div>
              </div>

              <div className="content-actions">
                <button
                  className="view-btn"
                  disabled={loading[contentItem.key] || !contentUrls[contentItem.key]}
                >
                  <i className="fas fa-eye"></i>
                  {loading[contentItem.key] ? 'Carregando...' : 'Visualizar'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {(!pack.contentWithUrls || pack.contentWithUrls.length === 0) && (!pack.packContent || pack.packContent.length === 0) && (!pack.content || pack.content.length === 0) && (
          <div className="empty-state">
            <i className="fas fa-folder-open"></i>
            <h3>Nenhum conteúdo disponível</h3>
            <p>Este pack não possui conteúdo para visualização.</p>
            <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
              <p><strong>Debug Info:</strong></p>
              <p>Pack ID: {pack.id}</p>
              <p>packContent: {JSON.stringify(pack.packContent)}</p>
              <p>content: {JSON.stringify(pack.content)}</p>
              <p>Se você vê este pack no R2 mas não aqui, o problema é que o campo packContent não está populado no Firestore.</p>
            </div>
          </div>
        )}
      </div>

      {/* Media Gallery Modal */}
      {galleryOpen && mediaItems.length > 0 && (
        <div className="media-gallery-overlay" onClick={closeGallery}>
          <div className="media-gallery-container" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-header">
              <div className="gallery-info">
                <h3>{mediaItems[selectedMediaIndex]?.name}</h3>
                <span className="gallery-counter">
                  {selectedMediaIndex + 1} de {mediaItems.length}
                </span>
              </div>
              <button className="gallery-close-btn" onClick={closeGallery}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="gallery-content">
              {mediaItems.length > 1 && (
                <button className="gallery-nav-btn gallery-prev" onClick={prevMedia}>
                  <i className="fas fa-chevron-left"></i>
                </button>
              )}

              <div className="gallery-media">
                {loading[mediaItems[selectedMediaIndex]?.key] ? (
                  <div className="gallery-loading">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Carregando mídia...</p>
                  </div>
                ) : mediaItems[selectedMediaIndex]?.isVideo ? (
                  <video
                    key={mediaItems[selectedMediaIndex]?.key}
                    src={mediaBlobUrls[mediaItems[selectedMediaIndex]?.key] || mediaItems[selectedMediaIndex]?.secureUrl}
                    controls
                    autoPlay
                    className="gallery-video"
                    crossOrigin="anonymous"
                    onLoadStart={() => {
                      console.log('=== VIDEO LOAD START ===');
                      console.log('Video src:', mediaBlobUrls[mediaItems[selectedMediaIndex]?.key] || mediaItems[selectedMediaIndex]?.secureUrl);
                      console.log('Requires auth:', mediaItems[selectedMediaIndex]?.requiresAuth);
                      console.log('JWT token length:', mediaItems[selectedMediaIndex]?.jwtToken?.length);
                    }}
                    onError={(e) => {
                      console.error('=== VIDEO LOAD ERROR ===');
                      console.error('Error:', e);
                      console.error('Video src:', e.target.src);
                    }}
                  />
                ) : (
                  <img
                    key={mediaItems[selectedMediaIndex]?.key}
                    src={mediaBlobUrls[mediaItems[selectedMediaIndex]?.key] || mediaItems[selectedMediaIndex]?.secureUrl}
                    alt={mediaItems[selectedMediaIndex]?.name}
                    className="gallery-image"
                    crossOrigin="anonymous"
                    onLoad={() => {
                      console.log('=== IMAGE LOAD SUCCESS ===');
                      console.log('Image src:', mediaBlobUrls[mediaItems[selectedMediaIndex]?.key] || mediaItems[selectedMediaIndex]?.secureUrl);
                      console.log('Requires auth:', mediaItems[selectedMediaIndex]?.requiresAuth);
                      console.log('JWT token length:', mediaItems[selectedMediaIndex]?.jwtToken?.length);
                    }}
                    onError={(e) => {
                      console.error('=== IMAGE LOAD ERROR ===');
                      console.error('Error:', e);
                      console.error('Image src:', e.target.src);
                    }}
                  />
                )}
              </div>

              {mediaItems.length > 1 && (
                <button className="gallery-nav-btn gallery-next" onClick={nextMedia}>
                  <i className="fas fa-chevron-right"></i>
                </button>
              )}
            </div>

            {mediaItems.length > 1 && (
              <div className="gallery-thumbnails">
                {mediaItems.map((item, index) => (
                  <div
                    key={item.key}
                    className={`gallery-thumbnail ${index === selectedMediaIndex ? 'active' : ''}`}
                    onClick={() => setSelectedMediaIndex(index)}
                  >
                    <div className="thumbnail-icon">
                      <i className={item.isVideo ? 'fas fa-video' : 'fas fa-image'}></i>
                    </div>
                    <span className="thumbnail-name">{item.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="gallery-controls">
              <span className="watermark-notice">
                <i className="fas fa-shield-alt"></i>
                Conteúdo protegido com watermark personalizado
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackContentViewer;
