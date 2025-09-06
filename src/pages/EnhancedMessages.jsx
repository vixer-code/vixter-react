import React, { useState, useEffect } from 'react';
import { useEnhancedMessaging } from '../contexts/EnhancedMessagingContext';
import { useCentrifugo } from '../contexts/CentrifugoContext';
import { useAuth } from '../contexts/AuthContext';
import UserSelector from '../components/messaging/UserSelector';
import ChatInterface from '../components/messaging/ChatInterface';
import DebugMessaging from '../components/DebugMessaging';
import CorsTest from '../components/CorsTest';
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
    offlineMessages
  } = useEnhancedMessaging();
  
  const { isConnected, isConnecting } = useCentrifugo();
  const { currentUser } = useAuth();
  
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Handle user selection
  const handleUserSelected = (conversation) => {
    setSelectedConversation(conversation);
    setShowUserSelector(false);
    setShowMobileChat(true);
  };

  // Handle conversation selection
  const handleConversationSelect = (conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
  };

  // Close mobile chat
  const handleCloseMobileChat = () => {
    setShowMobileChat(false);
  };

  // Get conversation display name
  const getConversationDisplayName = (conversation) => {
    if (conversation.name) {
      return conversation.name;
    }
    
    const otherUserId = Object.keys(conversation.participants || {})
      .find(uid => uid !== currentUser?.uid);
    
    if (otherUserId) {
      const otherUser = conversations.find(conv => 
        Object.keys(conv.participants || {}).includes(otherUserId)
      );
      return otherUser?.displayName || 'Usuário sem nome';
    }
    
    return 'Conversa sem nome';
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
      {/* Debug Component */}
      <DebugMessaging />
      {/* CORS Test Component */}
      <CorsTest />
      
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
                  <button
                    className="start-conversation-button"
                    onClick={() => setShowUserSelector(true)}
                  >
                    Iniciar conversa
                  </button>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`conversation-item ${
                      selectedConversation?.id === conversation.id ? 'active' : ''
                    }`}
                    onClick={() => handleConversationSelect(conversation)}
                  >
                    <div className="conversation-avatar">
                      <div className="default-avatar">
                        {getConversationDisplayName(conversation).charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="conversation-content">
                      <div className="conversation-header">
                        <div className="conversation-name">
                          {getConversationDisplayName(conversation)}
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
                ))
              )
            ) : (
              serviceConversations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🛠️</div>
                  <p>Nenhuma conversa de serviço</p>
                </div>
              ) : (
                serviceConversations.map((conversation) => (
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
                          Serviço #{conversation.serviceOrderId}
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
                ))
              )
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <div className={`chat-container ${showMobileChat ? 'mobile-visible' : ''}`}>
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
