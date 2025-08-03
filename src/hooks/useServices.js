import { useState, useEffect } from 'react';
import { ref, get, set, push, remove, update, onValue, off } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

export const useServices = () => {
  const { currentUser } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get all services for a specific provider with real-time updates
  const getServicesByProvider = async (providerId) => {
    try {
      setLoading(true);
      setError(null);
      
      const servicesRef = ref(database, `services/${providerId}`);
      
      // Set up real-time listener
      onValue(servicesRef, (snapshot) => {
        if (!snapshot.exists()) {
          setServices([]);
          return;
        }
        
        const servicesData = snapshot.val();
        const servicesArray = Object.entries(servicesData).map(([id, service]) => ({
          id,
          ...service
        }));
        
        setServices(servicesArray);
      }, (error) => {
        console.error('Error in real-time services listener:', error);
        setError(error.message);
      });
      
      return services;
    } catch (error) {
      console.error('Error fetching services:', error);
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Get all services for a specific provider (one-time fetch)
  const getServicesByProviderOnce = async (providerId) => {
    try {
      setLoading(true);
      setError(null);
      
      const servicesRef = ref(database, `services/${providerId}`);
      const snapshot = await get(servicesRef);
      
      if (!snapshot.exists()) {
        setServices([]);
        return [];
      }
      
      const servicesData = snapshot.val();
      const servicesArray = Object.entries(servicesData).map(([id, service]) => ({
        id,
        ...service
      }));
      
      setServices(servicesArray);
      return servicesArray;
    } catch (error) {
      console.error('Error fetching services:', error);
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time listener for services
  const setupServicesListener = (providerId) => {
    try {
      const servicesRef = ref(database, `services/${providerId}`);
      
      onValue(servicesRef, (snapshot) => {
        if (!snapshot.exists()) {
          setServices([]);
          return;
        }
        
        const servicesData = snapshot.val();
        const servicesArray = Object.entries(servicesData).map(([id, service]) => ({
          id,
          ...service
        }));
        
        setServices(servicesArray);
      }, (error) => {
        console.error('Error in real-time services listener:', error);
        setError(error.message);
      });
      
      // Return cleanup function
      return () => {
        off(servicesRef);
      };
    } catch (error) {
      console.error('Error setting up services listener:', error);
      setError(error.message);
    }
  };

  // Get service by ID
  const getServiceById = async (serviceId) => {
    try {
      if (!currentUser) {
        throw new Error('User must be authenticated to fetch a service');
      }
      
      const serviceRef = ref(database, `services/${currentUser.uid}/${serviceId}`);
      const snapshot = await get(serviceRef);
      
      if (!snapshot.exists()) {
        return null;
      }
      
      return {
        id: serviceId,
        ...snapshot.val()
      };
    } catch (error) {
      console.error(`Error fetching service ${serviceId}:`, error);
      throw error;
    }
  };

  // Create new service
  const createService = async (serviceData) => {
    try {
      if (!currentUser) {
        throw new Error('User must be authenticated to create a service');
      }
      
      // Add status field if not provided (default to active)
      if (!serviceData.status) {
        serviceData.status = 'active';
      }
      
      // Add provider ID
      serviceData.providerId = currentUser.uid;
      serviceData.createdAt = Date.now();
      
      // Create a reference to the services collection for this user
      const servicesRef = ref(database, `services/${currentUser.uid}`);
      const newServiceRef = push(servicesRef);
      
      // Save the service data
      await set(newServiceRef, serviceData);
      
      // Return the created service with its ID
      const createdService = {
        id: newServiceRef.key,
        ...serviceData
      };
      
      // Update local state
      setServices(prev => [createdService, ...prev]);
      
      return createdService;
    } catch (error) {
      console.error('Error creating service:', error);
      throw error;
    }
  };

  // Update service
  const updateService = async (serviceId, updates) => {
    try {
      if (!currentUser) {
        throw new Error('User must be authenticated to update a service');
      }
      
      const serviceRef = ref(database, `services/${currentUser.uid}/${serviceId}`);
      
      // Check if service exists
      const snapshot = await get(serviceRef);
      if (!snapshot.exists()) {
        throw new Error(`Service ${serviceId} not found`);
      }
      
      // Update the service
      await update(serviceRef, updates);
      
      // Update local state
      setServices(prev => prev.map(service => 
        service.id === serviceId ? { ...service, ...updates } : service
      ));
      
      return {
        id: serviceId,
        ...snapshot.val(),
        ...updates
      };
    } catch (error) {
      console.error(`Error updating service ${serviceId}:`, error);
      throw error;
    }
  };

  // Update service status
  const updateServiceStatus = async (serviceId, status) => {
    return await updateService(serviceId, { status });
  };

  // Delete service
  const deleteService = async (serviceId) => {
    try {
      if (!currentUser) {
        throw new Error('User must be authenticated to delete a service');
      }
      
      const serviceRef = ref(database, `services/${currentUser.uid}/${serviceId}`);
      
      // Delete the service
      await remove(serviceRef);
      
      // Update local state
      setServices(prev => prev.filter(service => service.id !== serviceId));
      
      return true;
    } catch (error) {
      console.error(`Error deleting service ${serviceId}:`, error);
      throw error;
    }
  };

  // Upload file to storage
  const uploadFile = async (file, path) => {
    try {
      const fileRef = storageRef(storage, path);
      const snapshot = await uploadBytes(fileRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  // Create service with ID (useful for uploads before saving to DB)
  const createServiceWithId = async (userId, serviceId, serviceData) => {
    try {
      const servicesRef = ref(database, `services/${userId}/${serviceId}`);
      await set(servicesRef, serviceData);
      
      const createdService = {
        id: serviceId,
        ...serviceData
      };
      
      // Update local state if it's the current user
      if (currentUser && currentUser.uid === userId) {
        setServices(prev => [createdService, ...prev]);
      }
      
      return createdService;
    } catch (error) {
      console.error('Error creating service with ID:', error);
      throw error;
    }
  };

  // Get provider by ID
  const getProviderById = async (providerId) => {
    try {
      const userRef = ref(database, `users/${providerId}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        throw new Error(`Provider ${providerId} not found`);
      }
      
      return {
        id: providerId,
        ...snapshot.val()
      };
    } catch (error) {
      console.error(`Error fetching provider ${providerId}:`, error);
      return null;
    }
  };

  // Load services for current user on mount with real-time updates
  useEffect(() => {
    if (currentUser) {
      const cleanup = setupServicesListener(currentUser.uid);
      
      // Cleanup function
      return cleanup;
    }
  }, [currentUser]);

  return {
    services,
    loading,
    error,
    getServicesByProvider,
    getServicesByProviderOnce,
    setupServicesListener,
    getServiceById,
    createService,
    updateService,
    updateServiceStatus,
    deleteService,
    uploadFile,
    createServiceWithId,
    getProviderById
  };
}; 