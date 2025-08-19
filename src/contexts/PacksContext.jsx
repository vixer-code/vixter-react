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
  onSnapshot
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

const PacksContext = createContext({});

export const usePacks = () => {
  const context = useContext(PacksContext);
  if (!context) {
    throw new Error('usePacks must be used within a PacksProvider');
  }
  return context;
};

export const PacksProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  
  // State
  const [packs, setPacks] = useState([]);
  const [userPacks, setUserPacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Firebase Functions - API unificada
  const apiFunc = httpsCallable(functions, 'api');

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

      if (userId) {
        return packsData; // Return for other users
      } else {
        setUserPacks(packsData); // Set for current user
      }
      
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

  // Create new pack
  const createPack = useCallback(async (packData) => {
    if (!currentUser) {
      showError('Você precisa estar logado para criar um pack.', 'Erro');
      return false;
    }

    try {
      setCreating(true);
      
      const result = await apiFunc({
        resource: 'pack',
        action: 'create',
        payload: packData
      });
      
      if (result.data.success) {
        showSuccess('Pack criado com sucesso!', 'Pack Criado');
        
        // Reload user packs
        await loadUserPacks();
        
        return { success: true, packId: result.data.packId };
      }
      
      return false;
    } catch (error) {
      console.error('Error creating pack:', error);
      showError('Erro ao criar pack. Tente novamente.', 'Erro');
      return false;
    } finally {
      setCreating(false);
    }
  }, [currentUser, apiFunc, showSuccess, showError, loadUserPacks]);

  // Update pack
  const updatePack = useCallback(async (packId, updates) => {
    if (!currentUser) {
      showError('Você precisa estar logado para atualizar um pack.', 'Erro');
      return false;
    }

    try {
      setUpdating(true);
      
      const result = await apiFunc({
        resource: 'pack',
        action: 'update',
        payload: { packId, updates }
      });
      
      if (result.data.success) {
        showSuccess('Pack atualizado com sucesso!', 'Pack Atualizado');
        
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
  }, [currentUser, apiFunc, showSuccess, showError, loadUserPacks]);

  // Delete pack
  const deletePack = useCallback(async (packId) => {
    if (!currentUser) {
      showError('Você precisa estar logado para deletar um pack.', 'Erro');
      return false;
    }

    try {
      const result = await apiFunc({
        resource: 'pack',
        action: 'delete',
        payload: { packId }
      });
      
      if (result.data.success) {
        showSuccess('Pack deletado com sucesso!', 'Pack Deletado');
        
        // Reload user packs
        await loadUserPacks();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting pack:', error);
      showError('Erro ao deletar pack. Tente novamente.', 'Erro');
      return false;
    }
  }, [currentUser, apiFunc, showSuccess, showError, loadUserPacks]);

  // Load current user's packs on mount
  useEffect(() => {
    if (currentUser) {
      loadUserPacks();
    } else {
      setUserPacks([]);
    }
  }, [currentUser, loadUserPacks]);

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
    
    // Utilities
    formatPackPrice,
    getCategoryDisplayName,
    isPackOwner,
    
    // Constants
    PACK_CATEGORIES
  };

  return (
    <PacksContext.Provider value={value}>
      {children}
    </PacksContext.Provider>
  );
};

export default PacksProvider;
