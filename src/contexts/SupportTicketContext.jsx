import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref,
  push,
  set,
  onValue,
  off
} from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, database, functions } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { useEnhancedMessaging } from './EnhancedMessagingContext';

const SupportTicketContext = createContext({});

export const useSupportTicket = () => {
  const context = useContext(SupportTicketContext);
  if (!context) {
    throw new Error('useSupportTicket must be used within a SupportTicketProvider');
  }
  return context;
};

export const SupportTicketProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const { createConversation, sendMessage } = useEnhancedMessaging();
  
  // State
  const [tickets, setTickets] = useState([]);
  const [userTickets, setUserTickets] = useState([]);
  const [adminTickets, setAdminTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);

  // Cloud Functions
  const apiFunc = httpsCallable(functions, 'api');

  // Ticket categories
  const TICKET_CATEGORIES = [
    { id: 'payment', label: 'Pagamentos', icon: 'fas fa-credit-card' },
    { id: 'technical', label: 'Problemas Técnicos', icon: 'fas fa-bug' },
    { id: 'account', label: 'Conta e Perfil', icon: 'fas fa-user' },
    { id: 'content', label: 'Conteúdo e Packs', icon: 'fas fa-box' },
    { id: 'other', label: 'Outros', icon: 'fas fa-question' }
  ];

  // Ticket priorities
  const TICKET_PRIORITIES = [
    { id: 'low', label: 'Baixa', color: '#10B981' },
    { id: 'medium', label: 'Média', color: '#F59E0B' },
    { id: 'high', label: 'Alta', color: '#EF4444' },
    { id: 'urgent', label: 'Urgente', color: '#DC2626' }
  ];

  // Ticket statuses
  const TICKET_STATUSES = [
    { id: 'open', label: 'Aberto', color: '#3B82F6' },
    { id: 'in_progress', label: 'Em Andamento', color: '#8B5CF6' },
    { id: 'waiting_user', label: 'Aguardando Usuário', color: '#F59E0B' },
    { id: 'resolved', label: 'Resolvido', color: '#10B981' },
    { id: 'closed', label: 'Fechado', color: '#6B7280' }
  ];

  // Check if user is admin
  const isAdmin = useCallback(() => {
    if (!currentUser) return false;
    // Add your admin UIDs here
    const adminUIDs = ['admin_uid_1', 'admin_uid_2']; // Replace with actual admin UIDs
    return adminUIDs.includes(currentUser.uid);
  }, [currentUser]);

  // Create new ticket
  const createTicket = useCallback(async (ticketData) => {
    if (!currentUser) {
      showError('Você precisa estar logado para criar um ticket');
      return null;
    }

    try {
      setCreating(true);

      const ticket = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || 'Usuário',
        subject: ticketData.subject,
        description: ticketData.description,
        category: ticketData.category,
        priority: ticketData.priority || 'medium',
        status: 'open',
        assignedTo: null,
        attachments: ticketData.attachments || [],
        metadata: {
          userAgent: navigator.userAgent,
          platform: 'web',
          version: '1.0.0'
        },
        timestamps: {
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      };

      // Create ticket in Firestore
      const ticketRef = await addDoc(collection(db, 'supportTickets'), ticket);
      const ticketId = ticketRef.id;

      // Create conversation for this ticket
      const conversationId = `conv_${currentUser.uid}_admin_ticket_${ticketId}`;
      
      // Create conversation object
      const conversation = {
        id: conversationId,
        participants: {
          [currentUser.uid]: true,
          'admin': true // Placeholder for admin assignment
        },
        metadata: {
          ticketId: ticketId,
          type: 'support',
          createdAt: Date.now()
        },
        lastMessage: {
          content: ticketData.description,
          timestamp: Date.now(),
          senderId: currentUser.uid
        }
      };

      // Save conversation to RTDB
      const conversationRef = ref(database, `conversations/${conversationId}`);
      await set(conversationRef, conversation);

      // Update ticket with conversation ID
      await updateDoc(ticketRef, {
        conversationId: conversationId,
        'timestamps.updatedAt': serverTimestamp()
      });

      // Send notification to admins
      await sendTicketNotification(ticketId, 'new_ticket');

      showSuccess('Ticket criado com sucesso! Nossa equipe entrará em contato em breve.');
      return ticketId;

    } catch (error) {
      console.error('Error creating ticket:', error);
      showError('Erro ao criar ticket. Tente novamente.');
      return null;
    } finally {
      setCreating(false);
    }
  }, [currentUser, showSuccess, showError]);

  // Load user tickets
  const loadUserTickets = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const ticketsRef = collection(db, 'supportTickets');
      const q = query(
        ticketsRef,
        where('userId', '==', currentUser.uid),
        orderBy('timestamps.createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ticketsData = [];
        snapshot.forEach((doc) => {
          ticketsData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setUserTickets(ticketsData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading user tickets:', error);
      showError('Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
  }, [currentUser, showError]);

  // Load admin tickets (for admin users)
  const loadAdminTickets = useCallback(async () => {
    if (!isAdmin()) return;

    try {
      setLoading(true);
      const ticketsRef = collection(db, 'supportTickets');
      const q = query(
        ticketsRef,
        orderBy('timestamps.createdAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ticketsData = [];
        snapshot.forEach((doc) => {
          ticketsData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setAdminTickets(ticketsData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading admin tickets:', error);
      showError('Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, showError]);

  // Update ticket status (admin only)
  const updateTicketStatus = useCallback(async (ticketId, updates) => {
    if (!isAdmin()) {
      showError('Apenas administradores podem atualizar tickets');
      return false;
    }

    try {
      setUpdating(true);
      
      const ticketRef = doc(db, 'supportTickets', ticketId);
      await updateDoc(ticketRef, {
        ...updates,
        'timestamps.updatedAt': serverTimestamp()
      });

      // Send notification to user
      await sendTicketNotification(ticketId, 'status_update', updates);

      showSuccess('Ticket atualizado com sucesso');
      return true;
    } catch (error) {
      console.error('Error updating ticket:', error);
      showError('Erro ao atualizar ticket');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [isAdmin, showSuccess, showError]);

  // Assign ticket to admin
  const assignTicket = useCallback(async (ticketId, adminId) => {
    if (!isAdmin()) {
      showError('Apenas administradores podem atribuir tickets');
      return false;
    }

    try {
      setUpdating(true);
      
      const ticketRef = doc(db, 'supportTickets', ticketId);
      await updateDoc(ticketRef, {
        assignedTo: adminId,
        status: 'in_progress',
        'timestamps.updatedAt': serverTimestamp()
      });

      showSuccess('Ticket atribuído com sucesso');
      return true;
    } catch (error) {
      console.error('Error assigning ticket:', error);
      showError('Erro ao atribuir ticket');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [isAdmin, showSuccess, showError]);

  // Send ticket notification
  const sendTicketNotification = useCallback(async (ticketId, type, data = {}) => {
    try {
      const result = await apiFunc({
        resource: 'supportTicket',
        action: 'sendNotification',
        payload: {
          ticketId,
          type,
          data
        }
      });
      return result.data.success;
    } catch (error) {
      console.error('Error sending ticket notification:', error);
      return false;
    }
  }, [apiFunc]);

  // Load ticket messages
  const loadTicketMessages = useCallback(async (ticketId) => {
    if (!ticketId) return;

    try {
      const conversationId = `conv_${currentUser.uid}_admin_ticket_${ticketId}`;
      const messagesRef = ref(database, `conversations/${conversationId}/messages`);
      
      const unsubscribe = onValue(messagesRef, (snapshot) => {
        const messagesData = [];
        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            messagesData.push({
              id: childSnapshot.key,
              ...childSnapshot.val()
            });
          });
          
          // Sort by timestamp
          messagesData.sort((a, b) => a.timestamp - b.timestamp);
        }
        setTicketMessages(messagesData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading ticket messages:', error);
      showError('Erro ao carregar mensagens do ticket');
    }
  }, [currentUser]);

  // Send message to ticket
  const sendTicketMessage = useCallback(async (ticketId, message, isInternal = false) => {
    if (!currentUser || !ticketId || !message.trim()) return false;

    try {
      const conversationId = `conv_${currentUser.uid}_admin_ticket_${ticketId}`;
      
      // Use existing messaging system
      const success = await sendMessage(message, conversationId);
      
      if (success) {
        // Update ticket last activity
        const ticketRef = doc(db, 'supportTickets', ticketId);
        await updateDoc(ticketRef, {
          'timestamps.updatedAt': serverTimestamp()
        });

        // Send notification
        await sendTicketNotification(ticketId, 'new_message', { isInternal });
      }

      return success;
    } catch (error) {
      console.error('Error sending ticket message:', error);
      showError('Erro ao enviar mensagem');
      return false;
    }
  }, [currentUser, sendMessage, sendTicketNotification, showError]);

  // Get ticket by ID
  const getTicketById = useCallback(async (ticketId) => {
    try {
      const ticketRef = doc(db, 'supportTickets', ticketId);
      const ticketSnap = await getDoc(ticketRef);
      
      if (ticketSnap.exists()) {
        return {
          id: ticketSnap.id,
          ...ticketSnap.data()
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting ticket:', error);
      return null;
    }
  }, []);

  // Load tickets on mount
  useEffect(() => {
    if (currentUser) {
      loadUserTickets();
      if (isAdmin()) {
        loadAdminTickets();
      }
    }
  }, [currentUser, loadUserTickets, loadAdminTickets, isAdmin]);

  const value = {
    // State
    tickets: isAdmin() ? adminTickets : userTickets,
    userTickets,
    adminTickets,
    loading,
    creating,
    updating,
    selectedTicket,
    ticketMessages,
    
    // Actions
    createTicket,
    updateTicketStatus,
    assignTicket,
    loadTicketMessages,
    sendTicketMessage,
    getTicketById,
    setSelectedTicket,
    
    // Utilities
    isAdmin,
    TICKET_CATEGORIES,
    TICKET_PRIORITIES,
    TICKET_STATUSES
  };

  return (
    <SupportTicketContext.Provider value={value}>
      {children}
    </SupportTicketContext.Provider>
  );
};
