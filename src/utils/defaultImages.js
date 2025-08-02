import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

// Default image URLs (will be populated after upload)
export const DEFAULT_IMAGES = {
  PROFILE_1: null, // defpfp1.png
  PROFILE_2: null, // defpfp2.png  
  PROFILE_3: null, // defpfp3.png
};

// Function to upload default images to Firebase Storage
export const uploadDefaultImages = async () => {
  try {
    const defaultImages = [
      { name: 'defpfp1.png', key: 'PROFILE_1' },
      { name: 'defpfp2.png', key: 'PROFILE_2' },
      { name: 'defpfp3.png', key: 'PROFILE_3' },
    ];

    const uploadPromises = defaultImages.map(async ({ name, key }) => {
      // Fetch the image from public folder
      const response = await fetch(`/images/${name}`);
      const blob = await response.blob();
      
      // Upload to Firebase Storage (same location as user profile pictures)
      const storageRef = ref(storage, `profilePictures/default_${name}`);
      await uploadBytes(storageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      console.log(`Uploaded ${name} to Firebase:`, downloadURL);
      return { key, url: downloadURL };
    });

    const results = await Promise.all(uploadPromises);
    
    // Update the DEFAULT_IMAGES object
    results.forEach(({ key, url }) => {
      DEFAULT_IMAGES[key] = url;
    });

    console.log('All default images uploaded successfully:', DEFAULT_IMAGES);
    return DEFAULT_IMAGES;
  } catch (error) {
    console.error('Error uploading default images:', error);
    throw error;
  }
};

// Function to get default image URL with fallback
export const getDefaultImage = (type = 'PROFILE_1') => {
  return DEFAULT_IMAGES[type] || `/images/${type === 'PROFILE_1' ? 'defpfp1.png' : type === 'PROFILE_2' ? 'defpfp2.png' : 'defpfp3.png'}`;
};

// Function to initialize default images (call this once after upload)
export const initializeDefaultImages = (urls) => {
  Object.assign(DEFAULT_IMAGES, urls);
}; 