// Exemplo de implementação no frontend para upload direto de vídeos
// Baseado na implementação original que funcionava sem problemas de MIME

import { httpsCallable } from 'firebase/functions';
import { functions } from './config/firebase';

class VideoUploadService {
  constructor() {
    this.functions = functions;
  }

  /**
   * Upload de vídeo direto para R2 (implementação original)
   * Esta abordagem evita problemas de MIME e é mais eficiente
   */
  async uploadVideoDirect(file, packId) {
    try {
      console.log('Starting direct video upload:', file.name, file.size);
      
      // 1. Gerar URL assinada para upload direto
      const generateUrlFunction = httpsCallable(this.functions, 'generateVideoUploadUrl');
      const urlResult = await generateUrlFunction({
        packId,
        contentType: file.type, // MIME type correto detectado pelo navegador
        originalName: file.name,
        expiresIn: 3600 // 1 hora
      });

      if (!urlResult.data.success) {
        throw new Error(urlResult.data.error || 'Failed to generate upload URL');
      }

      const { uploadUrl, key } = urlResult.data.data;
      console.log('Upload URL generated:', key);

      // 2. Upload direto para R2 (sem passar por Cloud Functions)
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type, // MIME type correto
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to R2');
      }

      console.log('Video uploaded to R2 successfully');

      // 3. Confirmar upload e atualizar packContent
      const confirmFunction = httpsCallable(this.functions, 'confirmVideoUpload');
      const confirmResult = await confirmFunction({
        packId,
        key,
        originalName: file.name
      });

      if (!confirmResult.data.success) {
        throw new Error(confirmResult.data.error || 'Failed to confirm upload');
      }

      console.log('Video upload confirmed and packContent updated');

      return {
        success: true,
        data: {
          key,
          size: file.size,
          type: file.type,
          name: file.name,
          processed: false,
          message: 'Video uploaded successfully. Processing will happen automatically in the background.'
        }
      };

    } catch (error) {
      console.error('Error in direct video upload:', error);
      throw error;
    }
  }

  /**
   * Verificar status de processamento dos vídeos
   */
  async getVideoProcessingStatus(packId) {
    try {
      const statusFunction = httpsCallable(this.functions, 'getVideoProcessingStatus');
      const result = await statusFunction({ packId });
      
      if (result.data.success) {
        return result.data.data;
      } else {
        throw new Error(result.data.error || 'Failed to get processing status');
      }
    } catch (error) {
      console.error('Error getting video processing status:', error);
      throw error;
    }
  }

  /**
   * Upload com progresso (para UI)
   */
  async uploadVideoWithProgress(file, packId, onProgress = null) {
    try {
      onProgress && onProgress(0, 'Preparando upload...');
      
      // 1. Gerar URL assinada
      onProgress && onProgress(10, 'Gerando URL de upload...');
      const generateUrlFunction = httpsCallable(this.functions, 'generateVideoUploadUrl');
      const urlResult = await generateUrlFunction({
        packId,
        contentType: file.type,
        originalName: file.name,
        expiresIn: 3600
      });

      if (!urlResult.data.success) {
        throw new Error(urlResult.data.error || 'Failed to generate upload URL');
      }

      const { uploadUrl, key } = urlResult.data.data;

      // 2. Upload direto para R2 com progresso
      onProgress && onProgress(20, 'Enviando vídeo...');
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            const uploadProgress = 20 + (percentComplete * 0.6); // 20% a 80%
            onProgress && onProgress(uploadProgress, 'Enviando vídeo...');
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            try {
              onProgress && onProgress(80, 'Confirmando upload...');
              
              // 3. Confirmar upload
              const confirmFunction = httpsCallable(this.functions, 'confirmVideoUpload');
              const confirmResult = await confirmFunction({
                packId,
                key,
                originalName: file.name
              });

              if (confirmResult.data.success) {
                onProgress && onProgress(100, 'Upload concluído!');
                resolve(confirmResult.data.data);
              } else {
                throw new Error(confirmResult.data.error || 'Failed to confirm upload');
              }
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

    } catch (error) {
      console.error('Error in upload with progress:', error);
      throw error;
    }
  }
}

// Exemplo de uso no componente React
export const useVideoUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const videoUploadService = new VideoUploadService();

  const uploadVideo = async (file, packId) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadStatus('Preparando upload...');

      const result = await videoUploadService.uploadVideoWithProgress(
        file, 
        packId, 
        (progress, status) => {
          setUploadProgress(progress);
          setUploadStatus(status);
        }
      );

      return result;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const getProcessingStatus = async (packId) => {
    try {
      return await videoUploadService.getVideoProcessingStatus(packId);
    } catch (error) {
      console.error('Status error:', error);
      throw error;
    }
  };

  return {
    uploading,
    uploadProgress,
    uploadStatus,
    uploadVideo,
    getProcessingStatus
  };
};

export default VideoUploadService;