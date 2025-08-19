import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

const UserContext = createContext({});

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  
  // User state
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Firebase Functions
  const migrateUserFunc = httpsCallable(functions, 'migrateUserToFirestore');

  // Load user profile from Firestore
  useEffect(() => {
    if (currentUser) {
      loadUserProfile();
    } else {
      setUserProfile(null);
      setLoading(false);
    }
  }, [currentUser]);

  const loadUserProfile = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      const userRef = doc(db, 'users', currentUser.uid);
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          setUserProfile(userData);
        } else {
          // User doesn't exist in Firestore, trigger migration
          migrateUserFromRTDB();
        }
        setLoading(false);
      }, (error) => {
        console.error('Error loading user profile:', error);
        showError('Erro ao carregar perfil do usuário.', 'Erro');
        setLoading(false);
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up user profile listener:', error);
      showError('Erro ao carregar perfil do usuário.', 'Erro');
      setLoading(false);
    }
  }, [currentUser, showError]);

  // Migrate user from RTDB to Firestore
  const migrateUserFromRTDB = useCallback(async () => {
    if (!currentUser) return;

    try {
      showInfo('Migrando dados do usuário...', 'Migração');
      
      const result = await migrateUserFunc();
      
      if (result.data.success) {
        setUserProfile(result.data.userData);
        showSuccess('Dados do usuário migrados com sucesso!', 'Migração Completa');
      }
    } catch (error) {
      console.error('Error migrating user:', error);
      showError('Erro ao migrar dados do usuário.', 'Erro de Migração');
    }
  }, [currentUser, migrateUserFunc, showSuccess, showError, showInfo]);

  // Update user profile
  const updateUserProfile = useCallback(async (updates) => {
    if (!currentUser || !userProfile) return false;

    try {
      setUpdating(true);
      
      const userRef = doc(db, 'users', currentUser.uid);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      await updateDoc(userRef, updateData);
      
      showSuccess('Perfil atualizado com sucesso!', 'Perfil Atualizado');
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      showError('Erro ao atualizar perfil.', 'Erro');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [currentUser, userProfile, showSuccess, showError]);

  // Search users
  const searchUsers = useCallback(async (searchTerm, limitCount = 20) => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const searchTermLower = searchTerm.toLowerCase();
      
      // Query users by searchTerms array
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('searchTerms', 'array-contains', searchTermLower),
        orderBy('displayName'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const users = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        users.push({
          id: doc.id,
          ...userData
        });
      });

      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      showError('Erro ao buscar usuários.', 'Erro de Busca');
      return [];
    }
  }, [showError]);

  // Get user by ID
  const getUserById = useCallback(async (userId) => {
    if (!userId) return null;

    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return {
          id: userSnap.id,
          ...userSnap.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }, []);

  // Check if user can claim daily bonus
  const canClaimDailyBonus = useCallback(() => {
    if (!userProfile || !userProfile.lastDailyBonus) return true;
    
    const lastBonus = userProfile.lastDailyBonus.toDate();
    const today = new Date();
    
    // Check if last bonus was claimed today
    return lastBonus.toDateString() !== today.toDateString();
  }, [userProfile]);

  // Format user display name
  const formatUserDisplayName = useCallback((user) => {
    if (!user) return 'Usuário';
    
    return user.displayName || user.username || user.name || 'Usuário';
  }, []);

  // Get user avatar URL with fallback
  const getUserAvatarUrl = useCallback((user) => {
    if (!user) return null;
    
    return user.profilePictureURL || null;
  }, []);

  // Get user stats
  const getUserStats = useCallback((user) => {
    if (!user || !user.stats) {
      return {
        totalPosts: 0,
        totalServices: 0,
        totalPacks: 0,
        totalSales: 0
      };
    }
    
    return user.stats;
  }, []);

  const value = {
    // State
    userProfile,
    loading,
    updating,
    
    // Actions
    updateUserProfile,
    migrateUserFromRTDB,
    searchUsers,
    getUserById,
    
    // Utilities
    canClaimDailyBonus,
    formatUserDisplayName,
    getUserAvatarUrl,
    getUserStats
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;
