import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSecurePackContent } from '../hooks/useSecurePackContent';
import SecureMediaLightbox from './SecureMediaLightbox';
import './PackContentViewer.css';

const PackContentViewer = ({ pack, orderId, vendorInfo, onClose }) => {
  const { currentUser } = useAuth();
  const { generateSecurePackContentUrl, openSecureContent } = useSecurePackContent();
  
  const [contentUrls, setContentUrls] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxItems, setLightboxItems] = useState([]);
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
      
      console.log('=== LOADING AUTHENTICATED MEDIA ===');
      console.log('Content item:', contentItem.name);
      console.log('Content type:', contentItem.type);
      console.log('Secure URL:', contentItem.secureUrl);
      console.log('JWT token length:', contentItem.jwtToken?.length);
      console.log('JWT token start:', contentItem.jwtToken?.substring(0, 50));
      
      const response = await fetch(contentItem.secureUrl, {
        headers: {
          'Authorization': `Bearer ${contentItem.jwtToken}`
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // For videos: backend returns JSON with signedUrl
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonResponse = await response.json();
        console.log('Received JSON response for video:', jsonResponse);
        
        if (jsonResponse.success && jsonResponse.signedUrl) {
          // Return the signed URL directly - no need to fetch again
          console.log('✅ Using signed URL for video:', jsonResponse.name);
          setMediaBlobUrls(prev => ({ ...prev, [cacheKey]: jsonResponse.signedUrl }));
          return jsonResponse.signedUrl;
        }
      }

      // For images: backend returns the binary data
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      console.log('Blob created, size:', blob.size);
      console.log('Blob URL:', blobUrl);
      
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
      const mediaItems = [];
      
      pack.contentWithUrls.forEach((contentItem, index) => {
        if (contentItem.key && contentItem.secureUrl) {
          urls[contentItem.key] = contentItem.secureUrl;
          
          // Check if it's a media item (image or video)
          if (contentItem.type.startsWith('image/') || contentItem.type.startsWith('video/') || 
              (contentItem.type === 'image/webp' && contentItem.name.toLowerCase().includes('video'))) {
            mediaItems.push({
              key: contentItem.key,
              type: contentItem.type.startsWith('video/') || 
                    (contentItem.type === 'image/webp' && contentItem.name.toLowerCase().includes('video')) 
                    ? 'video' : 'image',
              url: contentItem.secureUrl,
              name: contentItem.name,
              requiresAuth: contentItem.requiresAuth,
              jwtToken: contentItem.jwtToken,
              originalItem: contentItem
            });
          }
        }
      });
      
      setContentUrls(urls);
      setLightboxItems(mediaItems);
    }
  }, [pack?.contentWithUrls]);

  const handleContentClick = async (contentItem) => {
    if (!contentItem.key) return;

    // Check if it's a media item (image or video)
    const isMedia = contentItem.type.startsWith('image/') || contentItem.type.startsWith('video/') || 
                   (contentItem.type === 'image/webp' && contentItem.name.toLowerCase().includes('video'));

    if (isMedia && lightboxItems.length > 0) {
      // Open lightbox for media items
      const mediaIndex = lightboxItems.findIndex(item => item.key === contentItem.key);
      if (mediaIndex >= 0) {
        setLightboxIndex(mediaIndex);
        setLightboxOpen(true);
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

  // Close lightbox function
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // Handle keyboard navigation and disable download shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!lightboxOpen) return;
      
      // Disable common download shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's': // Ctrl+S / Cmd+S
          case 'a': // Ctrl+A / Cmd+A (select all)
          case 'c': // Ctrl+C / Cmd+C (copy)
          case 'v': // Ctrl+V / Cmd+V (paste)
          case 'x': // Ctrl+X / Cmd+X (cut)
          case 'p': // Ctrl+P / Cmd+P (print)
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
      }
      
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (view source)
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
          (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeLightbox();
          break;
      }
    };

    // Disable right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Disable drag and drop
    const handleDragStart = (e) => {
      e.preventDefault();
      return false;
    };

    // Disable text selection
    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('selectstart', handleSelectStart);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [lightboxOpen]);

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
              {(pack.contentWithUrls || pack.packContent || pack.content || []).length} itens
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

      {/* Secure Media Lightbox */}
      <SecureMediaLightbox
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        mediaItems={lightboxItems}
        currentIndex={lightboxIndex}
        type="pack"
        watermarked={true}
        isOwner={false}
      />
    </div>
  );
};

export default PackContentViewer;
