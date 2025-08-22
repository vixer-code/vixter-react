import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ref, 
  onValue, 
  push, 
  set, 
  update,
  off, 
  query, 
  orderByChild, 
  equalTo,
  orderByKey,
  limitToLast,
  serverTimestamp
} from 'firebase/database';
import { 
  uploadBytes, 
  getDownloadURL, 
  ref as storageRef,
  deleteObject
} from 'firebase/storage';
import { database, storage } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { useUser } from './UserContext';

const MessagingContext = createContext({});

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};

export const MessagingProvider = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const { getUserById } = useUser();
  
  // State
  const [conversations, setConversations] = useState([]);
  const [serviceConversations, setServiceConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('messages'); // 'messages' or 'services'
  
  // Media states
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  
  // Settings
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
  
  // Message types
  const MESSAGE_TYPES = {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    FILE: 'file',
    SERVICE_NOTIFICATION: 'service_notification'
  };

  // Load conversations
  useEffect(() => {
    if (authLoading) {
      // Don't do anything while auth is still loading
      return;
    }
    
    if (!currentUser || !currentUser.uid) {
      setConversations([]);
      setServiceConversations([]);
      setLoading(false);
      return;
    }

    console.log('Setting up conversation listeners for user:', currentUser.uid);

    // Load regular conversations
    const conversationsRef = ref(database, 'conversations');
    
    // Use onValue on the conversations root to handle empty collections gracefully
    const unsubscribeConversations = onValue(conversationsRef, (snapshot) => {
      const conversationsData = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const conversation = {
            id: childSnapshot.key,
            ...childSnapshot.val()
          };
          
          // Check if current user is a participant
          if (conversation.participants && conversation.participants[currentUser.uid]) {
            // Filter out service conversations from regular list
            if (!conversation.serviceOrderId) {
              conversationsData.push(conversation);
            }
          }
        });
        
        // Sort by last message time
        conversationsData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      }
      
      console.log('Regular conversations loaded:', conversationsData.length);
      setConversations(conversationsData);
      setLoading(false);
    });

    // Load service conversations (reuse the same conversationsRef)
    const unsubscribeServiceConversations = onValue(conversationsRef, (snapshot) => {
      const serviceConversationsData = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const conversation = {
            id: childSnapshot.key,
            ...childSnapshot.val()
          };
          
          // Check if current user is a participant
          if (conversation.participants && conversation.participants[currentUser.uid]) {
            // Only include service conversations
            if (conversation.serviceOrderId) {
              serviceConversationsData.push(conversation);
            }
          }
        });
        
        // Sort by last message time
        serviceConversationsData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      }
      
      console.log('Service conversations loaded:', serviceConversationsData.length);
      setServiceConversations(serviceConversationsData);
    });

    return () => {
      off(conversationsRef);
    };
  }, [currentUser?.uid, authLoading]);

  // Reset state when user changes or logs out
  useEffect(() => {
    if (!currentUser || !currentUser.uid) {
      setConversations([]);
      setServiceConversations([]);
      setSelectedConversation(null);
      setMessages([]);
      setUsers({});
      setLoading(false);
    }
  }, [currentUser]);

  // Load users data from Firestore (not RTDB)
  useEffect(() => {
    if (!currentUser) return;

    // Use the existing useUser context to get users from Firestore
    // This will populate the users state with actual user data
    const loadUsersFromFirestore = async () => {
      try {
        // Get current user data first
        const currentUserData = await getUserById(currentUser.uid);
        if (currentUserData) {
          setUsers(prev => ({
            ...prev,
            [currentUser.uid]: currentUserData
          }));
        }
        
        console.log('Users loaded from Firestore - current user:', currentUserData?.displayName || currentUserData?.name);
      } catch (error) {
        console.error('Error loading user from Firestore:', error);
      }
    };

    loadUsersFromFirestore();
  }, [currentUser, getUserById]);

  // Mark messages as read - Define this BEFORE useEffect hooks that use it
  const markMessagesAsRead = useCallback(async (messagesData) => {
    if (!currentUser?.uid || !selectedConversation) return;

    const unreadMessages = messagesData.filter(msg => 
      !msg.read && msg.senderId !== currentUser.uid
    );

    if (unreadMessages.length === 0) return;

    try {
      const updates = {};
      unreadMessages.forEach(msg => {
        updates[`messages/${selectedConversation.id}/${msg.id}/read`] = true;
        updates[`messages/${selectedConversation.id}/${msg.id}/readAt`] = Date.now();
        updates[`messages/${selectedConversation.id}/${msg.id}/readBy`] = currentUser.uid;
      });

      // Batch update
      await update(ref(database), updates);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUser?.uid, selectedConversation?.id]);

  // Load user data for all participants in conversations
  useEffect(() => {
    if (!currentUser?.uid || !conversations.length) return;

    const loadParticipantsData = async () => {
      const allParticipantIds = new Set();
      
      // Collect all participant IDs from conversations
      conversations.forEach(conversation => {
        if (conversation.participants) {
          Object.keys(conversation.participants).forEach(uid => {
            if (uid !== currentUser.uid) {
              allParticipantIds.add(uid);
            }
          });
        }
      });

      // Load data for participants we don't have yet
      for (const participantId of allParticipantIds) {
        if (!users[participantId]) {
          try {
            const participantData = await getUserById(participantId);
            if (participantData) {
              setUsers(prev => ({
                ...prev,
                [participantId]: participantData
              }));
              console.log('Loaded participant data:', participantData.displayName || participantData.name);
            }
          } catch (error) {
            console.error('Error loading participant data:', error);
          }
        }
      }
    };

    loadParticipantsData();
  }, [conversations, currentUser?.uid, getUserById]);

  // Global messages listener for all conversations where user is participant
  useEffect(() => {
    if (!currentUser?.uid || conversations.length === 0) return;

    console.log('Setting up global message listeners for', conversations.length, 'conversations');

    const unsubscribers = [];

    // Set up listeners for all conversations where user is participant
    conversations.forEach(conversation => {
      const messagesRef = ref(database, `messages/${conversation.id}`);
      
      const unsubscribe = onValue(messagesRef, (snapshot) => {
        if (snapshot.exists()) {
          const messagesData = [];
          snapshot.forEach((childSnapshot) => {
            messagesData.push({
              id: childSnapshot.key,
              ...childSnapshot.val()
            });
          });
          
          // Sort messages by timestamp (oldest first)
          messagesData.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          
          // If this is the currently selected conversation, update messages state
          if (selectedConversation && selectedConversation.id === conversation.id) {
            console.log('Updating messages for selected conversation:', messagesData.length);
            setMessages(messagesData);
            
            // Mark messages as read
            if (readReceiptsEnabled) {
              markMessagesAsRead(messagesData);
            }
          }
          
          // Update conversation last message if it's different
          const lastMessage = messagesData[messagesData.length - 1];
          if (lastMessage && conversation.lastMessage !== lastMessage.content) {
            console.log('Updating conversation last message:', lastMessage.content);
            setConversations(prev => 
              prev.map(conv => 
                conv.id === conversation.id 
                  ? { ...conv, lastMessage: lastMessage.content, lastMessageTime: lastMessage.timestamp, lastSenderId: lastMessage.senderId }
                  : conv
              )
            );
          }
        }
      });
      
      unsubscribers.push(() => off(messagesRef));
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUser?.uid, conversations, selectedConversation?.id, readReceiptsEnabled, markMessagesAsRead]);

  // Load messages for selected conversation (simplified - just for initial load)
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    console.log('Loading initial messages for conversation:', selectedConversation.id);

    const messagesRef = ref(database, `messages/${selectedConversation.id}`);
    
    // Use onValue directly on the messages ref for real-time updates
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const messagesData = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          messagesData.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        
        // Sort messages by timestamp (oldest first)
        messagesData.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      }
      
      console.log('Initial messages loaded:', messagesData.length);
      setMessages(messagesData);
      
      // Mark messages as read
      if (readReceiptsEnabled) {
        markMessagesAsRead(messagesData);
      }
    });

    return () => {
      off(messagesRef);
    };
  }, [selectedConversation?.id, readReceiptsEnabled, markMessagesAsRead]);

  // Create or get conversation
  const createOrGetConversation = useCallback(async (otherUserId, serviceOrderId = null) => {
    if (!currentUser?.uid || !otherUserId) return null;

    try {
      // Check if conversation already exists
      const conversationsRef = ref(database, 'conversations');
      const snapshot = await new Promise((resolve, reject) => {
        onValue(conversationsRef, resolve, { onlyOnce: true });
      });

      let existingConversation = null;
      snapshot.forEach((childSnapshot) => {
        const conv = childSnapshot.val();
        const participants = Object.keys(conv.participants || {});
        
        // Check if this is the same conversation (same participants and service order)
        if (participants.includes(currentUser.uid) && 
            participants.includes(otherUserId) &&
            conv.serviceOrderId === serviceOrderId) {
          existingConversation = {
            id: childSnapshot.key,
            ...conv
          };
        }
      });

      if (existingConversation) {
        return existingConversation;
      }

      // Create new conversation
      const newConversationRef = push(conversationsRef);
      const conversationData = {
        participants: {
          [currentUser.uid]: true,
          [otherUserId]: true
        },
        createdAt: Date.now(),
        lastMessage: '',
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid
      };

      if (serviceOrderId) {
        conversationData.serviceOrderId = serviceOrderId;
        conversationData.type = 'service';
      } else {
        conversationData.type = 'regular';
      }

      await set(newConversationRef, conversationData);

      return {
        id: newConversationRef.key,
        ...conversationData
      };
    } catch (error) {
      console.error('Error creating conversation:', error);
      showError('Erro ao criar conversa');
      return null;
    }
  }, [currentUser, showError]);

  // Create new conversation (supports both direct and group conversations)
  const createConversation = useCallback(async (conversationData) => {
    console.log('createConversation called with:', conversationData);
    
    if (!currentUser?.uid || !conversationData.participantIds?.length) {
      console.log('createConversation: Missing user or participants');
      return null;
    }

    try {
      const conversationsRef = ref(database, 'conversations');
      
      // For direct conversations, check if it already exists
      if (conversationData.participantIds.length === 2 && conversationData.type !== 'service') {
        console.log('createConversation: Checking for existing direct conversation');
        
        // Look for existing conversation in current conversations list
        const otherUserId = conversationData.participantIds.find(id => id !== currentUser.uid);
        if (otherUserId) {
          const existingConversation = conversations.find(conv => {
            const participants = Object.keys(conv.participants || {});
            return participants.length === 2 && 
                   participants.includes(currentUser.uid) && 
                   participants.includes(otherUserId) &&
                   !conv.serviceOrderId;
          });
          
          if (existingConversation) {
            console.log('createConversation: Found existing conversation:', existingConversation.id);
            setSelectedConversation(existingConversation);
            setActiveTab('messages');
            return existingConversation;
          }
        }
      }

      // Create new conversation
      console.log('createConversation: Creating new conversation');
      const newConversationRef = push(conversationsRef);
      const participants = {};
      conversationData.participantIds.forEach(id => {
        participants[id] = true;
      });

      const newConversationData = {
        participants,
        createdAt: Date.now(),
        lastMessage: '',
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid,
        type: conversationData.type || 'regular'
      };

      // Add optional fields
      if (conversationData.name) {
        newConversationData.name = conversationData.name;
      }
      if (conversationData.serviceOrderId) {
        newConversationData.serviceOrderId = conversationData.serviceOrderId;
      }

      console.log('createConversation: Setting conversation data:', newConversationData);
      await set(newConversationRef, newConversationData);

      const conversation = {
        id: newConversationRef.key,
        ...newConversationData
      };

      console.log('createConversation: Conversation created successfully:', conversation.id);
      
      // Load the other user's data immediately
      const otherUserId = conversationData.participantIds.find(id => id !== currentUser.uid);
      if (otherUserId && !users[otherUserId]) {
        try {
          const otherUserData = await getUserById(otherUserId);
          if (otherUserData) {
            setUsers(prev => ({
              ...prev,
              [otherUserId]: otherUserData
            }));
            console.log('Loaded other user data for new conversation:', otherUserData.displayName || otherUserData.name);
          }
        } catch (error) {
          console.error('Error loading other user data:', error);
        }
      }
      
      // Add conversation to local state immediately (don't wait for Firebase listener)
      if (conversation.serviceOrderId) {
        setServiceConversations(prev => [conversation, ...prev]);
      } else {
        setConversations(prev => [conversation, ...prev]);
      }
      
      // Set as selected conversation and switch to messages tab
      setSelectedConversation(conversation);
      setActiveTab('messages');

      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      showError('Erro ao criar conversa');
      return null;
    }
  }, [currentUser, showError, conversations, setSelectedConversation, setActiveTab]);

  // Send text message
  const sendMessage = useCallback(async (text, replyToId = null) => {
    if (!text.trim() || !selectedConversation || !currentUser?.uid) return false;

    try {
      setSending(true);

      const messageData = {
        senderId: currentUser.uid,
        type: MESSAGE_TYPES.TEXT,
        content: text.trim(),
        timestamp: Date.now(),
        read: false,
        replyTo: replyToId || null
      };

      const messagesRef = ref(database, `messages/${selectedConversation.id}`);
      const newMessageRef = await push(messagesRef, messageData);

      // Add message to local state immediately for instant UI update
      const newMessage = {
        id: newMessageRef.key,
        ...messageData
      };
      setMessages(prev => [...prev, newMessage]);

      // Update conversation last message using update to preserve existing fields
      const updates = {};
      updates[`conversations/${selectedConversation.id}/lastMessage`] = text.trim();
      updates[`conversations/${selectedConversation.id}/lastMessageTime`] = Date.now();
      updates[`conversations/${selectedConversation.id}/lastSenderId`] = currentUser.uid;

      await update(ref(database), updates);

      // Update local conversation state
      setSelectedConversation(prev => ({
        ...prev,
        lastMessage: text.trim(),
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid
      }));

      // Update conversations list
      setConversations(prev => 
        prev.map(conv => 
          conv.id === selectedConversation.id 
            ? { ...conv, lastMessage: text.trim(), lastMessageTime: Date.now(), lastSenderId: currentUser.uid }
            : conv
        )
      );

      console.log('Message sent successfully:', newMessage);
      console.log('Updated conversation:', {
        id: selectedConversation.id,
        lastMessage: text.trim(),
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid
      });
      console.log('Message should now be visible to other participants in real-time');
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Erro ao enviar mensagem');
      return false;
    } finally {
      setSending(false);
    }
  }, [selectedConversation, currentUser, showError]);

  // Upload media file
  const uploadMediaFile = useCallback(async (file, type) => {
    if (!file || !selectedConversation || !currentUser?.uid) return null;

    try {
      setUploadingMedia(true);

      // Create unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${type}/${selectedConversation.id}/${timestamp}_${currentUser.uid}.${fileExtension}`;

      // Upload to Firebase Storage
      const fileRef = storageRef(storage, `messages/${fileName}`);
      const uploadResult = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      return {
        url: downloadURL,
        name: file.name,
        size: file.size,
        type: file.type,
        storagePath: fileName
      };
    } catch (error) {
      console.error('Error uploading media:', error);
      showError('Erro ao fazer upload do arquivo');
      return null;
    } finally {
      setUploadingMedia(false);
    }
  }, [selectedConversation, currentUser, showError]);

  // Send media message
  const sendMediaMessage = useCallback(async (file, type, caption = '') => {
    if (!file || !selectedConversation || !currentUser?.uid) return false;

    try {
      setSending(true);

      const mediaInfo = await uploadMediaFile(file, type);
      if (!mediaInfo) return false;

      const messageData = {
        senderId: currentUser.uid,
        type: type,
        content: caption,
        mediaUrl: mediaInfo.url,
        mediaInfo: {
          name: mediaInfo.name,
          size: mediaInfo.size,
          type: mediaInfo.type,
          storagePath: mediaInfo.storagePath
        },
        timestamp: Date.now(),
        read: false
      };

      const messagesRef = ref(database, `messages/${selectedConversation.id}`);
      const newMessageRef = await push(messagesRef, messageData);

      // Add message to local state immediately for instant UI update
      const newMessage = {
        id: newMessageRef.key,
        ...messageData
      };
      setMessages(prev => [...prev, newMessage]);

      // Update conversation last message using update to preserve existing fields
      const lastMessageText = caption || `${type === MESSAGE_TYPES.IMAGE ? '📷 Foto' : 
                                       type === MESSAGE_TYPES.VIDEO ? '🎥 Vídeo' : 
                                       type === MESSAGE_TYPES.AUDIO ? '🎵 Áudio' : '📎 Arquivo'}`;
      
      const updates = {};
      updates[`conversations/${selectedConversation.id}/lastMessage`] = lastMessageText;
      updates[`conversations/${selectedConversation.id}/lastMessageTime`] = Date.now();
      updates[`conversations/${selectedConversation.id}/lastSenderId`] = currentUser.uid;

      await update(ref(database), updates);

      // Update local conversation state
      setSelectedConversation(prev => ({
        ...prev,
        lastMessage: lastMessageText,
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid
      }));

      // Update conversations list
      setConversations(prev => 
        prev.map(conv => 
          conv.id === selectedConversation.id 
            ? { ...conv, lastMessage: lastMessageText, lastMessageTime: Date.now(), lastSenderId: currentUser.uid }
            : conv
        )
      );

      return true;
    } catch (error) {
      console.error('Error sending media message:', error);
      showError('Erro ao enviar arquivo');
      return false;
    } finally {
      setSending(false);
    }
  }, [selectedConversation, currentUser, uploadMediaFile, showError]);

  // Send service notification
  const sendServiceNotification = useCallback(async (serviceOrderData) => {
    if (!serviceOrderData || !currentUser?.uid) return false;

    try {
      setSending(true);

      // Create or get service conversation
      const conversation = await createOrGetConversation(
        serviceOrderData.sellerId === currentUser.uid ? serviceOrderData.buyerId : serviceOrderData.sellerId,
        serviceOrderData.id
      );

      if (!conversation) return false;

      const messageData = {
        senderId: 'system',
        type: MESSAGE_TYPES.SERVICE_NOTIFICATION,
        content: 'Nova notificação de serviço',
        serviceOrderData: serviceOrderData,
        timestamp: Date.now(),
        read: false
      };

      const messagesRef = ref(database, `messages/${conversation.id}`);
      await push(messagesRef, messageData);

      // Update conversation last message
      const conversationRef = ref(database, `conversations/${conversation.id}`);
      await set(conversationRef, {
        ...conversation,
        lastMessage: `Serviço: ${serviceOrderData.serviceName}`,
        lastMessageTime: Date.now(),
        lastSenderId: 'system'
      });

      return true;
    } catch (error) {
      console.error('Error sending service notification:', error);
      showError('Erro ao enviar notificação de serviço');
      return false;
    } finally {
      setSending(false);
    }
  }, [currentUser, createOrGetConversation, showError]);



  // Get other participant in conversation
  const getOtherParticipant = useCallback((conversation) => {
    if (!conversation?.participants || !currentUser?.uid) return {};
    
    const participantIds = Object.keys(conversation.participants);
    const otherId = participantIds.find(id => id !== currentUser.uid);
    
    if (!otherId) return {};
    
    // Return the user data we already have loaded
    return users[otherId] || {};
  }, [currentUser, users]);

  // Load specific user data by ID
  const loadUserData = useCallback(async (userId) => {
    if (!userId || users[userId]) return users[userId];
    
    try {
      const userData = await getUserById(userId);
      if (userData) {
        setUsers(prev => ({
          ...prev,
          [userId]: userData
        }));
        return userData;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    
    return null;
  }, [users, getUserById]);

  // Format time
  const formatTime = useCallback((timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  }, []);

  // Get unread count for conversation
  const getUnreadCount = useCallback((conversationId) => {
    // This would be implemented with a separate listener for performance
    // For now, return 0
    return 0;
  }, []);

  // Delete message
  const deleteMessage = useCallback(async (messageId) => {
    if (!selectedConversation || !currentUser?.uid) return false;

    try {
      const messageRef = ref(database, `messages/${selectedConversation.id}/${messageId}`);
      await set(messageRef, null);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      showError('Erro ao deletar mensagem');
      return false;
    }
  }, [selectedConversation, currentUser, showError]);

  // Start conversation with user
  const startConversation = useCallback(async (userId) => {
    if (!currentUser?.uid || !userId) return;

    try {
      const conversation = await createOrGetConversation(userId);
      if (conversation) {
        setSelectedConversation(conversation);
        setActiveTab('messages');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      showError('Erro ao iniciar conversa');
    }
  }, [currentUser, createOrGetConversation, showError]);

  const value = useMemo(() => ({
    // State
    conversations,
    serviceConversations,
    selectedConversation,
    messages,
    users,
    loading,
    sending,
    uploadingMedia,
    recordingAudio,
    activeTab,
    readReceiptsEnabled,

    // Actions
    setSelectedConversation,
    setActiveTab,
    setReadReceiptsEnabled,
    sendMessage,
    sendMediaMessage,
    sendServiceNotification,
    startConversation,
    createConversation,
    createOrGetConversation,
    deleteMessage,
    
    // Utilities
    getOtherParticipant,
    loadUserData,
    formatTime,
    getUnreadCount,
    
    // Constants
    MESSAGE_TYPES
  }), [
    conversations,
    serviceConversations,
    selectedConversation,
    messages,
    users,
    loading,
    sending,
    uploadingMedia,
    recordingAudio,
    activeTab,
    readReceiptsEnabled,
    sendMessage,
    sendMediaMessage,
    sendServiceNotification,
    startConversation,
    createConversation,
    createOrGetConversation,
    deleteMessage,
    getOtherParticipant,
    loadUserData,
    formatTime,
    getUnreadCount
  ]);

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};

export default MessagingProvider;
