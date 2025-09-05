import React, { useState, useEffect, useCallback } from 'react';
import R2MediaViewer from './R2MediaViewer';
import CachedImage from './CachedImage';
import './SmartMediaViewer.css';

const SmartMediaViewer = ({ 
  mediaData, // Can be a string (URL) or object with { key, publicUrl }
  type = 'service', // 'service' or 'pack'
  watermarked = false, // For pack content
  fallbackSrc = null,
  className = '',
  sizes = null,
  alt = 'Media',
  ...props 
}) => {
  const [isR2Media, setIsR2Media] = useState(false);
  const [r2Key, setR2Key] = useState(null);
  const [fallbackUrl, setFallbackUrl] = useState(null);

  // Determine if this is R2 media or regular URL
  useEffect(() => {
    if (!mediaData) {
      setIsR2Media(false);
      setR2Key(null);
      setFallbackUrl(fallbackSrc);
      return;
    }

    // If mediaData is a string, it's a regular URL
    if (typeof mediaData === 'string') {
      setIsR2Media(false);
      setR2Key(null);
      
      // Ensure URL has protocol
      let url = mediaData;
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      
      console.log('SmartMediaViewer: Processing URL:', { original: mediaData, processed: url });
      setFallbackUrl(url);
      return;
    }

    // If mediaData is an object, check if it has a key (R2 media)
    if (typeof mediaData === 'object' && mediaData.key) {
      setIsR2Media(true);
      setR2Key(mediaData.key);
      setFallbackUrl(mediaData.publicUrl || fallbackSrc);
      return;
    }

    // If mediaData is an object but no key, use publicUrl as fallback
    if (typeof mediaData === 'object' && mediaData.publicUrl) {
      setIsR2Media(false);
      setR2Key(null);
      setFallbackUrl(mediaData.publicUrl);
      return;
    }

    // Fallback to provided fallback
    setIsR2Media(false);
    setR2Key(null);
    setFallbackUrl(fallbackSrc);
  }, [mediaData, fallbackSrc]);

  // If it's R2 media, use R2MediaViewer
  if (isR2Media && r2Key) {
    return (
      <R2MediaViewer
        mediaKey={r2Key}
        type={type}
        watermarked={watermarked}
        fallbackUrl={fallbackUrl}
        className={className}
        {...props}
      />
    );
  }

  // Otherwise, use CachedImage with the URL
  console.log('SmartMediaViewer: Using CachedImage with:', { 
    src: fallbackUrl, 
    fallbackSrc, 
    isR2Media, 
    r2Key 
  });
  
  return (
    <CachedImage
      src={fallbackUrl}
      fallbackSrc={fallbackSrc}
      alt={alt}
      sizes={sizes}
      className={className}
      {...props}
    />
  );
};

export default SmartMediaViewer;
