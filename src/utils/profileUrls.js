/**
 * Utility functions for generating profile URLs
 */

/**
 * Generate profile URL using username if available, fallback to user ID
 * @param {Object} user - User object with id and username
 * @returns {string} Profile URL
 */
export const getProfileUrl = (user) => {
  if (!user) return '/profile';
  
  // If user has a username, use it for the URL
  if (user.username) {
    return `/profile/${user.username}`;
  }
  
  // Fallback to user ID if no username
  return `/profile/${user.id}`;
};

/**
 * Generate profile URL from user ID (for cases where we only have ID)
 * @param {string} userId - User ID
 * @param {string} username - Optional username
 * @returns {string} Profile URL
 */
export const getProfileUrlById = (userId, username = null) => {
  if (!userId) return '/profile';
  
  // If username is provided, use it
  if (username) {
    return `/profile/${username}`;
  }
  
  // Fallback to user ID
  return `/profile/${userId}`;
};

/**
 * Check if a string is a valid username (not a Firebase UID)
 * @param {string} str - String to check
 * @returns {boolean} True if looks like username, false if looks like UID
 */
export const isUsername = (str) => {
  if (!str) return false;
  
  // Firebase UIDs are typically 28 characters long and contain only alphanumeric characters
  // Usernames are typically shorter and may contain underscores, hyphens, etc.
  return str.length < 28 || /[^a-zA-Z0-9]/.test(str);
};
