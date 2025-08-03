# Image Caching System

This document explains how to use the image caching system implemented in the Vixter React project to optimize Firebase Storage image loading.

## Overview

The image caching system provides:
- **Memory caching** for fast access to recently used images
- **localStorage caching** for persistent storage across browser sessions
- **Automatic cache management** with expiration and cleanup
- **Fallback handling** for failed image loads
- **Preloading utilities** for common images

## Components

### 1. CachedImage Component

The main component for displaying cached images:

```jsx
import CachedImage from '../components/CachedImage';

// Basic usage
<CachedImage 
  src={user.profilePictureURL}
  alt="User Profile"
  className="profile-avatar"
/>

// With fallback and custom settings
<CachedImage 
  src={service.coverImageURL}
  fallbackSrc="/images/default-service.jpg"
  defaultType="PROFILE_1"
  alt={service.title}
  className="service-image"
  showLoading={true}
  enableCache={true}
/>
```

#### Props

- `src` (string|object): Firebase Storage reference or URL
- `fallbackSrc` (string): Fallback image URL if loading fails
- `defaultType` (string): Type of default image ('PROFILE_1', 'PROFILE_2', 'PROFILE_3')
- `alt` (string): Alt text for the image
- `className` (string): CSS class name
- `style` (object): Inline styles
- `showLoading` (boolean): Whether to show loading state (default: true)
- `enableCache` (boolean): Whether to enable caching (default: true)
- `onLoad` (function): On load callback
- `onError` (function): On error callback
- `loadingComponent` (React.ReactNode): Custom loading component
- `errorComponent` (React.ReactNode): Custom error component

### 2. useFirebaseImage Hook

Custom hook for handling Firebase Storage images:

```jsx
import { useFirebaseImage } from '../hooks/useFirebaseImage';

function MyComponent() {
  const { imageSrc, loading, error, refetch } = useFirebaseImage(
    user.profilePictureURL,
    '/images/default-avatar.jpg',
    true // enableCache
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading image</div>;

  return <img src={imageSrc} alt="Profile" />;
}
```

### 3. useFirebaseImages Hook

Hook for loading multiple images:

```jsx
import { useFirebaseImages } from '../hooks/useFirebaseImages';

function GalleryComponent() {
  const { images, loading, errors } = useFirebaseImages(
    imageUrls,
    '/images/default-image.jpg'
  );

  if (loading) return <div>Loading gallery...</div>;

  return (
    <div className="gallery">
      {images.map((imageSrc, index) => (
        <img key={index} src={imageSrc} alt={`Image ${index}`} />
      ))}
    </div>
  );
}
```

## Utilities

### Image Cache Management

```jsx
import { imageCache } from '../utils/imageCache';

// Get cache statistics
const stats = imageCache.getCacheStats();
console.log('Cache stats:', stats);

// Clear all cached data
imageCache.clearCache();

// Preload a specific image
import { preloadImage } from '../utils/imageCache';
await preloadImage('https://firebase-storage-url.com/image.jpg');
```

### Image Preloading

```jsx
import { 
  preloadCommonImages, 
  preloadUserImages,
  preloadUserProfileImages 
} from '../utils/imagePreloader';

// Preload common images (badges, defaults, etc.)
await preloadCommonImages();

// Preload user-specific images
await preloadUserImages([
  'https://firebase-storage-url.com/user1.jpg',
  'https://firebase-storage-url.com/user2.jpg'
]);

// Preload user profile and service images
await preloadUserProfileImages(userData, userServices);
```

## Migration Guide

### Replacing Regular img Tags

**Before:**
```jsx
<img 
  src={user.profilePictureURL || getDefaultImage('PROFILE_1')} 
  alt="Profile" 
/>
```

**After:**
```jsx
<CachedImage 
  src={user.profilePictureURL}
  defaultType="PROFILE_1"
  alt="Profile"
/>
```

### Replacing Firebase Storage References

**Before:**
```jsx
const [imageUrl, setImageUrl] = useState(null);

useEffect(() => {
  if (storageRef) {
    getDownloadURL(storageRef).then(setImageUrl);
  }
}, [storageRef]);

return <img src={imageUrl} alt="Image" />;
```

**After:**
```jsx
const { imageSrc, loading } = useFirebaseImage(storageRef, fallbackUrl);

if (loading) return <div>Loading...</div>;
return <img src={imageSrc} alt="Image" />;
```

## Cache Configuration

The cache system can be configured by modifying the `ImageCache` class in `src/utils/imageCache.js`:

- `maxMemorySize`: Maximum number of images in memory cache (default: 100)
- `cacheExpiry`: Cache expiration time in milliseconds (default: 24 hours)
- Cleanup interval: How often to clean expired entries (default: 1 hour)

## Performance Benefits

1. **Reduced Network Requests**: Images are cached locally and don't need to be re-downloaded
2. **Faster Loading**: Cached images load instantly from memory or localStorage
3. **Better UX**: Loading states and fallbacks provide better user experience
4. **Bandwidth Savings**: Reduces Firebase Storage bandwidth usage
5. **Automatic Management**: Cache cleanup prevents memory bloat

## Best Practices

1. **Use appropriate fallbacks**: Always provide fallback images for better UX
2. **Disable loading for small images**: Set `showLoading={false}` for small avatars
3. **Preload important images**: Use preloading utilities for commonly accessed images
4. **Monitor cache size**: Check cache statistics periodically
5. **Handle errors gracefully**: Provide error components for failed image loads

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure Firebase Storage CORS is configured properly
2. **Cache Not Working**: Check if localStorage is available and not full
3. **Memory Issues**: Reduce `maxMemorySize` if experiencing memory problems
4. **Slow Loading**: Consider preloading images for better performance

### Debug Mode

Enable debug logging by adding this to your browser console:

```javascript
// Enable debug mode
localStorage.setItem('imageCache_debug', 'true');

// Check cache stats
import { imageCache } from './utils/imageCache';
console.log(imageCache.getCacheStats());
``` 