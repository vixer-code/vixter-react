import React, { useState, useEffect } from 'react';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useCentrifugo } from '../contexts/CentrifugoContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLocation } from 'react-router-dom';
import UserSelector from '../components/messaging/UserSelector';
import ChatInterface from '../components/messaging/ChatInterface';
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
  
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Handle URL parameters for conversation selection
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const conversationIdFromUrl = searchParams.get('conversation');
    
    if (conversationIdFromUrl && conversations.length > 0) {
      console.log('🔗 URL parameter conversation:', conversationIdFromUrl);
      
      // Find conversation in regular conversations
      let targetConversation = conversations.find(conv => conv.id === conversationIdFromUrl);
      
      // If not found, check service conversations
      if (!targetConversation && serviceConversations.length > 0) {
        targetConversation = serviceConversations.find(conv => conv.id === conversationIdFromUrl);
        if (targetConversation) {
          setActiveTab('services');
        }
      }
      
      if (targetConversation) {
        console.log('✅ Found conversation from URL, selecting:', targetConversation.id);
        setSelectedConversation(targetConversation);
        // Only show mobile chat on mobile devices
        if (window.innerWidth <= 768) {
          setShowMobileChat(true);
        }
        
        // Clear URL parameter after handling
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else {
        console.warn('⚠️ Conversation not found:', conversationIdFromUrl);
      }
    }
  }, [conversations, serviceConversations, location.search, setSelectedConversation, setActiveTab]);

  // Debug effect to track selectedConversation changes
  useEffect(() => {
    console.log('🔄 selectedConversation changed to:', selectedConversation?.id);
  }, [selectedConversation]);

  // Handle user selection
  const handleUserSelected = (conversation) => {
    console.log('📱 EnhancedMessages: User selected, conversation:', conversation);
    console.log('📱 Previous selectedConversation:', selectedConversation?.id);
    setSelectedConversation(conversation);
    setShowUserSelector(false);
    setShowMobileChat(true);
    console.log('📱 EnhancedMessages: UI state updated, mobile chat should show');
    
    // Force a small delay to ensure state has updated
    setTimeout(() => {
      console.log('📱 Current selectedConversation after update:', selectedConversation?.id);
    }, 100);
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

  // Get conversation display name
  const getConversationDisplayName = (conversation) => {
    try {
      if (!conversation) {
        return 'Conversa sem nome';
      }
      
      if (conversation.name) {
        return conversation.name;
      }
      
      if (!conversation.participants || typeof conversation.participants !== 'object') {
        return 'Conversa sem nome';
      }
      
      let participantIds;
      try {
        participantIds = Object.keys(conversation.participants);
      } catch (keysError) {
        console.warn('Error getting participant keys:', keysError, { conversation });
        return 'Conversa sem nome';
      }
      
      if (!participantIds || participantIds.length === 0) {
        return 'Conversa sem nome';
      }
      
      let otherUserId;
      try {
        otherUserId = participantIds.find(uid => uid !== currentUser?.uid);
      } catch (findError) {
        console.warn('Error finding other user ID:', findError, { participantIds, currentUser });
        return 'Conversa sem nome';
      }
      
      if (otherUserId) {
        // Always return fallback first to prevent any errors
        const fallbackName = `Usuário ${otherUserId.slice(0, 8)}`;
        
        // Try to get user data, but don't fail if users object is not available
        try {
          // Additional safety check for users object
          if (users && typeof users === 'object' && !Array.isArray(users) && users.hasOwnProperty(otherUserId) && users[otherUserId]) {
            const otherUser = users[otherUserId];
            if (otherUser && typeof otherUser === 'object') {
              return otherUser?.displayName || otherUser?.name || fallbackName;
            }
          } else {
            // User data not available, trigger loading only if users object is valid
            if (users && typeof users === 'object' && !Array.isArray(users)) {
              console.log('User data not available, triggering load for:', otherUserId);
              loadUserData(otherUserId);
            } else {
              console.warn('Users object is invalid, cannot load user data for:', otherUserId);
            }
          }
        } catch (userAccessError) {
          console.warn('Error accessing user data:', userAccessError, { otherUserId, users, usersType: typeof users });
        }
        
        // Fallback to showing partial user ID if users data is not available
        return fallbackName;
      }
      
      return 'Conversa sem nome';
    } catch (error) {
      console.error('Error getting conversation display name:', error, { conversation, users, currentUser, usersType: typeof users });
      return 'Conversa sem nome';
    }
  };

  // Get conversation last message preview
  const getLastMessagePreview = (conversation) => {
    if (!conversation.lastMessage) {
      return 'Nenhuma mensagem';
    }
    
    const maxLength = 50;
    if (conversation.lastMessage.length <= maxLength) {
      return conversation.lastMessage;
    }
    
    return conversation.lastMessage.substring(0, maxLength) + '...';
  };

  // Format last message time
  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Agora';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };

  // Debug logging
  console.log('EnhancedMessages render:', {
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
                    
                    const displayName = getConversationDisplayName(conversation);
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
