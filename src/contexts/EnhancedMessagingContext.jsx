import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// Generate deterministic conversation ID from participants
const generateConversationId = (userA, userB, serviceOrderId = null) => {
  const sorted = [userA, userB].sort(); // Ensure same order regardless of who initiates
  // Replace special characters that might cause Firebase key issues
  const cleanUserA = sorted[0].replace(/[.#$[\]]/g, '_');
  const cleanUserB = sorted[1].replace(/[.#$[\]]/g, '_');
  const baseId = `conv_${cleanUserA}_${cleanUserB}`;
  return serviceOrderId ? `${baseId}_service_${serviceOrderId}` : baseId;
};

const EnhancedMessagingContext = createContext({});

export const useEnhancedMessaging = () => {
  const context = useContext(EnhancedMessagingContext);
  if (!context) {
    throw new Error('useEnhancedMessaging must be used within an EnhancedMessagingProvider');
  }
  return context;
};

// Alias for backward compatibility
export const useMessaging = useEnhancedMessaging;

export const EnhancedMessagingProvider = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const { getUserById } = useUser();
  const { subscribe, unsubscribe, publish, isConnected } = useCentrifugo();
  
  // Fallback for when Centrifugo is not available
  const [centrifugoAvailable, setCentrifugoAvailable] = useState(true);
  
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
  
  // Typing indicators
  const [typingUsers, setTypingUsers] = useState({}); // { conversationId: { userId: { name, timestamp } } }
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  
  // Ref to access current selectedConversation in global subscription
  const selectedConversationRef = useRef(selectedConversation);
  
  // Update ref when selectedConversation changes
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);
  
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

    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('Conversations loading timeout - setting loading to false');
      setLoading(false);
    }, 15000); // 15 second timeout (increased from 10)

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
      setLoading(false); // Set loading to false immediately after first load
      clearTimeout(loadingTimeout);
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
      unsubscribeConversations();
      unsubscribeServiceConversations();
      clearTimeout(loadingTimeout);
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
    if (!selectedConversation) {
      return;
    }

    // If Centrifugo is not connected, still show a message but don't fail
    if (!isConnected) {
      console.log('⚠️ Centrifugo not connected, messages will only sync via Firebase');
      return;
    }

    const channelName = `conversation:${selectedConversation.id}`;
    console.log('🔔 SUBSCRIBING TO CHANNEL:', channelName);
    console.log('🔔 CONVERSATION ID:', selectedConversation.id);
    console.log('🔔 CURRENT USER:', currentUser.uid);

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
          console.log('📝 Received typing indicator:', data.userId, data.isTyping);
          
          // Don't show typing indicator for current user
          if (data.userId !== currentUser?.uid) {
            setTypingUsers(prev => {
              const conversationId = selectedConversation?.id;
              if (!conversationId) return prev;

              const updated = { ...prev };
              
              if (!updated[conversationId]) {
                updated[conversationId] = {};
              }

              if (data.isTyping) {
                updated[conversationId][data.userId] = {
                  name: data.userName,
                  timestamp: Date.now()
                };
              } else {
                delete updated[conversationId][data.userId];
                
                // Remove conversation if no users typing
                if (Object.keys(updated[conversationId]).length === 0) {
                  delete updated[conversationId];
                }
              }

              return updated;
            });
          }
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

  // Global user subscription for receiving messages from any conversation
  useEffect(() => {
    if (!currentUser?.uid || !isConnected || !subscribe || !unsubscribe) return;

    const userChannel = `user:${currentUser.uid}`;
    console.log('🌐 Subscribing to global user channel:', userChannel);

    const subscription = subscribe(userChannel, {
      onMessage: (data, ctx) => {
        console.log('🌐 Received global message notification:', data);
        
        if (data.type === 'new_message') {
          const { message, conversationId } = data;
          
          // If this is for the currently selected conversation, it will be handled by the conversation subscription
          // If not, update the conversations list to show new message indicator
          if (conversationId !== selectedConversationRef.current?.id) {
            console.log('🔔 New message in different conversation:', conversationId);
            
            let conversationUpdated = false;
            
            // Update conversations list with new message info
            setConversations(prev => {
              const updated = prev.map(conv => 
                conv.id === conversationId 
                  ? { 
                      ...conv, 
                      lastMessage: message.content,
                      lastMessageTime: message.timestamp,
                      lastSenderId: message.senderId,
                      hasUnreadMessages: true
                    }
                  : conv
              );
              
              // Re-sort conversations by last message time
              updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
              
              conversationUpdated = updated.some(conv => conv.id === conversationId);
              console.log('📋 Updated conversations list, conversation found:', conversationUpdated);
              return updated;
            });

            // Also update service conversations if it's a service conversation
            setServiceConversations(prev => {
              const updated = prev.map(conv => 
                conv.id === conversationId 
                  ? { 
                      ...conv, 
                      lastMessage: message.content,
                      lastMessageTime: message.timestamp,
                      lastSenderId: message.senderId,
                      hasUnreadMessages: true
                    }
                  : conv
              );
              
              // Re-sort service conversations by last message time
              updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
              
              if (!conversationUpdated) {
                conversationUpdated = updated.some(conv => conv.id === conversationId);
                console.log('📋 Updated service conversations list, conversation found:', conversationUpdated);
              }
              return updated;
            });

            // Show notification regardless of whether conversation was found in state
            // This ensures users always see notifications even if there's a state sync issue
            showInfo(
              `New message from ${message.senderName || 'Someone'}`, 
              'New Message',
              7000,
              {
                onClick: (data) => {
                  // Navigate to messages page and select conversation
                  window.location.href = `/messages?conversation=${data.conversationId}`;
                },
                data: { conversationId, messageId: message.id }
              }
            );
            
            if (!conversationUpdated) {
              console.warn('⚠️ Received message for conversation not in local state:', conversationId);
              console.log('📝 This might indicate a state sync issue or new conversation creation');
            }
          }
        }
      },
      onSubscribed: (ctx) => {
        console.log('✅ Successfully subscribed to global user channel');
      },
      onError: (ctx) => {
        console.error('❌ Error in global user subscription:', ctx);
      }
    });

    return () => {
      console.log('🌐 Unsubscribing from global user channel:', userChannel);
      if (subscription) {
        unsubscribe(userChannel);
      }
    };
  }, [currentUser?.uid, isConnected, subscribe, unsubscribe]);

  // Typing indicators functions
  const sendTypingIndicator = useCallback(async (isTyping) => {
    if (!selectedConversation?.id || !currentUser?.uid || !isConnected || !publish) return;

    try {
      const channelName = `conversation:${selectedConversation.id}`;
      await publish(channelName, {
        type: 'typing',
        userId: currentUser.uid,
        userName: currentUser.displayName || 'User',
        isTyping: isTyping,
        timestamp: Date.now()
      });
      console.log('📝 Typing indicator sent:', isTyping);
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }, [selectedConversation?.id, currentUser, isConnected, publish]);

  const startTyping = useCallback(() => {
    if (isTyping) return; // Already typing
    
    setIsTyping(true);
    sendTypingIndicator(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [isTyping, sendTypingIndicator]);

  const stopTyping = useCallback(() => {
    if (!isTyping) return; // Not typing

    setIsTyping(false);
    sendTypingIndicator(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, sendTypingIndicator]);

  const handleTypingChange = useCallback((typing) => {
    if (typing) {
      startTyping();
    } else {
      // Reset timeout when user continues typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          stopTyping();
        }, 3000);
      }
    }
  }, [startTyping, stopTyping]);

  // Clean up typing indicators older than 5 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(conversationId => {
          Object.keys(updated[conversationId]).forEach(userId => {
            if (now - updated[conversationId][userId].timestamp > 5000) {
              delete updated[conversationId][userId];
              hasChanges = true;
              
              // Remove conversation if no users typing
              if (Object.keys(updated[conversationId]).length === 0) {
                delete updated[conversationId];
              }
            }
          });
        });

        return hasChanges ? updated : prev;
      });
    }, 1000); // Check every second

    return () => clearInterval(cleanupInterval);
  }, []);

  // Clean up typing state when conversation changes
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setIsTyping(false);
    };
  }, [selectedConversation?.id]);

  // Create or get conversation
  const createOrGetConversation = useCallback(async (otherUserId, serviceOrderId = null) => {
    console.log('🔄 createOrGetConversation called with:', { otherUserId, serviceOrderId, currentUser: currentUser?.uid });
    
    if (!currentUser?.uid || !otherUserId) {
      console.log('❌ Missing required data:', { currentUser: currentUser?.uid, otherUserId });
      return null;
    }

    try {
      // Generate deterministic conversation ID
      const conversationId = generateConversationId(currentUser.uid, otherUserId, serviceOrderId);
      console.log('🎯 Generated deterministic conversation ID:', conversationId);

      const conversationRef = ref(database, `conversations/${conversationId}`);
      
      // First check if conversation already exists in local state
      const allConversations = [...conversations, ...serviceConversations];
      let existingConversation = allConversations.find(conv => conv.id === conversationId);

      if (existingConversation) {
        console.log('✅ Found existing conversation in local state:', conversationId);
        return existingConversation;
      }

      // Check if conversation exists in Firebase
      const snapshot = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Firebase query timeout'));
        }, 5000);
        
        onValue(conversationRef, (snapshot) => {
          clearTimeout(timeoutId);
          resolve(snapshot);
        }, { onlyOnce: true });
      });

      if (snapshot.exists()) {
        console.log('✅ Found existing conversation in Firebase:', conversationId);
        const existingData = snapshot.val();
        const conversation = {
          id: conversationId,
          ...existingData
        };

        // Add to local state
        if (serviceOrderId) {
          setServiceConversations(prev => [conversation, ...prev]);
        } else {
          setConversations(prev => [conversation, ...prev]);
        }

        return conversation;
      }

      // Create new conversation with deterministic ID
      console.log('🆕 Creating new conversation with ID:', conversationId);
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

      console.log('💾 Saving conversation to Firebase...');
      await set(conversationRef, conversationData);
      console.log('✅ Conversation saved to Firebase successfully');

      const newConversation = {
        id: conversationId,
        ...conversationData
      };
      
      console.log('✅ Created new conversation:', newConversation.id);
      
      // Add conversation to local state immediately (don't wait for Firebase listener)
      if (conversationData.serviceOrderId) {
        setServiceConversations(prev => [newConversation, ...prev]);
      } else {
        setConversations(prev => [newConversation, ...prev]);
      }
      console.log('📱 Added conversation to local state');
      
      return newConversation;
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      
      // If the error is a timeout, try creating the conversation anyway
      if (error.message === 'Firebase query timeout') {
        console.log('⚠️ Firebase query timed out, creating conversation anyway...');
        try {
          const conversationsRef = ref(database, 'conversations');
          const newConversationRef = push(conversationsRef);
          const conversationData = {
            participants: {
              [currentUser.uid]: true,
              [otherUserId]: true
            },
            createdAt: Date.now(),
            lastMessage: '',
            lastMessageTime: Date.now(),
            lastSenderId: currentUser.uid,
            type: serviceOrderId ? 'service' : 'regular'
          };

          if (serviceOrderId) {
            conversationData.serviceOrderId = serviceOrderId;
      }

      await set(newConversationRef, conversationData);

          const newConversation = {
        id: newConversationRef.key,
        ...conversationData
      };
          
          console.log('✅ Fallback conversation created:', newConversation.id);
          
          // Add to local state
          if (conversationData.serviceOrderId) {
            setServiceConversations(prev => [newConversation, ...prev]);
          } else {
            setConversations(prev => [newConversation, ...prev]);
          }
          
          return newConversation;
        } catch (fallbackError) {
          console.error('❌ Fallback creation also failed:', fallbackError);
          showError('Erro ao criar conversa - problema de conexão');
          return null;
        }
      }
      
      showError('Erro ao criar conversa');
      return null;
    }
  }, [currentUser, showError, conversations, serviceConversations, setConversations, setServiceConversations]);

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
      const conversationRef = ref(database, `conversations/${conversationId}`);
      const conversationUpdates = {
        lastMessage: text.trim(),
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid
      };

      await update(conversationRef, conversationUpdates);

      // Publish message via Centrifugo for real-time delivery
      if (centrifugoAvailable && publish) {
        try {
          const channelName = `conversation:${conversationId}`;
          console.log('📤 PUBLISHING TO CHANNEL:', channelName);
          console.log('📤 MESSAGE DATA:', newMessage);
          await publish(channelName, {
            type: 'new_message',
            message: newMessage,
            conversationId: conversationId,
            timestamp: Date.now()
          });
          console.log('✅ Message published via Centrifugo successfully');

          // Also publish to recipient's global user channel for notifications
          const conversation = conversations.find(c => c.id === conversationId) || 
                              serviceConversations.find(c => c.id === conversationId);
          
          if (conversation) {
            const participantIds = Object.keys(conversation.participants || {});
            const recipientIds = participantIds.filter(id => id !== currentUser.uid);
            
            for (const recipientId of recipientIds) {
              try {
                const userChannel = `user:${recipientId}`;
                console.log('🌐 Publishing global notification to:', userChannel);
                await publish(userChannel, {
                  type: 'new_message',
                  message: {
                    ...newMessage,
                    senderName: currentUser.displayName || 'Someone'
                  },
                  conversationId: conversationId,
                  timestamp: Date.now()
                });
                console.log('✅ Global notification sent to:', recipientId);
              } catch (globalError) {
                console.error('Error sending global notification to', recipientId, ':', globalError);
              }
            }
          }
        } catch (error) {
          console.error('Error publishing message via Centrifugo:', error);
          // Disable Centrifugo if it fails consistently
          setCentrifugoAvailable(false);
        }
      } else {
        console.log('Centrifugo not available - message saved to Firebase only');
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [currentUser, publish, conversations, serviceConversations]);

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
      
      // Update conversation last message
      const conversationRef = ref(database, `conversations/${selectedConversation.id}`);
      const conversationUpdates = {
        lastMessage: lastMessageText,
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid
      };

      await update(conversationRef, conversationUpdates);

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

        // Also publish to recipient's global user channel for notifications
        const participantIds = Object.keys(selectedConversation.participants || {});
        const recipientIds = participantIds.filter(id => id !== currentUser.uid);
        
        for (const recipientId of recipientIds) {
          try {
            const userChannel = `user:${recipientId}`;
            console.log('🌐 Publishing global media notification to:', userChannel);
            await publish(userChannel, {
              type: 'new_message',
              message: {
                ...newMessage,
                senderName: currentUser.displayName || 'Someone'
              },
              conversationId: selectedConversation.id,
              timestamp: Date.now()
            });
            console.log('✅ Global media notification sent to:', recipientId);
          } catch (globalError) {
            console.error('Error sending global media notification to', recipientId, ':', globalError);
          }
        }
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
    if (!currentUser?.uid || !userId) return null;

    try {
      console.log('🚀 Starting conversation with user ID:', userId);
      // Use deterministic conversation ID approach
      const conversation = await createOrGetConversation(userId, null);
      if (conversation) {
        console.log('✅ Conversation created/found:', conversation.id);
        setSelectedConversation(conversation);
        setActiveTab('messages');
        return conversation; // Return the conversation so UserSelector can use it
      }
      return null;
    } catch (error) {
      console.error('❌ Error starting conversation:', error);
      showError('Erro ao iniciar conversa');
      return null;
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

  // Get typing users for current conversation
  const getTypingUsers = useCallback(() => {
    if (!selectedConversation?.id) return [];
    
    const conversationTyping = typingUsers[selectedConversation.id];
    if (!conversationTyping) return [];
    
    return Object.keys(conversationTyping).map(userId => ({
      userId,
      name: conversationTyping[userId].name,
      timestamp: conversationTyping[userId].timestamp
    }));
  }, [selectedConversation?.id, typingUsers]);

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
    
    // Typing indicators
    typingUsers,
    isTyping,

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
    
    // Typing functions
    handleTypingChange,
    startTyping,
    stopTyping,
    getTypingUsers,
    
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
