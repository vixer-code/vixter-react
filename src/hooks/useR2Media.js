import { useState, useCallback } from 'react';
import mediaService from '../services/mediaService';

/**
 * Hook para gerenciar mídia com R2
 */
export const useR2Media = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Upload de arquivo para R2
   */
  const uploadFile = useCallback(async (file, type, itemId = null) => {
    try {
      setUploading(true);
      setUploadProgress(0);

      const result = await mediaService.uploadFile(file, type, itemId);
      
      setUploadProgress(100);
      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, []);

  /**
   * Upload de múltiplos arquivos
   */
  const uploadMultipleFiles = useCallback(async (files, type, itemId = null) => {
    try {
      setUploading(true);
      setUploadProgress(0);

      const results = [];
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await mediaService.uploadFile(file, type, itemId);
        results.push(result);
        
        // Update progress
        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      return results;
    } catch (error) {
      console.error('Error uploading multiple files:', error);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, []);

  /**
   * Gerar URL de download (com ou sem watermark)
   */
  const getDownloadUrl = useCallback(async (key, watermarked = false, userId = null, packId = null) => {
    try {
      return await mediaService.generateDownloadUrl(key, watermarked, userId, packId);
    } catch (error) {
      console.error('Error generating download URL:', error);
      throw error;
    }
  }, []);

  /**
   * Gerar URL segura de conteúdo de pack com watermark específico do usuário
   */
  const generateSecurePackContentUrl = useCallback(async (key, userId, packId, orderId = null) => {
    try {
      return await mediaService.generatePackContentUrl(key, userId, packId, orderId);
    } catch (error) {
      console.error('Error generating secure pack content URL:', error);
      throw error;
    }
  }, []);

  /**
   * Deletar mídia
   */
  const deleteMedia = useCallback(async (key) => {
    try {
      return await mediaService.deleteMedia(key);
    } catch (error) {
      console.error('Error deleting media:', error);
      throw error;
    }
  }, []);

  /**
   * Deletar mídia de conteúdo de pack (bucket privado)
   */
  const deletePackContentMedia = useCallback(async (key) => {
    try {
      return await mediaService.deleteMedia(key, 'pack-content');
    } catch (error) {
      console.error('Error deleting pack content media:', error);
      throw error;
    }
  }, []);

  /**
   * Upload de mídia de pack (capa e amostras - bucket público)
   */
  const uploadPackMedia = useCallback(async (file, packId) => {
    return await uploadFile(file, 'pack', packId);
  }, [uploadFile]);

  /**
   * Upload de conteúdo de pack (bucket privado)
   * Vídeos e imagens usam o mesmo sistema de upload R2
   */
  const uploadPackContentMedia = useCallback(async (file, packId, vendorId) => {
    // All files (videos and images) use the standard R2 upload
    return await uploadFile(file, 'pack-content', packId);
  }, [uploadFile]);

  /**
   * Upload de mídia de serviço
   */
  const uploadServiceMedia = useCallback(async (file, serviceId) => {
    return await uploadFile(file, 'service', serviceId);
  }, [uploadFile]);

  /**
   * Obter URL de conteúdo de pack (com watermark)
   */
  const getPackContentUrl = useCallback(async (key) => {
    return await getDownloadUrl(key, true);
  }, [getDownloadUrl]);

  /**
   * Obter URL de mídia de serviço (sem watermark)
   */
  const getServiceMediaUrl = useCallback(async (key) => {
    return await getDownloadUrl(key, false);
  }, [getDownloadUrl]);

  return {
    uploading,
    uploadProgress,
    uploadFile,
    uploadMultipleFiles,
    getDownloadUrl,
    generateSecurePackContentUrl,
    deleteMedia,
    deletePackContentMedia,
    uploadPackMedia,
    uploadPackContentMedia,
    uploadServiceMedia,
    getPackContentUrl,
    getServiceMediaUrl,
  };
};

export default useR2Media;
