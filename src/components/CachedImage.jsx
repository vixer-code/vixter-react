import React from 'react';
import { useFirebaseImage } from '../hooks/useFirebaseImage';
import { getDefaultImage } from '../utils/defaultImages';
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
  showLoading = true,
  loadingComponent,
  errorComponent,
  ...props
}) => {
  // Use default image if no fallback is provided
  const finalFallbackSrc = fallbackSrc || getDefaultImage(defaultType);
  
  const { imageSrc, loading, error } = useFirebaseImage(src, finalFallbackSrc, enableCache);

  const handleLoad = (e) => {
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    if (onError) onError(e);
  };

  // Show loading state
  if (loading && showLoading) {
    if (loadingComponent) {
      return loadingComponent;
    }
    
    return (
      <div 
        className={`cached-image-loading ${className}`}
        style={{ 
          backgroundColor: '#f0f0f0', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '100px',
          ...style 
        }}
        {...props}
      >
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
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
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
};

export default CachedImage; 