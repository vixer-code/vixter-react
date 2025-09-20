import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import mediaService from '../services/mediaService';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import useR2Media from '../hooks/useR2Media';

const PacksContextR2 = createContext({});

export const usePacksR2 = () => {
  const context = useContext(PacksContextR2);
  if (!context) {
    throw new Error('usePacksR2 must be used within a PacksProviderR2');
  }
  return context;
};

export const PacksProviderR2 = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const { uploadPackMedia, uploadPackContentMedia, getPackContentUrl, deleteMedia, deletePackContentMedia } = useR2Media();
  
  // State
  const [packs, setPacks] = useState([]);
  const [userPacks, setUserPacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Cloud Functions for pack operations
  const createPackFunc = httpsCallable(functions, 'createPack');
  const updatePackFunc = httpsCallable(functions, 'updatePack');
  const deletePackFunc = httpsCallable(functions, 'deletePack');

  // Categories for filtering
  const PACK_CATEGORIES = [
    'geral',
    'design',
    'programacao',
    'marketing',
    'educacao',
    'entretenimento',
    'lifestyle',
    'negocios'
  ];

  // Load user's packs
  const loadUserPacks = useCallback(async (userId = null) => {
    const targetUserId = userId || currentUser?.uid;
    if (!targetUserId) return;

    try {
      setLoading(true);
      
      const packsRef = collection(db, 'packs');
      const q = query(
        packsRef,
        where('authorId', '==', targetUserId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const packsData = [];
      
      snapshot.forEach((doc) => {
        packsData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Always update userPacks state for Profile component to use
      setUserPacks(packsData);
      
      return packsData;
      
    } catch (error) {
      console.error('Error loading user packs:', error);
      showError('Erro ao carregar packs do usuário.', 'Erro');
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUser, showError]);

  // Search packs
  const searchPacks = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      
      const packsRef = collection(db, 'packs');
      let q = query(
        packsRef,
        where('isActive', '==', true)
      );

      // Add category filter
      if (filters.category && filters.category !== 'all') {
        q = query(q, where('category', '==', filters.category));
      }

      // Add price range filter
      if (filters.minPrice !== undefined) {
        q = query(q, where('price', '>=', filters.minPrice));
      }
      if (filters.maxPrice !== undefined) {
        q = query(q, where('price', '<=', filters.maxPrice));
      }

      // Add ordering
      const orderField = filters.sortBy || 'createdAt';
      const orderDirection = filters.sortDirection || 'desc';
      q = query(q, orderBy(orderField, orderDirection));

      // Add pagination
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      if (filters.startAfter) {
        q = query(q, startAfter(filters.startAfter));
      }

      const snapshot = await getDocs(q);
      const packsData = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Client-side text search (for better UX)
        if (filters.searchTerm) {
          const searchTerm = filters.searchTerm.toLowerCase();
          const matchesSearch = (
            data.title.toLowerCase().includes(searchTerm) ||
            data.description.toLowerCase().includes(searchTerm) ||
            data.searchTerms?.some(term => term.includes(searchTerm))
          );
          
          if (!matchesSearch) return;
        }
        
        packsData.push({
          id: doc.id,
          ...data
        });
      });

      return packsData;
      
    } catch (error) {
      console.error('Error searching packs:', error);
      showError('Erro ao buscar packs.', 'Erro');
      return [];
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Get pack by ID
  const getPackById = useCallback(async (packId) => {
    if (!packId) return null;

    try {
      const packRef = doc(db, 'packs', packId);
      const packSnap = await getDoc(packRef);
      
      if (packSnap.exists()) {
        return {
          id: packSnap.id,
          ...packSnap.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting pack by ID:', error);
      return null;
    }
  }, []);

  // Create new pack with R2 media
  const createPack = useCallback(async (packData, onProgress = null) => {
    if (!currentUser) {
      showError('Você precisa estar logado para criar um pack.', 'Erro');
      return false;
    }

    try {
      setCreating(true);
      
      // Create the pack using Cloud Function
      const result = await createPackFunc(packData);
      
      if (result.data.success) {
        const packId = result.data.packId;
        
        // Calculate total files to upload
        const totalFiles = [
          packData.coverImageFile,
          ...(packData.sampleImageFiles || []),
          ...(packData.sampleVideoFiles || []),
          ...(packData.packFiles || [])
        ].filter(Boolean).length;

        let uploadedFiles = 0;
        
        // Upload media files to R2
        const mediaData = {
          coverImage: null,
          sampleImages: [],
          sampleVideos: [],
          packContent: []
        };

        // Upload cover image
        if (packData.coverImageFile) {
          onProgress && onProgress(Math.round((uploadedFiles / totalFiles) * 100), 'Enviando imagem de capa...');
          const coverResult = await uploadPackMedia(packData.coverImageFile, packId);
          mediaData.coverImage = {
            key: coverResult.key,
            publicUrl: coverResult.publicUrl,
            size: coverResult.size,
            type: coverResult.type
          };
          uploadedFiles++;
        }

        // Upload sample images
        if (packData.sampleImageFiles && packData.sampleImageFiles.length > 0) {
          for (let i = 0; i < packData.sampleImageFiles.length; i++) {
            const file = packData.sampleImageFiles[i];
            onProgress && onProgress(Math.round((uploadedFiles / totalFiles) * 100), `Enviando amostra ${i + 1}/${packData.sampleImageFiles.length}...`);
            const sampleResult = await uploadPackMedia(file, packId);
            mediaData.sampleImages.push({
              key: sampleResult.key,
              publicUrl: sampleResult.publicUrl,
              size: sampleResult.size,
              type: sampleResult.type
            });
            uploadedFiles++;
          }
        }

        // Upload sample videos
        if (packData.sampleVideoFiles && packData.sampleVideoFiles.length > 0) {
          for (let i = 0; i < packData.sampleVideoFiles.length; i++) {
            const file = packData.sampleVideoFiles[i];
            onProgress && onProgress(Math.round((uploadedFiles / totalFiles) * 100), `Enviando vídeo de amostra ${i + 1}/${packData.sampleVideoFiles.length}...`);
            const sampleResult = await uploadPackMedia(file, packId);
            mediaData.sampleVideos.push({
              key: sampleResult.key,
              publicUrl: sampleResult.publicUrl,
              size: sampleResult.size,
              type: sampleResult.type
            });
            uploadedFiles++;
          }
        }

        // Upload pack content files (to private bucket)
        if (packData.packFiles && packData.packFiles.length > 0) {
          for (let i = 0; i < packData.packFiles.length; i++) {
            const file = packData.packFiles[i];
            onProgress && onProgress(Math.round((uploadedFiles / totalFiles) * 100), `Enviando arquivo do pack ${i + 1}/${packData.packFiles.length}...`);
            const contentResult = await uploadPackContentMedia(file, packId);
            mediaData.packContent.push({
              key: contentResult.key,
              // No publicUrl for pack content (private bucket)
              size: contentResult.size,
              type: contentResult.type,
              name: contentResult.name
            });
            uploadedFiles++;
          }
        }

        // Final progress update
        onProgress && onProgress(100, 'Finalizando...');

        // Update pack with media data directly in Firestore
        const packRef = doc(db, 'packs', packId);
        await updateDoc(packRef, {
          ...mediaData,
          mediaStorage: 'r2', // Flag to indicate R2 storage
          updatedAt: new Date()
        });

        showSuccess('Pack criado com sucesso!', 'Pack Criado');
        
        // Reload user packs
        await loadUserPacks();
        
        return { success: true, packId };
      }
      
      return false;
    } catch (error) {
      console.error('Error creating pack:', error);
      showError('Erro ao criar pack. Tente novamente.', 'Erro');
      return false;
    } finally {
      setCreating(false);
    }
  }, [currentUser, showSuccess, showError, loadUserPacks, uploadPackMedia]);

  // Update pack
  const updatePack = useCallback(async (packId, updates, showSuccessMessage = true) => {
    if (!currentUser) {
      showError('Você precisa estar logado para atualizar um pack.', 'Erro');
      return false;
    }

    try {
      setUpdating(true);
      
      const result = await updatePackFunc({ packId, ...updates });
      
      if (result.data.success) {
        if (showSuccessMessage) {
          showSuccess('Pack atualizado com sucesso!', 'Pack Atualizado');
        }
        
        // Reload user packs
        await loadUserPacks();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating pack:', error);
      showError('Erro ao atualizar pack. Tente novamente.', 'Erro');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [currentUser, showSuccess, showError, loadUserPacks]);

  // Delete pack
  const deletePack = useCallback(async (packId, onProgress = null) => {
    if (!currentUser) {
      showError('Você precisa estar logado para deletar um pack.', 'Erro');
      return false;
    }

    try {
      console.log('Starting pack deletion for ID:', packId);
      onProgress && onProgress(0, 'Iniciando exclusão do pack...');
      
      // Get pack data to delete media files
      const pack = await getPackById(packId);
      if (!pack) {
        console.error('Pack not found:', packId);
        showError('Pack não encontrado.', 'Erro');
        return false;
      }

      console.log('Deleting pack with data:', {
        packId,
        coverImage: pack.coverImage,
        sampleImages: pack.sampleImages,
        sampleVideos: pack.sampleVideos,
        packContent: pack.packContent
      });

      // Delete R2 media files first
      try {
        onProgress && onProgress(10, 'Deletando imagem de capa...');
        
        // Delete cover image - handle both R2 key object and URL string
        if (pack.coverImage?.key) {
          console.log('Deleting R2 cover image with key:', pack.coverImage.key);
          await deleteMedia(pack.coverImage.key);
        } else if (pack.coverImage && typeof pack.coverImage === 'string') {
          console.log('Cover image is URL string:', pack.coverImage);
          // Try to extract key from URL if it's an R2 URL
          const urlParts = pack.coverImage.split('/');
          const possibleKey = urlParts[urlParts.length - 1];
          if (possibleKey && possibleKey.includes('.')) {
            console.log('Attempting to delete cover image with extracted key:', possibleKey);
            try {
              await deleteMedia(possibleKey);
            } catch (keyError) {
              console.warn('Could not delete cover image with extracted key:', keyError);
            }
          }
        }

        // Delete sample images
        if (pack.sampleImages && Array.isArray(pack.sampleImages)) {
          onProgress && onProgress(20, 'Deletando imagens de amostra...');
          for (let i = 0; i < pack.sampleImages.length; i++) {
            const image = pack.sampleImages[i];
            if (image.key) {
              console.log('Deleting R2 sample image with key:', image.key);
              await deleteMedia(image.key);
            }
            // Update progress for each image
            const progress = 20 + Math.round((i + 1) / pack.sampleImages.length * 20);
            onProgress && onProgress(progress, `Deletando imagens de amostra... (${i + 1}/${pack.sampleImages.length})`);
          }
        }

        // Delete sample videos
        if (pack.sampleVideos && Array.isArray(pack.sampleVideos)) {
          onProgress && onProgress(40, 'Deletando vídeos de amostra...');
          for (let i = 0; i < pack.sampleVideos.length; i++) {
            const video = pack.sampleVideos[i];
            if (video.key) {
              console.log('Deleting R2 sample video with key:', video.key);
              await deleteMedia(video.key);
            }
            // Update progress for each video
            const progress = 40 + Math.round((i + 1) / pack.sampleVideos.length * 20);
            onProgress && onProgress(progress, `Deletando vídeos de amostra... (${i + 1}/${pack.sampleVideos.length})`);
          }
        }

        // Delete pack content (from private bucket)
        if (pack.packContent && Array.isArray(pack.packContent)) {
          onProgress && onProgress(60, 'Deletando conteúdo do pack...');
          for (let i = 0; i < pack.packContent.length; i++) {
            const content = pack.packContent[i];
            if (content.key) {
              console.log('Deleting R2 pack content with key:', content.key);
              await deletePackContentMedia(content.key);
            }
            // Update progress for each content
            const progress = 60 + Math.round((i + 1) / pack.packContent.length * 20);
            onProgress && onProgress(progress, `Deletando conteúdo do pack... (${i + 1}/${pack.packContent.length})`);
          }
        }
      } catch (mediaError) {
        console.warn('Error deleting some media files:', mediaError);
        // Continue with Firestore deletion even if media deletion fails
      }

      // Delete from Firestore using Firebase Functions
      onProgress && onProgress(80, 'Removendo dados do banco de dados...');
      console.log('🗑️ Deleting pack from Firestore via Functions...');
      console.log('📋 Pack ID:', packId, 'Type:', typeof packId);
      
      if (!packId || typeof packId !== 'string') {
        throw new Error('Invalid pack ID');
      }
      
      console.log('📞 Calling Cloud Function with payload:', { packId });
      const result = await deletePackFunc({ packId });
      
      console.log('📥 Cloud Function response:', result);
      
      if (!result.data.success) {
        console.error('❌ Cloud Function failed:', result.data.error);
        throw new Error(result.error || 'Failed to delete pack');
      }
      
      onProgress && onProgress(90, 'Finalizando exclusão...');
      console.log('✅ Pack deleted from Firestore successfully');

      onProgress && onProgress(100, 'Exclusão concluída!');
      showSuccess('Pack deletado com sucesso!', 'Pack Deletado');
      
      // Small delay to ensure Firestore has processed the deletion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reload user packs
      await loadUserPacks();
      
      return true;
    } catch (error) {
      console.error('Error deleting pack:', error);
      showError(`Erro ao deletar pack: ${error.message}`, 'Erro');
      return false;
    }
  }, [currentUser, showSuccess, showError, loadUserPacks, getPackById, deleteMedia]);

  // Get watermarked download URL for pack content
  const getPackContentDownloadUrl = useCallback(async (packId, contentKey) => {
    try {
      const result = await getPackContentUrl(contentKey);
      return result.downloadUrl;
    } catch (error) {
      console.error('Error getting pack content download URL:', error);
      throw error;
    }
  }, [getPackContentUrl]);

  // Load current user's packs on mount
  useEffect(() => {
    if (currentUser) {
      loadUserPacks();
    } else {
      setUserPacks([]);
    }
  }, [currentUser, loadUserPacks]);

  // Real-time listener for user's packs
  useEffect(() => {
    if (!currentUser) {
      setUserPacks([]);
      return;
    }

    const packsRef = collection(db, 'packs');
    const q = query(
      packsRef,
      where('authorId', '==', currentUser.uid),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const packsData = [];
      
      snapshot.forEach((doc) => {
        packsData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setUserPacks(packsData);
    }, (error) => {
      console.error('Error listening to user packs:', error);
      showError('Erro ao carregar packs em tempo real.', 'Erro');
    });

    return () => unsubscribe();
  }, [currentUser, showError]);

  // Format pack price
  const formatPackPrice = useCallback((price) => {
    if (!price) return '0 VP';
    return `${price.toLocaleString()} VP`;
  }, []);

  // Get pack category display name
  const getCategoryDisplayName = useCallback((category) => {
    const categoryMap = {
      'geral': 'Geral',
      'design': 'Design',
      'programacao': 'Programação',
      'marketing': 'Marketing',
      'educacao': 'Educação',
      'entretenimento': 'Entretenimento',
      'lifestyle': 'Lifestyle',
      'negocios': 'Negócios'
    };
    
    return categoryMap[category] || 'Geral';
  }, []);

  // Check if user owns pack
  const isPackOwner = useCallback((pack) => {
    return currentUser && pack && pack.authorId === currentUser.uid;
  }, [currentUser]);

  const value = {
    // State
    packs,
    userPacks,
    loading,
    creating,
    updating,
    
    // Actions
    searchPacks,
    getPackById,
    createPack,
    updatePack,
    deletePack,
    loadUserPacks,
    getPackContentDownloadUrl,
    
    // Utilities
    formatPackPrice,
    getCategoryDisplayName,
    isPackOwner,
    
    // Constants
    PACK_CATEGORIES
  };

  return (
    <PacksContextR2.Provider value={value}>
      {children}
    </PacksContextR2.Provider>
  );
};

export default PacksProviderR2;
