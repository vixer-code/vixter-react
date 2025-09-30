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
  enableCache = true,
  defaultType = 'PROFILE_1',
   showLoading = false,
   // Remove unused custom loading UI for now to simplify
   // and avoid delaying image paint
   // loadingComponent,
  errorComponent,
  // If true, mark as critical for LCP: eager load + high fetch priority and bypass heavy caching work
  priority = false,
  loading: loadingAttr,
  fetchpriority: fetchPriorityAttr,
  sizes,
  srcSet,
  width,
  height,
  ...props
}) => {
  // Use default image if no fallback is provided
  const finalFallbackSrc = fallbackSrc || getDefaultImage(defaultType);

  // For priority images, set src immediately on first render to start the request ASAP
  const shouldBypass = Boolean(priority && typeof src === 'string' && src.startsWith('http'));
  const resolveSrcToString = (candidate) => {
    if (!candidate) return '';
    if (typeof candidate === 'string') return candidate;
    if (typeof candidate === 'object') {
      // Support responsive objects saved in DB: { small, medium, large } or width map
      return candidate.large || candidate.medium || candidate.small || candidate[1440] || candidate[512] || '';
    }
    return '';
  };

  const [imageSrc, setImageSrc] = useState(() => {
    const initial = resolveSrcToString(src);
    if (!initial) return finalFallbackSrc;
    return shouldBypass ? initial : null;
  });
  const [loading, setLoading] = useState(() => {
    if (!src || src === '') return false;
    return !shouldBypass;
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadImage = async () => {
      // If no src provided, use fallback immediately
      const desired = resolveSrcToString(src);
      if (!desired) {
        setImageSrc(finalFallbackSrc);
        setLoading(false);
        return;
      }

      try {
        // For priority images, bypass ALL caching and async work for immediate display
        if (shouldBypass) {
          setImageSrc(desired);
          setLoading(false);
          setError(null);
          return;
        }

        setLoading(true);
        setError(null);
        let imageUrl = null;

        // For data URLs and blob URLs, use them directly without caching
        if (typeof desired === 'string' && (desired.startsWith('data:') || desired.startsWith('blob:'))) {
          setImageSrc(desired);
          setLoading(false);
          return;
        }

        // Try cache first for non-priority images
        if (enableCache && typeof desired === 'string') {
          const cached = imageCache.getCachedImage(desired);
          if (cached) {
            imageUrl = cached;
          }
        }

        // If not cached, preload and cache it
        if (!imageUrl) {
          if (typeof desired === 'string' && desired.startsWith('http')) {
            try {
              const preloaded = enableCache ? await preloadImage(desired) : desired;
              imageUrl = preloaded || desired;
            } catch {
              imageUrl = desired;
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
  }, [src, finalFallbackSrc, priority, enableCache, shouldBypass]);

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

  // If a custom error UI is provided, show it
  if (error && errorComponent) {
    return errorComponent;
  }

  // Always mount the <img>; hide it until it finishes loading
  return (
    <img
      src={imageSrc || finalFallbackSrc}
      alt={alt}
      className={className}
      style={priority ? style : { ...style, opacity: loading ? 0 : 1, transition: 'opacity 200ms ease' }}
      loading={loadingAttr || (priority ? 'eager' : 'lazy')}
      fetchpriority={fetchPriorityAttr || (priority ? 'high' : undefined)}
      // Let the browser decide decoding for priority images
      decoding={priority ? undefined : 'async'}
      onLoad={handleLoad}
      onError={handleError}
      sizes={sizes}
      srcSet={srcSet}
      width={width}
      height={height}
      {...props}
    />
  );
};

export default CachedImage; 