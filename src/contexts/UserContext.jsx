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
import { db } from '../../config/firebase';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import { database as rtdb, } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { useReview } from './ReviewContext';

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
  const { updateReviewerPhoto } = useReview();
  
  // User state
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Migration functions removed from deployment; we create a default doc if missing

  // Load user profile from Firestore
  useEffect(() => {
    let unsubscribe = null;
    
    if (currentUser && currentUser.uid) {
      // Add a small delay to ensure auth is fully ready
      const timer = setTimeout(async () => {
        unsubscribe = await loadUserProfile();
      }, 100);
      
      return () => {
        clearTimeout(timer);
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } else {
      // Clear user profile immediately when user logs out
      setUserProfile(null);
      setLoading(false);
    }
  }, [currentUser]);

  const loadUserProfile = useCallback(async () => {
    if (!currentUser || !currentUser.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const userRef = doc(db, 'users', currentUser.uid);
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(userRef, async (doc) => {
        // Check if user is still authenticated before processing
        if (!currentUser || !currentUser.uid) {
          setLoading(false);
          return;
        }

        if (doc.exists()) {
          const userData = doc.data();
          setUserProfile({
            id: doc.id,
            ...userData
          });

          // Backfill username once from RTDB if missing in Firestore
          if ((!userData.username || userData.username === '') && rtdb) {
            try {
              const usernameSnap = await rtdbGet(rtdbRef(rtdb, `users/${currentUser.uid}/username`));
              const usernameVal = usernameSnap.exists() ? usernameSnap.val() : '';
              if (usernameVal) {
                await updateDoc(userRef, { username: usernameVal, updatedAt: Timestamp.now() });
              }
            } catch (e) {
              // ignore backfill errors
            }
          }
        } else {
          // User doesn't exist: create minimal profile document
          setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            profilePictureURL: currentUser.photoURL || null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            followersCount: 0,
            followingCount: 0,
            kyc: false,
            kycState: 'PENDING_UPLOAD',
            emailVerified: false,
            emailVerifiedAt: null,
            stats: { totalPosts: 0, totalServices: 0, totalPacks: 0, totalSales: 0 },
            searchTerms: [(currentUser.displayName || '').toLowerCase()].filter(Boolean)
          });
        }
        setLoading(false);
      }, (error) => {
        console.error('Error loading user profile:', error);
        // Only show error if user is still authenticated
        if (currentUser && currentUser.uid) {
          showError('Erro ao carregar perfil do usuário.', 'Erro');
        }
        setLoading(false);
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up user profile listener:', error);
      // Only show error if user is still authenticated
      if (currentUser && currentUser.uid) {
        showError('Erro ao carregar perfil do usuário.', 'Erro');
      }
      setLoading(false);
    }
  }, [currentUser, showError]);

  // Migration disabled
  const migrateUserFromRTDB = useCallback(async () => {
    showInfo('Migração desativada.', 'Info');
  }, [showInfo]);

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
      
      // If profile picture was updated, update all reviews
      if (updates.profilePictureURL && typeof updateReviewerPhoto === 'function') {
        try {
          await updateReviewerPhoto(currentUser.uid, updates.profilePictureURL);
        } catch (reviewError) {
          console.error('Error updating reviewer photos:', reviewError);
          // Don't fail the profile update if review update fails
        }
      } else if (updates.profilePictureURL && typeof updateReviewerPhoto !== 'function') {
        console.warn('updateReviewerPhoto function is not available');
      }
      
      showSuccess('Perfil atualizado com sucesso!', 'Perfil Atualizado');
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      showError('Erro ao atualizar perfil.', 'Erro');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [currentUser, userProfile, showSuccess, showError, updateReviewerPhoto]);

  // Search users
  const searchUsers = useCallback(async (searchTerm, limitCount = 20) => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
      const searchTermLower = searchTerm.toLowerCase();
      // console.log('🔍 Searching for users with term:', searchTermLower);
      
      // Try searchTerms array first (optimal but requires index)
      try {
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('searchTerms', 'array-contains', searchTermLower),
          limit(limitCount)
        );

        const snapshot = await getDocs(q);
        const users = [];
        
        snapshot.forEach((doc) => {
          const userData = doc.data();
          // console.log('👤 Found user via searchTerms:', userData.displayName);
          
          // Remove sensitive data before returning
          const { email, ...safeUserData } = userData;
          users.push({
            id: doc.id,
            ...safeUserData
          });
        });

        if (users.length > 0) {
          // console.log('🔍 Search results via searchTerms:', users.length, 'users found');
          return users;
        }
      } catch (indexError) {
        console.log('⚠️ SearchTerms query failed, trying fallback method:', indexError.message);
      }

      // Fallback: Get all users and filter client-side (less efficient but more reliable)
      console.log('🔄 Using fallback search method...');
      const usersRef = collection(db, 'users');
      const q = query(usersRef, limit(100)); // Get more to filter
      
      const snapshot = await getDocs(q);
      const users = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        const displayName = (userData.displayName || '').toLowerCase();
        const username = (userData.username || '').toLowerCase();
        const name = (userData.name || '').toLowerCase();
        
        // Check if search term matches displayName, username, or name (but NOT email for privacy)
        if (displayName.includes(searchTermLower) || 
            username.includes(searchTermLower) ||
            name.includes(searchTermLower)) {
          // console.log('👤 Found user via fallback:', userData.displayName);
          
          // Remove sensitive data before returning
          const { email, ...safeUserData } = userData;
          users.push({
            id: doc.id,
            ...safeUserData
          });
        }
      });

      // Limit results and sort by relevance
      const limitedUsers = users
        .slice(0, limitCount)
        .sort((a, b) => {
          const aName = (a.displayName || '').toLowerCase();
          const bName = (b.displayName || '').toLowerCase();
          
          // Prioritize exact matches at the beginning
          const aStartsWith = aName.startsWith(searchTermLower);
          const bStartsWith = bName.startsWith(searchTermLower);
          
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          return aName.localeCompare(bName);
        });

      // console.log('🔍 Fallback search results:', limitedUsers.length, 'users found');
      return limitedUsers;
    } catch (error) {
      console.error('❌ Error searching users:', error);
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

  // Get user by username
  const getUserByUsername = useCallback(async (username) => {
    if (!username) return null;

    try {
      // Search for user by username in Firestore
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return {
          id: userDoc.id,
          ...userDoc.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user by username:', error);
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
    getUserByUsername,
    
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
