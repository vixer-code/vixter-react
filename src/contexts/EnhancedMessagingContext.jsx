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
import { useCentrifugo } from './CentrifugoContext';

const EnhancedMessagingContext = createContext({});

export const useEnhancedMessaging = () => {
  const context = useContext(EnhancedMessagingContext);
  if (!context) {
    throw new Error('useEnhancedMessaging must be used within an EnhancedMessagingProvider');
  }
  return context;
};

export const EnhancedMessagingProvider = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const { getUserById } = useUser();
  const { subscribe, unsubscribe, publish, isConnected } = useCentrifugo();
  
  // State
  const [conversations, setConversations] = useState([]);
  const [serviceConversations, setServiceConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const [offlineMessages, setOfflineMessages] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
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

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('App is online - processing offline messages');
      processOfflineMessages();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('App is offline - messages will be queued');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process offline messages when coming back online
  const processOfflineMessages = useCallback(async () => {
    if (offlineMessages.length === 0) return;

    console.log(`Processing ${offlineMessages.length} offline messages`);
    
    for (const message of offlineMessages) {
      try {
        await sendMessageDirect(message.text, message.conversationId, message.replyToId);
      } catch (error) {
        console.error('Error processing offline message:', error);
      }
    }

    setOfflineMessages([]);
  }, [offlineMessages]);

  // Load conversations
  useEffect(() => {
    if (authLoading) {
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

    // Load service conversations
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

  // Load users data from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const loadUsersFromFirestore = async () => {
      try {
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

  // Mark messages as read
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
    if (!currentUser?.uid || conversations.length === 0) return;

    const loadParticipantsData = async () => {
      const allParticipantIds = new Set();
      
      conversations.forEach(conversation => {
        if (conversation.participants) {
          Object.keys(conversation.participants).forEach(uid => {
            if (uid !== currentUser.uid) {
              allParticipantIds.add(uid);
            }
          });
        }
      });

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

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    console.log('Loading messages for conversation:', selectedConversation.id);

    const messagesRef = ref(database, `messages/${selectedConversation.id}`);
    
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
      
      console.log('Messages loaded:', messagesData.length);
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

  // Subscribe to Centrifugo channel for real-time messaging
  useEffect(() => {
    if (!selectedConversation || !isConnected) {
      return;
    }

    const channelName = `conversation:${selectedConversation.id}`;
    console.log('Subscribing to Centrifugo channel:', channelName);

    const subscription = subscribe(channelName, {
      onMessage: (data, ctx) => {
        console.log('Received real-time message via Centrifugo:', data);
        
        // Handle different message types
        if (data.type === 'new_message') {
          // Add new message to local state
          setMessages(prev => {
            const messageExists = prev.some(msg => msg.id === data.message.id);
            if (!messageExists) {
              return [...prev, data.message];
            }
            return prev;
          });
        } else if (data.type === 'message_updated') {
          // Update existing message
          setMessages(prev => 
            prev.map(msg => 
              msg.id === data.message.id ? data.message : msg
            )
          );
        } else if (data.type === 'message_deleted') {
          // Remove deleted message
          setMessages(prev => 
            prev.filter(msg => msg.id !== data.messageId)
          );
        } else if (data.type === 'typing') {
          // Handle typing indicators
          console.log('User typing:', data.userId, data.isTyping);
        }
      },
      onSubscribed: (ctx) => {
        console.log('Successfully subscribed to conversation channel');
      },
      onError: (ctx) => {
        console.error('Error in conversation subscription:', ctx);
      }
    });

    return () => {
      if (subscription) {
        unsubscribe(channelName);
      }
    };
  }, [selectedConversation?.id, isConnected, subscribe, unsubscribe]);

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

  // Create new conversation
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
      
      // Add conversation to local state immediately
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

  // Send message directly (used for offline message processing)
  const sendMessageDirect = useCallback(async (text, conversationId, replyToId = null) => {
    if (!text.trim() || !conversationId || !currentUser?.uid) return false;

    try {
      const messageData = {
        senderId: currentUser.uid,
        type: MESSAGE_TYPES.TEXT,
        content: text.trim(),
        timestamp: Date.now(),
        read: false,
        replyTo: replyToId || null
      };

      const messagesRef = ref(database, `messages/${conversationId}`);
      const newMessageRef = await push(messagesRef, messageData);

      const newMessage = {
        id: newMessageRef.key,
        ...messageData
      };

      // Update conversation last message
      const updates = {};
      updates[`conversations/${conversationId}/lastMessage`] = text.trim();
      updates[`conversations/${conversationId}/lastMessageTime`] = Date.now();
      updates[`conversations/${conversationId}/lastSenderId`] = currentUser.uid;

      await update(ref(database), updates);

      // Publish message via Centrifugo for real-time delivery
      try {
        const channelName = `conversation:${conversationId}`;
        await publish(channelName, {
          type: 'new_message',
          message: newMessage,
          conversationId: conversationId,
          timestamp: Date.now()
        });
        console.log('Message published via Centrifugo');
      } catch (error) {
        console.error('Error publishing message via Centrifugo:', error);
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [currentUser, publish]);

  // Send text message (main function)
  const sendMessage = useCallback(async (text, replyToId = null) => {
    if (!text.trim() || !selectedConversation || !currentUser?.uid) return false;

    // If offline, queue the message
    if (!isOnline) {
      console.log('App is offline - queuing message');
      setOfflineMessages(prev => [...prev, {
        text: text.trim(),
        conversationId: selectedConversation.id,
        replyToId,
        timestamp: Date.now()
      }]);
      return true;
    }

    try {
      setSending(true);
      const success = await sendMessageDirect(text, selectedConversation.id, replyToId);
      
      if (success) {
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
      }

      return success;
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Erro ao enviar mensagem');
      return false;
    } finally {
      setSending(false);
    }
  }, [selectedConversation, currentUser, isOnline, sendMessageDirect, showError]);

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

      const newMessage = {
        id: newMessageRef.key,
        ...messageData
      };

      // Update conversation last message
      const lastMessageText = caption || `${type === MESSAGE_TYPES.IMAGE ? '📷 Foto' : 
                                       type === MESSAGE_TYPES.VIDEO ? '🎥 Vídeo' : 
                                       type === MESSAGE_TYPES.AUDIO ? '🎵 Áudio' : '📎 Arquivo'}`;
      
      const updates = {};
      updates[`conversations/${selectedConversation.id}/lastMessage`] = lastMessageText;
      updates[`conversations/${selectedConversation.id}/lastMessageTime`] = Date.now();
      updates[`conversations/${selectedConversation.id}/lastSenderId`] = currentUser.uid;

      await update(ref(database), updates);

      // Publish message via Centrifugo
      try {
        const channelName = `conversation:${selectedConversation.id}`;
        await publish(channelName, {
          type: 'new_message',
          message: newMessage,
          conversationId: selectedConversation.id,
          timestamp: Date.now()
        });
        console.log('Media message published via Centrifugo');
      } catch (error) {
        console.error('Error publishing media message via Centrifugo:', error);
      }

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
  }, [selectedConversation, currentUser, uploadMediaFile, publish, showError]);

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

  // Get other participant in conversation
  const getOtherParticipant = useCallback((conversation) => {
    if (!conversation?.participants || !currentUser?.uid) return {};
    
    const participantIds = Object.keys(conversation.participants);
    const otherId = participantIds.find(id => id !== currentUser.uid);
    
    if (!otherId) return {};
    
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
    offlineMessages,
    isOnline,

    // Actions
    setSelectedConversation,
    setActiveTab,
    setReadReceiptsEnabled,
    sendMessage,
    sendMediaMessage,
    startConversation,
    createConversation,
    createOrGetConversation,
    deleteMessage,
    
    // Utilities
    getOtherParticipant,
    loadUserData,
    formatTime,
    
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
    offlineMessages,
    isOnline,
    sendMessage,
    sendMediaMessage,
    startConversation,
    createConversation,
    createOrGetConversation,
    deleteMessage,
    getOtherParticipant,
    loadUserData,
    formatTime
  ]);

  return (
    <EnhancedMessagingContext.Provider value={value}>
      {children}
    </EnhancedMessagingContext.Provider>
  );
};

export default EnhancedMessagingProvider;
