// Media service for R2 integration
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://vixter-react-llyd.vercel.app';

class MediaService {
  constructor() {
    this.backendUrl = BACKEND_URL;
  }

  /**
   * Get Firebase ID token for authentication
   */
  async getAuthToken() {
    const { auth } = await import('../../config/firebase');
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    return await user.getIdToken();
  }

  /**
   * Generate upload URL for media
   */
  async generateUploadUrl(type, contentType, originalName, itemId = null) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.backendUrl}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          contentType,
          originalName,
          itemId,
          expiresIn: 3600, // 1 hour
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate upload URL');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw error;
    }
  }

  /**
   * Upload file to R2 using signed URL
   */
  async uploadFile(file, type, itemId = null) {
    try {
      // Generate upload URL
      const uploadData = await this.generateUploadUrl(
        type,
        file.type,
        file.name,
        itemId
      );

      // Upload file to R2
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to R2');
      }

      return {
        key: uploadData.key,
        publicUrl: uploadData.publicUrl,
        size: file.size,
        type: file.type,
        name: file.name,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Generate download URL for media
   */
  async generateDownloadUrl(key, watermarked = false) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.backendUrl}/api/media/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          key,
          watermarked,
          expiresIn: 3600, // 1 hour
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate download URL');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw error;
    }
  }

  /**
   * Delete media from R2
   */
  async deleteMedia(key) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.backendUrl}/api/media/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ key }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete media');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error deleting media:', error);
      throw error;
    }
  }

  /**
   * Upload pack media
   */
  async uploadPackMedia(file, packId) {
    return await this.uploadFile(file, 'pack', packId);
  }

  /**
   * Upload service media
   */
  async uploadServiceMedia(file, serviceId) {
    return await this.uploadFile(file, 'service', serviceId);
  }

  /**
   * Get watermarked download URL for pack content
   */
  async getPackContentUrl(key) {
    return await this.generateDownloadUrl(key, true);
  }

  /**
   * Get regular download URL for service media
   */
  async getServiceMediaUrl(key) {
    return await this.generateDownloadUrl(key, false);
  }
}

export default new MediaService();
