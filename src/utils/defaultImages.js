// Default image URLs from Firebase Storage
export const DEFAULT_IMAGES = {
  PROFILE_1: 'https://firebasestorage.googleapis.com/v0/b/vixter-451b3.firebasestorage.app/o/profilePictures%2Fdefpfp1.png?alt=media&token=c416daf2-f983-443e-ae8a-1ac654b9a57c',
  PROFILE_2: 'https://firebasestorage.googleapis.com/v0/b/vixter-451b3.firebasestorage.app/o/profilePictures%2Fdefpfp2.png?alt=media&token=929005ea-b3ae-404c-bc48-3cb7f77defa5',
  PROFILE_3: 'https://firebasestorage.googleapis.com/v0/b/vixter-451b3.firebasestorage.app/o/profilePictures%2Fdefpfp3.png?alt=media&token=e353c81b-ec9b-41c6-ab8a-064549ce865e',
};

// Function to get default image URL with fallback
export const getDefaultImage = (type = 'PROFILE_1') => {
  return DEFAULT_IMAGES[type] || `/images/${type === 'PROFILE_1' ? 'defpfp1.png' : type === 'PROFILE_2' ? 'defpfp2.png' : 'defpfp3.png'}`;
}; 