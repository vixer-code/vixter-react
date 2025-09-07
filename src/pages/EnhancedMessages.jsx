import React, { useState, useEffect } from 'react';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useCentrifugo } from '../contexts/CentrifugoContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLocation, useParams } from 'react-router-dom';
import UserSelector from '../components/messaging/UserSelector';
import ChatInterface from '../components/messaging/ChatInterface';
import { 
  getConversationDisplayName, 
  formatLastMessageTime, 
  getLastMessagePreview,
  debugLog 
} from '../utils/conversation';
import './EnhancedMessages.css';

const EnhancedMessages = () => {
  const {
    conversations,
    serviceConversations,
    selectedConversation,
    loading,
    activeTab,
    setActiveTab,
    setSelectedConversation,
    isOnline,
    offlineMessages,
    users,
    loadUserData
  } = useEnhancedMessaging();
  
  const { isConnected, isConnecting } = useCentrifugo();
  const { currentUser } = useAuth();
  const { showInfo } = useNotification();
  const location = useLocation();
  const { conversationId } = useParams();
  
  // Debug mode toggle (can be controlled by environment variable or localStorage)
  const [debugMode] = useState(() => {
    return localStorage.getItem('vixter-debug') === 'true' || process.env.NODE_ENV === 'development';
  });
  
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Handle URL parameters for conversation selection
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      debugLog('URL parameter conversation', conversationId);
      
      // Find conversation in regular conversations
      let targetConversation = conversations.find(conv => conv.id === conversationId);
      
      // If not found, check service conversations
      if (!targetConversation && serviceConversations.length > 0) {
        targetConversation = serviceConversations.find(conv => conv.id === conversationId);
        if (targetConversation) {
          setActiveTab('services');
        }
      }
      
      if (targetConversation) {
        debugLog('Found conversation from URL, selecting', targetConversation.id);
        setSelectedConversation(targetConversation);
        // Only show mobile chat on mobile devices
        if (window.innerWidth <= 768) {
          setShowMobileChat(true);
        }
      } else {
        debugLog('Conversation not found', conversationId);
      }
    }
  }, [conversationId, conversations, serviceConversations, setSelectedConversation, setActiveTab, debugMode]);

  // Debug effect to track selectedConversation changes
  useEffect(() => {
    debugLog('selectedConversation changed', selectedConversation?.id);
  }, [selectedConversation, debugMode]);

  // Handle user selection
  const handleUserSelected = (conversation) => {
    debugLog('User selected, conversation', conversation);
    debugLog('Previous selectedConversation', selectedConversation?.id);
    
    if (!conversation || !conversation.id) {
      debugLog('Invalid conversation object received', conversation);
      showInfo('Erro: Conversa inválida', 'error');
      return;
    }
    
    setSelectedConversation(conversation);
    setShowUserSelector(false);
    setShowMobileChat(true);
    debugLog('UI state updated, mobile chat should show', conversation.id);
  };

  // Handle conversation selection
  const handleConversationSelect = (conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
  };

  // Close mobile chat and clear selected conversation
  const handleCloseMobileChat = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
  };

  // Helper functions now use utility functions from conversation.js
  // These are imported at the top of the file

  // Debug logging
  debugLog('EnhancedMessages render', {
    loading,
    conversationsCount: conversations.length,
    serviceConversationsCount: serviceConversations.length,
    selectedConversation: selectedConversation?.id,
    activeTab
  });

  if (loading) {
    return (
      <div className="enhanced-messages loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Carregando conversas...</p>
        </div>
      </div>
    );
  }

  // Guard clause to ensure users object is properly initialized
  if (!users || typeof users !== 'object' || Array.isArray(users)) {
    console.warn('Users object is not properly initialized:', { users, usersType: typeof users, conversationsCount: conversations.length });
    return (
      <div className="enhanced-messages loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Carregando dados dos usuários...</p>
        </div>
      </div>
    );
  }

  // Additional safety check - if users object becomes invalid during render, show loading
  if (Object.keys(users).length === 0 && conversations.length > 0) {
    console.warn('Users object is empty but conversations exist, showing loading state');
    return (
      <div className="enhanced-messages loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Carregando dados dos usuários...</p>
        </div>
      </div>
    );
  }

  // Debug logging for search operations
  console.log('EnhancedMessages render:', { 
    usersKeys: Object.keys(users), 
    conversationsCount: conversations.length,
    usersType: typeof users,
    isArray: Array.isArray(users),
    loading: loading,
    conversations: conversations.map(conv => ({
      id: conv.id,
      participants: conv.participants ? Object.keys(conv.participants) : 'no participants',
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime
    }))
  });

  // Check if we need to load missing user data
  const missingUserIds = [];
  if (users && typeof users === 'object' && !Array.isArray(users)) {
    conversations.forEach(conversation => {
      if (conversation.participants) {
        Object.keys(conversation.participants).forEach(participantId => {
          if (participantId !== currentUser?.uid && !users[participantId]) {
            missingUserIds.push(participantId);
          }
        });
      }
    });

    if (missingUserIds.length > 0) {
      console.log('Missing user data for participants:', missingUserIds);
      // Load missing user data
      missingUserIds.forEach(userId => {
        try {
          loadUserData(userId);
        } catch (error) {
          console.error('Error loading user data for participant:', error, userId);
        }
      });
    }
  } else {
    console.warn('Users object is invalid, cannot check for missing user data');
  }

  return (
    <div className="enhanced-messages">
      {/* Connection Status */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        <div className="status-indicator">
          <div className="status-dot"></div>
          <span>
            {isConnecting ? 'Conectando...' : 
             isConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
        {!isOnline && (
          <div className="offline-indicator">
            <span>📱 Modo offline - {offlineMessages.length} mensagem(ns) na fila</span>
          </div>
        )}
      </div>

      <div className="messages-container">
        {/* Conversations Sidebar */}
        <div className={`conversations-sidebar ${showMobileChat ? 'mobile-hidden' : ''}`}>
          <div className="sidebar-header">
            <h2>Mensagens</h2>
            <button
              className="new-chat-button"
              onClick={() => setShowUserSelector(true)}
              title="Nova conversa"
            >
              ✏️
            </button>
          </div>

          <div className="sidebar-tabs">
            <button
              className={`tab ${activeTab === 'messages' ? 'active' : ''}`}
              onClick={() => setActiveTab('messages')}
            >
              Conversas ({conversations.length})
            </button>
            <button
              className={`tab ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              Serviços ({serviceConversations.length})
            </button>
          </div>

          <div className="conversations-list">
            {activeTab === 'messages' ? (
              conversations.length === 0 || !Array.isArray(conversations) ? (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <p>Nenhuma conversa ainda</p>
                  <p style={{fontSize: '12px', opacity: 0.7}}>
                    Debug: Loading: {loading ? 'Yes' : 'No'}, 
                    Conversations: {conversations.length}, 
                    User: {currentUser?.uid ? 'Logged in' : 'Not logged in'}
                  </p>
                  <div style={{fontSize: '10px', opacity: 0.5, marginTop: '10px'}}>
                    Conversations: {JSON.stringify(conversations.map(c => ({id: c.id, participants: Object.keys(c.participants || {})})), null, 2)}
                  </div>
                  <button
                    className="start-conversation-button"
                    onClick={() => setShowUserSelector(true)}
                  >
                    Iniciar conversa
                  </button>
                  <button
                    className="start-conversation-button"
                    onClick={() => showInfo('Test notification!', 'Test', 3000)}
                    style={{marginTop: '10px', background: '#8A2BE2'}}
                  >
                    Test Notification
                  </button>
                </div>
              ) : (
                Array.isArray(conversations) ? conversations.map((conversation) => {
                  try {
                    // Additional safety checks
                    if (!conversation || !conversation.id) {
                      console.warn('Invalid conversation object:', conversation);
                      return null;
                    }
                    
                    // Ensure conversation.participants is valid before processing
                    if (!conversation.participants || typeof conversation.participants !== 'object') {
                      console.warn('Invalid conversation participants:', conversation);
                      return null;
                    }
                    
                    // Additional safety check for users object during rendering
                    if (!users || typeof users !== 'object' || Array.isArray(users)) {
                      console.warn('Users object became invalid during conversation rendering, skipping conversation:', conversation.id);
                      return (
                        <div
                          key={conversation.id}
                          className="conversation-item error"
                        >
                          <div className="conversation-content">
                            <div className="conversation-name">
                              Carregando...
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    const displayName = getConversationDisplayName(conversation, users, currentUser?.uid);
                    return (
                      <div
                        key={conversation.id}
                        className={`conversation-item ${
                          selectedConversation?.id === conversation.id ? 'active' : ''
                        }`}
                        onClick={() => handleConversationSelect(conversation)}
                      >
                        <div className="conversation-avatar">
                          <div className="default-avatar">
                            {displayName && displayName.length > 0 ? displayName.charAt(0).toUpperCase() : '?'}
                          </div>
                        </div>
                        <div className="conversation-content">
                          <div className="conversation-header">
                            <div className="conversation-name">
                              {displayName || 'Conversa sem nome'}
                            </div>
                            <div className="conversation-time">
                              {formatLastMessageTime(conversation.lastMessageTime)}
                            </div>
                          </div>
                          <div className="conversation-preview">
                            {getLastMessagePreview(conversation)}
                          </div>
                        </div>
                      </div>
                    );
                  } catch (error) {
                    console.error('Error rendering conversation:', error, { conversation, users, currentUser, usersType: typeof users });
                    return (
                      <div
                        key={conversation?.id || 'error-' + Math.random()}
                        className="conversation-item error"
                      >
                        <div className="conversation-content">
                          <div className="conversation-name">
                            Erro ao carregar conversa
                          </div>
                        </div>
                      </div>
                    );
                  }
                }).filter(Boolean) : []
              )
            ) : (
              serviceConversations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🛠️</div>
                  <p>Nenhuma conversa de serviço</p>
                </div>
              ) : (
                Array.isArray(serviceConversations) ? serviceConversations.map((conversation) => {
                  try {
                    // Additional safety checks
                    if (!conversation || !conversation.id) {
                      console.warn('Invalid service conversation object:', conversation);
                      return null;
                    }
                    
                    return (
                      <div
                        key={conversation.id}
                        className={`conversation-item ${
                          selectedConversation?.id === conversation.id ? 'active' : ''
                        }`}
                        onClick={() => handleConversationSelect(conversation)}
                      >
                        <div className="conversation-avatar">
                          <div className="service-avatar">🛠️</div>
                        </div>
                        <div className="conversation-content">
                          <div className="conversation-header">
                            <div className="conversation-name">
                              Serviço #{conversation.serviceOrderId || 'N/A'}
                            </div>
                            <div className="conversation-time">
                              {formatLastMessageTime(conversation.lastMessageTime)}
                            </div>
                          </div>
                          <div className="conversation-preview">
                            {getLastMessagePreview(conversation)}
                          </div>
                        </div>
                      </div>
                    );
                  } catch (error) {
                    console.error('Error rendering service conversation:', error, { conversation, users, currentUser });
                    return (
                      <div
                        key={conversation?.id || 'error-service-' + Math.random()}
                        className="conversation-item error"
                      >
                        <div className="conversation-content">
                          <div className="conversation-name">
                            Erro ao carregar serviço
                          </div>
                        </div>
                      </div>
                    );
                  }
                }).filter(Boolean) : []
              )
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <div className={`chat-container ${showMobileChat ? 'mobile-visible' : ''}`}>
          {/* Mobile back button */}
          {showMobileChat && (
            <button 
              className="mobile-back-button" 
              onClick={handleCloseMobileChat}
              title="Voltar para conversas"
            >
              ←
            </button>
          )}
          <ChatInterface
            conversation={selectedConversation}
            onClose={handleCloseMobileChat}
          />
        </div>
      </div>

      {/* User Selector Modal */}
      <UserSelector
        isOpen={showUserSelector}
        onClose={() => setShowUserSelector(false)}
        onUserSelected={handleUserSelected}
      />
    </div>
  );
};

export default EnhancedMessages;
