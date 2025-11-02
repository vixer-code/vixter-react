// Media service for R2 integration
// Backend can remain on vercel.app if CORS is properly configured
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
      // Android fix: Ensure file.type is not empty
      let contentType = file.type;
      if (!contentType || contentType === '') {
        // Detect content type from file extension
        const extension = file.name.split('.').pop().toLowerCase();
        const mimeTypes = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'mp4': 'video/mp4',
          'mov': 'video/quicktime',
          'avi': 'video/x-msvideo',
          'pdf': 'application/pdf',
          'zip': 'application/zip',
          'rar': 'application/x-rar-compressed',
          'txt': 'text/plain',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        contentType = mimeTypes[extension] || 'application/octet-stream';
        console.log(`Android fix: Detected content type ${contentType} for file ${file.name}`);
      }

      // Generate upload URL
      const uploadData = await this.generateUploadUrl(
        type,
        contentType,
        file.name,
        itemId
      );

      // Upload file to R2
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to R2');
      }

      return {
        key: uploadData.key,
        publicUrl: uploadData.publicUrl,
        size: file.size,
        type: contentType,
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
  async generateDownloadUrl(key, watermarked = false, userId = null, packId = null) {
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
          userId,
          packId,
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
   * Generate secure pack content URL with user-specific watermark
   */
  async generatePackContentUrl(key, userId, packId, orderId = null) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.backendUrl}/api/pack-content/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          key,
          userId,
          packId,
          orderId,
          expiresIn: 7200, // 2 hours
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate pack content URL');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error generating pack content URL:', error);
      throw error;
    }
  }

  /**
   * Generate service media URL (fixed, no watermark)
   */
  async generateServiceMediaUrl(key) {
    return await this.generateDownloadUrl(key, false);
  }

  /**
   * Delete media from R2
   */
  async deleteMedia(key, type = null) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.backendUrl}/api/media/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ key, type }),
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
   * Upload pack content video using standard R2 upload
   */
  async uploadPackContentVideo(file, packId, vendorId) {
    // Use the standard upload method for videos, same as images
    // vendorId is kept for API compatibility but not used in R2 upload
    return await this.uploadFile(file, 'pack-content', packId);
  }

  /**
   * Upload service media
   */
  async uploadServiceMedia(file, serviceId) {
    return await this.uploadFile(file, 'service', serviceId);
  }

  /**
   * Get watermarked download URL for pack content (legacy - use generatePackContentUrl for new implementation)
   */
  async getPackContentUrl(key) {
    return await this.generateDownloadUrl(key, true);
  }

  /**
   * Get regular download URL for service media
   */
  async getServiceMediaUrl(key) {
    return await this.generateServiceMediaUrl(key);
  }
}

export default new MediaService();
