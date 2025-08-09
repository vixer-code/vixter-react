// Image cache utility for Firebase Storage images
class ImageCache {
  constructor() {
    this.memoryCache = new Map();
    this.maxMemorySize = 100; // Maximum number of images in memory cache
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  // Generate a cache key from the Firebase Storage URL
  generateCacheKey(url) {
    if (!url) return null;
    // If it's a relative URL, just return it directly
    try {
      const urlObj = new URL(url, window.location.origin);
      const isSameOrigin = urlObj.origin === window.location.origin;
      // Extract Firebase Storage object path when applicable
      const pathMatch = urlObj.pathname.match(/\/o\/(.+?)\?/);
      if (pathMatch) {
        return decodeURIComponent(pathMatch[1]);
      }
      // Use full absolute URL for cross-origin, relative for same-origin
      return isSameOrigin ? urlObj.pathname + urlObj.search : urlObj.href;
    } catch {
      // As a last resort, return the raw string
      return url;
    }
  }

  // Get cached image data
  getCachedImage(url) {
    const cacheKey = this.generateCacheKey(url);
    if (!cacheKey) return null;

    // Check memory cache first
    const memoryData = this.memoryCache.get(cacheKey);
    if (memoryData && !this.isExpired(memoryData.timestamp)) {
      return memoryData.data;
    }

    // Check localStorage
    try {
      const storedData = localStorage.getItem(`img_cache_${cacheKey}`);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        if (!this.isExpired(parsedData.timestamp)) {
          // Move to memory cache for faster access
          this.setMemoryCache(cacheKey, parsedData.data);
          return parsedData.data;
        } else {
          // Remove expired data
          localStorage.removeItem(`img_cache_${cacheKey}`);
        }
      }
    } catch (error) {
      console.warn('Error reading from localStorage cache:', error);
    }

    return null;
  }

  // Cache image data
  cacheImage(url, data) {
    const cacheKey = this.generateCacheKey(url);
    if (!cacheKey) return;

    const cacheData = {
      data,
      timestamp: Date.now()
    };

    // Store in memory cache
    this.setMemoryCache(cacheKey, data);

    // Store in localStorage
    try {
      localStorage.setItem(`img_cache_${cacheKey}`, JSON.stringify(cacheData));
     } catch (error) {
      console.warn('Error writing to localStorage cache:', error);
      // If localStorage is full, try to clear some old entries
      this.cleanupLocalStorage();
    }
  }

  // Set memory cache with size management
  setMemoryCache(key, data) {
    // Remove oldest entries if cache is full
    if (this.memoryCache.size >= this.maxMemorySize) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
    
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Check if cache entry is expired
  isExpired(timestamp) {
    return Date.now() - timestamp > this.cacheExpiry;
  }

  // Clean up expired entries from localStorage
  cleanupLocalStorage() {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith('img_cache_'));
      
      cacheKeys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (this.isExpired(data.timestamp)) {
            localStorage.removeItem(key);
          }
      } catch (error) {
          // Remove invalid entries
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Error cleaning up localStorage cache:', error);
    }
  }

  // Clear all cached data
  clearCache() {
    this.memoryCache.clear();
    
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith('img_cache_'));
      cacheKeys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Error clearing localStorage cache:', error);
    }
  }

  // Get cache statistics
  getCacheStats() {
    let localStorageCount = 0;
    try {
      const keys = Object.keys(localStorage);
      localStorageCount = keys.filter(key => key.startsWith('img_cache_')).length;
    } catch (error) {
      console.warn('Error getting localStorage stats:', error);
    }

    return {
      memoryCacheSize: this.memoryCache.size,
      localStorageCount,
      maxMemorySize: this.maxMemorySize
    };
  }
}

// Create a singleton instance
const imageCache = new ImageCache();

// Utility function to preload an image
export const preloadImage = (url) => {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('No URL provided'));
      return;
    }

    // Check if already cached
    const cachedData = imageCache.getCachedImage(url);
    if (cachedData) {
      resolve(cachedData);
      return;
    }

    const img = new Image();
    // Determine if cross-origin; only set crossOrigin when needed and allowed
    let isCrossOrigin = false;
    try {
      const parsed = new URL(url, window.location.origin);
      isCrossOrigin = parsed.origin !== window.location.origin;
      if (!isCrossOrigin) {
        img.crossOrigin = 'anonymous';
      }
    } catch {}
    
    img.onload = () => {
      // For cross-origin images, avoid canvas conversion to prevent CORS taint
      if (isCrossOrigin) {
        imageCache.cacheImage(url, url);
        resolve(url);
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        imageCache.cacheImage(url, dataUrl);
        resolve(dataUrl);
      } catch (error) {
        imageCache.cacheImage(url, url);
        resolve(url);
      }
    };
    
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };
    
    img.src = url;
  });
};

// Export the cache instance for direct access
export { imageCache };

// Clean up expired cache entries periodically
setInterval(() => {
  imageCache.cleanupLocalStorage();
}, 60 * 60 * 1000); // Clean up every hour 