import { preloadImage } from './imageCache';
import { DEFAULT_IMAGES } from './defaultImages';

/**
 * Preload commonly used images to improve performance
 */
export const preloadCommonImages = async () => {
  const commonImages = [
    // Default profile images
    DEFAULT_IMAGES.PROFILE_1,
    DEFAULT_IMAGES.PROFILE_2,
    DEFAULT_IMAGES.PROFILE_3,
    
    // Badge images
    '/images/iron.png',
    '/images/bronze.png',
    '/images/silver.png',
    '/images/gold.png',
    '/images/platinum.png',
    '/images/emerald.png',
    '/images/diamond.png',
    '/images/master.png',
    '/images/admin.png',
    
    // Default service images
    '/images/default-service.jpg',
    '/images/default-pack.jpg',
    '/images/default-subscription.jpg',
    '/images/default-avatar.jpg'
  ];

  console.log('Preloading common images...');
  
  const preloadPromises = commonImages.map(async (imageUrl) => {
    try {
      await preloadImage(imageUrl);
      return { url: imageUrl, success: true };
    } catch (error) {
      console.warn(`Failed to preload image: ${imageUrl}`, error);
      return { url: imageUrl, success: false, error };
    }
  });

  const results = await Promise.allSettled(preloadPromises);
  
  const successful = results.filter(result => 
    result.status === 'fulfilled' && result.value.success
  ).length;
  
  const failed = results.length - successful;
  
  console.log(`Image preloading complete: ${successful} successful, ${failed} failed`);
  
  return {
    total: results.length,
    successful,
    failed,
    results: results.map(result => 
      result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
    )
  };
};

/**
 * Preload user-specific images (profile pictures, service images, etc.)
 * @param {Array} imageUrls - Array of image URLs to preload
 */
export const preloadUserImages = async (imageUrls = []) => {
  if (!imageUrls || imageUrls.length === 0) return;

  console.log(`Preloading ${imageUrls.length} user images...`);

  const preloadPromises = imageUrls.map(async (imageUrl) => {
    try {
      await preloadImage(imageUrl);
      return { url: imageUrl, success: true };
    } catch (error) {
      console.warn(`Failed to preload user image: ${imageUrl}`, error);
      return { url: imageUrl, success: false, error };
    }
  });

  const results = await Promise.allSettled(preloadPromises);
  
  const successful = results.filter(result => 
    result.status === 'fulfilled' && result.value.success
  ).length;
  
  console.log(`User image preloading complete: ${successful}/${imageUrls.length} successful`);
  
  return {
    total: imageUrls.length,
    successful,
    failed: imageUrls.length - successful
  };
};

/**
 * Preload images for a specific user's profile and services
 * @param {object} userData - User data object
 * @param {Array} services - User's services array
 */
export const preloadUserProfileImages = async (userData, services = []) => {
  const imageUrls = [];

  // Add profile images
  if (userData?.profilePictureURL) {
    imageUrls.push(userData.profilePictureURL);
  }
  if (userData?.coverPhotoURL) {
    imageUrls.push(userData.coverPhotoURL);
  }

  // Add service images
  services.forEach(service => {
    if (service?.coverImageURL) {
      imageUrls.push(service.coverImageURL);
    }
    if (service?.imageUrl) {
      imageUrls.push(service.imageUrl);
    }
  });

  return await preloadUserImages(imageUrls);
};

/**
 * Preload images for multiple users
 * @param {Array} users - Array of user data objects
 */
export const preloadMultipleUsersImages = async (users = []) => {
  const imageUrls = [];

  users.forEach(user => {
    if (user?.profilePictureURL) {
      imageUrls.push(user.profilePictureURL);
    }
    if (user?.coverPhotoURL) {
      imageUrls.push(user.coverPhotoURL);
    }
  });

  return await preloadUserImages(imageUrls);
}; 