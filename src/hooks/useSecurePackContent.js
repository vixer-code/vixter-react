import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for secure pack content access with watermarking
 */
export const useSecurePackContent = () => {
  const { currentUser, getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generate secure URL for pack content with watermark
   */
  const generateSecurePackContentUrl = useCallback(async (
    contentKey,
    packId,
    orderId,
    watermark = null
  ) => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    if (!contentKey || !packId || !orderId) {
      throw new Error('Missing required parameters');
    }

    setLoading(true);
    setError(null);

    try {
      // Get Firebase ID token for authentication (force refresh)
      const token = await getIdToken();

      // Use Cloud Function for secure pack content access with watermark
      const cloudFunctionUrl = 'https://packcontentaccess-6twxbx5ima-ue.a.run.app';
      
      // Build query parameters
      const params = new URLSearchParams({
        packId,
        orderId,
        contentKey,
        username: watermark || currentUser.email?.split('@')[0] || 'user',
        token: token
      });
      
      const secureUrl = `${cloudFunctionUrl}?${params.toString()}`;
      
      // Return the secure URL directly (the Cloud Function will handle watermarking)
      return {
        url: secureUrl,
        watermark: watermark || currentUser.email?.split('@')[0] || 'user',
        downloadUrl: secureUrl
      };

    } catch (err) {
      console.error('Error generating secure pack content URL:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  /**
   * Generate secure URLs for multiple content items
   */
  const generateMultipleSecureUrls = useCallback(async (
    packContent,
    packId,
    orderId,
    watermark = null
  ) => {
    if (!packContent || !Array.isArray(packContent)) {
      return {};
    }

    const urls = {};
    
    for (const contentItem of packContent) {
      if (contentItem.key) {
        try {
          const result = await generateSecurePackContentUrl(
            contentItem.key,
            packId,
            orderId,
            watermark
          );
          urls[contentItem.key] = result.url;
        } catch (err) {
          console.error(`Error generating URL for ${contentItem.key}:`, err);
          urls[contentItem.key] = null;
        }
      }
    }

    return urls;
  }, [generateSecurePackContentUrl]);

  /**
   * Open content in secure viewer with watermark
   */
  const openSecureContent = useCallback(async (
    contentKey,
    packId,
    orderId,
    watermark = null
  ) => {
    try {
      const result = await generateSecurePackContentUrl(
        contentKey,
        packId,
        orderId,
        watermark
      );

      // Open in new tab with security settings
      window.open(result.url, '_blank', 'noopener,noreferrer,resizable=yes,scrollbars=yes');
      
      return result;
    } catch (err) {
      console.error('Error opening secure content:', err);
      throw err;
    }
  }, [generateSecurePackContentUrl]);

  /**
   * Check if user has access to pack content
   */
  const checkPackAccess = useCallback(async (packId, orderId) => {
    if (!currentUser) {
      return { hasAccess: false, reason: 'User not authenticated' };
    }

    try {
      // This would call a separate Cloud Function to check access
      // For now, we'll assume access if user is authenticated
      // In a real implementation, you'd verify the pack order status
      return { hasAccess: true };
    } catch (err) {
      console.error('Error checking pack access:', err);
      return { hasAccess: false, reason: err.message };
    }
  }, [currentUser]);

  return {
    generateSecurePackContentUrl,
    generateMultipleSecureUrls,
    openSecureContent,
    checkPackAccess,
    loading,
    error
  };
};

export default useSecurePackContent;
