import { useState, useEffect } from 'react';
import { getDownloadURL } from 'firebase/storage';
import { preloadImage } from '../utils/imageCache';

/**
 * Custom hook for handling Firebase Storage images with caching
 * @param {string} storageRef - Firebase Storage reference or URL
 * @param {string} fallbackUrl - Fallback image URL if loading fails
 * @param {boolean} enableCache - Whether to enable caching (default: true)
 * @returns {object} - { imageSrc, loading, error, refetch }
 */
export const useFirebaseImage = (storageRef, fallbackUrl = null, enableCache = true) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadImage = async (ref) => {
    if (!ref) {
      setImageSrc(fallbackUrl);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let imageUrl;

      // If it's already a URL, use it directly
      if (typeof ref === 'string' && ref.startsWith('http')) {
        imageUrl = ref;
      } else {
        // Get download URL from Firebase Storage reference
        imageUrl = await getDownloadURL(ref);
      }

      if (enableCache) {
        // Use cached image loading
        const cachedUrl = await preloadImage(imageUrl);
        setImageSrc(cachedUrl);
      } else {
        // Use direct URL without caching
        setImageSrc(imageUrl);
      }

      setLoading(false);
    } catch (err) {
      console.warn('Failed to load Firebase image:', err);
      setImageSrc(fallbackUrl);
      setError(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImage(storageRef);
  }, [storageRef, enableCache]);

  const refetch = () => {
    loadImage(storageRef);
  };

  return { imageSrc, loading, error, refetch };
};

/**
 * Hook for preloading multiple Firebase images
 * @param {Array} imageRefs - Array of Firebase Storage references or URLs
 * @param {string} fallbackUrl - Fallback image URL
 * @returns {object} - { images, loading, errors }
 */
export const useFirebaseImages = (imageRefs = [], fallbackUrl = null) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!imageRefs || imageRefs.length === 0) {
      setImages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrors([]);

    const loadImages = async () => {
      const imagePromises = imageRefs.map(async (ref, index) => {
        try {
          let imageUrl;

          if (typeof ref === 'string' && ref.startsWith('http')) {
            imageUrl = ref;
          } else {
            imageUrl = await getDownloadURL(ref);
          }

          const cachedUrl = await preloadImage(imageUrl);
          return { index, url: cachedUrl, error: null };
        } catch (error) {
          return { index, url: fallbackUrl, error };
        }
      });

      const results = await Promise.all(imagePromises);
      const loadedImages = results.map(result => result.url);
      const imageErrors = results.filter(result => result.error).map(result => result.error);

      setImages(loadedImages);
      setErrors(imageErrors);
      setLoading(false);
    };

    loadImages();
  }, [imageRefs, fallbackUrl]);

  return { images, loading, errors };
}; 