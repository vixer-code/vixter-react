import React, { useState, useEffect, useCallback } from 'react';
import R2MediaViewer from './R2MediaViewer';
import CachedImage from './CachedImage';
import './SmartMediaViewer.css';

const SmartMediaViewer = ({ 
  mediaData, // Can be a string (URL) or object with { key, publicUrl }
  type = 'service', // 'service' or 'pack'
  watermarked = false, // For pack content - only when buyer is viewing
  isOwner = false, // If true, owner can see their own content without watermark

  fallbackSrc = null,
  className = '',
  sizes = null,
  alt = 'Media',
  ...props 
}) => {
  const [isR2Media, setIsR2Media] = useState(false);
  const [r2Key, setR2Key] = useState(null);
  const [fallbackUrl, setFallbackUrl] = useState(null);

  // Function to detect if media is a video
  const isVideo = (url) => {
    if (!url) return false;
    return /\.(mp4|mov|webm|ogg|avi|mkv)(\?|$)/i.test(url);
  };

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
      
      setFallbackUrl(url);
      return;
    }

    // If mediaData is an object, check if it has a key (R2 media)
    if (typeof mediaData === 'object' && mediaData.key) {
      // Check if this is from a private bucket (no publicUrl) or public bucket (has publicUrl)
      const hasPublicUrl = mediaData.publicUrl && (mediaData.publicUrl.startsWith('http') || mediaData.publicUrl.startsWith('media.vixter.com.br'));

      
      
      if (hasPublicUrl) {
        // Content from public bucket - use publicUrl directly
        // Ensure URL has protocol
        const publicUrl = mediaData.publicUrl.startsWith('http') ? mediaData.publicUrl : `https://${mediaData.publicUrl}`;

        setIsR2Media(false);
        setR2Key(null);
        setFallbackUrl(publicUrl);
      } else {
        // Content from private bucket - needs R2MediaViewer for signed URLs
        setIsR2Media(true);
        setR2Key(mediaData.key);
        setFallbackUrl(fallbackSrc);
      }
      return;
    }

    // If mediaData is an object but no key, use publicUrl as fallback
    if (typeof mediaData === 'object' && mediaData.publicUrl) {
      // Ensure URL has protocol
      const publicUrl = mediaData.publicUrl.startsWith('http') ? mediaData.publicUrl : `https://${mediaData.publicUrl}`;

      setIsR2Media(false);
      setR2Key(null);
      setFallbackUrl(publicUrl);
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
        isOwner={isOwner}
        fallbackUrl={fallbackUrl}
        className={className}
        {...props}
      />
    );
  }

  // Check if this is a video
  const isVideoFile = isVideo(fallbackUrl);
  

  // If it's a video, render video element
  if (isVideoFile) {
    return (
      <video 
        controls 
        className={`smart-media-viewer video ${className}`}
        {...props}
      >
        <source src={fallbackUrl} type="video/mp4" />
        Seu navegador não suporta vídeo.
      </video>
    );
  }
  
  // Otherwise, use CachedImage with the URL
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