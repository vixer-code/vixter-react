import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

const BlockContext = createContext();

export const useBlock = () => {
  const context = useContext(BlockContext);
  if (!context) {
    throw new Error('useBlock must be used within a BlockProvider');
  }
  return context;
};

export const BlockProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]); // Users that current user blocked
  const [blockedByUsers, setBlockedByUsers] = useState([]); // Users that blocked current user
  const [loading, setLoading] = useState(true);
  const [blockMap, setBlockMap] = useState({}); // Map of blockedId -> blockDocId for quick lookup

  // Load blocked users (users that current user blocked)
  useEffect(() => {
    if (!currentUser?.uid) {
      setBlockedUsers([]);
      setBlockedByUsers([]);
      setBlockMap({});
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to blocks where current user is the blocker
    const blocksQuery = query(
      collection(db, 'blocks'),
      where('blockerId', '==', currentUser.uid)
    );

    const unsubscribeBlocked = onSnapshot(blocksQuery, (snapshot) => {
      const blocks = [];
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        blocks.push({
          id: doc.id,
          ...data
        });
        map[data.blockedId] = doc.id;
      });
      setBlockedUsers(blocks);
      setBlockMap(map);
      setLoading(false);
    }, (error) => {
      console.error('Error loading blocked users:', error);
      setLoading(false);
    });

    // Subscribe to blocks where current user is blocked by someone
    const blockedByQuery = query(
      collection(db, 'blocks'),
      where('blockedId', '==', currentUser.uid)
    );

    const unsubscribeBlockedBy = onSnapshot(blockedByQuery, (snapshot) => {
      const blocks = [];
      snapshot.forEach((doc) => {
        blocks.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setBlockedByUsers(blocks);
    }, (error) => {
      console.error('Error loading blockedBy users:', error);
    });

    return () => {
      unsubscribeBlocked();
      unsubscribeBlockedBy();
    };
  }, [currentUser]);

  // Check if current user blocked a specific user
  const isUserBlocked = useCallback((userId) => {
    if (!userId || !currentUser?.uid) return false;
    return blockMap.hasOwnProperty(userId);
  }, [blockMap, currentUser]);

  // Check if current user is blocked by a specific user
  const isBlockedBy = useCallback((userId) => {
    if (!userId || !currentUser?.uid) return false;
    return blockedByUsers.some(block => block.blockerId === userId);
  }, [blockedByUsers, currentUser]);

  // Check if there's any block between two users (either direction)
  const hasBlockBetween = useCallback((userId) => {
    return isUserBlocked(userId) || isBlockedBy(userId);
  }, [isUserBlocked, isBlockedBy]);

  // Block a user
  const blockUser = useCallback(async (userId, userData = {}) => {
    if (!currentUser?.uid || !userId) {
      throw new Error('Invalid user IDs');
    }

    if (userId === currentUser.uid) {
      throw new Error('Você não pode bloquear a si mesmo');
    }

    if (isUserBlocked(userId)) {
      throw new Error('Usuário já está bloqueado');
    }

    try {
      const blockData = {
        blockerId: currentUser.uid,
        blockedId: userId,
        timestamp: serverTimestamp(),
        blockedUsername: userData.username || '',
        blockedDisplayName: userData.displayName || userData.name || ''
      };

      await addDoc(collection(db, 'blocks'), blockData);
      console.log('User blocked successfully:', userId);
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }, [currentUser, isUserBlocked]);

  // Unblock a user
  const unblockUser = useCallback(async (userId) => {
    if (!currentUser?.uid || !userId) {
      throw new Error('Invalid user IDs');
    }

    const blockDocId = blockMap[userId];
    if (!blockDocId) {
      throw new Error('Usuário não está bloqueado');
    }

    try {
      await deleteDoc(doc(db, 'blocks', blockDocId));
      console.log('User unblocked successfully:', userId);
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  }, [currentUser, blockMap]);

  // Get list of blocked users with their details
  const getBlockedUsersWithDetails = useCallback(async () => {
    if (!currentUser?.uid) return [];

    try {
      // We already have the blocked users from the real-time subscription
      return blockedUsers;
    } catch (error) {
      console.error('Error getting blocked users:', error);
      return [];
    }
  }, [currentUser, blockedUsers]);

  const value = {
    blockedUsers,
    blockedByUsers,
    loading,
    isUserBlocked,
    isBlockedBy,
    hasBlockBetween,
    blockUser,
    unblockUser,
    getBlockedUsersWithDetails
  };

  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
};

export default BlockContext;

