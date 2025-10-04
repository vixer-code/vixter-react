import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import useKycStatus from '../hooks/useKycStatus';
import { useEmailVerification } from '../hooks/useEmailVerification';

const EmailTicketContext = createContext({});

export const useEmailTicket = () => {
  const context = useContext(EmailTicketContext);
  if (!context) {
    throw new Error('useEmailTicket must be used within an EmailTicketProvider');
  }
  return context;
};

export const EmailTicketProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const { isKycVerified, isKycPending, isKycNotConfigured, getKycStatusMessage } = useKycStatus();
  const { emailVerified, loading: emailVerificationLoading } = useEmailVerification();
  
  // State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);

  // Cloud Functions
  const apiFunc = httpsCallable(functions, 'emailTicketApi');

  // Ticket categories
  const TICKET_CATEGORIES = [
    { id: 'payment', label: 'Pagamentos', icon: 'fas fa-credit-card', description: 'Problemas com pagamentos, reembolsos, VP, VBP' },
    { id: 'technical', label: 'Problemas Técnicos', icon: 'fas fa-bug', description: 'Erros, bugs, problemas de performance' },
    { id: 'account', label: 'Conta e Perfil', icon: 'fas fa-user', description: 'KYC, verificação, configurações de conta' },
    { id: 'content', label: 'Conteúdo e Packs', icon: 'fas fa-box', description: 'Problemas com packs, downloads, conteúdo' },
    { id: 'services', label: 'Serviços', icon: 'fas fa-tools', description: 'Problemas com marketplace de serviços' },
    { id: 'other', label: 'Outros', icon: 'fas fa-question', description: 'Outras questões não categorizadas' }
  ];

  // Ticket priorities
  const TICKET_PRIORITIES = [
    { id: 'low', label: 'Baixa', color: '#10B981', description: 'Questões gerais, sugestões' },
    { id: 'medium', label: 'Média', color: '#F59E0B', description: 'Problemas que afetam funcionalidades' },
    { id: 'high', label: 'Alta', color: '#EF4444', description: 'Problemas críticos que impedem uso' },
    { id: 'urgent', label: 'Urgente', color: '#DC2626', description: 'Problemas de segurança ou perda de dados' }
  ];

  // Ticket statuses
  const TICKET_STATUSES = [
    { id: 'open', label: 'Aberto', color: '#3B82F6', description: 'Ticket criado, aguardando análise' },
    { id: 'in_progress', label: 'Em Andamento', color: '#8B5CF6', description: 'Equipe trabalhando na solução' },
    { id: 'waiting_user', label: 'Aguardando Usuário', color: '#F59E0B', description: 'Aguardando resposta do usuário' },
    { id: 'resolved', label: 'Resolvido', color: '#10B981', description: 'Problema solucionado' },
    { id: 'closed', label: 'Fechado', color: '#6B7280', description: 'Ticket finalizado' }
  ];

  // Create new ticket
  const createTicket = useCallback(async (ticketData) => {
    if (!currentUser) {
      showError('Você precisa estar logado para criar um ticket');
      return null;
    }

    // Check KYC verification
    if (!isKycVerified) {
      const kycStatus = getKycStatusMessage();
      showError(`KYC obrigatório: ${kycStatus.message}. Complete a verificação para criar tickets de suporte.`);
      return null;
    }

    // Check email verification
    if (!emailVerified) {
      showError('Verificação de email obrigatória. Verifique seu email para criar tickets de suporte.');
      return null;
    }

    try {
      setCreating(true);

      const result = await apiFunc({
        resource: 'supportTicket',
        action: 'create',
        payload: {
          subject: ticketData.subject,
          description: ticketData.description,
          category: ticketData.category,
          priority: ticketData.priority || 'medium'
        }
      });

      if (result.data.success) {
        showSuccess('Ticket criado com sucesso! Você receberá um email de confirmação em breve.');
        // Reload tickets
        await loadTickets();
        return result.data.ticketId;
      } else {
        showError('Erro ao criar ticket');
        return null;
      }

    } catch (error) {
      console.error('Error creating ticket:', error);
      showError('Erro ao criar ticket. Tente novamente.');
      return null;
    } finally {
      setCreating(false);
    }
  }, [currentUser, showSuccess, showError, apiFunc, isKycVerified, emailVerified, getKycStatusMessage]);

  // Load user tickets
  const loadTickets = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const result = await apiFunc({
        resource: 'supportTicket',
        action: 'getUserTickets',
        payload: {}
      });

      if (result.data.success) {
        setTickets(result.data.tickets);
        setTicketsLoaded(true);
      } else {
        showError('Erro ao carregar tickets');
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      showError('Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
  }, [currentUser, showError, apiFunc]);

  // Get ticket by ID
  const getTicketById = useCallback(async (ticketId) => {
    if (!currentUser || !ticketId) return null;

    try {
      const result = await apiFunc({
        resource: 'supportTicket',
        action: 'getById',
        payload: { ticketId }
      });

      if (result.data.success) {
        return result.data.ticket;
      } else {
        showError('Erro ao carregar ticket');
        return null;
      }
    } catch (error) {
      console.error('Error getting ticket:', error);
      showError('Erro ao carregar ticket');
      return null;
    }
  }, [currentUser, showError, apiFunc]);


  // Get category display name
  const getCategoryDisplayName = useCallback((categoryId) => {
    const category = TICKET_CATEGORIES.find(cat => cat.id === categoryId);
    return category ? category.label : 'Outros';
  }, [TICKET_CATEGORIES]);

  // Get priority display name
  const getPriorityDisplayName = useCallback((priorityId) => {
    const priority = TICKET_PRIORITIES.find(pri => pri.id === priorityId);
    return priority ? priority.label : 'Média';
  }, [TICKET_PRIORITIES]);

  // Get status display name
  const getStatusDisplayName = useCallback((statusId) => {
    const status = TICKET_STATUSES.find(stat => stat.id === statusId);
    return status ? status.label : 'Aberto';
  }, [TICKET_STATUSES]);

  // Get priority color
  const getPriorityColor = useCallback((priorityId) => {
    const priority = TICKET_PRIORITIES.find(pri => pri.id === priorityId);
    return priority ? priority.color : '#F59E0B';
  }, [TICKET_PRIORITIES]);

  // Get status color
  const getStatusColor = useCallback((statusId) => {
    const status = TICKET_STATUSES.find(stat => stat.id === statusId);
    return status ? status.color : '#3B82F6';
  }, [TICKET_STATUSES]);

  // Format ticket ID for display
  const formatTicketId = useCallback((ticketId) => {
    return ticketId ? ticketId.toUpperCase() : '';
  }, []);

  // Format date for display
  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('pt-BR');
  }, []);

  // Load tickets on mount - only when user changes, not when loadTickets changes
  useEffect(() => {
    if (currentUser && !ticketsLoaded) {
      loadTickets();
      setTicketsLoaded(true);
    } else if (!currentUser) {
      setTicketsLoaded(false);
      setTickets([]);
    }
  }, [currentUser, ticketsLoaded]); // Only load once per user session

  const value = {
    // State
    tickets,
    loading,
    creating,
    selectedTicket,
    
    // Actions
    createTicket,
    loadTickets,
    getTicketById,
    setSelectedTicket,
    
    // Utilities
    getCategoryDisplayName,
    getPriorityDisplayName,
    getStatusDisplayName,
    getPriorityColor,
    getStatusColor,
    formatTicketId,
    formatDate,
    
    // Validation status
    isKycVerified,
    isKycPending,
    isKycNotConfigured,
    emailVerified,
    emailVerificationLoading,
    getKycStatusMessage,
    
    // Constants
    TICKET_CATEGORIES,
    TICKET_PRIORITIES,
    TICKET_STATUSES
  };

  return (
    <EmailTicketContext.Provider value={value}>
      {children}
    </EmailTicketContext.Provider>
  );
};
