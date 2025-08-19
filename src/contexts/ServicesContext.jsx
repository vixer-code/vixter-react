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

const ServicesContext = createContext({});

export const useServices = () => {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
};

export const ServicesProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  
  // State
  const [services, setServices] = useState([]);
  const [userServices, setUserServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Firebase Functions - API unificada
  const apiFunc = httpsCallable(functions, 'api');

  // Categories for filtering
  const SERVICE_CATEGORIES = [
    'geral',
    'design',
    'programacao',
    'marketing',
    'educacao',
    'consultoria',
    'redacao',
    'traducao',
    'musica',
    'video'
  ];

  // Delivery time options
  const DELIVERY_TIMES = [
    '24h',
    '3-dias',
    '1-semana',
    '2-semanas',
    '1-mes',
    'negociavel'
  ];

  // Load user's services
  const loadUserServices = useCallback(async (userId = null) => {
    const targetUserId = userId || currentUser?.uid;
    if (!targetUserId) return [];

    try {
      setLoading(true);
      
      const servicesRef = collection(db, 'services');
      const q = query(
        servicesRef,
        where('providerId', '==', targetUserId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const servicesData = [];
      
      snapshot.forEach((doc) => {
        servicesData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Sempre popula a lista geral utilizada na UI
      setServices(servicesData);

      // Se for o usuário atual (ou não foi passado userId explicitamente), atualiza também userServices
      if (!userId || (currentUser && targetUserId === currentUser.uid)) {
        setUserServices(servicesData);
      }

      return servicesData;
      
    } catch (error) {
      console.error('Error loading user services:', error);
      showError('Erro ao carregar serviços do usuário.', 'Erro');
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentUser, showError]);

  // Update only status convenience
  const updateServiceStatus = useCallback(async (serviceId, status) => {
    try {
      const result = await apiFunc({
        resource: 'service',
        action: 'update',
        payload: { serviceId, updates: { status } }
      });
      if (result?.data?.success) {
        // Reload current view
        const targetUserId = currentUser?.uid;
        await loadUserServices(targetUserId);
      }
      return !!result?.data?.success;
    } catch (error) {
      console.error('Error updating service status:', error);
      showError('Erro ao atualizar status do serviço.', 'Erro');
      return false;
    }
  }, [apiFunc, currentUser, loadUserServices, showError]);

  // Search services
  const searchServices = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      
      const servicesRef = collection(db, 'services');
      let q = query(
        servicesRef,
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

      // Add delivery time filter
      if (filters.deliveryTime && filters.deliveryTime !== 'all') {
        q = query(q, where('deliveryTime', '==', filters.deliveryTime));
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
      const servicesData = [];
      
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
        
        servicesData.push({
          id: doc.id,
          ...data
        });
      });

      return servicesData;
      
    } catch (error) {
      console.error('Error searching services:', error);
      showError('Erro ao buscar serviços.', 'Erro');
      return [];
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Get service by ID
  const getServiceById = useCallback(async (serviceId) => {
    if (!serviceId) return null;

    try {
      const serviceRef = doc(db, 'services', serviceId);
      const serviceSnap = await getDoc(serviceRef);
      
      if (serviceSnap.exists()) {
        return {
          id: serviceSnap.id,
          ...serviceSnap.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting service by ID:', error);
      return null;
    }
  }, []);

  // Create new service
  const createService = useCallback(async (serviceData) => {
    if (!currentUser) {
      showError('Você precisa estar logado para criar um serviço.', 'Erro');
      return false;
    }

    try {
      setCreating(true);
      
      const result = await apiFunc({
        resource: 'service',
        action: 'create',
        payload: serviceData
      });
      
      if (result.data.success) {
        showSuccess('Serviço criado com sucesso!', 'Serviço Criado');
        
        // Reload user services
        await loadUserServices();
        
        return { success: true, serviceId: result.data.serviceId };
      }
      
      return false;
    } catch (error) {
      console.error('Error creating service:', error);
      showError('Erro ao criar serviço. Tente novamente.', 'Erro');
      return false;
    } finally {
      setCreating(false);
    }
  }, [currentUser, apiFunc, showSuccess, showError, loadUserServices]);

  // Update service
  const updateService = useCallback(async (serviceId, updates) => {
    if (!currentUser) {
      showError('Você precisa estar logado para atualizar um serviço.', 'Erro');
      return false;
    }

    try {
      setUpdating(true);
      
      const result = await apiFunc({
        resource: 'service',
        action: 'update',
        payload: { serviceId, updates }
      });
      
      if (result.data.success) {
        showSuccess('Serviço atualizado com sucesso!', 'Serviço Atualizado');
        
        // Reload user services
        await loadUserServices();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating service:', error);
      showError('Erro ao atualizar serviço. Tente novamente.', 'Erro');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [currentUser, apiFunc, showSuccess, showError, loadUserServices]);

  // Delete service
  const deleteService = useCallback(async (serviceId) => {
    if (!currentUser) {
      showError('Você precisa estar logado para deletar um serviço.', 'Erro');
      return false;
    }

    try {
      const result = await apiFunc({
        resource: 'service',
        action: 'delete',
        payload: { serviceId }
      });
      
      if (result.data.success) {
        showSuccess('Serviço deletado com sucesso!', 'Serviço Deletado');
        
        // Reload user services
        await loadUserServices();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting service:', error);
      showError('Erro ao deletar serviço. Tente novamente.', 'Erro');
      return false;
    }
  }, [currentUser, apiFunc, showSuccess, showError, loadUserServices]);

  // Load current user's services on mount
  useEffect(() => {
    if (currentUser) {
      loadUserServices();
    } else {
      setUserServices([]);
    }
  }, [currentUser, loadUserServices]);

  // Format service price
  const formatServicePrice = useCallback((price) => {
    if (!price) return '0 VP';
    return `${price.toLocaleString()} VP`;
  }, []);

  // Get service category display name
  const getCategoryDisplayName = useCallback((category) => {
    const categoryMap = {
      'geral': 'Geral',
      'design': 'Design',
      'programacao': 'Programação',
      'marketing': 'Marketing',
      'educacao': 'Educação',
      'consultoria': 'Consultoria',
      'redacao': 'Redação',
      'traducao': 'Tradução',
      'musica': 'Música',
      'video': 'Vídeo'
    };
    
    return categoryMap[category] || 'Geral';
  }, []);

  // Get delivery time display name
  const getDeliveryTimeDisplayName = useCallback((deliveryTime) => {
    const deliveryMap = {
      '24h': '24 horas',
      '3-dias': '3 dias',
      '1-semana': '1 semana',
      '2-semanas': '2 semanas',
      '1-mes': '1 mês',
      'negociavel': 'Negociável'
    };
    
    return deliveryMap[deliveryTime] || 'Negociável';
  }, []);

  // Check if user owns service
  const isServiceOwner = useCallback((service) => {
    return currentUser && service && service.providerId === currentUser.uid;
  }, [currentUser]);

  const value = {
    // State
    services,
    userServices,
    loading,
    creating,
    updating,
    
    // Actions
    searchServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    loadUserServices,
    
    // Utilities
    formatServicePrice,
    getCategoryDisplayName,
    getDeliveryTimeDisplayName,
    isServiceOwner,
    
    // Constants
    SERVICE_CATEGORIES,
    DELIVERY_TIMES
  };

  return (
    <ServicesContext.Provider value={value}>
      {children}
    </ServicesContext.Provider>
  );
};

export default ServicesProvider;
