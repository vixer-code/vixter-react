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
  getLastMessagePreview
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
    loadUserData,
    forceReloadConversations
  } = useEnhancedMessaging();
  
  const { isConnected, isConnecting } = useCentrifugo();
  const { currentUser } = useAuth();
  const { showInfo } = useNotification();
  const location = useLocation();
  const { conversationId } = useParams();
  
  
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Force desktop mode for debugging
  const isDesktop = !isMobile && window.innerWidth > 768;

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
        setSelectedConversation(targetConversation);
        // Only show mobile chat on mobile devices
        if (window.innerWidth <= 768) {
          setShowMobileChat(true);
        }
      }
    }
  }, [conversationId, conversations, serviceConversations, setSelectedConversation, setActiveTab]);


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
    if (!conversation || !conversation.id) {
      showInfo('Erro: Conversa inválida', 'error');
      return;
    }
    
    setSelectedConversation(conversation);
    setShowUserSelector(false);
    setShowMobileChat(true);
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
    
    // Show mobile chat on mobile devices, on desktop it's always visible
    if (isMobile) {
      setShowMobileChat(true);
    } else {
      // On desktop, we don't use showMobileChat, the chat container is always visible
      // Only the ChatInterface content changes based on selectedConversation
      setShowMobileChat(false);
    }
  };

  // Close mobile chat and return to conversations list
  const handleCloseMobileChat = () => {
    setShowMobileChat(false);
    // Clear selected conversation to return to main menu
    setSelectedConversation(null);
  };

  // Helper functions now use utility functions from conversation.js
  // These are imported at the top of the file

  // Get account type badge for user
  const getAccountTypeBadge = (user) => {
    if (!user?.accountType) return null;
    
    switch (user.accountType) {
      case 'provider':
        return <span className="account-badge provider">Vendedor</span>;
      case 'client':
        return <span className="account-badge client">Cliente</span>;
      case 'both':
        return <span className="account-badge both">Ambos</span>;
      default:
        return null;
    }
  };

  // Get KYC badge for user
  const getKycBadge = (user) => {
    if (user?.kyc === true) {
      return <span className="kyc-badge">✓ Verificado</span>;
    }
    return null;
  };


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
    return (
      <div className="enhanced-messages loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Carregando dados dos usuários...</p>
        </div>
      </div>
    );
  }


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
      // Load missing user data
      missingUserIds.forEach(userId => {
        try {
          loadUserData(userId);
        } catch (error) {
          console.error('Error loading user data for participant:', error, userId);
        }
      });
    }
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
            <div className="header-actions">
              <button
                className="new-chat-button"
                onClick={() => setShowUserSelector(true)}
                title="Nova conversa"
              >
                ✏️
              </button>
            </div>
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
                  <p style={{ fontSize: '12px', color: '#666' }}>
                    Use o botão ✏️ para nova conversa
                  </p>
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
                          
                          // Try both photoURL and profilePictureURL
                          const imageUrl = otherUser?.photoURL || otherUser?.profilePictureURL;
                          
                          if (imageUrl) {
                            return (
                              <img 
                                src={imageUrl} 
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
                        <div className="conversation-badges">
                          {(() => {
                            const participantIds = Object.keys(conversation.participants || {});
                            const otherId = participantIds.find(id => id !== currentUser?.uid);
                            const otherUser = otherId ? users[otherId] : null;
                            
                            return (
                              <>
                                {getAccountTypeBadge(otherUser)}
                                {getKycBadge(otherUser)}
                              </>
                            );
                          })()}
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

        {/* Chat Interface - moved to be sibling of sidebar for desktop */}
        <div 
          className={`chat-container ${showMobileChat ? 'mobile-visible' : ''} ${selectedConversation ? 'has-conversation' : ''} ${isDesktop ? 'desktop-always-visible' : ''}`}
          style={isDesktop ? { 
            display: 'flex',
            flex: '1',
            visibility: 'visible',
            position: 'relative',
            opacity: 1,
            minWidth: '300px',
            height: '100%',
            flexDirection: 'column'
          } : {}}
        >
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
