import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ref, 
  onValue, 
  push, 
  set, 
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
  const { currentUser } = useAuth();
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
    if (!currentUser) {
      setConversations([]);
      setServiceConversations([]);
      setLoading(false);
      return;
    }

    // Load regular conversations
    const conversationsRef = ref(database, 'conversations');
    const userConversationsQuery = query(
      conversationsRef,
      orderByChild(`participants/${currentUser.uid}`),
      equalTo(true)
    );

    const unsubscribeConversations = onValue(userConversationsQuery, (snapshot) => {
      const conversationsData = [];
      snapshot.forEach((childSnapshot) => {
        const conversation = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
        
        // Filter out service conversations from regular list
        if (!conversation.serviceOrderId) {
          conversationsData.push(conversation);
        }
      });
      
      // Sort by last message time
      conversationsData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      setConversations(conversationsData);
      setLoading(false);
    });

    // Load service conversations
    const serviceConversationsQuery = query(
      conversationsRef,
      orderByChild(`participants/${currentUser.uid}`),
      equalTo(true)
    );

    const unsubscribeServiceConversations = onValue(serviceConversationsQuery, (snapshot) => {
      const serviceConversationsData = [];
      snapshot.forEach((childSnapshot) => {
        const conversation = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
        
        // Only include service conversations
        if (conversation.serviceOrderId) {
          serviceConversationsData.push(conversation);
        }
      });
      
      // Sort by last message time
      serviceConversationsData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      setServiceConversations(serviceConversationsData);
    });

    return () => {
      off(conversationsRef);
    };
  }, [currentUser]);

  // Load users data
  useEffect(() => {
    if (!currentUser) return;

    const usersRef = ref(database, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const usersData = {};
      snapshot.forEach((childSnapshot) => {
        usersData[childSnapshot.key] = childSnapshot.val();
      });
      setUsers(usersData);
    });

    return () => {
      off(usersRef);
    };
  }, [currentUser]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const messagesRef = ref(database, `messages/${selectedConversation.id}`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'));

    const unsubscribeMessages = onValue(messagesQuery, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((childSnapshot) => {
        messagesData.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      setMessages(messagesData);
      
      // Mark messages as read
      if (readReceiptsEnabled) {
        markMessagesAsRead(messagesData);
      }
    });

    return () => {
      off(messagesRef);
    };
  }, [selectedConversation, readReceiptsEnabled]);

  // Create or get conversation
  const createOrGetConversation = useCallback(async (otherUserId, serviceOrderId = null) => {
    if (!currentUser || !otherUserId) return null;

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

  // Send text message
  const sendMessage = useCallback(async (text, replyToId = null) => {
    if (!text.trim() || !selectedConversation || !currentUser) return false;

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
      await push(messagesRef, messageData);

      // Update conversation last message
      const conversationRef = ref(database, `conversations/${selectedConversation.id}`);
      await set(conversationRef, {
        ...selectedConversation,
        lastMessage: text.trim(),
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid
      });

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
    if (!file || !selectedConversation || !currentUser) return null;

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
    if (!file || !selectedConversation || !currentUser) return false;

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
      await push(messagesRef, messageData);

      // Update conversation last message
      const conversationRef = ref(database, `conversations/${selectedConversation.id}`);
      const lastMessageText = caption || `${type === MESSAGE_TYPES.IMAGE ? '📷 Foto' : 
                                       type === MESSAGE_TYPES.VIDEO ? '🎥 Vídeo' : 
                                       type === MESSAGE_TYPES.AUDIO ? '🎵 Áudio' : '📎 Arquivo'}`;
      
      await set(conversationRef, {
        ...selectedConversation,
        lastMessage: lastMessageText,
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid
      });

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
    if (!serviceOrderData || !currentUser) return false;

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

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (messagesData) => {
    if (!currentUser || !selectedConversation) return;

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
      await set(ref(database), updates);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUser, selectedConversation]);

  // Get other participant in conversation
  const getOtherParticipant = useCallback((conversation) => {
    if (!conversation?.participants || !currentUser) return {};
    
    const participantIds = Object.keys(conversation.participants);
    const otherId = participantIds.find(id => id !== currentUser.uid);
    return users[otherId] || {};
  }, [currentUser, users]);

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
    if (!selectedConversation || !currentUser) return false;

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
    if (!currentUser || !userId) return;

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
    createOrGetConversation,
    deleteMessage,
    
    // Utilities
    getOtherParticipant,
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
    createOrGetConversation,
    deleteMessage,
    getOtherParticipant,
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
