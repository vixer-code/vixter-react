import React, { useState, useEffect } from 'react';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useCentrifugo } from '../contexts/CentrifugoContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLocation, useParams } from 'react-router-dom';
import UserSelector from '../components/messaging/UserSelector';
import ChatInterface from '../components/messaging/ChatInterface';
import OnlineUsersList from '../components/messaging/OnlineUsersList';
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Remove header padding for messages page
  useEffect(() => {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.classList.add('no-header-padding');
      mainContent.classList.add('messages-page');
    }
    
    return () => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.classList.remove('no-header-padding');
        mainContent.classList.remove('messages-page');
      }
    };
  }, []);

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

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // If switching to desktop, hide mobile chat
      if (!mobile && showMobileChat) {
        setShowMobileChat(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showMobileChat]);

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
    
    // Load user data for the other participant if not already loaded
    if (conversation?.participants && currentUser?.uid) {
      const participantIds = Object.keys(conversation.participants);
      const otherId = participantIds.find(id => id !== currentUser.uid);
      
      if (otherId && !users[otherId]) {
        // Load user data asynchronously
        loadUserData(otherId).catch(error => {
          console.error('Error loading user data for conversation:', error);
        });
      }
    }
    
    // Only show mobile chat on mobile devices
    if (isMobile) {
      setShowMobileChat(true);
    }
  };

  // Close mobile chat and return to conversations list
  const handleCloseMobileChat = () => {
    setShowMobileChat(false);
    // Don't clear selected conversation - keep it for desktop view
    // setSelectedConversation(null);
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

  // Simplified guard clause - only show loading if users object is completely invalid
  if (users === null || users === undefined) {
    console.warn('Users object is null/undefined, showing loading state');
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
        {selectedConversation?.type === 'service' && selectedConversation?.serviceOrderId && (
          <div className="service-status-indicator">
            <span>🛠️ Conversa de serviço - Aguardando aceitação do vendedor</span>
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
            <button
              className={`tab ${activeTab === 'online' ? 'active' : ''}`}
              onClick={() => setActiveTab('online')}
            >
              Online agora
            </button>
          </div>

          <div className="conversations-list">
            {activeTab === 'messages' ? (
              conversations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <p>Nenhuma conversa ainda</p>
                  <button
                    className="start-conversation-button"
                    onClick={() => setShowUserSelector(true)}
                  >
                    Iniciar conversa
                  </button>
                </div>
              ) : (
                conversations.map((conversation) => {
                  if (!conversation || !conversation.id) {
                    return null;
                  }
                  
                  const displayName = getConversationDisplayName(conversation, users || {}, currentUser?.uid);
                  
                  return (
                    <div
                      key={conversation.id}
                      className={`conversation-item ${
                        selectedConversation?.id === conversation.id ? 'active' : ''
                      }`}
                      onClick={() => handleConversationSelect(conversation)}
                    >
                      <div className="conversation-avatar">
                        {(() => {
                          // Get other participant data for avatar
                          const participantIds = Object.keys(conversation.participants || {});
                          const otherId = participantIds.find(id => id !== currentUser?.uid);
                          const otherUser = otherId ? users[otherId] : null;
                          
                          if (otherUser?.photoURL) {
                            return (
                              <img 
                                src={otherUser.photoURL} 
                                alt={displayName || 'Usuário'} 
                                className="user-avatar-img"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            );
                          }
                          
                          return (
                            <div className="default-avatar">
                              {displayName && displayName.length > 0 ? displayName.charAt(0).toUpperCase() : '?'}
                            </div>
                          );
                        })()}
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
                }).filter(Boolean)
              )
            ) : activeTab === 'online' ? (
              <OnlineUsersList 
                onUserSelect={handleUserSelected}
                currentUser={currentUser}
              />
            ) : (
              serviceConversations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🛠️</div>
                  <p>Nenhuma conversa de serviço</p>
                </div>
              ) : (
                serviceConversations.map((conversation) => {
                  if (!conversation || !conversation.id) {
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
                }).filter(Boolean)
              )
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <div className={`chat-container ${showMobileChat ? 'mobile-visible' : ''} ${selectedConversation ? 'has-conversation' : ''}`}>
          {/* Mobile back button */}
          {showMobileChat && (
            <button 
              className="mobile-back-button" 
              onClick={handleCloseMobileChat}
              title="Voltar para conversas"
              aria-label="Voltar para lista de conversas"
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
