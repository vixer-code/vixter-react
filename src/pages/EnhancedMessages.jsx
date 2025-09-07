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
    users
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
      
      const otherUserId = Object.keys(conversation.participants)
        .find(uid => uid !== currentUser?.uid);
      
      if (otherUserId && users && typeof users === 'object' && users[otherUserId]) {
        // Get user data from the enhanced messaging context users state
        const otherUser = users[otherUserId];
        return otherUser?.displayName || otherUser?.name || 'Usuário sem nome';
      }
      
      return 'Conversa sem nome';
    } catch (error) {
      console.error('Error getting conversation display name:', error);
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
              conversations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <p>Nenhuma conversa ainda</p>
                  <p style={{fontSize: '12px', opacity: 0.7}}>
                    Debug: Loading: {loading ? 'Yes' : 'No'}, 
                    Conversations: {conversations.length}, 
                    User: {currentUser?.uid ? 'Logged in' : 'Not logged in'}
                  </p>
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
                conversations.map((conversation) => {
                  try {
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
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="conversation-content">
                          <div className="conversation-header">
                            <div className="conversation-name">
                              {displayName}
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
                    console.error('Error rendering conversation:', error, conversation);
                    return (
                      <div
                        key={conversation.id}
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
                })
              )
            ) : (
              serviceConversations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🛠️</div>
                  <p>Nenhuma conversa de serviço</p>
                </div>
              ) : (
                serviceConversations.map((conversation) => {
                  try {
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
                    console.error('Error rendering service conversation:', error, conversation);
                    return (
                      <div
                        key={conversation.id}
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
                })
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
