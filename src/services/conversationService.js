/**
 * Conversation Service
 * Handles persistent storage of conversations using Firebase Firestore
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';

/**
 * Save a conversation to Firestore
 * @param {Object} conversation - Conversation object to save
 * @returns {Promise<void>}
 */
export const saveConversation = async (conversation) => {
  try {
    if (!conversation || !conversation.id) {
      throw new Error('Invalid conversation object');
    }

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversation.id);
    await setDoc(conversationRef, {
      ...conversation,
      updatedAt: serverTimestamp(),
      createdAt: conversation.createdAt || serverTimestamp()
    }, { merge: true });

    console.log('Conversation saved:', conversation.id);
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
};

/**
 * Get all conversations for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of conversations
 */
export const getUserConversations = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
    const q = query(
      conversationsRef,
      where(`participants.${userId}`, '==', true),
      orderBy('lastMessageTime', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const conversations = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to numbers
        lastMessageTime: data.lastMessageTime?.toMillis?.() || data.lastMessageTime,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt
      });
    });

    console.log('Loaded conversations:', conversations.length);
    return conversations;
  } catch (error) {
    console.error('Error getting user conversations:', error);
    throw error;
  }
};

/**
 * Get a specific conversation by ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Conversation object or null
 */
export const getConversation = async (conversationId) => {
  try {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const conversationSnap = await getDoc(conversationRef);

    if (conversationSnap.exists()) {
      const data = conversationSnap.data();
      return {
        id: conversationSnap.id,
        ...data,
        // Convert Firestore timestamps to numbers
        lastMessageTime: data.lastMessageTime?.toMillis?.() || data.lastMessageTime,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting conversation:', error);
    throw error;
  }
};

/**
 * Update a conversation
 * @param {string} conversationId - Conversation ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<void>}
 */
export const updateConversation = async (conversationId, updates) => {
  try {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    await updateDoc(conversationRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('Conversation updated:', conversationId);
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
};

/**
 * Delete a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
export const deleteConversation = async (conversationId) => {
  try {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    await deleteDoc(conversationRef);

    console.log('Conversation deleted:', conversationId);
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time conversation updates for a user
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function for updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUserConversations = (userId, callback) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const conversationsRef = collection(db, CONVERSATIONS_COLLECTION);
    const q = query(
      conversationsRef,
      where(`participants.${userId}`, '==', true),
      orderBy('lastMessageTime', 'desc')
    );

    return onSnapshot(q, (querySnapshot) => {
      const conversations = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to numbers
          lastMessageTime: data.lastMessageTime?.toMillis?.() || data.lastMessageTime,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt,
          updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt
        });
      });

      callback(conversations);
    }, (error) => {
      console.error('Error in conversation subscription:', error);
    });
  } catch (error) {
    console.error('Error setting up conversation subscription:', error);
    throw error;
  }
};

/**
 * Save a message to Firestore
 * @param {string} conversationId - Conversation ID
 * @param {Object} message - Message object
 * @returns {Promise<string>} Message ID
 */
export const saveMessage = async (conversationId, message) => {
  try {
    if (!conversationId || !message) {
      throw new Error('Conversation ID and message are required');
    }

    const messagesRef = collection(db, MESSAGES_COLLECTION, conversationId, 'messages');
    const messageRef = doc(messagesRef);
    
    await setDoc(messageRef, {
      ...message,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    // Update conversation's last message
    await updateConversation(conversationId, {
      lastMessage: message.content || message.text || '',
      lastMessageTime: Date.now()
    });

    console.log('Message saved:', messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
};

/**
 * Get messages for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {number} limit - Number of messages to retrieve
 * @returns {Promise<Array>} Array of messages
 */
export const getConversationMessages = async (conversationId, limit = 50) => {
  try {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const messagesRef = collection(db, MESSAGES_COLLECTION, conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(limit));

    const querySnapshot = await getDocs(q);
    const messages = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to numbers
        timestamp: data.timestamp?.toMillis?.() || data.timestamp,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt
      });
    });

    // Reverse to get chronological order
    return messages.reverse();
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time message updates for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {Function} callback - Callback function for updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToConversationMessages = (conversationId, callback) => {
  try {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const messagesRef = collection(db, MESSAGES_COLLECTION, conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));

    return onSnapshot(q, (querySnapshot) => {
      const messages = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to numbers
          timestamp: data.timestamp?.toMillis?.() || data.timestamp,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt
        });
      });

      // Reverse to get chronological order
      callback(messages.reverse());
    }, (error) => {
      console.error('Error in message subscription:', error);
    });
  } catch (error) {
    console.error('Error setting up message subscription:', error);
    throw error;
  }
};
