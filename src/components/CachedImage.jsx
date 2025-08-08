import React, { useState, useEffect } from 'react';
import { getDefaultImage } from '../utils/defaultImages';
import { imageCache, preloadImage } from '../utils/imageCache';
import './CachedImage.css';

/**
 * CachedImage component for displaying Firebase Storage images with caching
 * @param {object} props - Component props
 * @param {string|object} props.src - Firebase Storage reference or URL
 * @param {string} props.fallbackSrc - Fallback image URL
 * @param {string} props.alt - Alt text for the image
 * @param {string} props.className - CSS class name
 * @param {object} props.style - Inline styles
 * @param {function} props.onLoad - On load callback
 * @param {function} props.onError - On error callback
 * @param {boolean} props.enableCache - Whether to enable caching
 * @param {string} props.defaultType - Type of default image to use ('PROFILE_1', 'PROFILE_2', 'PROFILE_3')
 * @param {boolean} props.showLoading - Whether to show loading state
 * @param {React.ReactNode} props.loadingComponent - Custom loading component
 * @param {React.ReactNode} props.errorComponent - Custom error component
 */
const CachedImage = ({
  src,
  fallbackSrc,
  alt = '',
  className = '',
  style = {},
  onLoad,
  onError,
  enableCache = false,
  defaultType = 'PROFILE_1',
  showLoading = false,
  loadingComponent,
  errorComponent,
  ...props
}) => {
  // Use default image if no fallback is provided
  const finalFallbackSrc = fallbackSrc || getDefaultImage(defaultType);
  
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadImage = async () => {
      // If no src provided, use fallback immediately
      if (!src || src === '') {
        setImageSrc(finalFallbackSrc);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let imageUrl = null;

        // Try cache first
        if (enableCache && typeof src === 'string') {
          const cached = imageCache.getCachedImage(src);
          if (cached) {
            imageUrl = cached;
          }
        }

        // If not cached, preload and cache it
        if (!imageUrl) {
          if (typeof src === 'string' && src.startsWith('http')) {
            try {
              const preloaded = enableCache ? await preloadImage(src) : src;
              imageUrl = preloaded || src;
            } catch {
              imageUrl = src;
            }
          } else {
            imageUrl = finalFallbackSrc;
          }
        }

        // Set the image source but keep loading true until the <img> fires onLoad
        setImageSrc(imageUrl);
      } catch (err) {
        setImageSrc(finalFallbackSrc);
        setError(err);
        setLoading(false);
      }
    };

    loadImage();
  }, [src, finalFallbackSrc]);

  const handleLoad = (e) => {
    setLoading(false);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    setError(e);
    setImageSrc(finalFallbackSrc);
    setLoading(false);
    if (onError) onError(e);
  };

  // Show loading state
  if (loading) {
    if (loadingComponent) {
      return loadingComponent;
    }
    // Render an empty container to preserve layout until the image loads
    return <div className={className} style={style} {...props} />;
  }

  // Show error state
  if (error && errorComponent) {
    return errorComponent;
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
};

export default CachedImage; 