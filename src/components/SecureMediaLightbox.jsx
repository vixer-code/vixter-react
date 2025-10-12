import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MediaLightbox.css';

const SecureMediaLightbox = ({ 
  isOpen, 
  onClose, 
  mediaItems = [], 
  currentIndex = 0,
  type = 'pack',
  watermarked = false,
  isOwner = false
}) => {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(currentIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mediaBlobUrls, setMediaBlobUrls] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  
  const modalRef = useRef(null);
  const mediaRef = useRef(null);
  const lastTouchDistance = useRef(0);
  const lastTouchCenter = useRef({ x: 0, y: 0 });

  // Load authenticated media using fetch with JWT token
  const loadAuthenticatedMedia = useCallback(async (mediaItem) => {
    if (!mediaItem.requiresAuth || !mediaItem.jwtToken) {
      return mediaItem.url;
    }

    const cacheKey = mediaItem.key;
    if (mediaBlobUrls[cacheKey]) {
      return mediaBlobUrls[cacheKey];
    }

    try {
      setLoading(prev => ({ ...prev, [cacheKey]: true }));
      
      // Check if URL is already a signed URL from R2 (for large videos)
      if (mediaItem.url && mediaItem.url.includes('r2.cloudflarestorage.com')) {
        console.log('✅ Using pre-signed R2 URL directly (no fetch needed):', mediaItem.name);
        // Signed URLs from R2 can be used directly - no need to fetch
        setMediaBlobUrls(prev => ({ ...prev, [cacheKey]: mediaItem.url }));
        return mediaItem.url;
      }
      
      const response = await fetch(mediaItem.url, {
        headers: {
          'Authorization': `Bearer ${mediaItem.jwtToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response is JSON (videos with signed URLs)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const jsonResponse = await response.json();
        console.log('Received JSON response for video:', jsonResponse);
        
        if (jsonResponse.type === 'signedUrl' && jsonResponse.signedUrl) {
          // Use the signed URL directly
          console.log(`✅ Using signed URL for video: ${jsonResponse.name}`);
          setMediaBlobUrls(prev => ({ ...prev, [cacheKey]: jsonResponse.signedUrl }));
          return jsonResponse.signedUrl;
        }
      }

      // For images: create blob URL from binary data
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      setMediaBlobUrls(prev => ({ ...prev, [cacheKey]: blobUrl }));
      return blobUrl;
    } catch (error) {
      console.error('Error loading authenticated media:', error);
      setError(`Erro ao carregar ${mediaItem.name}: ${error.message}`);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  }, [mediaBlobUrls]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentMediaIndex(currentIndex);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, currentIndex]);

  // Load media when gallery opens or index changes
  useEffect(() => {
    if (isOpen && mediaItems[currentMediaIndex]) {
      loadAuthenticatedMedia(mediaItems[currentMediaIndex]);
    }
  }, [isOpen, currentMediaIndex, mediaItems, loadAuthenticatedMedia]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
        // Disable common download shortcuts
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
          }
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  const goToNext = useCallback(() => {
    setCurrentMediaIndex((prev) => 
      prev < mediaItems.length - 1 ? prev + 1 : 0
    );
    resetZoom();
  }, [mediaItems.length]);

  const goToPrevious = useCallback(() => {
    setCurrentMediaIndex((prev) => 
      prev > 0 ? prev - 1 : mediaItems.length - 1
    );
    resetZoom();
  }, [mediaItems.length]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = prev / 1.2;
      if (newZoom <= 1) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return newZoom;
    });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, [handleZoomIn, handleZoomOut]);

  // Mouse drag for pan
  const handleMouseDown = useCallback((e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch events for mobile
  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch to zoom
      lastTouchDistance.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1 && zoom > 1) {
      // Single touch pan
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - pan.x, 
        y: e.touches[0].clientY - pan.y 
      });
    }
  }, [zoom, pan]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      // Pinch to zoom
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / lastTouchDistance.current;
      
      setZoom(prev => {
        const newZoom = prev * scale;
        return Math.min(Math.max(newZoom, 0.5), 5);
      });
      
      lastTouchDistance.current = currentDistance;
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      // Single touch pan
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Prevent context menu and other security measures
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  const handleSelectStart = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);


  if (!isOpen || mediaItems.length === 0) return null;

  const currentMedia = mediaItems[currentMediaIndex];
  const isVideo = currentMedia?.type === 'video';
  const mediaSrc = mediaBlobUrls[currentMedia?.key] || currentMedia?.url;
  const isLoading = loading[currentMedia?.key];
  
  // Detect if video is vertical (height > width)
  const isVerticalVideo = isVideo && currentMedia?.originalItem?.height && currentMedia?.originalItem?.width && 
                         currentMedia.originalItem.height > currentMedia.originalItem.width;

  return (
    <div 
      className="media-lightbox-overlay"
      onClick={onClose}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onSelectStart={handleSelectStart}
    >
      <div 
        className="media-lightbox-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        {/* Close button */}
        <button 
          className="lightbox-close-btn"
          onClick={onClose}
          aria-label="Fechar"
        >
          <i className="fas fa-times"></i>
        </button>

        {/* Navigation buttons */}
        {mediaItems.length > 1 && (
          <>
            <button 
              className="lightbox-nav-btn lightbox-prev"
              onClick={goToPrevious}
              aria-label="Anterior"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <button 
              className="lightbox-nav-btn lightbox-next"
              onClick={goToNext}
              aria-label="Próximo"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </>
        )}

        {/* Media container */}
        <div className="lightbox-media-container">
          <div 
            className={`lightbox-media-wrapper ${isVerticalVideo ? 'vertical-video' : ''}`}
            ref={mediaRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
            onSelectStart={handleSelectStart}
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
          >
            {isLoading ? (
              <div className="lightbox-loading">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Carregando mídia...</p>
              </div>
            ) : isVideo ? (
              <video 
                src={mediaSrc}
                controls 
                className="lightbox-media"
                crossOrigin="anonymous"
                controlsList="nodownload"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
              >
                <source src={mediaSrc} type="video/mp4" />
                Seu navegador não suporta vídeo.
              </video>
            ) : (
              <img 
                src={mediaSrc} 
                alt={currentMedia?.name || 'Conteúdo'}
                className="lightbox-media"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
                onContextMenu={handleContextMenu}
                onDragStart={handleDragStart}
                onSelectStart={handleSelectStart}
              />
            )}

          </div>
        </div>

        {/* Zoom controls */}
        <div className="lightbox-zoom-controls">
          <button onClick={handleZoomOut} aria-label="Diminuir zoom">
            <i className="fas fa-search-minus"></i>
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} aria-label="Aumentar zoom">
            <i className="fas fa-search-plus"></i>
          </button>
          <button onClick={resetZoom} aria-label="Resetar zoom">
            <i className="fas fa-expand-arrows-alt"></i>
          </button>
        </div>

        {/* Media counter */}
        {mediaItems.length > 1 && (
          <div className="lightbox-counter">
            {currentMediaIndex + 1} / {mediaItems.length}
          </div>
        )}

        {/* Security notice */}
        <div className="lightbox-security-notice">
          <div className="security-item">
            <i className="fas fa-shield-alt"></i>
            <span>Conteúdo protegido com watermark</span>
          </div>
          <div className="security-item">
            <i className="fas fa-ban"></i>
            <span>Download desabilitado</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="lightbox-instructions">
          <div className="instruction-item">
            <i className="fas fa-keyboard"></i>
            <span>ESC para fechar</span>
          </div>
          <div className="instruction-item">
            <i className="fas fa-arrows-alt-h"></i>
            <span>← → para navegar</span>
          </div>
          <div className="instruction-item">
            <i className="fas fa-search-plus"></i>
            <span>+ - para zoom</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecureMediaLightbox;
