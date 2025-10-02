import React, { useState, useEffect, useRef, useCallback } from 'react';
import R2MediaViewer from './R2MediaViewer';
import './MediaLightbox.css';

const MediaLightbox = ({ 
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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  const modalRef = useRef(null);
  const mediaRef = useRef(null);
  const lastTouchDistance = useRef(0);
  const lastTouchCenter = useRef({ x: 0, y: 0 });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentMediaIndex(currentIndex);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsVideoPlaying(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, currentIndex]);

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

  // Handle video play/pause
  const handleVideoToggle = useCallback(() => {
    const video = mediaRef.current?.querySelector('video');
    if (video) {
      if (video.paused) {
        video.play();
        setIsVideoPlaying(true);
      } else {
        video.pause();
        setIsVideoPlaying(false);
      }
    }
  }, []);

  if (!isOpen || mediaItems.length === 0) return null;

  const currentMedia = mediaItems[currentMediaIndex];
  const isVideo = currentMedia?.type === 'video' || 
                  (currentMedia?.key && currentMedia.key.toLowerCase().includes('.mp4'));

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
            className="lightbox-media-wrapper"
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
            {currentMedia?.key ? (
              <R2MediaViewer
                mediaKey={currentMedia.key}
                type={type}
                watermarked={watermarked}
                isOwner={isOwner}
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
            ) : (
              <img 
                src={currentMedia?.url} 
                alt="Conteúdo"
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

            {/* Video play/pause overlay */}
            {isVideo && (
              <button 
                className="lightbox-video-toggle"
                onClick={handleVideoToggle}
                aria-label={isVideoPlaying ? "Pausar" : "Reproduzir"}
              >
                <i className={`fas fa-${isVideoPlaying ? 'pause' : 'play'}`}></i>
              </button>
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

export default MediaLightbox;
