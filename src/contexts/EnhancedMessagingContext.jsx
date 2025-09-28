import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ref, 
  onValue, 
  push, 
  set, 
  update,
  off, 
  get,
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
import { 
  collection, 
  query as fsQuery, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { database, storage, db } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { useUser } from './UserContext';
import { useCentrifugo } from './CentrifugoContext';
import { useStatus } from './StatusContext';
// Conversation service removed - using RTDB only
import { sendMessageNotification } from '../services/notificationService';
import { 
  createConversationObject, 
  findExistingConversation, 
  isValidConversation
} from '../utils/conversation';

// Generate deterministic conversation ID from participants
const generateConversationId = (userA, userB, serviceOrderId = null) => {
  const sorted = [userA, userB].sort(); // Ensure same order regardless of who initiates
  // Replace special characters that might cause Firebase key issues
  const cleanUserA = sorted[0].replace(/[.#$[\]]/g, '_');
  const cleanUserB = sorted[1].replace(/[.#$[\]]/g, '_');
  
  // For service orders, always include the serviceOrderId to ensure uniqueness
  // This prevents conflicts when multiple orders exist between the same users
  return serviceOrderId ? 
    `conv_${cleanUserA}_${cleanUserB}_service_${serviceOrderId}` : 
    `conv_${cleanUserA}_${cleanUserB}`;
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
  const { userStatus, selectedStatus } = useStatus();
  
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
  
  // Update isOnline based on user status
  useEffect(() => {
    setIsOnline(userStatus === 'online' && navigator.onLine);
  }, [userStatus]);

  // Subscribe to status updates for users in conversations
  useEffect(() => {
    if (!currentUser?.uid || conversations.length === 0) return;

    const statusUnsubscribers = [];
    const subscribedUsers = new Set(); // Track already subscribed users

    // Get all unique user IDs from conversations
    const allUserIds = new Set();
    conversations.forEach(conversation => {
      if (conversation.participants) {
        Object.keys(conversation.participants).forEach(userId => {
          if (userId !== currentUser.uid) {
            allUserIds.add(userId);
          }
        });
      }
    });

    // Subscribe to status updates for each user (only if not already subscribed)
    allUserIds.forEach(userId => {
      if (subscribedUsers.has(userId)) return; // Skip if already subscribed
      
      const statusRef = ref(database, `status/${userId}`);
      const unsubscribe = onValue(statusRef, (snapshot) => {
        if (snapshot.exists()) {
          const statusData = snapshot.val();
          const now = Date.now();
          const OFFLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes (reduced from 3)
          const lastChanged = statusData.last_changed;
          
          // Handle both timestamp formats (number and server timestamp)
          let lastChangedTime = lastChanged;
          if (lastChanged && typeof lastChanged === 'object' && lastChanged._seconds) {
            lastChangedTime = lastChanged._seconds * 1000; // Convert from seconds to milliseconds
          }
          
          const isRecentActivity = lastChangedTime && (now - lastChangedTime) < OFFLINE_THRESHOLD;
          
          // Only consider user online if they have recent activity AND status is online
          const actualStatus = (statusData.state === 'online' && isRecentActivity) ? 'online' : 'offline';
          
          // Only update if status actually changed to prevent unnecessary re-renders
          setUsers(prev => {
            const currentUserData = prev[userId];
            if (currentUserData && currentUserData.status === actualStatus) {
              return prev; // No change needed
            }
            
            console.log(`👤 Status update for ${userId.slice(0, 8)}:`, {
              dbStatus: statusData.state,
              lastChanged: lastChangedTime,
              timeSinceChange: lastChangedTime ? (now - lastChangedTime) / 1000 : 'unknown',
              isRecentActivity,
              actualStatus
            });
            
            return {
              ...prev,
              [userId]: {
                ...prev[userId],
                status: actualStatus,
                lastSeen: lastChangedTime
              }
            };
          });
        } else {
          // If no status data exists, mark as offline
          setUsers(prev => {
            const currentUserData = prev[userId];
            if (currentUserData && currentUserData.status === 'offline') {
              return prev; // No change needed
            }
            
            console.log(`👤 No status data for ${userId.slice(0, 8)}, marking as offline`);
            
            return {
              ...prev,
              [userId]: {
                ...prev[userId],
                status: 'offline',
                lastSeen: null
              }
            };
          });
        }
      });
      statusUnsubscribers.push(unsubscribe);
      subscribedUsers.add(userId);
    });

    return () => {
      statusUnsubscribers.forEach(unsubscribe => unsubscribe());
      subscribedUsers.clear();
    };
  }, [conversations, currentUser?.uid]);
  
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

  // Function to enrich conversation with user data
  const enrichConversationWithUserData = async (conversation) => {
    try {
      // Get buyer and seller data
      const [buyerData, sellerData] = await Promise.all([
        getUserById(conversation.buyerId),
        getUserById(conversation.sellerId)
      ]);
      
      return {
        ...conversation,
        buyerUsername: buyerData?.username || buyerData?.displayName || 'Comprador',
        sellerUsername: sellerData?.username || sellerData?.displayName || 'Vendedor',
        buyerPhotoURL: buyerData?.photoURL || buyerData?.profilePictureURL,
        sellerPhotoURL: sellerData?.photoURL || sellerData?.profilePictureURL
      };
    } catch (error) {
      console.error('Error enriching conversation with user data:', error);
      return conversation;
    }
  };

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
      setLoading(false);
    }, 15000); // 15 second timeout (increased from 10)


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
          
          console.log('🔍 Processing conversation:', conversation.id, {
            participants: conversation.participants,
            hasCurrentUser: conversation.participants?.[currentUser.uid],
            isService: !!conversation.serviceOrderId,
            lastMessage: conversation.lastMessage,
            lastMessageTime: conversation.lastMessageTime
          });
          
          // Check if current user is a participant
          if (conversation.participants && conversation.participants[currentUser.uid]) {
            // Filter out service conversations from regular list
            if (!conversation.serviceOrderId) {
              conversationsData.push(conversation);
              console.log('✅ Added regular conversation:', conversation.id);
            } else {
              console.log('🛠️ Skipped service conversation:', conversation.id);
            }
          } else {
            console.log('❌ User not participant in conversation:', conversation.id);
          }
        });
        
        // Sort by last message time
        conversationsData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      } else {
      }
      
      setConversations(conversationsData);
      
      // Load user data for all participants
      const allParticipantIds = new Set();
      conversationsData.forEach(conversation => {
        if (conversation.participants) {
          Object.keys(conversation.participants).forEach(participantId => {
            if (participantId !== currentUser.uid) {
              allParticipantIds.add(participantId);
            }
          });
        }
      });
      
      // Load missing user data
      allParticipantIds.forEach(participantId => {
        if (!users[participantId]) {
          // Load user data asynchronously
          getUserById(participantId).then(userData => {
            if (userData) {
              setUsers(prev => ({
                ...prev,
                [participantId]: userData
              }));
            }
          }).catch(error => {
            console.error('Error loading user data for participant:', error, participantId);
          });
        }
      });
      
      setLoading(false); // Set loading to false immediately after first load
      clearTimeout(loadingTimeout);
    });

    // Load service conversations from RTDB
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
            // Include all service conversations (both active and completed)
            if (conversation.serviceOrderId) {
              serviceConversationsData.push(conversation);
              console.log('✅ Added service conversation from RTDB:', conversation.id, 'Order:', conversation.serviceOrderId, 'Completed:', conversation.isCompleted);
            }
          }
        });
        
        // Sort by last message time
        serviceConversationsData.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      } else {
        console.log('🛠️ No service conversations found in RTDB');
      }
      
      console.log('🛠️ RTDB service conversations loaded:', serviceConversationsData.length);
      console.log('🛠️ RTDB service conversation IDs:', serviceConversationsData.map(c => `${c.id} (Order: ${c.serviceOrderId})`));
      
      // Debug: Check for completed conversations
      const completedConversations = serviceConversationsData.filter(conv => conv.isCompleted);
      console.log('🔒 Completed service conversations:', completedConversations.length);
      
      // Update service conversations with RTDB data only
      setServiceConversations(prev => {
        // Keep Firestore conversations that are not in RTDB
        const firestoreConversations = prev.filter(conv => conv._source === 'firestore');
        const rtdbConversationIds = new Set(serviceConversationsData.map(conv => conv.id));
        const uniqueFirestoreConversations = firestoreConversations.filter(conv => !rtdbConversationIds.has(conv.id));
        
        // Combine RTDB and unique Firestore conversations
        const allConversations = [...serviceConversationsData, ...uniqueFirestoreConversations];
        
        // Sort by last message time
        allConversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        
        console.log('🛠️ Combined service conversations:', allConversations.length);
        console.log('🛠️ RTDB:', serviceConversationsData.length, 'Firestore:', uniqueFirestoreConversations.length);
        
        return allConversations;
      });
    });

    // Load service conversations from Firestore based on chatId in serviceOrders
    const loadFirestoreServiceConversations = async () => {
      try {
        console.log('🔍 Loading Firestore service conversations for user:', currentUser.uid);
        
        // Query service orders where user is buyer or seller
        const serviceOrdersRef = collection(db, 'serviceOrders');
        const buyerQuery = fsQuery(
          serviceOrdersRef,
          where('buyerId', '==', currentUser.uid),
          where('chatId', '!=', null)
        );
        
        const sellerQuery = fsQuery(
          serviceOrdersRef,
          where('sellerId', '==', currentUser.uid),
          where('chatId', '!=', null)
        );
        
        const [buyerSnapshot, sellerSnapshot] = await Promise.all([
          getDocs(buyerQuery).catch(error => {
            console.warn('Buyer query failed:', error.message);
            return { docs: [] };
          }),
          getDocs(sellerQuery).catch(error => {
            console.warn('Seller query failed:', error.message);
            return { docs: [] };
          })
        ]);
        
        const firestoreConversations = [];
        
        // Process buyer orders
        for (const doc of buyerSnapshot.docs) {
          const orderData = doc.data();
          if (orderData.chatId) {
            const isCompleted = orderData.status === 'COMPLETED' || orderData.status === 'CONFIRMED' || orderData.status === 'AUTO_RELEASED';
            
            const conversation = {
              id: orderData.chatId,
              serviceOrderId: orderData.id,
              participants: {
                [orderData.buyerId]: true,
                [orderData.sellerId]: true
              },
              participantIds: [orderData.buyerId, orderData.sellerId],
              lastMessage: `Conversa iniciada para o serviço: ${orderData.metadata?.serviceName || 'Serviço'}`,
              lastMessageTime: orderData.timestamps?.createdAt?.toMillis?.() || Date.now(),
              isCompleted: isCompleted,
              serviceName: orderData.metadata?.serviceName || 'Serviço',
              buyerId: orderData.buyerId,
              sellerId: orderData.sellerId,
              additionalFeatures: orderData.additionalFeatures || [],
              _source: 'firestore'
            };
            
            // Enrich with user data
            const enrichedConversation = await enrichConversationWithUserData(conversation);
            firestoreConversations.push(enrichedConversation);
            console.log('✅ Added Firestore conversation from buyer order:', orderData.chatId, 'Order:', orderData.id, 'Completed:', isCompleted);
          }
        }
        
        // Process seller orders
        for (const doc of sellerSnapshot.docs) {
          const orderData = doc.data();
          if (orderData.chatId) {
            const isCompleted = orderData.status === 'COMPLETED' || orderData.status === 'CONFIRMED' || orderData.status === 'AUTO_RELEASED';
            
            const conversation = {
              id: orderData.chatId,
              serviceOrderId: orderData.id,
              participants: {
                [orderData.buyerId]: true,
                [orderData.sellerId]: true
              },
              participantIds: [orderData.buyerId, orderData.sellerId],
              lastMessage: `Conversa iniciada para o serviço: ${orderData.metadata?.serviceName || 'Serviço'}`,
              lastMessageTime: orderData.timestamps?.createdAt?.toMillis?.() || Date.now(),
              isCompleted: isCompleted,
              serviceName: orderData.metadata?.serviceName || 'Serviço',
              buyerId: orderData.buyerId,
              sellerId: orderData.sellerId,
              additionalFeatures: orderData.additionalFeatures || [],
              _source: 'firestore'
            };
            
            // Enrich with user data
            const enrichedConversation = await enrichConversationWithUserData(conversation);
            firestoreConversations.push(enrichedConversation);
            console.log('✅ Added Firestore conversation from seller order:', orderData.chatId, 'Order:', orderData.id, 'Completed:', isCompleted);
          }
        }
        
        // Removed additionalFeatures processing - all conversations now use chatId at root level
        
        // Merge Firestore conversations with existing RTDB conversations
        setServiceConversations(prev => {
          const existingIds = new Set(prev.map(conv => conv.id));
          const newFirestoreConversations = firestoreConversations.filter(conv => !existingIds.has(conv.id));
          
          if (newFirestoreConversations.length > 0) {
            console.log('✅ Adding new Firestore conversations:', newFirestoreConversations.length);
            newFirestoreConversations.forEach(conv => {
              console.log('✅ Added new Firestore conversation:', conv.id, 'Order:', conv.serviceOrderId, 'Completed:', conv.isCompleted);
            });
          }
          
          // Combine existing conversations with new Firestore conversations
          const allConversations = [...prev, ...newFirestoreConversations];
          
          // Sort by last message time
          allConversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          
          console.log('🛠️ Final service conversations:', allConversations.length);
          console.log('🛠️ Conversation IDs:', allConversations.map(c => `${c.id} (Order: ${c.serviceOrderId}, Source: ${c._source || 'RTDB'}, Completed: ${c.isCompleted})`));
          
          return allConversations;
        });
        
      } catch (error) {
        console.error('❌ Error loading Firestore service conversations:', error);
      }
    };
    
    // Load Firestore conversations
    loadFirestoreServiceConversations();

    return () => {
      unsubscribeConversations();
      unsubscribeServiceConversations();
      clearTimeout(loadingTimeout);
    };
  }, [currentUser?.uid, authLoading]);

  // Reset state when user changes or logs out
  useEffect(() => {
    if (!currentUser || !currentUser.uid) {
      console.log('🔄 User logged out or changed, clearing conversation state');
      setConversations([]);
      setServiceConversations([]);
      setSelectedConversation(null);
      setMessages([]);
      setUsers({});
      setLoading(false);
    } else {
      console.log('👤 User logged in:', currentUser.uid);
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

    if (unreadMessages.length === 0) {
      console.log('📖 No unread messages to mark as read');
      return;
    }

    console.log(`📖 Marking ${unreadMessages.length} messages as read for conversation:`, selectedConversation.id);

    try {
      // Update messages one by one to handle permissions better
      const updatePromises = unreadMessages.map(async (msg) => {
        const messageRef = ref(database, `conversations/${selectedConversation.id}/messages/${msg.id}`);
        const updates = {
          read: true,
          readAt: Date.now(),
          readBy: currentUser.uid
        };
        
        try {
          await update(messageRef, updates);
          console.log(`✅ Message ${msg.id} marked as read`);
          return true;
        } catch (error) {
          console.error(`❌ Error marking message ${msg.id} as read:`, error);
          return false;
        }
      });

      const results = await Promise.all(updatePromises);
      const successCount = results.filter(Boolean).length;
      
      console.log(`✅ ${successCount}/${unreadMessages.length} messages marked as read successfully`);
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      
      // If it's a permission error, show a more specific message
      if (error.code === 'PERMISSION_DENIED') {
        console.warn('⚠️ Permission denied when marking messages as read. This might be due to conversation completion or insufficient permissions.');
      }
      
      // Don't throw the error to prevent breaking the UI
    }
  }, [currentUser?.uid, selectedConversation?.id]);

  // Force reload conversations from Firebase (diagnostic function)
  const forceReloadConversations = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    
    try {
      const conversationsRef = ref(database, 'conversations');
      const { get } = await import('firebase/database');
      const snapshot = await get(conversationsRef);
      
      if (snapshot.exists()) {
        console.log('💾 Total conversations in Firebase:', snapshot.size);
        const allConversations = [];
        const regularConversations = [];
        const serviceConversations = [];
        
        snapshot.forEach((childSnapshot) => {
          const conversation = {
            id: childSnapshot.key,
            ...childSnapshot.val()
          };
          
          allConversations.push(conversation);
          
          if (conversation.participants?.[currentUser.uid]) {
            if (conversation.serviceOrderId) {
              serviceConversations.push(conversation);
            } else {
              regularConversations.push(conversation);
            }
          }
        });
        
        console.log('📊 Conversation analysis:', {
          total: allConversations.length,
          userParticipant: regularConversations.length + serviceConversations.length,
          regular: regularConversations.length,
          service: serviceConversations.length,
          conversationIds: regularConversations.map(c => c.id)
        });
        
        // Sort and update state
        regularConversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        serviceConversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        
        setConversations(regularConversations);
        setServiceConversations(serviceConversations);
        
        console.log('✅ Conversations force reloaded successfully');
        
        // Additional debug: check for conversations without proper lastMessage
        const incompleteConversations = regularConversations.filter(c => !c.lastMessage || !c.lastMessageTime);
        if (incompleteConversations.length > 0) {
          console.warn('⚠️ Found conversations without lastMessage/Time:', 
            incompleteConversations.map(c => ({ id: c.id, lastMessage: c.lastMessage, lastMessageTime: c.lastMessageTime }))
          );
        }
        
      } else {
        console.log('📭 No conversations found in Firebase database');
      }
    } catch (error) {
      console.error('❌ Error force reloading conversations:', error);
      console.log('🔧 Attempting alternative query method...');
      
      // Alternative approach: Use ordered query if permissions are the issue
      try {
        const { query, orderByChild } = await import('firebase/database');
        const orderedQuery = query(conversationsRef, orderByChild('lastMessageTime'));
        const orderedSnapshot = await get(orderedQuery);
        
        if (orderedSnapshot.exists()) {
          console.log('✅ Alternative query succeeded');
          const regularConversations = [];
          const serviceConversations = [];
          
          orderedSnapshot.forEach((childSnapshot) => {
            const conversation = {
              id: childSnapshot.key,
              ...childSnapshot.val()
            };
            
            if (conversation.participants?.[currentUser.uid]) {
              if (conversation.serviceOrderId) {
                serviceConversations.push(conversation);
              } else {
                regularConversations.push(conversation);
              }
            }
          });
          
          regularConversations.reverse(); // Since ordered by lastMessageTime, reverse for newest first
          serviceConversations.reverse();
          
          setConversations(regularConversations);
          setServiceConversations(serviceConversations);
          
          console.log('✅ Alternative conversations loaded:', {
            regular: regularConversations.length,
            service: serviceConversations.length
          });
        }
      } catch (altError) {
        console.error('❌ Alternative query also failed:', altError);
        showError('Erro ao carregar conversas. Verifique suas permissões.');
      }
    }
  }, [currentUser?.uid]);

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

    // Load messages from within the conversation document for Centrifugo compatibility
    const messagesRef = ref(database, `conversations/${selectedConversation.id}/messages`);
    
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const messagesData = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const messageData = {
            id: childSnapshot.key,
            ...childSnapshot.val()
          };
          
          // Debug: Log image messages
          if (messageData.type === 'image' && messageData.mediaUrl) {
            console.log('🖼️ Image message loaded:', {
              id: messageData.id,
              mediaUrl: messageData.mediaUrl,
              content: messageData.content,
              timestamp: messageData.timestamp
            });
          }
          
          messagesData.push(messageData);
        });
        
        // Sort messages by timestamp (oldest first)
        messagesData.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      }
      
      console.log('Messages loaded from conversation document:', messagesData.length);
      console.log('Image messages count:', messagesData.filter(m => m.type === 'image').length);
      setMessages(messagesData);
      
      // Mark messages as read when conversation is opened
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
      console.log('🔔 No conversation selected');
      currentActiveSubscription.current = null;
      return;
    }

    // If Centrifugo is not connected, still show a message but don't fail
    if (!isConnected) {
      return;
    }

    console.log('🔔 ACTIVATING SUBSCRIPTION FOR:', selectedConversation.id);
    
    // Get or create subscription for this conversation
    const subscription = getOrCreateSubscription(selectedConversation.id);
    currentActiveSubscription.current = subscription;

    return () => {
      // Don't clear subscription, just mark as inactive
      console.log('🔔 DEACTIVATING SUBSCRIPTION FOR:', selectedConversation.id);
      currentActiveSubscription.current = null;
    };
  }, [selectedConversation?.id, isConnected, subscribe, unsubscribe, currentUser?.uid]);

  // Global user subscription for receiving messages from any conversation
  const globalSubscriptionRef = useRef(null);
  
  // Subscription pool to manage multiple conversation subscriptions
  const subscriptionPool = useRef(new Map());
  const currentActiveSubscription = useRef(null);
  
  // Function to get or create subscription for a conversation
  const getOrCreateSubscription = useCallback((conversationId) => {
    const channelName = `conversation:${conversationId}`;
    
    // If subscription already exists in pool, return it
    if (subscriptionPool.current.has(channelName)) {
      console.log('🔔 Using existing subscription for:', channelName);
      return subscriptionPool.current.get(channelName);
    }
    
    // Create new subscription
    console.log('🔔 Creating new subscription for:', channelName);
    const subscription = subscribe(channelName, {
      onMessage: (data, ctx) => {
        
        // Handle different message types
        if (data.type === 'new_message') {
          // Add new message to local state
          setMessages(prev => {
            const messageExists = prev.some(msg => msg.id === data.message.id);
            if (!messageExists) {
              const updatedMessages = [...prev, data.message];
              
              // Mark message as read if it's from another user and conversation is active
              if (data.message.senderId !== currentUser.uid && 
                  readReceiptsEnabled) {
                setTimeout(() => {
                  markMessagesAsRead([data.message]);
                }, 100); // Small delay to ensure message is saved first
              }
              
              return updatedMessages;
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
              const conversationId = data.conversationId || selectedConversationRef.current?.id;
              if (!conversationId) return prev;

              const updated = { ...prev };
              
              if (!updated[conversationId]) {
                updated[conversationId] = {};
              }

              if (data.isTyping) {
                updated[conversationId][data.userId] = Date.now();
              } else {
                delete updated[conversationId][data.userId];
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
        // Remove from pool on error
        subscriptionPool.current.delete(channelName);
      }
    });
    
    // Store in pool
    subscriptionPool.current.set(channelName, subscription);
    return subscription;
  }, [subscribe, unsubscribe, currentUser?.uid]);
  
  // Function to clear all subscriptions
  const clearAllSubscriptions = useCallback(() => {
    console.log('🧹 Clearing all subscriptions');
    subscriptionPool.current.forEach((subscription, channelName) => {
      if (unsubscribe) {
        unsubscribe(channelName);
      }
    });
    subscriptionPool.current.clear();
    currentActiveSubscription.current = null;
  }, [unsubscribe]);
  
  useEffect(() => {
    if (!currentUser?.uid || !isConnected || !subscribe || !unsubscribe) return;

    const userChannel = `user:${currentUser.uid}`;
    
    // Check if subscription already exists
    if (globalSubscriptionRef.current) {
      console.log('🌐 Global subscription already exists, skipping...');
      return;
    }
    
    console.log('🌐 Subscribing to global user channel:', userChannel);

    const subscription = subscribe(userChannel, {
      onMessage: (data, ctx) => {
        console.log('🌐 Received global message notification:', data);
        console.log('🌐 Notification data type:', data.type);
        console.log('🌐 Message data:', data.message);
        console.log('🌐 Conversation ID:', data.conversationId);
        
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
            console.log('🔔 About to show notification for message:', message);
            console.log('🔔 Notification will show:', `New message from ${message.senderName || 'Someone'}`);
            
            showInfo(
              `${message.senderName || 'Alguém'} enviou uma mensagem`, 
              'Nova Mensagem',
              7000,
              {
                onClick: (data) => {
                  console.log('🔔 Notification clicked, navigating to:', data.conversationId);
                  // Navigate to messages page and select conversation
                  window.location.href = `/messages`;
                },
                data: { conversationId, messageId: message.id }
              }
            );

            // Send Firebase notification for persistence (since this only fires once)
            sendMessageNotification(
              currentUser.uid,
              message.senderId,
              message.senderName || 'Alguém',
              conversationId,
              message.content
            ).then(() => {
              console.log('✅ Firebase notification sent for message');
            }).catch((notificationError) => {
              console.error('❌ Error sending Firebase notification:', notificationError);
            });
            
            if (!conversationUpdated) {
              console.warn('⚠️ Received message for conversation not in local state:', conversationId);
              console.log('📝 This might indicate a state sync issue or new conversation creation');
            }
          }
        }
      },
      onSubscribed: (ctx) => {
        console.log('✅ Successfully subscribed to global user channel');
        globalSubscriptionRef.current = subscription;
      },
      onError: (ctx) => {
        console.error('❌ Error in global user subscription:', ctx);
        globalSubscriptionRef.current = null;
      }
    });

    return () => {
      console.log('🌐 Unsubscribing from global user channel:', userChannel);
      if (globalSubscriptionRef.current) {
        unsubscribe(userChannel);
        globalSubscriptionRef.current = null;
      }
    };
  }, [currentUser?.uid, isConnected, subscribe, unsubscribe]);

  // Cleanup global subscription on unmount
  useEffect(() => {
    return () => {
      if (globalSubscriptionRef.current && currentUser?.uid) {
        const userChannel = `user:${currentUser.uid}`;
        console.log('🧹 Cleaning up global subscription on unmount:', userChannel);
        if (unsubscribe) {
          unsubscribe(userChannel);
        }
        globalSubscriptionRef.current = null;
      }
    };
  }, [currentUser?.uid, unsubscribe]);

  // Cleanup conversation subscription on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Clearing all subscriptions on unmount');
      subscriptionPool.current.forEach((subscription, channelName) => {
        if (unsubscribe) {
          unsubscribe(channelName);
        }
      });
      subscriptionPool.current.clear();
      currentActiveSubscription.current = null;
    };
  }, [unsubscribe]);

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
    
    // Send typing indicator directly
    if (selectedConversation?.id && currentUser?.uid && isConnected && publish) {
      const channelName = `conversation:${selectedConversation.id}`;
      publish(channelName, {
        type: 'typing',
        userId: currentUser.uid,
        userName: currentUser.displayName || 'User',
        isTyping: true,
        timestamp: Date.now()
      }).catch(error => console.error('Error sending typing indicator:', error));
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [isTyping, selectedConversation?.id, currentUser, isConnected, publish]);

  const stopTyping = useCallback(() => {
    if (!isTyping) return; // Not typing

    setIsTyping(false);
    
    // Send typing indicator directly
    if (selectedConversation?.id && currentUser?.uid && isConnected && publish) {
      const channelName = `conversation:${selectedConversation.id}`;
      publish(channelName, {
        type: 'typing',
        userId: currentUser.uid,
        userName: currentUser.displayName || 'User',
        isTyping: false,
        timestamp: Date.now()
      }).catch(error => console.error('Error sending typing indicator:', error));
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, selectedConversation?.id, currentUser, isConnected, publish]);

  const handleTypingChange = useCallback((typing) => {
    if (typing) {
      if (isTyping) return; // Already typing
      
      setIsTyping(true);
      
      // Send typing indicator directly
      if (selectedConversation?.id && currentUser?.uid && isConnected && publish) {
        const channelName = `conversation:${selectedConversation.id}`;
        publish(channelName, {
          type: 'typing',
          userId: currentUser.uid,
          userName: currentUser.displayName || 'User',
          isTyping: true,
          timestamp: Date.now()
        }).catch(error => console.error('Error sending typing indicator:', error));
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        
        // Send typing indicator directly
        if (selectedConversation?.id && currentUser?.uid && isConnected && publish) {
          const channelName = `conversation:${selectedConversation.id}`;
          publish(channelName, {
            type: 'typing',
            userId: currentUser.uid,
            userName: currentUser.displayName || 'User',
            isTyping: false,
            timestamp: Date.now()
          }).catch(error => console.error('Error sending typing indicator:', error));
        }

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }, 3000);
    } else {
      // Reset timeout when user continues typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          
          // Send typing indicator directly
          if (selectedConversation?.id && currentUser?.uid && isConnected && publish) {
            const channelName = `conversation:${selectedConversation.id}`;
            publish(channelName, {
              type: 'typing',
              userId: currentUser.uid,
              userName: currentUser.displayName || 'User',
              isTyping: false,
              timestamp: Date.now()
            }).catch(error => console.error('Error sending typing indicator:', error));
          }

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
          }
        }, 3000);
      }
    }
  }, [isTyping, selectedConversation?.id, currentUser, isConnected, publish]);

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
    if (!currentUser?.uid || !otherUserId) {
      return null;
    }

    try {
      // Generate deterministic conversation ID
      const sorted = [currentUser.uid, otherUserId].sort();
      const cleanUserA = sorted[0].replace(/[.#$[\]]/g, '_');
      const cleanUserB = sorted[1].replace(/[.#$[\]]/g, '_');
      const conversationId = serviceOrderId ? 
        `conv_${cleanUserA}_${cleanUserB}_service_${serviceOrderId}` : 
        `conv_${cleanUserA}_${cleanUserB}`;


      // First check if conversation already exists in local state
      const allConversations = [...conversations, ...serviceConversations];
      const localExistingConversation = allConversations.find(conv => conv.id === conversationId);

      if (localExistingConversation) {
        return localExistingConversation;
      }

      // Check if conversation exists in Firebase Database
      const conversationRef = ref(database, `conversations/${conversationId}`);
      const { get } = await import('firebase/database');
      const conversationSnapshot = await get(conversationRef);

      if (conversationSnapshot.exists()) {
        const existingConversation = {
          id: conversationId,
          ...conversationSnapshot.val()
        };
        
        // Add to local state
        if (serviceOrderId) {
          setServiceConversations(prev => {
            const exists = prev.find(c => c.id === existingConversation.id);
            if (!exists) {
              return [existingConversation, ...prev];
            }
            return prev;
          });
        } else {
          setConversations(prev => {
            const exists = prev.find(c => c.id === existingConversation.id);
            if (!exists) {
              return [existingConversation, ...prev];
            }
            return prev;
          });
        }
        
        return existingConversation;
      }

      // Create new conversation using utility function
      const otherUser = { uid: otherUserId }; // Minimal user object for creation
      const newConversation = {
        id: conversationId,
        participants: { 
          [currentUser.uid]: true, 
          [otherUserId]: true 
        },
        lastMessage: '',
        lastMessageTime: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Add service order ID if provided
      if (serviceOrderId) {
        newConversation.serviceOrderId = serviceOrderId;
        newConversation.type = 'service';
      } else {
        newConversation.type = 'regular';
      }


      // Save to Firebase Realtime Database with messages structure for Centrifugo compatibility
      const newConversationRef = ref(database, `conversations/${conversationId}`);
      await set(newConversationRef, {
        participants: newConversation.participants,
        createdAt: newConversation.createdAt,
        lastMessage: newConversation.lastMessage,
        lastMessageTime: newConversation.lastMessageTime,
        lastSenderId: currentUser.uid,
        type: newConversation.type,
        ...(serviceOrderId && { serviceOrderId }),
        // Initialize messages structure for Centrifugo compatibility
        messages: {},
        messageCount: 0,
        lastActivity: Date.now()
      });

      // Conversations are stored in RTDB only

      // Add to local state immediately
      if (serviceOrderId) {
        setServiceConversations(prev => [newConversation, ...prev]);
      } else {
        setConversations(prev => [newConversation, ...prev]);
      }

      return newConversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      showError('Erro ao criar conversa');
      return null;
    }
  }, [currentUser, conversations, serviceConversations, showError]);

  // Create new conversation
  const createConversation = useCallback(async (conversationData) => {
    console.log('createConversation called with:', conversationData);
    
    if (!currentUser?.uid || !conversationData.participantIds?.length) {
      console.log('createConversation: Missing user or participants');
      return null;
    }

    try {
      const conversationsRef = ref(database, 'conversations');
      
      // For direct conversations, use deterministic approach
      if (conversationData.participantIds.length === 2 && conversationData.type !== 'service') {
        console.log('createConversation: Using deterministic approach for direct conversation');
        
        const otherUserId = conversationData.participantIds.find(id => id !== currentUser.uid);
        if (otherUserId) {
          // Use createOrGetConversation for deterministic behavior
          const conversation = await createOrGetConversation(otherUserId, null);
          if (conversation) {
            setSelectedConversation(conversation);
            setActiveTab('messages');
            return conversation;
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
      const messageId = `msg_${Date.now()}_${currentUser.uid}`;
      const messageData = {
        id: messageId,
        senderId: currentUser.uid,
        type: MESSAGE_TYPES.TEXT,
        content: text.trim(),
        timestamp: Date.now(),
        read: false,
        replyTo: replyToId || null
      };

      // Save message inside the conversation document for Centrifugo compatibility
      const conversationRef = ref(database, `conversations/${conversationId}`);
      const messageRef = ref(database, `conversations/${conversationId}/messages/${messageId}`);
      
      // Save the message
      await set(messageRef, messageData);

      // Update conversation metadata
      const conversationUpdates = {
        lastMessage: text.trim(),
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid,
        messageCount: serverTimestamp(), // Increment message count
        lastActivity: Date.now(),
        // Ensure participants are preserved
        [`participants/${currentUser.uid}`]: true
      };

      await update(conversationRef, conversationUpdates);
      
      console.log('💾 Conversation metadata updated:', conversationId, conversationUpdates);
      
      // Update local conversation state immediately to ensure UI consistency
      setConversations(prevConversations => {
        const updatedConversations = prevConversations.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              lastMessage: text.trim(),
              lastMessageTime: Date.now(),
              lastSenderId: currentUser.uid
            };
          }
          return conv;
        });
        
        // Re-sort by lastMessageTime
        updatedConversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        return updatedConversations;
      });

      // Publish message via Centrifugo for real-time delivery
      
      if (centrifugoAvailable && publish) {
        try {
          const channelName = `conversation:${conversationId}`;
          console.log('📤 PUBLISHING TO CHANNEL:', channelName);
          console.log('📤 MESSAGE DATA:', messageData);
          await publish(channelName, {
            type: 'new_message',
            message: messageData,
            conversationId: conversationId,
            timestamp: Date.now()
          });

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
                    ...messageData,
                    senderName: currentUser.displayName || currentUser.name || 'Alguém'
                  },
                  conversationId: conversationId,
                  timestamp: Date.now()
                });
                console.log('✅ Global notification sent to:', recipientId);
                
                // Push notification will be sent by the global subscription handler
                // to prevent duplicates
              } catch (globalError) {
                console.error('Error sending global notification to', recipientId, ':', globalError);
              }
            }
          }
        } catch (error) {
          // Disable Centrifugo if it fails consistently
          setCentrifugoAvailable(false);
        }
      } else {
        
        // Fallback: send notification directly via Firebase Database when Centrifugo is not available
        const conversation = conversations.find(c => c.id === conversationId) || 
                            serviceConversations.find(c => c.id === conversationId);
        
        if (conversation) {
          const participantIds = Object.keys(conversation.participants || {});
          const recipientIds = participantIds.filter(id => id !== currentUser.uid);
          
          for (const recipientId of recipientIds) {
            try {
              console.log('📧 Sending fallback notification to:', recipientId);
              
              // Push notification will be sent by the global subscription handler
              // to prevent duplicates
              console.log('✅ Fallback notification sent to:', recipientId);
            } catch (globalError) {
              console.error('Error sending fallback notification to', recipientId, ':', globalError);
            }
          }
        }
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

    // Check if this is a service conversation and if it's on hold
    if (selectedConversation.type === 'service' && selectedConversation.serviceOrderId) {
      try {
        // Get the service order status from Firestore
        const { doc, getDoc } = await import('firebase/firestore');
        const { firestore } = await import('../../config/firebase');
        
        const serviceOrderRef = doc(firestore, 'serviceOrders', selectedConversation.serviceOrderId);
        const serviceOrderSnap = await getDoc(serviceOrderRef);
        
        if (serviceOrderSnap.exists()) {
          const serviceOrderData = serviceOrderSnap.data();
          const status = serviceOrderData.status;
          
          // If the service order is pending acceptance, the conversation is on hold
          if (status === 'PENDING_ACCEPTANCE') {
            showError('Esta conversa está em espera. O vendedor ainda não aceitou o pedido.');
            return false;
          }
        }
      } catch (error) {
        console.error('Error checking service order status:', error);
        // Continue with message sending if we can't check the status
      }
    }

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
      
      // Check if it's a permission denied error for completed service
      if (error.code === 'PERMISSION_DENIED' && selectedConversation?.type === 'service') {
        showError('Esta conversa foi finalizada e não permite mais mensagens');
      } else {
        showError('Erro ao enviar mensagem');
      }
      
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

      // Use the same path structure as text messages for consistency
      const messageId = `msg_${Date.now()}_${currentUser.uid}`;
      const messageRef = ref(database, `conversations/${selectedConversation.id}/messages/${messageId}`);
      
      // Add the messageId to the messageData
      const completeMessageData = {
        id: messageId,
        ...messageData
      };
      
      // Save the message
      await set(messageRef, completeMessageData);

      const newMessage = completeMessageData;

      // Update conversation last message
      const lastMessageText = caption || `${type === MESSAGE_TYPES.IMAGE ? '📷 Foto' : 
                                       type === MESSAGE_TYPES.VIDEO ? '🎥 Vídeo' : 
                                       type === MESSAGE_TYPES.AUDIO ? '🎵 Áudio' : '📎 Arquivo'}`;
      
      // Update conversation metadata (same as text messages)
      const conversationRef = ref(database, `conversations/${selectedConversation.id}`);
      const conversationUpdates = {
        lastMessage: lastMessageText,
        lastMessageTime: Date.now(),
        lastSenderId: currentUser.uid,
        messageCount: serverTimestamp(), // Increment message count
        lastActivity: Date.now(),
        // Ensure participants are preserved
        [`participants/${currentUser.uid}`]: true
      };

      await update(conversationRef, conversationUpdates);
      
      console.log('💾 Media message saved and conversation metadata updated:', selectedConversation.id, conversationUpdates);

      // Update local conversation state immediately for UI consistency
      setConversations(prevConversations => {
        const updatedConversations = prevConversations.map(conv => {
          if (conv.id === selectedConversation.id) {
            return {
              ...conv,
              lastMessage: lastMessageText,
              lastMessageTime: Date.now(),
              lastSenderId: currentUser.uid
            };
          }
          return conv;
        });
        
        // Re-sort by lastMessageTime
        updatedConversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        return updatedConversations;
      });

      // Publish message via Centrifugo
      try {
        const channelName = `conversation:${selectedConversation.id}`;
        await publish(channelName, {
          type: 'new_message',
          message: newMessage,
          conversationId: selectedConversation.id,
          timestamp: Date.now()
        });

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
    
    // Return user data with fallback to basic info
    const userData = users[otherId];
    if (userData) {
      return {
        ...userData,
        // Ensure we have uid for consistency
        uid: otherId
      };
    }
    
    // Fallback: return basic user info with uid
    return {
      uid: otherId,
      displayName: `Usuário ${otherId.slice(0, 8)}`,
      name: `Usuário ${otherId.slice(0, 8)}`,
      photoURL: null,
      profilePictureURL: null
    };
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
    
    return Object.keys(conversationTyping).map(userId => {
      const user = users[userId];
      return {
        userId,
        name: user?.displayName || user?.name || `User ${userId.slice(0, 8)}`,
        timestamp: conversationTyping[userId]
      };
    });
  }, [selectedConversation?.id, typingUsers, users]);

  // Send service notification
  const sendServiceNotification = useCallback(async (serviceData) => {
    if (!currentUser?.uid) return;

    try {
      const notificationData = {
        id: `service_${serviceData.id}_${Date.now()}`,
        type: serviceData.status === 'PENDING_ACCEPTANCE' ? 'service_requested' : 
              serviceData.status === 'ACCEPTED' ? 'service_accepted' :
              serviceData.status === 'DELIVERED' ? 'service_delivered' :
              serviceData.status === 'CONFIRMED' ? 'service_completed' :
              serviceData.status === 'CANCELLED' ? 'service_declined' : 'service_update',
        orderId: serviceData.id,
        serviceName: serviceData.metadata?.serviceName || serviceData.serviceName || 'Serviço',
        vpAmount: serviceData.vpAmount,
        status: serviceData.status,
        description: serviceData.status === 'PENDING_ACCEPTANCE' ? 
          'Você recebeu um novo pedido de serviço' :
          serviceData.status === 'ACCEPTED' ? 
          'Seu pedido foi aceito pelo provedor' :
          serviceData.status === 'DELIVERED' ? 
          'O serviço foi entregue' :
          serviceData.status === 'CONFIRMED' ? 
          'O serviço foi concluído' :
          serviceData.status === 'CANCELLED' ? 
          'O pedido foi recusado' : 'Status do serviço atualizado',
        timestamp: serverTimestamp(),
        read: false,
        recipientId: serviceData.status === 'PENDING_ACCEPTANCE' ? serviceData.sellerId : serviceData.buyerId
      };

      // Save notification to RTDB
      const notificationRef = ref(database, `notifications/${notificationData.recipientId}/${notificationData.id}`);
      await set(notificationRef, notificationData);

      return notificationData;
    } catch (error) {
      console.error('Error sending service notification:', error);
    }
  }, [currentUser]);

  // Create service conversation when order is accepted
  const createServiceConversation = useCallback(async (serviceOrder) => {
    if (!currentUser?.uid) {
      console.error('❌ No current user - cannot create service conversation');
      return null;
    }

    if (!serviceOrder) {
      console.error('❌ No service order provided - cannot create service conversation');
      return null;
    }

    if (!serviceOrder.buyerId || !serviceOrder.sellerId || !serviceOrder.id) {
      console.error('❌ Invalid service order data - missing required fields:', {
        buyerId: serviceOrder.buyerId,
        sellerId: serviceOrder.sellerId,
        id: serviceOrder.id
      });
      return null;
    }

    try {
      console.log('Creating service conversation for order:', serviceOrder);
      console.log('Order buyerId:', serviceOrder.buyerId);
      console.log('Order sellerId:', serviceOrder.sellerId);
      console.log('Order id:', serviceOrder.id);
      
      const conversationId = generateConversationId(
        serviceOrder.buyerId, 
        serviceOrder.sellerId, 
        serviceOrder.id
      );
      console.log('Generated conversation ID:', conversationId);

      // Check if conversation already exists to prevent duplicates
      const existingConversation = serviceConversations.find(conv => 
        conv.id === conversationId || 
        (conv.serviceOrderId === serviceOrder.id && 
         conv.participants[serviceOrder.buyerId] && 
         conv.participants[serviceOrder.sellerId])
      );

      if (existingConversation) {
        console.log('Service conversation already exists:', existingConversation.id);
        return existingConversation;
      }

      // Get user data for initial message
      console.log('🔍 Loading user data for conversation...');
      const buyerUser = await getUserById(serviceOrder.buyerId);
      const sellerUser = await getUserById(serviceOrder.sellerId);
      
      console.log('🔍 Buyer user data:', buyerUser);
      console.log('🔍 Seller user data:', sellerUser);
      
      const buyerUsername = buyerUser?.username || buyerUser?.displayName || 'Comprador';
      const sellerUsername = sellerUser?.username || sellerUser?.displayName || 'Vendedor';
      const serviceName = serviceOrder.metadata?.serviceName || 'Serviço';
      
      console.log('🔍 Usernames:', { buyerUsername, sellerUsername, serviceName });
      
      const conversationData = {
        id: conversationId,
        type: 'service',
        participants: {
          [serviceOrder.buyerId]: true,
          [serviceOrder.sellerId]: true
        },
        serviceOrderId: serviceOrder.id,
        serviceName: serviceName,
        buyerId: serviceOrder.buyerId,
        sellerId: serviceOrder.sellerId,
        additionalFeatures: serviceOrder.additionalFeatures || [],
        createdAt: Date.now(),
        lastMessageTime: Date.now(),
        lastMessage: `Esta é a conversa do serviço "${serviceName}", entre @${sellerUsername} e @${buyerUsername}`,
        lastSenderId: serviceOrder.sellerId,
        unreadCount: { [serviceOrder.buyerId]: 0, [serviceOrder.sellerId]: 0 },
        isCompleted: false
      };

      // Save to RTDB with messages structure for Centrifugo compatibility
      const conversationRef = ref(database, `conversations/${conversationId}`);
      
      console.log('🚀 Saving service conversation to RTDB:', conversationId);
      console.log('🔍 Conversation data being saved:', {
        ...conversationData,
        messages: {},
        messageCount: 0,
        lastActivity: Date.now()
      });
      
      // Validate database connection
      if (!database) {
        console.error('❌ Database not initialized - cannot save conversation');
        return null;
      }
      
      try {
        await set(conversationRef, {
          ...conversationData,
          // Initialize messages structure for Centrifugo compatibility
          messages: {},
          messageCount: 0,
          lastActivity: Date.now()
        });
        
        console.log('✅ Service conversation saved to RTDB successfully:', conversationId);
      } catch (saveError) {
        console.error('❌ Error saving conversation to RTDB:', saveError);
        throw saveError;
      }
      
      // Verify it was saved by reading it back
      setTimeout(async () => {
        try {
          const savedConversationSnapshot = await get(conversationRef);
          if (savedConversationSnapshot.exists()) {
            console.log('✅ Verification: Service conversation exists in RTDB:', savedConversationSnapshot.val());
          } else {
            console.log('❌ Verification: Service conversation NOT found in RTDB');
          }
        } catch (verifyError) {
          console.error('❌ Error verifying service conversation:', verifyError);
        }
      }, 1000);

      // Service conversations are stored in RTDB only
      console.log('Service conversation saved to RTDB:', conversationId);

      // Add to local state immediately
      setServiceConversations(prev => [conversationData, ...prev]);
      console.log('Service conversation added to local state');

      return conversationData;
    } catch (error) {
      console.error('Error creating service conversation:', error);
      return null;
    }
  }, [currentUser, getUserById, serviceConversations]);

  // Mark service conversation as completed
  const markServiceConversationCompleted = useCallback(async (serviceOrderId) => {
    if (!currentUser?.uid) return;

    try {
      // Find the conversation by service order ID
      const conversation = serviceConversations.find(conv => conv.serviceOrderId === serviceOrderId);
      if (!conversation) return;

      const conversationRef = ref(database, `conversations/${conversation.id}`);
      await update(conversationRef, {
        isCompleted: true,
        completedAt: serverTimestamp(),
        lastMessage: 'Serviço concluído - conversa arquivada'
      });
    } catch (error) {
      console.error('Error marking service conversation as completed:', error);
    }
  }, [currentUser, serviceConversations]);

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
    
    // Service functions
    sendServiceNotification,
    createServiceConversation,
    markServiceConversationCompleted,
    
    // Typing functions
    handleTypingChange,
    startTyping,
    stopTyping,
    getTypingUsers,
    
    // Utilities
    getOtherParticipant,
    loadUserData,
    formatTime,
    forceReloadConversations,
    
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
    sendServiceNotification,
    createServiceConversation,
    markServiceConversationCompleted,
    markMessagesAsRead,
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
